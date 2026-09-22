CREATE TABLE public.orientadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso text NOT NULL UNIQUE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orientadores TO authenticated;
GRANT ALL ON public.orientadores TO service_role;
ALTER TABLE public.orientadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam orientadores" ON public.orientadores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_orientadores_updated_at BEFORE UPDATE ON public.orientadores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.declaracoes_resposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor text NOT NULL DEFAULT '',
  estagiario text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  modelo_chave text NOT NULL DEFAULT 'enfermagem',
  tipo_avaliacao text NOT NULL DEFAULT '',
  periodo text NOT NULL DEFAULT '',
  email_supervisor text NOT NULL DEFAULT '',
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  conteudo_html text,
  pdf_path text,
  email_enviado_em timestamptz,
  email_destino text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT 'google_forms',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.declaracoes_resposta TO authenticated;
GRANT ALL ON public.declaracoes_resposta TO service_role;
ALTER TABLE public.declaracoes_resposta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam declaracoes_resposta" ON public.declaracoes_resposta FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_declaracoes_resposta_updated_at BEFORE UPDATE ON public.declaracoes_resposta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.modelos_declaracao_resposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  cursos text NOT NULL DEFAULT '',
  modelo_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_declaracao_resposta TO authenticated;
GRANT ALL ON public.modelos_declaracao_resposta TO service_role;
ALTER TABLE public.modelos_declaracao_resposta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam modelos_declaracao_resposta" ON public.modelos_declaracao_resposta FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_modelos_declaracao_resposta_updated_at BEFORE UPDATE ON public.modelos_declaracao_resposta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.modelos_declaracao_resposta (chave, nome, cursos, modelo_html) VALUES
('enfermagem','Declaração de resposta - Enfermagem','Enfermagem',''),
('fisioterapia','Declaração de resposta - Fisioterapia','Fisioterapia',''),
('nutricao','Declaração de resposta - Nutrição','Nutrição',''),
('psicologia','Declaração de resposta - Psicologia','Psicologia','');

INSERT INTO public.orientadores (curso, nome, email) VALUES
('enfermagem','',''),
('fisioterapia','',''),
('nutricao','',''),
('psicologia','','');