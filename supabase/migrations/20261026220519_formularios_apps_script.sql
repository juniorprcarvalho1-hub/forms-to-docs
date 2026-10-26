-- Recepção de documentos enviada pelos Apps Scripts. Não altera documentos existentes.
create schema if not exists private;
create table private.forms_config(id boolean primary key default true check(id),usuario_id uuid references auth.users(id));
insert into private.forms_config(id) values(true);
create table private.forms_receipts(destino text not null,chave text not null,hash text not null,usuario_id uuid not null references auth.users(id),registro_id uuid not null,numero_formatado text,created_at timestamptz not null default now(),primary key(destino,chave));
create table private.forms_limits(usuario_id uuid not null,hora timestamptz not null,recebidos integer not null,primary key(usuario_id,hora));
alter table private.forms_config enable row level security;
alter table private.forms_receipts enable row level security;
alter table private.forms_limits enable row level security;
revoke all on private.forms_config,private.forms_receipts,private.forms_limits from public,anon,authenticated;

create function private.forms_set_owner(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and lower(email)='juniorprcarvalho1@gmail.com' and email_confirmed_at is not null) then raise exception 'FORMS_OWNER_REQUIRED';end if;
 select id into u from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
 if u is null or not coalesce(private.controle_conta_ativa(u),false) then raise exception 'FORMS_ACCOUNT_INACTIVE';end if;
 update private.forms_config set usuario_id=u where id;
 return jsonb_build_object('ok',true);
end $$;
create function public.definir_responsavel_forms(p_email text) returns jsonb language sql security invoker set search_path='' as $$select private.forms_set_owner(p_email)$$;
revoke all on function private.forms_set_owner(text),public.definir_responsavel_forms(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.forms_set_owner(text),public.definir_responsavel_forms(text) to authenticated;

create function private.forms_context(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if p_token is null or length(p_token)<1 or length(p_token)>256 or not coalesce(public.validar_webhook_legado(p_token),false) then raise exception 'FORMS_TOKEN_INVALID';end if;
 select usuario_id into u from private.forms_config where id;
 if u is null then raise exception 'FORMS_NOT_CONFIGURED';end if;
 if not coalesce(private.controle_conta_ativa(u),false) then raise exception 'FORMS_ACCOUNT_INACTIVE';end if;
 return u;
end $$;
create function public.forms_documentos_contexto(p_token text) returns uuid language sql security invoker set search_path='' as $$select private.forms_context(p_token)$$;

create function private.forms_save(p_token text,p_destino text,p_chave text,p_hash text,p_dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;allowed text[];t text;cols text;payload jsonb;receipt private.forms_receipts;record_id uuid;seq integer;y integer;label text;cfg record;counted integer;attempt integer;
begin
 u:=private.forms_context(p_token);
 if p_chave is null or p_chave !~ '^[a-f0-9]{64}$' or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'FORMS_ID_INVALID';end if;
 case p_destino
 when 'oficios' then
 t:='oficios';allowed:=array['data','nome','cpf','curso','matricula','instituicao','cargo','assunto','corpo','destinatario','area_estagio','professor_orientador','registro_professor','carga_horaria','periodo','seguradora','apolice','coordenador','origem','modulo','modelo_chave'];
 when 'declaracoes' then
 t:='declaracoes';allowed:=array['nome','curso','modelo_chave','coren','hospital','data_inicio','data_fim','carga_horaria','alunos','email','origem'];
 when 'declaracoes-resposta' then
 t:='declaracoes_resposta';allowed:=array['supervisor','estagiario','curso','modelo_chave','tipo_avaliacao','periodo','email_supervisor','origem'];
 else raise exception 'FORMS_DESTINATION_INVALID';end case;
 if jsonb_typeof(p_dados)<>'object' or octet_length(p_dados::text)>64000 or exists(select 1 from jsonb_each(p_dados) e where not e.key=any(allowed) or jsonb_typeof(e.value)<>'string' or length(e.value #>> '{}')>20000) then raise exception 'FORMS_FIELDS_INVALID';end if;
 if (t in ('oficios','declaracoes') and length(trim(coalesce(p_dados->>'nome','')))<2)
 or (t='declaracoes_resposta' and (length(trim(coalesce(p_dados->>'supervisor','')))<2 or length(trim(coalesce(p_dados->>'estagiario','')))<2)) then raise exception 'FORMS_FIELDS_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('forms:'||p_destino||':'||p_chave,0));
 select * into receipt from private.forms_receipts where destino=p_destino and chave=p_chave;
 if found then
  if receipt.hash<>p_hash then raise exception 'FORMS_RESPONSE_CHANGED';end if;
  return jsonb_build_object('ok',true,'duplicado',true,'id',receipt.registro_id,'numero_formatado',receipt.numero_formatado);
 end if;
 insert into private.forms_limits(usuario_id,hora,recebidos) values(u,date_trunc('hour',now()),1)
 on conflict(usuario_id,hora) do update set recebidos=private.forms_limits.recebidos+1 where private.forms_limits.recebidos<300
 returning recebidos into counted;
 if not found then raise exception 'FORMS_RATE_LIMIT';end if;
 delete from private.forms_limits where hora<now()-interval '2 days';
 payload:=p_dados||jsonb_build_object('created_by',u,'origem','google_forms');
 if t='oficios' then
  y:=extract(year from (p_dados->>'data')::date)::int;
  if y is null or y<1900 or y>2200 then raise exception 'FORMS_FIELDS_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('forms-number:'||y::text,0));
  select formato_numeracao,digitos into cfg from public.configuracoes where id;
 end if;
 for attempt in 1..5 loop
  if t='oficios' then
   select coalesce(max(numero),0)+1 into seq from public.oficios where ano=y;
   label:=replace(replace(coalesce(nullif(cfg.formato_numeracao,''),'Ofício nº. {{seq}}/{{ano}} Estágio'),'{{seq}}',lpad(seq::text,greatest(length(seq::text),least(greatest(coalesce(cfg.digitos,2),1),10)),'0')),'{{ano}}',y::text);
   payload:=payload||jsonb_build_object('numero',seq,'ano',y,'numero_formatado',label);
  end if;
  select string_agg(format('%I',key),',') into cols from jsonb_object_keys(payload) as key;
  begin
   execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) returning id',t,cols,cols,t) into record_id using payload;
   exit;
  exception when unique_violation then
   if t<>'oficios' or attempt=5 then raise exception 'FORMS_NUMBERING_BUSY';end if;
  end;
 end loop;
 insert into private.forms_receipts(destino,chave,hash,usuario_id,registro_id,numero_formatado) values(p_destino,p_chave,p_hash,u,record_id,label);
 return jsonb_build_object('ok',true,'duplicado',false,'id',record_id,'numero_formatado',label);
end $$;
create function public.registrar_documento_forms(p_token text,p_destino text,p_chave text,p_hash text,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.forms_save(p_token,p_destino,p_chave,p_hash,p_dados)$$;
revoke all on function private.forms_context(text),public.forms_documentos_contexto(text),private.forms_save(text,text,text,text,jsonb),public.registrar_documento_forms(text,text,text,text,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.forms_context(text),public.forms_documentos_contexto(text),private.forms_save(text,text,text,text,jsonb),public.registrar_documento_forms(text,text,text,text,jsonb) to service_role;
