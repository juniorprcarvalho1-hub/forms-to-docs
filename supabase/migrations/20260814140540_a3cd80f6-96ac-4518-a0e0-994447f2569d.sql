CREATE TABLE public.oficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL,
  ano integer NOT NULL,
  numero_formatado text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  nome text NOT NULL DEFAULT '',
  cpf text NOT NULL DEFAULT '',
  instituicao text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT '',
  assunto text NOT NULL DEFAULT '',
  corpo text NOT NULL DEFAULT '',
  pdf_path text,
  origem text NOT NULL DEFAULT 'google_forms',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficios TO authenticated;
GRANT ALL ON public.oficios TO service_role;
ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam oficios" ON public.oficios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.configuracoes (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  modelo text NOT NULL DEFAULT '',
  logo_url text,
  assinatura_url text,
  formato_numeracao text NOT NULL DEFAULT 'OFÍCIO Nº {{seq}}/{{ano}}',
  digitos integer NOT NULL DEFAULT 3,
  webhook_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem config" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados atualizam config" ON public.configuracoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados criam config" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.configuracoes (id, modelo) VALUES (true,
'{{numero}}

{{data}}

Ao(À) Senhor(a)
{{nome}}
CPF: {{cpf}}
{{cargo}} - {{instituicao}}

Assunto: {{assunto}}

Prezado(a) Senhor(a),

Cumprimentando-o(a) cordialmente, vimos por meio deste ofício tratar do assunto acima referido, solicitando as providências cabíveis.

Atenciosamente,');

CREATE POLICY "Autenticados leem PDFs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'oficios');
CREATE POLICY "Autenticados enviam PDFs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'oficios');
CREATE POLICY "Autenticados atualizam PDFs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'oficios');