CREATE TABLE public.modelos_oficio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  cursos text NOT NULL DEFAULT '',
  modelo_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_oficio TO authenticated;
GRANT ALL ON public.modelos_oficio TO service_role;
ALTER TABLE public.modelos_oficio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam modelos" ON public.modelos_oficio FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.modulos_estagio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso text NOT NULL DEFAULT '',
  nome_formulario text NOT NULL DEFAULT '',
  nome_oficial text NOT NULL DEFAULT '',
  carga_horaria text NOT NULL DEFAULT '',
  area_estagio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos_estagio TO authenticated;
GRANT ALL ON public.modulos_estagio TO service_role;
ALTER TABLE public.modulos_estagio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam modulos" ON public.modulos_estagio FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS modulo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS modelo_chave text NOT NULL DEFAULT 'padrao';

INSERT INTO public.modelos_oficio (chave, nome, cursos, modelo_html)
SELECT 'padrao', 'Ofício 1 — Enfermagem e Fisioterapia', 'Enfermagem, Fisioterapia', modelo_html FROM public.configuracoes;
INSERT INTO public.modelos_oficio (chave, nome, cursos, modelo_html)
SELECT 'nutricao', 'Ofício 2 — Nutrição', 'Nutrição', modelo_html FROM public.configuracoes;
INSERT INTO public.modelos_oficio (chave, nome, cursos, modelo_html)
SELECT 'psicologia', 'Ofício 3 — Psicologia', 'Psicologia', modelo_html FROM public.configuracoes;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_modelos_oficio_updated_at BEFORE UPDATE ON public.modelos_oficio
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
