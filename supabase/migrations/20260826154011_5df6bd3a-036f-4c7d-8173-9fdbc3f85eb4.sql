ALTER TABLE public.declaracoes
  ADD COLUMN IF NOT EXISTS carga_horaria text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS alunos text NOT NULL DEFAULT '';