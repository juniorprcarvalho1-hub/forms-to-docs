-- Envio automático somente para novas declarações recebidas do Google Forms.

create or replace function private.automacao_enfileirar() returns trigger language plpgsql security definer set search_path='' as $$
declare snap jsonb;doc jsonb;enviar boolean;
begin
 if tg_op='DELETE' then delete from private.documento_jobs where tipo=tg_table_name and documento_id=old.id;return old;end if;
 if tg_op='UPDATE' and new.automacao_versao=old.automacao_versao then return new;end if;
 if tg_op='UPDATE' then update private.documento_jobs set estado='cancelado',lease_token=null,lease_ate=null,updated_at=now() where tipo=tg_table_name and documento_id=new.id and versao<new.automacao_versao and estado not in('concluido','cancelado');end if;
 if new.origem<>'google_forms' or new.created_by is null then return new;end if;
 doc:=to_jsonb(new);snap:=private.automacao_snapshot(tg_table_name,doc);
 enviar:=doc->>'email_enviado_em' is null and (
  tg_table_name='declaracoes_resposta' or (tg_table_name='declaracoes' and (
   tg_op='INSERT' or exists(select 1 from private.documento_jobs
    where tipo='declaracoes' and documento_id=new.id and etapa='pdf' and email_solicitado)
  ))
 );
 insert into private.documento_jobs(tipo,documento_id,usuario_id,versao,etapa,snapshot,email_solicitado)
 values(tg_table_name,new.id,new.created_by,new.automacao_versao,'pdf',snap,enviar) on conflict do nothing;
 return new;
end $$;

create or replace function private.automacao_pdf_concluir(p_job uuid,p_lease uuid,p_path text,p_html text,p_sha256 text default null) returns boolean language plpgsql security definer set search_path='' as $$
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
 if j.tipo in('declaracoes_resposta','declaracoes') and j.email_solicitado and d->>'email_enviado_em' is null and (d->>'origem'<>'lovable_migracao' or j.envio_manual) then
  insert into private.documento_jobs(tipo,documento_id,usuario_id,versao,etapa,snapshot,html,pdf_path,pdf_sha256,envio_manual)
  values(j.tipo,j.documento_id,j.usuario_id,j.versao,'email',j.snapshot,p_html,p_path,coalesce(p_sha256,j.pdf_sha256),j.envio_manual) on conflict do nothing;
 end if;
 return true;
end $$;

create or replace function private.automacao_email_iniciar(p_job uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if j.tipo='declaracoes' then
  if d->>'origem' is distinct from 'google_forms' then return null; end if;
  destino:=btrim(d->>'email');
 elsif j.tipo='declaracoes_resposta' then
  select btrim(email) into destino from public.orientadores where lower(curso)=d->>'modelo_chave' limit 1;
 else return null; end if;
 if destino is null or destino !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(destino)>254 or destino ~ '[<>,;]' then
  update private.documento_jobs set estado='bloqueado_configuracao',erro_codigo=case when j.tipo='declaracoes' then 'preceptor_ausente' else 'orientador_ausente' end,disponivel_em=now()+interval '5 minutes',lease_token=null,lease_ate=null,updated_at=now() where id=p_job;return null;
 end if;
 update private.documento_jobs set envio_iniciado_em=now(),email_destino=destino,updated_at=now() where id=p_job;
 return jsonb_build_object('to',destino,'message_id','<facesf.'||j.id::text||'@sintegradocursosfacesf.com.br>');
end $$;

create or replace function private.automacao_email_concluir(p_job uuid,p_lease uuid,p_provider text) returns boolean language plpgsql security definer set search_path='' as $$
declare j private.documento_jobs;d jsonb;
begin
 select * into j from private.documento_jobs where id=p_job;
 if not found then return false;end if;
 d:=private.automacao_documento(j.tipo,j.documento_id,true);
 select * into j from private.documento_jobs where id=p_job for update;
 if not found or j.etapa<>'email' or j.estado<>'processando' or j.lease_token is distinct from p_lease or j.lease_ate<=clock_timestamp() or j.envio_iniciado_em is null then return false;end if;
 if d is null or (d->>'automacao_versao')::int<>j.versao then return false;end if;
 if p_provider is null or length(p_provider)>256 or p_provider !~ '^[A-Za-z0-9_-]+$' then raise exception 'RECIBO_INVALIDO';end if;
 if j.tipo='declaracoes' then
  update public.declaracoes set email_enviado_em=now() where id=j.documento_id;
 elsif j.tipo='declaracoes_resposta' then
  update public.declaracoes_resposta set email_enviado_em=now(),email_destino=j.email_destino where id=j.documento_id;
 else return false; end if;
 update private.documento_jobs set estado='concluido',provider_id=p_provider,lease_token=null,lease_ate=null,erro_codigo=null,updated_at=now() where id=p_job;
 return true;
end $$;

create or replace function private.automacao_consumir_ticket_email(p_ticket text,p_enviar boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if d is null or d->>'email_enviado_em' is not null then return null;end if;
  if j.tipo='declaracoes' then
   if d->>'origem' is distinct from 'google_forms' or btrim(d->>'email') is distinct from j.email_destino then return null;end if;
  elsif j.tipo='declaracoes_resposta' then
   if not exists(select 1 from public.orientadores where lower(curso)=d->>'modelo_chave' and btrim(email)=j.email_destino) then return null;end if;
  else return null;end if;
  update private.automacao_mail_tickets set envio_autorizado_em=clock_timestamp() where token_hash=h;
  return jsonb_build_object('autorizado',true);
 end if;
 if t.envelope_lido_em is not null then return null;end if;
 update private.automacao_mail_tickets set envelope_lido_em=clock_timestamp() where token_hash=h;
 return to_jsonb(j);
end $$;

create or replace function private.automacao_status(p_tipo text,p_documento uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;pdf jsonb;email jsonb;
begin
 d:=private.automacao_documento(p_tipo,p_documento);
 if not private.automacao_permitido(d) then return null;end if;
 select jsonb_build_object('estado',estado,'path',pdf_path,'erro_codigo',erro_codigo,'tentativas',tentativas,'atualizado_em',updated_at) into pdf from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='pdf';
 select jsonb_build_object('estado',case when estado='processando' and envio_iniciado_em is not null and lease_ate<=now() then 'envio_a_confirmar' else estado end,'erro_codigo',erro_codigo,'tentativas',tentativas,'atualizado_em',updated_at) into email from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='email';
 return jsonb_build_object('versao',(d->>'automacao_versao')::int,'habilitada',(select habilitada from private.automacao_config where id),'pdf',pdf,'email',email,
  'emailAutomatico',exists(select 1 from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and etapa='pdf' and email_solicitado));
end $$;

create or replace function private.automacao_confirmar_envio(p_tipo text,p_documento uuid,p_enviado boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare d jsonb;j private.documento_jobs;
begin
 if p_tipo='declaracoes_resposta' then return private.automacao_confirmar_envio(p_documento,p_enviado); end if;
 if p_tipo is distinct from 'declaracoes' then return false; end if;
 d:=private.automacao_documento('declaracoes',p_documento,true);
 if not private.automacao_permitido(d) then raise exception 'DOCUMENTO_NAO_AUTORIZADO';end if;
 select * into j from private.documento_jobs where tipo='declaracoes' and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='email' and (estado='envio_a_confirmar' or (estado='processando' and envio_iniciado_em is not null and lease_ate<=clock_timestamp())) for update;
 if not found or p_enviado is null then return false;end if;
 if p_enviado then
  update public.declaracoes set email_enviado_em=now() where id=p_documento;
  update private.documento_jobs set estado='concluido',provider_id='confirmacao_manual',erro_codigo=null,updated_at=now() where id=j.id;
 else
  update private.documento_jobs set estado='pendente',envio_iniciado_em=null,disponivel_em=now(),tentativas=0,erro_codigo=null,updated_at=now() where id=j.id;
 end if;
 return true;
end $$;

create function public.automacao_confirmar_envio(p_tipo text,p_documento uuid,p_enviado boolean)
returns boolean language sql security invoker set search_path='' as $$
 select private.automacao_confirmar_envio(p_tipo,p_documento,p_enviado)
$$;
revoke all on function private.automacao_confirmar_envio(text,uuid,boolean) from public,anon,authenticated;
revoke all on function public.automacao_confirmar_envio(text,uuid,boolean) from public,anon,authenticated;
grant execute on function private.automacao_confirmar_envio(text,uuid,boolean) to authenticated;
grant execute on function public.automacao_confirmar_envio(text,uuid,boolean) to authenticated;
