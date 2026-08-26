CREATE TABLE public.modelos_declaracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  cursos text NOT NULL DEFAULT '',
  modelo_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_declaracao TO authenticated;
GRANT ALL ON public.modelos_declaracao TO service_role;

ALTER TABLE public.modelos_declaracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam modelos de declaracao"
  ON public.modelos_declaracao FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_modelos_declaracao_updated_at
  BEFORE UPDATE ON public.modelos_declaracao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.declaracoes
  ADD COLUMN IF NOT EXISTS curso text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS modelo_chave text NOT NULL DEFAULT 'enfermagem';

INSERT INTO public.modelos_declaracao (chave, nome, cursos, modelo_html)
SELECT v.chave, v.nome, v.cursos,
       replace(
         replace(
           replace(c.modelo_declaracao_html, 'Campo de Estágio em Enfermagem', 'Campo de Estágio em ' || v.curso_texto),
           'equipe de enfermagem', 'equipe de ' || v.equipe),
         'COREN nº {{coren}}', v.conselho || ' nº {{coren}}')
FROM public.configuracoes c
CROSS JOIN (VALUES
  ('enfermagem',   'Declaração 1 — Enfermagem',  'Enfermagem',  'Enfermagem',  'enfermagem',   'COREN'),
  ('fisioterapia', 'Declaração 2 — Fisioterapia','Fisioterapia','Fisioterapia','fisioterapia', 'CREFITO'),
  ('nutricao',     'Declaração 3 — Nutrição',    'Nutrição',    'Nutrição',    'nutrição',     'CRN'),
  ('psicologia',   'Declaração 4 — Psicologia',  'Psicologia',  'Psicologia',  'psicologia',   'CRP')
) AS v(chave, nome, cursos, curso_texto, equipe, conselho)
ON CONFLICT (chave) DO NOTHING;