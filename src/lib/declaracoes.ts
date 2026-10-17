import { formatarData, type Configuracoes } from "./oficios";
import { preencherModeloSeguro } from "./modelo-seguro";

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

/** Mapeamento oficial curso → conselho, departamento, núcleo e portaria de autorização. */
export type MapaCurso = {
  curso: string;
  conselho: string;
  departamento: string;
  nucleo: string;
  portaria: string;
};

export const MAPA_CURSOS = {
  enfermagem: {
    curso: "Enfermagem",
    conselho: "COREN",
    departamento: "DEPARTAMENTO DE ENFERMAGEM",
    nucleo: "NÚCLEO DE PRÁTICAS E ESTUDOS EM SAÚDE - NUPES",
    portaria:
      "Curso de Enfermagem autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. No D.O.U. de 18/08/2015 Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP.:56440-000",
  },
  fisioterapia: {
    curso: "Fisioterapia",
    conselho: "CREFITO",
    departamento: "DEPARTAMENTO DE FISIOTERAPIA",
    nucleo: "NÚCLEO DE PRÁTICAS E ESTUDOS EM SAÚDE - NUPES",
    portaria:
      "Curso de Fisioterapia autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. No D.O.U. de 18/08/2015 Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP.:56440-000",
  },
  nutricao: {
    curso: "Nutrição",
    conselho: "CRN",
    departamento: "DEPARTAMENTO DE NUTRIÇÃO",
    nucleo: "NÚCLEO DE PRÁTICAS E ESTUDOS EM SAÚDE - NUPES",
    portaria:
      "Curso de Nutrição autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. No D.O.U. de 18/08/2015 Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP.:56440-000",
  },
  psicologia: {
    curso: "Psicologia",
    conselho: "CRP",
    departamento: "DEPARTAMENTO DE PSICOLOGIA",
    nucleo: "NÚCLEO DE PRÁTICAS E ESTUDOS EM PSICOLOGIA - NUPEP",
    portaria:
      "Curso de Psicologia autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. No D.O.U. de 18/08/2015 Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP.:56440-000",
  },
} satisfies Record<string, MapaCurso>;

/** Retorna o mapeamento do curso ou null quando o curso não está cadastrado. */
export function mapaDoCurso(cursoOuChave: string): MapaCurso | null {
  const texto = (cursoOuChave ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (texto.includes("fisio")) return MAPA_CURSOS.fisioterapia;
  if (texto.includes("nutri")) return MAPA_CURSOS.nutricao;
  if (texto.includes("psico")) return MAPA_CURSOS.psicologia;
  if (texto.includes("enferm")) return MAPA_CURSOS.enfermagem;
  return null;
}

/** Sigla do conselho profissional conforme o curso/categoria do formulário. */
export function siglaConselho(cursoOuChave: string): string {
  return mapaDoCurso(cursoOuChave)?.conselho ?? "";
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
  "{{departamento}}",
  "{{nucleo}}",
  "{{portaria}}",
  "{{data_inicio}}",
  "{{data_fim}}",
  "{{carga_horaria}}",
  "{{alunos}}",
  "{{data_emissao}}",
  "{{cidade}}",
];

/** Mensagem de pendência quando o curso da declaração não está no mapeamento oficial. */
export function pendenciaDeclaracao(declaracao: Declaracao): string | null {
  const mapa = mapaDoCurso(declaracao.modelo_chave || declaracao.curso || "");
  if (!mapa)
    return `Curso "${declaracao.curso || "não informado"}" não consta na tabela de cursos (Enfermagem, Fisioterapia, Nutrição, Psicologia). Corrija o curso antes de gerar a declaração.`;
  return null;
}

/** Documento final da declaração já com os campos do formulário substituídos. */
export function montarDeclaracaoHtml(
  declaracao: Declaracao,
  config: ConfiguracoesDeclaracao,
  modelos: ModeloDeclaracao[] = [],
): string {
  if (declaracao.conteudo_html && declaracao.conteudo_html.trim()) return declaracao.conteudo_html;

  const chave = declaracao.modelo_chave || chaveModeloDeclaracao(declaracao.curso ?? "");
  const info = mapaDoCurso(chave || declaracao.curso || "");
  if (!info) throw new Error(pendenciaDeclaracao(declaracao) ?? "Curso inválido.");

  const mapa: Record<string, string> = {
    nome: declaracao.nome,
    conselho: info.conselho,
    coren: declaracao.coren,
    hospital: declaracao.hospital,
    curso: info.curso,
    departamento: info.departamento,
    nucleo: info.nucleo,
    portaria: info.portaria,
    data_inicio: declaracao.data_inicio,
    data_fim: declaracao.data_fim,
    carga_horaria: declaracao.carga_horaria ?? "",
    alunos: declaracao.alunos ?? "",
    data_emissao: formatarData(declaracao.data_emissao),
    cidade: config.cidade ?? "",
  };

  const doCurso = modelos.find((m) => m.chave === chave)?.modelo_html;
  const modelo = (doCurso ?? config.modelo_declaracao_html ?? "").trim();

  return preencherModeloSeguro(modelo, mapa);
}


/** Assunto e corpo padrão do e-mail enviado ao preceptor. */
export function mensagemEmailDeclaracao(declaracao: Declaracao, linkPdf?: string) {
  const assunto = `Declaração de Preceptoria - ${declaracao.nome}`;
  const corpo = [
    `Prezado(a) ${declaracao.nome},`,
    "",
    `Segue em anexo a Declaração de Preceptoria referente às atividades desenvolvidas no período de ${declaracao.data_inicio} a ${declaracao.data_fim}${declaracao.hospital ? ` no ${declaracao.hospital}` : ""}.`,
    "",
    "Agradecemos imensamente a sua contribuição para a integração ensino-serviço e para a formação profissional dos nossos discentes.",
    ...(linkPdf ? ["", `Link para o documento: ${linkPdf}`] : []),
    "",
    "Atenciosamente,",
    "NUPES/NUPEP - FACESF",
  ].join("\n");
  return { assunto, corpo };
}
