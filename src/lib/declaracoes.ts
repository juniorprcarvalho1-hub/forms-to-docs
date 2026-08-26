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

export const TAGS_DECLARACAO = [
  "{{nome}}",
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

  const mapa: Record<string, string> = {
    nome: declaracao.nome,
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

  const chave = declaracao.modelo_chave || chaveModeloDeclaracao(declaracao.curso ?? "");
  const doCurso = modelos.find((m) => m.chave === chave)?.modelo_html;
  const modelo = (doCurso ?? config.modelo_declaracao_html ?? "").trim();

  const substituido = Object.entries(mapa).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{{${chave}}}`, valor),
    modelo,
  );
  return substituido.replace(/\{\{[^}]+\}\}/g, "");
}
