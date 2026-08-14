ALTER TABLE public.oficios
  ADD COLUMN IF NOT EXISTS curso text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS matricula text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS area_estagio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS professor_orientador text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registro_professor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS carga_horaria text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS periodo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destinatario text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seguradora text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apolice text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coordenador text NOT NULL DEFAULT '';

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS cidade text NOT NULL DEFAULT 'Belém do São Francisco',
  ADD COLUMN IF NOT EXISTS form_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_destinatario text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_seguradora text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_apolice text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_coordenador text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_cargo_coordenador text NOT NULL DEFAULT 'Coordenadora de Estágios',
  ADD COLUMN IF NOT EXISTS padrao_carga_horaria text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_periodo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_area_estagio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_professor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS padrao_registro_professor text NOT NULL DEFAULT '';

UPDATE public.configuracoes SET
  form_url = 'https://docs.google.com/forms/d/e/1FAIpQLSeC_NoZlTBIrtGt07imwZEuMMnYSv22_u8ZVuUTFpcfOrBazw/viewform',
  padrao_destinatario = 'A Secretaria Municipal de Saúde – Belém do São Francisco – PE',
  padrao_seguradora = 'Capemisa',
  padrao_apolice = '110820053075',
  padrao_coordenador = 'Anna Paula Rodrigues Madeiro e Silva',
  padrao_cargo_coordenador = 'Coordenadora de Estágios',
  padrao_carga_horaria = '420 horas',
  padrao_periodo = 'março a junho de 2026',
  padrao_area_estagio = 'Saúde Coletiva Enfermagem',
  padrao_professor = 'Joana D''Arc Lopes de Sá',
  padrao_registro_professor = 'COREN 729.200 ENF',
  formato_numeracao = 'Ofício nº. {{seq}}/{{ano}} Estágio',
  digitos = 2,
  modelo = 'Missão: Contribuir para o desenvolvimento humano e socioeconômico da região do semi-árido nordestino, através da formação de profissionais aptos ao permanente autodesenvolvimento técnico, intelectual e ético.

{{numero}}

{{cidade}}, {{data}}.

{{destinatario}}

Prezado (a) Secretário (a),

A Coordenação de Estágios da Faculdade de Ciências Humanas e Exatas do Sertão do São Francisco – FACESF, localizada em Belém do São Francisco – PE, apresenta a Vossa Senhoria o aluno (a) {{nome}} CPF {{cpf}} regularmente matriculado (a) no curso de {{curso}} da supracitada IES, matrícula: {{matricula}}, e solicita, para o mesmo, a realização de Estágio Curricular Obrigatório.

O estágio transcorrerá na área de {{area_estagio}}, sob a orientação do professor (a) {{professor_orientador}}, {{registro_professor}}, com carga horária de {{carga_horaria}} distribuídas entre os meses de {{periodo}}, ajustando-se ao plano de estágio concebido pelo (a) estagiário (a) sob acordos entre os profissionais responsáveis – professor orientador e supervisor de campo.

Informamos que o aluno será encaminhado com o Termo de Compromisso, Seguro Contra Acidentes Pessoais pela Seguradora {{seguradora}}, sob a apólice Nº {{apolice}}.

Na ocasião, manifestamos nossos votos de estima e apreço, agradecemos o esforço em nos atender e nos colocamos à disposição para quaisquer esclarecimentos adicionais que se fizerem necessários.

Atenciosamente,

{{coordenador}}
{{cargo_coordenador}}'
WHERE id = true;