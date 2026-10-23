CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE POLICY "Papeis do proprio usuario" ON public.user_roles FOR SELECT TO authenticated USING(user_id = auth.uid());
CREATE POLICY "Administradores gerenciam papeis" ON public.user_roles FOR ALL TO authenticated USING(public.has_role(auth.uid(), 'admin')) WITH CHECK(public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.assinatura (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  cliente text NOT NULL DEFAULT 'FACESF',
  plano text NOT NULL DEFAULT 'mensal',
  valor numeric(12,2) NOT NULL DEFAULT 250,
  status text NOT NULL DEFAULT 'ativa',
  vencimento date NOT NULL DEFAULT current_date,
  observacao text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT current_date,
  plano text NOT NULL,
  valor numeric(12,2) NOT NULL,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ips_bloqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  motivo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ips_bloqueados ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinatura, public.pagamentos, public.ips_bloqueados TO authenticated;
GRANT ALL ON public.user_roles, public.assinatura, public.pagamentos, public.ips_bloqueados TO service_role;
CREATE POLICY "Administradores gerenciam assinatura" ON public.assinatura FOR ALL TO authenticated USING(public.has_role(auth.uid(), 'admin')) WITH CHECK(public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Administradores gerenciam pagamentos" ON public.pagamentos FOR ALL TO authenticated USING(public.has_role(auth.uid(), 'admin')) WITH CHECK(public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Administradores gerenciam IPs" ON public.ips_bloqueados FOR ALL TO authenticated USING(public.has_role(auth.uid(), 'admin')) WITH CHECK(public.has_role(auth.uid(), 'admin'));
INSERT INTO public.assinatura(id) VALUES(true);
INSERT INTO storage.buckets(id, name, public) VALUES('oficios', 'oficios', false) ON CONFLICT(id) DO NOTHING;
