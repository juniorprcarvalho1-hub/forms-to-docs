import { formatarData, type Configuracoes } from "./oficios";

export type Declaracao = {
  id: string;
  nome: string;
  coren: string;
  hospital: string;
  data_inicio: string;
  data_fim: string;
  carga_horaria: string;
  alunos: string;
  email: string;
  curso: string;
  modelo_chave: string;
  data_emissao: string;
  conteudo_html: string | null;
  pdf_path: string | null;
  email_enviado_em: string | null;
  origem: string;
  created_at: string;
};

export type ModeloDeclaracao = {
  id: string;
  chave: string;
  nome: string;
  cursos: string;
  modelo_html: string;
};

export const ORDEM_MODELOS_DECLARACAO = [
  "enfermagem",
  "fisioterapia",
  "nutricao",
  "psicologia",
];

/** Descobre o modelo de declaração a partir do curso respondido no formulário. */
export function chaveModeloDeclaracao(curso: string): string {
  const texto = (curso ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (texto.includes("fisio")) return "fisioterapia";
  if (texto.includes("nutri")) return "nutricao";
  if (texto.includes("psico")) return "psicologia";
  return "enfermagem";
}

export type ConfiguracoesDeclaracao = Configuracoes & {
  modelo_declaracao_html?: string;
  form_declaracao_url?: string;
};

/** Sigla do conselho profissional conforme o curso/categoria do formulário. */
export function siglaConselho(cursoOuChave: string): string {
  const texto = (cursoOuChave ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (texto.includes("fisio")) return "CREFITO";
  if (texto.includes("nutri")) return "CRN";
  if (texto.includes("psico")) return "CRP";
  return "COREN";
}

/** Rótulos dos campos no editor de declarações (o nome é do preceptor, não do aluno). */
export const ROTULOS_DECLARACAO: Record<string, string> = {
  nome: "Preceptor(a)",
  conselho: "Conselho (sigla automática)",
  coren: "Número do registro",
};

export const TAGS_DECLARACAO = [
  "{{nome}}",
  "{{conselho}}",
  "{{coren}}",
  "{{hospital}}",
  "{{curso}}",
  "{{data_inicio}}",
  "{{data_fim}}",
  "{{carga_horaria}}",
  "{{alunos}}",
  "{{data_emissao}}",
  "{{cidade}}",
];

/** Documento final da declaração já com os campos do formulário substituídos. */
export function montarDeclaracaoHtml(
  declaracao: Declaracao,
  config: ConfiguracoesDeclaracao,
  modelos: ModeloDeclaracao[] = [],
): string {
  if (declaracao.conteudo_html && declaracao.conteudo_html.trim()) return declaracao.conteudo_html;

  const chave = declaracao.modelo_chave || chaveModeloDeclaracao(declaracao.curso ?? "");

  const mapa: Record<string, string> = {
    nome: declaracao.nome,
    conselho: siglaConselho(chave || declaracao.curso),
    coren: declaracao.coren,
    hospital: declaracao.hospital,
    curso: declaracao.curso ?? "",
    data_inicio: declaracao.data_inicio,
    data_fim: declaracao.data_fim,
    carga_horaria: declaracao.carga_horaria ?? "",
    alunos: declaracao.alunos ?? "",
    data_emissao: formatarData(declaracao.data_emissao),
    cidade: config.cidade ?? "",
  };

  const doCurso = modelos.find((m) => m.chave === chave)?.modelo_html;
  const modelo = (doCurso ?? config.modelo_declaracao_html ?? "").trim();

  const substituido = Object.entries(mapa).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{{${chave}}}`, valor),
    modelo,
  );
  return substituido.replace(/\{\{[^}]+\}\}/g, "");
}
