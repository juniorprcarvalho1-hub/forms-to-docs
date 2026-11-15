-- Processa trabalhos aguardando há mais tempo antes de repetir bloqueios antigos.
CREATE OR REPLACE FUNCTION private.automacao_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 order by disponivel_em,created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update private.documento_jobs set estado='processando',lease_token=gen_random_uuid(),lease_ate=now()+interval '3 minutes',tentativas=tentativas+1,erro_codigo=null,updated_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $function$;
