-- Contas ativas consultam o acervo institucional sem duplicar documentos.
create policy "Conta ativa consulta acervo" on public.oficios
 for select to authenticated using ((select public.acesso_documentos_aprovado()));
create policy "Conta ativa consulta acervo" on public.declaracoes
 for select to authenticated using ((select public.acesso_documentos_aprovado()));
create policy "Conta ativa consulta acervo" on public.declaracoes_resposta
 for select to authenticated using ((select public.acesso_documentos_aprovado()));

alter policy "Restringe PDFs aos documentos permitidos" on storage.objects
 to authenticated using (
  bucket_id <> 'oficios' or public.has_role(auth.uid(), 'admin'::public.app_role)
  or ((select public.acesso_documentos_aprovado()) and (
   starts_with(name, auth.uid()::text || '/')
   or exists (select 1 from public.oficios d where d.pdf_path = objects.name)
   or exists (select 1 from public.declaracoes d where d.pdf_path = objects.name)
   or exists (select 1 from public.declaracoes_resposta d where d.pdf_path = objects.name)
  ))
 );

CREATE OR REPLACE FUNCTION private.automacao_status(p_tipo text, p_documento uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb;pdf jsonb;email jsonb;
begin
 d:=private.automacao_documento(p_tipo,p_documento);
 if d is null or not coalesce(private.controle_conta_ativa(auth.uid()),false) then return null;end if;
 select jsonb_build_object('estado',estado,'path',pdf_path,'erro_codigo',erro_codigo,'tentativas',tentativas,'atualizado_em',updated_at) into pdf from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='pdf';
 select jsonb_build_object('estado',case when estado='processando' and envio_iniciado_em is not null and lease_ate<=now() then 'envio_a_confirmar' else estado end,'erro_codigo',erro_codigo,'tentativas',tentativas,'atualizado_em',updated_at) into email from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and versao=(d->>'automacao_versao')::int and etapa='email';
 return jsonb_build_object('versao',(d->>'automacao_versao')::int,'habilitada',(select habilitada from private.automacao_config where id),'pdf',pdf,'email',email,
  'emailAutomatico',exists(select 1 from private.documento_jobs where tipo=p_tipo and documento_id=p_documento and etapa='pdf' and email_solicitado));
end $function$;
