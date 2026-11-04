-- Automação documental: fila privada, versões e envios controlados. Não enfileira histórico.
create table private.automacao_config(id boolean primary key default true check(id),habilitada boolean not null default false);
insert into private.automacao_config(id) values(true);
create table private.documento_jobs(
 id uuid primary key default gen_random_uuid(),tipo text not null check(tipo in('oficios','declaracoes','declaracoes_resposta')),
 documento_id uuid not null,usuario_id uuid not null references auth.users(id),versao integer not null check(versao>0),
 etapa text not null check(etapa in('pdf','email')),
 estado text not null default 'pendente' check(estado in('pendente','processando','concluido','erro_recuperavel','bloqueado_configuracao','envio_a_confirmar','cancelado')),
 snapshot jsonb not null,html text,pdf_path text,pdf_sha256 text,pdf_base64 text,email_solicitado boolean not null default false,envio_manual boolean not null default false,
 email_destino text,provider_id text,envio_iniciado_em timestamptz,
 tentativas integer not null default 0,disponivel_em timestamptz not null default now(),lease_token uuid,lease_ate timestamptz,
 erro_codigo text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tipo,documento_id,versao,etapa)
);
create index documento_jobs_prontos on private.documento_jobs(estado,disponivel_em,created_at);
create index documento_jobs_documento on private.documento_jobs(tipo,documento_id,versao);
create table private.automacao_tickets(token_hash text primary key,expira_em timestamptz not null,modo text not null check(modo in('processar','verificar','auditar')),indice integer not null check(indice between 0 and 14));
create table private.automacao_mail_tickets(token_hash text primary key,job_id uuid not null references private.documento_jobs(id) on delete cascade,lease_token uuid not null,expira_em timestamptz not null,envelope_lido_em timestamptz,envio_autorizado_em timestamptz);
alter table private.automacao_mail_tickets enable row level security;
revoke all on private.automacao_mail_tickets from public,anon,authenticated;
alter table private.automacao_config enable row level security;
alter table private.documento_jobs enable row level security;
alter table private.automacao_tickets enable row level security;
revoke all on private.automacao_config,private.documento_jobs,private.automacao_tickets from public,anon,authenticated;

alter table public.oficios add column automacao_versao integer not null default 1;
alter table public.declaracoes add column automacao_versao integer not null default 1;
alter table public.declaracoes_resposta add column automacao_versao integer not null default 1;

create function private.automacao_documento(p_tipo text,p_id uuid,p_lock boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;
begin
 if p_tipo not in('oficios','declaracoes','declaracoes_resposta') then raise exception 'TIPO_INVALIDO';end if;
 execute format('select to_jsonb(d) from public.%I d where id=$1%s',p_tipo,case when p_lock then ' for update' else '' end) into d using p_id;
 return d;
end $$;
create function private.automacao_dono() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and lower(email)='juniorprcarvalho1@gmail.com' and email_confirmed_at is not null)
$$;
create function private.automacao_permitido(p_doc jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select p_doc is not null and (private.automacao_dono() or (coalesce(private.controle_conta_ativa(auth.uid()),false) and p_doc->>'created_by'=auth.uid()::text))
$$;
create function private.automacao_snapshot(p_tipo text,p_doc jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg jsonb;modelos jsonb;t text;
begin
 select to_jsonb(c)-'webhook_token' into cfg from public.configuracoes c limit 1;
 t:=case p_tipo when 'oficios' then 'modelos_oficio' when 'declaracoes' then 'modelos_declaracao' when 'declaracoes_resposta' then 'modelos_declaracao_resposta' else null end;
 if t is null then raise exception 'TIPO_INVALIDO';end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(m)),''[]''::jsonb) from public.%I m where chave=$1',t) into modelos using p_doc->>'modelo_chave';
 return jsonb_build_object('documento',p_doc,'config',coalesce(cfg,'{}'::jsonb),'modelos',modelos);
end $$;
create function private.automacao_guardar_versao() returns trigger language plpgsql security definer set search_path='' as $$
declare mudou boolean;
begin
 if exists(select 1 from private.documento_jobs where tipo=tg_table_name and documento_id=old.id and etapa='email' and (estado='envio_a_confirmar' or (estado='processando' and envio_iniciado_em is not null))) then
  if tg_op='DELETE' then raise exception 'ENVIO_PRECISA_CONFIRMACAO';end if;
  mudou:=(to_jsonb(new)-array['pdf_path','email_enviado_em','email_destino','updated_at','automacao_versao']) is distinct from (to_jsonb(old)-array['pdf_path','email_enviado_em','email_destino','updated_at','automacao_versao']);
  if mudou then raise exception 'ENVIO_PRECISA_CONFIRMACAO';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 new.created_by:=old.created_by;new.origem:=old.origem;
 mudou:=(to_jsonb(new)-array['pdf_path','email_enviado_em','email_destino','updated_at','automacao_versao']) is distinct from (to_jsonb(old)-array['pdf_path','email_enviado_em','email_destino','updated_at','automacao_versao']);
 if mudou or new.automacao_versao<>old.automacao_versao then
  new.automacao_versao:=old.automacao_versao+1;new.pdf_path:=null;
 else new.automacao_versao:=old.automacao_versao;end if;
 return new;
end $$;
create function private.automacao_enfileirar() returns trigger language plpgsql security definer set search_path='' as $$
declare snap jsonb;doc jsonb;enviar boolean;
begin
 if tg_op='DELETE' then delete from private.documento_jobs where tipo=tg_table_name and documento_id=old.id;return old;end if;
 if tg_op='UPDATE' and new.automacao_versao=old.automacao_versao then return new;end if;
 if tg_op='UPDATE' then update private.documento_jobs set estado='cancelado',lease_token=null,lease_ate=null,updated_at=now() where tipo=tg_table_name and documento_id=new.id and versao<new.automacao_versao and estado not in('concluido','cancelado');end if;
 if new.origem<>'google_forms' or new.created_by is null then return new;end if;
 doc:=to_jsonb(new);snap:=private.automacao_snapshot(tg_table_name,doc);
 enviar:=tg_table_name='declaracoes_resposta' and doc->>'email_enviado_em' is null;
 insert into private.documento_jobs(tipo,documento_id,usuario_id,versao,etapa,snapshot,email_solicitado)
 values(tg_table_name,new.id,new.created_by,new.automacao_versao,'pdf',snap,enviar) on conflict do nothing;
 return new;
end $$;
create trigger automacao_oficios_guard before update or delete on public.oficios for each row execute function private.automacao_guardar_versao();
create trigger automacao_declaracoes_guard before update or delete on public.declaracoes for each row execute function private.automacao_guardar_versao();
create trigger automacao_respostas_guard before update or delete on public.declaracoes_resposta for each row execute function private.automacao_guardar_versao();
create trigger automacao_oficios after insert or update or delete on public.oficios for each row execute function private.automacao_enfileirar();
create trigger automacao_declaracoes after insert or update or delete on public.declaracoes for each row execute function private.automacao_enfileirar();
create trigger automacao_respostas after insert or update or delete on public.declaracoes_resposta for each row execute function private.automacao_enfileirar();

create function private.automacao_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;
begin
 perform 1 from private.automacao_config where id for update;
 if not coalesce((select habilitada from private.automacao_config where id),false) then return null;end if;
 if (select count(*) from private.documento_jobs where estado='processando' and lease_ate>clock_timestamp())>=2 then return null;end if;
 update private.documento_jobs set estado='envio_a_confirmar',erro_codigo='confirmar_envio',lease_token=null,lease_ate=null,updated_at=now()
 where etapa='email' and estado='processando' and lease_ate<now() and envio_iniciado_em is not null;
 select * into j from private.documento_jobs
 where (estado='pendente' or (estado='erro_recuperavel' and tentativas<7) or (estado='bloqueado_configuracao' and erro_codigo in('renderizador_ausente','gmail_ausente','orientador_ausente','conta_inativa')) or (estado='processando' and lease_ate<now() and envio_iniciado_em is null))
 and disponivel_em<=now() and coalesce(private.controle_conta_ativa(usuario_id),false)
 order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update private.documento_jobs set estado='processando',lease_token=gen_random_uuid(),lease_ate=now()+interval '3 minutes',tentativas=tentativas+1,erro_codigo=null,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
create function private.automacao_autorizar(p_job uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;d jsonb;
begin
 select * into j from private.documento_jobs where id=p_job;
 if not found then return false;end if;
 d:=private.automacao_documento(j.tipo,j.documento_id,true);
 select * into j from private.documento_jobs where id=p_job for update;
 if not found or j.estado<>'processando' or j.lease_token is distinct from p_lease or j.lease_ate<=clock_timestamp() then return false;end if;
 if d is null or (d->>'automacao_versao')::int<>j.versao or d->>'created_by'<>j.usuario_id::text then
  update private.documento_jobs set estado='cancelado',lease_token=null,lease_ate=null where id=p_job;return false;
 end if;
 if not coalesce(private.controle_conta_ativa(j.usuario_id),false) then
  update private.documento_jobs set estado='bloqueado_configuracao',erro_codigo='conta_inativa',envio_iniciado_em=null,disponivel_em=now()+interval '5 minutes',lease_token=null,lease_ate=null where id=p_job;return false;
 end if;
 return true;
end $$;
create function private.automacao_pdf_concluir(p_job uuid,p_lease uuid,p_path text,p_html text,p_sha256 text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;d jsonb;expected text;
begin
 if not private.automacao_autorizar(p_job,p_lease) then return false;end if;
 select * into j from private.documento_jobs where id=p_job for update;
 if j.etapa<>'pdf' then return false;end if;
 expected:=j.usuario_id::text||'/automacao/'||j.documento_id::text||'/v'||j.versao::text||'.pdf';
 if p_path is distinct from expected or p_html is null or length(p_html)>2000000 or (p_sha256 is not null and p_sha256 !~ '^[a-f0-9]{64}$') or (j.pdf_sha256 is not null and p_sha256 is not null and j.pdf_sha256<>p_sha256) or (j.html is not null and j.html<>p_html) then raise exception 'PDF_INVALIDO';end if;
 execute format('update public.%I set pdf_path=$1 where id=$2 and automacao_versao=$3',j.tipo) using p_path,j.documento_id,j.versao;
 update private.documento_jobs set estado='concluido',pdf_path=p_path,html=p_html,pdf_sha256=coalesce(p_sha256,pdf_sha256),pdf_base64=null,lease_token=null,lease_ate=null,updated_at=now() where id=p_job;
 d:=private.automacao_documento(j.tipo,j.documento_id);
 if j.tipo='declaracoes_resposta' and j.email_solicitado and d->>'email_enviado_em' is null and (d->>'origem'<>'lovable_migracao' or j.envio_manual) then
  insert into private.documento_jobs(tipo,documento_id,usuario_id,versao,etapa,snapshot,html,pdf_path,pdf_sha256,envio_manual)
  values(j.tipo,j.documento_id,j.usuario_id,j.versao,'email',j.snapshot,p_html,p_path,coalesce(p_sha256,j.pdf_sha256),j.envio_manual) on conflict do nothing;
 end if;
 return true;
end $$;
create function private.automacao_email_iniciar(p_job uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;d jsonb;destino text;
begin
 if not private.automacao_autorizar(p_job,p_lease) then return null;end if;
 select * into j from private.documento_jobs where id=p_job for update;
 if j.etapa<>'email' or j.envio_iniciado_em is not null then return null;end if;
 d:=private.automacao_documento(j.tipo,j.documento_id);
 if d->>'origem'='lovable_migracao' and not j.envio_manual or d->>'email_enviado_em' is not null then
  update private.documento_jobs set estado='cancelado',lease_token=null,lease_ate=null where id=p_job;return null;
 end if;
 if not exists(select 1 from private.documento_jobs where tipo=j.tipo and documento_id=j.documento_id and versao=j.versao and etapa='pdf' and estado='concluido' and pdf_path=j.pdf_path) then raise exception 'PDF_AUSENTE';end if;
 select btrim(email) into destino from public.orientadores where lower(curso)=d->>'modelo_chave' limit 1;
 if destino is null or destino !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(destino)>254 or destino ~ '[<>,;]' then
  update private.documento_jobs set estado='bloqueado_configuracao',erro_codigo='orientador_ausente',disponivel_em=now()+interval '5 minutes',lease_token=null,lease_ate=null,updated_at=now() where id=p_job;return null;
 end if;
 update private.documento_jobs set envio_iniciado_em=now(),email_destino=destino,updated_at=now() where id=p_job;
 return jsonb_build_object('to',destino,'message_id','<facesf.'||j.id::text||'@sintegradocursosfacesf.com.br>');
end $$;
create function private.automacao_email_concluir(p_job uuid,p_lease uuid,p_provider text) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;d jsonb;
begin
 select * into j from private.documento_jobs where id=p_job;
 if not found then return false;end if;
 d:=private.automacao_documento(j.tipo,j.documento_id,true);
 select * into j from private.documento_jobs where id=p_job for update;
 if not found or j.etapa<>'email' or j.estado<>'processando' or j.lease_token is distinct from p_lease or j.lease_ate<=clock_timestamp() or j.envio_iniciado_em is null then return false;end if;
 if d is null or (d->>'automacao_versao')::int<>j.versao then return false;end if;
 if p_provider is null or p_provider !~ '^[A-Za-z0-9_-]{1,256}$' then raise exception 'RECIBO_INVALIDO';end if;
 execute format('update public.%I set email_enviado_em=now(),email_destino=$1 where id=$2',j.tipo) using j.email_destino,j.documento_id;
 update private.documento_jobs set estado='concluido',provider_id=p_provider,lease_token=null,lease_ate=null,erro_codigo=null,updated_at=now() where id=p_job;
 return true;
end $$;
create function private.automacao_falhar(p_job uuid,p_lease uuid,p_codigo text,p_incerto boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;s text;
begin
 select * into j from private.documento_jobs where id=p_job for update;
 if not found or j.estado<>'processando' or j.lease_token is distinct from p_lease then return false;end if;
 if p_codigo is null or p_codigo !~ '^[a-z_]{1,64}$' then raise exception 'ERRO_INVALIDO';end if;
 s:=case when p_incerto and j.etapa='email' and j.envio_iniciado_em is not null then 'envio_a_confirmar'
 when p_codigo in('renderizador_ausente','gmail_ausente','orientador_ausente','modelo_ausente','campo_ausente','imagem_invalida','pdf_layout','pdf_invalido','gmail_recusado','tentativas_esgotadas') then 'bloqueado_configuracao'
 when j.tentativas>=7 then 'bloqueado_configuracao' else 'erro_recuperavel' end;
 update private.documento_jobs set estado=s,erro_codigo=case when s='envio_a_confirmar' then 'confirmar_envio' else p_codigo end,
 disponivel_em=now()+case when s='bloqueado_configuracao' then interval '5 minutes' else least(60,power(2,least(tentativas,6))) * interval '1 minute' end,
 envio_iniciado_em=case when s='envio_a_confirmar' then envio_iniciado_em else null end,lease_token=null,lease_ate=null,updated_at=now()
 where id=p_job;
 return true;
end $$;

create function private.automacao_status(p_tipo text,p_documento uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;pdf jsonb;email jsonb;
begin
 d:=private.automacao_documento(p_tipo,p_documento);
 if not private.automacao_permitido(d) then return null;end if;
 select jsonb_build_object('estado',estado,'erro_codigo',erro_codigo,'tentativas',tentativas,'atualizado_em',updated_at) into pdf from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='pdf';
 select jsonb_build_object('estado',case when estado='processando' and envio_iniciado_em is not null and lease_ate<=now() then 'envio_a_confirmar' else estado end,'erro_codigo',erro_codigo,'tentativas',tentativas,'atualizado_em',updated_at) into email from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='email';
 return jsonb_build_object('versao',(d->>'automacao_versao')::int,'habilitada',(select habilitada from private.automacao_config where id),'pdf',pdf,'email',email);
end $$;
create function private.automacao_retomar(p_tipo text,p_documento uuid,p_etapa text default 'pdf') returns boolean language plpgsql security definer set search_path='' as $$
declare d jsonb;j private.documento_jobs;
begin
 if p_etapa not in('pdf','email') then raise exception 'ETAPA_INVALIDA';end if;
 d:=private.automacao_documento(p_tipo,p_documento,true);
 if not private.automacao_permitido(d) then raise exception 'DOCUMENTO_NAO_AUTORIZADO';end if;
 select * into j from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa=p_etapa for update;
 if found then
  if j.estado='envio_a_confirmar' or (j.etapa='email' and j.estado='processando' and j.envio_iniciado_em is not null and j.lease_ate<=clock_timestamp()) then raise exception 'ENVIO_PRECISA_CONFIRMACAO';end if;
  if j.estado='processando' and j.lease_ate>now() then raise exception 'PROCESSAMENTO_EM_ANDAMENTO';end if;
  if j.estado='concluido' then return false;end if;
  update private.documento_jobs set estado='pendente',tentativas=0,disponivel_em=now(),lease_token=null,lease_ate=null,envio_iniciado_em=null,erro_codigo=null,
  snapshot=case when p_etapa='pdf' and html is null then private.automacao_snapshot(p_tipo,d) else snapshot end,updated_at=now() where id=j.id;
  return true;
 end if;
 if p_etapa<>'pdf' then raise exception 'PDF_AUSENTE';end if;
 insert into private.documento_jobs(tipo,documento_id,usuario_id,versao,etapa,snapshot,email_solicitado)
 values(p_tipo,p_documento,(d->>'created_by')::uuid,(d->>'automacao_versao')::int,'pdf',private.automacao_snapshot(p_tipo,d),p_tipo='declaracoes_resposta' and d->>'origem'<>'lovable_migracao' and d->>'email_enviado_em' is null);
 return true;
end $$;
create function private.automacao_pedir_envio(p_documento uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare d jsonb;j private.documento_jobs;
begin
 d:=private.automacao_documento('declaracoes_resposta',p_documento,true);
 if not private.automacao_permitido(d) then raise exception 'DOCUMENTO_NAO_AUTORIZADO';end if;
 if d->>'email_enviado_em' is not null then return false;end if;
 select * into j from private.documento_jobs where tipo='declaracoes_resposta' and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='email' for update;
 if found then return private.automacao_retomar('declaracoes_resposta',p_documento,'email');end if;
 perform private.automacao_retomar('declaracoes_resposta',p_documento,'pdf');
 select * into j from private.documento_jobs where tipo='declaracoes_resposta' and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='pdf' for update;
 if j.estado='concluido' then
  insert into private.documento_jobs(tipo,documento_id,usuario_id,versao,etapa,snapshot,html,pdf_path,pdf_sha256,envio_manual)
  values(j.tipo,j.documento_id,j.usuario_id,j.versao,'email',j.snapshot,j.html,j.pdf_path,j.pdf_sha256,true) on conflict do nothing;
 else update private.documento_jobs set email_solicitado=true,envio_manual=true where id=j.id;end if;
 return true;
end $$;
create function private.automacao_confirmar_envio(p_documento uuid,p_enviado boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare d jsonb;j private.documento_jobs;
begin
 d:=private.automacao_documento('declaracoes_resposta',p_documento,true);
 if not private.automacao_permitido(d) then raise exception 'DOCUMENTO_NAO_AUTORIZADO';end if;
 select * into j from private.documento_jobs where tipo='declaracoes_resposta' and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='email' and (estado='envio_a_confirmar' or (estado='processando' and envio_iniciado_em is not null and lease_ate<=clock_timestamp())) for update;
 if not found or p_enviado is null then return false;end if;
 if p_enviado then
  update public.declaracoes_resposta set email_enviado_em=now(),email_destino=j.email_destino where id=p_documento;
  update private.documento_jobs set estado='concluido',provider_id='confirmacao_manual',erro_codigo=null,updated_at=now() where id=j.id;
 else
  update private.documento_jobs set estado='pendente',envio_iniciado_em=null,disponivel_em=now(),tentativas=0,erro_codigo=null,updated_at=now() where id=j.id;
 end if;
 return true;
end $$;

-- RPCs invoker: nenhuma função privilegiada é exposta diretamente a PUBLIC.
create function public.automacao_claim() returns jsonb language sql security invoker set search_path='' as $$select private.automacao_claim()$$;
create function public.automacao_autorizar(p_job uuid,p_lease uuid) returns boolean language sql security invoker set search_path='' as $$select private.automacao_autorizar(p_job,p_lease)$$;
create function public.automacao_pdf_concluir(p_job uuid,p_lease uuid,p_path text,p_html text,p_sha256 text default null) returns boolean language sql security invoker set search_path='' as $$select private.automacao_pdf_concluir(p_job,p_lease,p_path,p_html,p_sha256)$$;
create function public.automacao_email_iniciar(p_job uuid,p_lease uuid) returns jsonb language sql security invoker set search_path='' as $$select private.automacao_email_iniciar(p_job,p_lease)$$;
create function public.automacao_email_concluir(p_job uuid,p_lease uuid,p_provider text) returns boolean language sql security invoker set search_path='' as $$select private.automacao_email_concluir(p_job,p_lease,p_provider)$$;
create function public.automacao_falhar(p_job uuid,p_lease uuid,p_codigo text,p_incerto boolean default false) returns boolean language sql security invoker set search_path='' as $$select private.automacao_falhar(p_job,p_lease,p_codigo,p_incerto)$$;
create function public.automacao_status(p_tipo text,p_documento uuid) returns jsonb language sql security invoker set search_path='' as $$select private.automacao_status(p_tipo,p_documento)$$;
create function public.automacao_retomar(p_tipo text,p_documento uuid,p_etapa text default 'pdf') returns boolean language sql security invoker set search_path='' as $$select private.automacao_retomar(p_tipo,p_documento,p_etapa)$$;
create function public.automacao_pedir_envio(p_documento uuid) returns boolean language sql security invoker set search_path='' as $$select private.automacao_pedir_envio(p_documento)$$;
create function public.automacao_confirmar_envio(p_documento uuid,p_enviado boolean) returns boolean language sql security invoker set search_path='' as $$select private.automacao_confirmar_envio(p_documento,p_enviado)$$;

create function private.automacao_pdf_reservar(p_job uuid,p_lease uuid,p_sha256 text,p_base64 text,p_html text) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;
begin
 if not private.automacao_autorizar(p_job,p_lease) then return false;end if;
 select * into j from private.documento_jobs where id=p_job for update;
 if j.etapa<>'pdf' then return false;end if;
 if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_base64 is null or length(p_base64)>10666668 or p_html is null or length(p_html)>2000000 then raise exception 'PDF_INVALIDO';end if;
 if encode(sha256(decode(p_base64,'base64')),'hex')<>p_sha256 then raise exception 'PDF_INVALIDO';end if;
 if j.pdf_sha256 is not null and j.pdf_sha256<>p_sha256 then return false;end if;
 if j.html is not null and j.html<>p_html then return false;end if;
 update private.documento_jobs set pdf_sha256=p_sha256,pdf_base64=p_base64,html=p_html,updated_at=now() where id=p_job;
 return true;
end $$;
create function public.automacao_pdf_reservar(p_job uuid,p_lease uuid,p_sha256 text,p_base64 text,p_html text) returns boolean language sql security invoker set search_path='' as $$select private.automacao_pdf_reservar(p_job,p_lease,p_sha256,p_base64,p_html)$$;

create function private.automacao_ticket_email(p_job uuid,p_lease uuid) returns text language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;t text;
begin
 if not private.automacao_autorizar(p_job,p_lease) then return null;end if;
 select * into j from private.documento_jobs where id=p_job;
 if j.etapa<>'email' or j.envio_iniciado_em is null then return null;end if;
 t:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 delete from private.automacao_mail_tickets where expira_em<now();
 insert into private.automacao_mail_tickets(token_hash,job_id,lease_token,expira_em) values(encode(sha256(convert_to(t,'UTF8')),'hex'),p_job,p_lease,now()+interval '90 seconds');
 return t;
end $$;
create function private.automacao_consumir_ticket_email(p_ticket text,p_enviar boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.automacao_mail_tickets;j private.documento_jobs;d jsonb;h text;
begin
 if p_ticket is null or p_ticket !~ '^[a-f0-9]{64}$' or p_enviar is null then return null;end if;
 h:=encode(sha256(convert_to(p_ticket,'UTF8')),'hex');
 select * into t from private.automacao_mail_tickets where token_hash=h and expira_em>clock_timestamp();
 if not found then return null;end if;
 if not private.automacao_autorizar(t.job_id,t.lease_token) then return null;end if;
 select * into t from private.automacao_mail_tickets where token_hash=h and expira_em>clock_timestamp() for update;
 if not found then return null;end if;
 select * into j from private.documento_jobs where id=t.job_id;
 if j.etapa<>'email' or j.envio_iniciado_em is null then return null;end if;
 if p_enviar then
  if t.envelope_lido_em is null or t.envio_autorizado_em is not null then return null;end if;
  d:=private.automacao_documento(j.tipo,j.documento_id);
  if not exists(select 1 from public.orientadores where lower(curso)=d->>'modelo_chave' and btrim(email)=j.email_destino) then return null;end if;
  update private.automacao_mail_tickets set envio_autorizado_em=clock_timestamp() where token_hash=h;
  return jsonb_build_object('autorizado',true);
 end if;
 if t.envelope_lido_em is not null then return null;end if;
 update private.automacao_mail_tickets set envelope_lido_em=clock_timestamp() where token_hash=h;
 return to_jsonb(j);
end $$;
create function public.automacao_ticket_email(p_job uuid,p_lease uuid) returns text language sql security invoker set search_path='' as $$select private.automacao_ticket_email(p_job,p_lease)$$;
create function public.automacao_consumir_ticket_email(p_ticket text,p_enviar boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.automacao_consumir_ticket_email(p_ticket,p_enviar)$$;

create function private.automacao_pode_configurar() returns boolean language sql stable security definer set search_path='' as $$
 select private.automacao_dono() or (
  coalesce(private.controle_conta_ativa(auth.uid()),false) and
  exists(select 1 from private.forms_config where usuario_id=auth.uid()) and
  exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 )
$$;
create function public.permissao_config_documental() returns boolean language sql security invoker set search_path='' as $$select private.automacao_pode_configurar()$$;
revoke all on function public.permissao_config_documental() from public,anon;
grant execute on function public.permissao_config_documental() to authenticated,service_role;
alter function private.forms_save(text,text,text,text,jsonb) set timezone to 'America/Fortaleza';


create function private.automacao_emitir_ticket(p_modo text,p_indice integer default 0) returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if p_modo is null or p_modo not in('processar','verificar','auditar') or p_indice is null or p_indice not between 0 and 14 or (p_modo<>'auditar' and p_indice<>0) then raise exception 'ESCOPO_INVALIDO';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into private.automacao_tickets(token_hash,expira_em,modo,indice) values(encode(sha256(convert_to(token,'UTF8')),'hex'),clock_timestamp()+interval '90 seconds',p_modo,p_indice);
 return token;
end $$;
create function private.automacao_consumir_ticket(p_ticket text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.automacao_tickets;j jsonb;
begin
 if p_ticket is null or p_ticket !~ '^[a-f0-9]{64}$' then return null;end if;
 delete from private.automacao_tickets where token_hash=encode(sha256(convert_to(p_ticket,'UTF8')),'hex') and expira_em>clock_timestamp() returning * into t;
 if not found then return null;end if;
 if t.modo='processar' then j:=private.automacao_claim();return jsonb_build_object('modo',t.modo,'job',j);end if;
 return jsonb_build_object('modo',t.modo,'indice',t.indice);
end $$;
create function public.automacao_emitir_ticket(p_modo text,p_indice integer default 0) returns text language sql security invoker set search_path='' as $$select private.automacao_emitir_ticket(p_modo,p_indice)$$;
create function public.automacao_consumir_ticket(p_ticket text) returns jsonb language sql security invoker set search_path='' as $$select private.automacao_consumir_ticket(p_ticket)$$;

do $$
declare f record;
begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname like 'automacao_%'
 loop
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',f.nspname,f.proname,f.args);
  execute format('grant execute on function %I.%I(%s) to service_role',f.nspname,f.proname,f.args);
  if f.proname in('automacao_status','automacao_retomar','automacao_pedir_envio','automacao_confirmar_envio') then
   execute format('grant execute on function %I.%I(%s) to authenticated',f.nspname,f.proname,f.args);
  end if;
 end loop;
end $$;
grant usage on schema private to service_role,authenticated;

grant execute on function private.automacao_pode_configurar() to authenticated;
