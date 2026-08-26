CREATE TABLE public.declaracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  coren text NOT NULL DEFAULT '',
  hospital text NOT NULL DEFAULT '',
  data_inicio text NOT NULL DEFAULT '',
  data_fim text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  conteudo_html text,
  pdf_path text,
  email_enviado_em timestamptz,
  origem text NOT NULL DEFAULT 'google_forms',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.declaracoes TO authenticated;
GRANT ALL ON public.declaracoes TO service_role;

ALTER TABLE public.declaracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam declaracoes" ON public.declaracoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_declaracoes_updated_at
  BEFORE UPDATE ON public.declaracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS modelo_declaracao_html text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS form_declaracao_url text NOT NULL DEFAULT '';