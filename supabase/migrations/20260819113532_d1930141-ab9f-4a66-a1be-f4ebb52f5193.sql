ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS modelo_html text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cabecalho_html text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rodape_html text NOT NULL DEFAULT '';

ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS conteudo_html text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oficios' AND cmd = 'DELETE'
  ) THEN
    EXECUTE 'CREATE POLICY "Autenticados podem excluir oficios" ON public.oficios FOR DELETE TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oficios' AND cmd = 'UPDATE'
  ) THEN
    EXECUTE 'CREATE POLICY "Autenticados podem editar oficios" ON public.oficios FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.oficios TO service_role;
GRANT ALL ON public.configuracoes TO service_role;