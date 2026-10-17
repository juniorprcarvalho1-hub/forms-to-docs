-- Execute depois da migração de importações. Não altera usuários existentes nem apaga documentos.
CREATE TABLE public.acessos_autorizados (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  ativo boolean NOT NULL DEFAULT true,
  aprovado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acessos_autorizados ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acessos_autorizados TO authenticated;
CREATE POLICY "Administradores aprovam acessos" ON public.acessos_autorizados FOR ALL TO authenticated
 USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Usuario consulta proprio acesso" ON public.acessos_autorizados FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.acesso_documentos_aprovado() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(public.has_role(auth.uid(),'admin'),false) OR EXISTS(SELECT 1 FROM public.acessos_autorizados WHERE user_id=auth.uid() AND ativo)
$$;
REVOKE ALL ON FUNCTION public.acesso_documentos_aprovado() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.acesso_documentos_aprovado() TO authenticated;

DO $$ DECLARE tabela text; politica record; BEGIN
 FOREACH tabela IN ARRAY ARRAY['oficios','declaracoes','declaracoes_resposta'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id)',tabela);
  FOR politica IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tabela LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',politica.policyname,tabela);
  END LOOP;
  EXECUTE format('CREATE POLICY "Documentos proprios ou administrador" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'') OR (public.acesso_documentos_aprovado() AND created_by=auth.uid())) WITH CHECK (public.has_role(auth.uid(),''admin'') OR (public.acesso_documentos_aprovado() AND created_by=auth.uid()))',tabela);
 END LOOP;
 FOREACH tabela IN ARRAY ARRAY['configuracoes','modelos_oficio','modelos_declaracao','modelos_declaracao_resposta','cursos','professores'] LOOP
  FOR politica IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tabela LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',politica.policyname,tabela);
  END LOOP;
  EXECUTE format('CREATE POLICY "Aprovados consultam modelos" ON public.%I FOR SELECT TO authenticated USING (public.acesso_documentos_aprovado())',tabela);
  EXECUTE format('CREATE POLICY "Administradores configuram" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))',tabela);
 END LOOP;
END $$;

-- Tabela sem acesso direto pela API: o token nunca é devolvido nas consultas de configurações.
CREATE TABLE public.webhook_legado_segredo (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), token_hash text NOT NULL,
 ativo boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_legado_segredo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_legado_segredo FROM PUBLIC,anon,authenticated;
INSERT INTO public.webhook_legado_segredo(id,token_hash,ativo)
 SELECT true,encode(sha256(convert_to(webhook_token,'UTF8')),'hex'),webhook_token<>'' FROM public.configuracoes LIMIT 1;
UPDATE public.configuracoes SET webhook_token='';
ALTER TABLE public.configuracoes ALTER COLUMN webhook_token SET DEFAULT '';
-- Impede que atualizações antigas da configuração voltem a persistir tokens em claro.
ALTER TABLE public.configuracoes ADD CONSTRAINT webhook_token_sem_texto CHECK(webhook_token='');

CREATE FUNCTION public.validar_webhook_legado(p_token text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT ativo AND token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') FROM public.webhook_legado_segredo WHERE id),false)
$$;
REVOKE ALL ON FUNCTION public.validar_webhook_legado(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validar_webhook_legado(text) TO service_role;
CREATE FUNCTION public.gerenciar_webhook_legado(p_revogar boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE segredo text; BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Acesso restrito a administradores.'; END IF;
 IF p_revogar THEN UPDATE public.webhook_legado_segredo SET ativo=false,updated_at=now(); RETURN jsonb_build_object('ativo',false); END IF;
 segredo:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.webhook_legado_segredo(id,token_hash,ativo) VALUES(true,encode(sha256(convert_to(segredo,'UTF8')),'hex'),true)
 ON CONFLICT(id) DO UPDATE SET token_hash=EXCLUDED.token_hash,ativo=true,updated_at=now();
 RETURN jsonb_build_object('ativo',true,'token',segredo);
END $$;
REVOKE ALL ON FUNCTION public.gerenciar_webhook_legado(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gerenciar_webhook_legado(boolean) TO authenticated;

-- Evita exposição dos PDFs legados sem proprietário. Novos caminhos precisam ser associados ao documento.
-- O bucket não deve ser público. Não altera buckets de outros aplicativos.
UPDATE storage.buckets SET public=false WHERE id='oficios';
CREATE POLICY "Restringe PDFs aos documentos permitidos" ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (
 bucket_id<>'oficios' OR public.has_role(auth.uid(),'admin') OR (
 public.acesso_documentos_aprovado() AND (starts_with(name,auth.uid()::text||'/') OR EXISTS(SELECT 1 FROM public.oficios o WHERE o.pdf_path=name AND o.created_by=auth.uid()))
 )
);
CREATE POLICY "Restringe gravacao de PDFs" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 bucket_id<>'oficios' OR public.has_role(auth.uid(),'admin') OR (public.acesso_documentos_aprovado() AND starts_with(name,auth.uid()::text||'/')));
CREATE POLICY "Restringe alteracao de PDFs" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(
 bucket_id<>'oficios' OR public.has_role(auth.uid(),'admin') OR (public.acesso_documentos_aprovado() AND starts_with(name,auth.uid()::text||'/')))
 WITH CHECK(bucket_id<>'oficios' OR public.has_role(auth.uid(),'admin') OR (public.acesso_documentos_aprovado() AND starts_with(name,auth.uid()::text||'/')));
CREATE POLICY "Restringe exclusao de PDFs" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(
 bucket_id<>'oficios' OR public.has_role(auth.uid(),'admin') OR (public.acesso_documentos_aprovado() AND starts_with(name,auth.uid()::text||'/')));

CREATE FUNCTION public.autorizar_usuario_documentos(p_email text,p_ativo boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE usuario uuid; BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
 SELECT id INTO usuario FROM auth.users WHERE lower(email)=lower(trim(p_email));
 IF usuario IS NULL THEN RAISE EXCEPTION 'Conta não encontrada. O administrador do Supabase precisa convidar o usuário primeiro.'; END IF;
 INSERT INTO public.acessos_autorizados(user_id,ativo,aprovado_por) VALUES(usuario,p_ativo,auth.uid()) ON CONFLICT(user_id) DO UPDATE SET ativo=EXCLUDED.ativo,aprovado_por=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.autorizar_usuario_documentos(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_usuario_documentos(text,boolean) TO authenticated;
