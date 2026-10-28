import { formatarData } from "./oficios";
import { preencherModeloSeguro } from "./modelo-seguro";

export type DeclaracaoResposta = {
  id: string;
  supervisor: string;
  estagiario: string;
  curso: string;
  modelo_chave: string;
  tipo_avaliacao: string;
  periodo: string;
  email_supervisor: string;
  data_emissao: string;
  conteudo_html: string | null;
  pdf_path: string | null;
  email_enviado_em: string | null;
  email_destino: string;
  origem: string;
  created_at: string;
};

export type ModeloDeclaracaoResposta = {
  id: string;
  chave: string;
  nome: string;
  cursos: string;
  modelo_html: string;
};

export type Orientador = {
  id: string;
  curso: string;
  nome: string;
  email: string;
};

export const ORDEM_MODELOS_RESPOSTA = ["enfermagem", "fisioterapia", "nutricao", "psicologia"];

export const NOMES_CURSO: Record<string, string> = {
  enfermagem: "Enfermagem",
  fisioterapia: "Fisioterapia",
  nutricao: "Nutrição",
  psicologia: "Psicologia",
};

/** Descobre o curso (chave) a partir do texto respondido no formulário. */
export function chaveCurso(curso: string): string {
  const texto = (curso ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (texto.includes("fisio")) return "fisioterapia";
  if (texto.includes("nutri")) return "nutricao";
  if (texto.includes("psico")) return "psicologia";
  return "enfermagem";
}

export const TAGS_DECLARACAO_RESPOSTA = [
  "{{supervisor}}",
  "{{estagiario}}",
  "{{tipo_avaliacao}}",
  "{{periodo}}",
  "{{curso}}",
  "{{data_emissao}}",
];

export const ROTULOS_DECLARACAO_RESPOSTA: Record<string, string> = {
  supervisor: "Supervisor(a) de campo",
  estagiario: "Estagiário(a)",
  tipo_avaliacao: "Avaliação parcial/final",
  periodo: "Período",
};

/** Documento final já com os campos do formulário substituídos. */
export function montarDeclaracaoRespostaHtml(
  declaracao: DeclaracaoResposta,
  modelos: ModeloDeclaracaoResposta[] = [],
): string {
  if (declaracao.conteudo_html && declaracao.conteudo_html.trim()) return declaracao.conteudo_html;

  const chave = declaracao.modelo_chave || chaveCurso(declaracao.curso ?? "");
  const modelo = (modelos.find((m) => m.chave === chave)?.modelo_html ?? "").trim();
  if (!modelo) throw new Error("Modelo da declaração de resposta não cadastrado em Configurações.");

  const mapa: Record<string, string> = {
    supervisor: declaracao.supervisor,
    estagiario: declaracao.estagiario,
    tipo_avaliacao: declaracao.tipo_avaliacao,
    periodo: declaracao.periodo,
    curso: NOMES_CURSO[chave] ?? declaracao.curso,
    data_emissao: formatarData(declaracao.data_emissao),
  };

  return preencherModeloSeguro(modelo, mapa);
}

/** Assunto e corpo do e-mail enviado ao professor orientador do curso. */
export function mensagemEmailResposta(declaracao: DeclaracaoResposta) {
  const curso = NOMES_CURSO[declaracao.modelo_chave] ?? declaracao.curso;
  const assunto = `Declaração de resposta - ${declaracao.supervisor} (${curso})`;
  const corpo = [
    "Prezado(a) professor(a) orientador(a),",
    "",
    `Segue em anexo a declaração referente ao preenchimento do instrumento de Avaliação do Estagiário${declaracao.tipo_avaliacao ? ` – ${declaracao.tipo_avaliacao}` : ""}, realizado por ${declaracao.supervisor}, supervisor(a) de campo do(a) estagiário(a) ${declaracao.estagiario}.`,
    "",
    "Atenciosamente,",
    "Sistema Integrado de Cursos FACESF",
  ].join("\n");
  return { assunto, corpo };
}

/** Seleciona respostas novas, preservando o histórico importado sem reenvios. */
export function respostasParaEnvioAutomatico<T extends Pick<DeclaracaoResposta,"id"|"origem"|"email_enviado_em">>(declaracoes:readonly T[],processados:ReadonlySet<string>):T[]{return declaracoes.filter(d=>d.origem!=="lovable_migracao"&&!d.email_enviado_em&&!processados.has(d.id));}
