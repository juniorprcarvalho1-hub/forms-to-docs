import { formatarData, type Configuracoes } from "./oficios";

export type Declaracao = {
  id: string;
  nome: string;
  coren: string;
  hospital: string;
  data_inicio: string;
  data_fim: string;
  email: string;
  data_emissao: string;
  conteudo_html: string | null;
  pdf_path: string | null;
  email_enviado_em: string | null;
  origem: string;
  created_at: string;
};

export type ConfiguracoesDeclaracao = Configuracoes & {
  modelo_declaracao_html?: string;
  form_declaracao_url?: string;
};

export const TAGS_DECLARACAO = [
  "{{nome}}",
  "{{coren}}",
  "{{hospital}}",
  "{{data_inicio}}",
  "{{data_fim}}",
  "{{data_emissao}}",
  "{{cidade}}",
];

/** Documento final da declaração já com os campos do formulário substituídos. */
export function montarDeclaracaoHtml(
  declaracao: Declaracao,
  config: ConfiguracoesDeclaracao,
): string {
  if (declaracao.conteudo_html && declaracao.conteudo_html.trim()) return declaracao.conteudo_html;

  const mapa: Record<string, string> = {
    nome: declaracao.nome,
    coren: declaracao.coren,
    hospital: declaracao.hospital,
    data_inicio: declaracao.data_inicio,
    data_fim: declaracao.data_fim,
    data_emissao: formatarData(declaracao.data_emissao),
    cidade: config.cidade ?? "",
  };

  const modelo = (config.modelo_declaracao_html ?? "").trim();
  const substituido = Object.entries(mapa).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{{${chave}}}`, valor),
    modelo,
  );
  return substituido.replace(/\{\{[^}]+\}\}/g, "");
}
