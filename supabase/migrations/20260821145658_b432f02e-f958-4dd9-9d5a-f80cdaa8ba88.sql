CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_formulario text NOT NULL DEFAULT '',
  nome_oficial text NOT NULL DEFAULT '',
  area_estagio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam cursos" ON public.cursos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_formulario text NOT NULL DEFAULT '',
  nome_oficial text NOT NULL DEFAULT '',
  registro text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professores TO authenticated;
GRANT ALL ON public.professores TO service_role;
ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam professores" ON public.professores FOR ALL TO authenticated USING (true) WITH CHECK (true);