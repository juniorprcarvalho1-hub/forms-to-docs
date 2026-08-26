export type Oficio = {
  id: string;
  numero: number;
  ano: number;
  numero_formatado: string;
  data: string;
  nome: string;
  cpf: string;
  instituicao: string;
  cargo: string;
  assunto: string;
  corpo: string;
  curso: string;
  modulo: string;
  modelo_chave: string;
  matricula: string;
  area_estagio: string;
  professor_orientador: string;
  registro_professor: string;
  carga_horaria: string;
  periodo: string;
  destinatario: string;
  seguradora: string;
  apolice: string;
  coordenador: string;
  pdf_path: string | null;
  conteudo_html: string | null;
  origem: string;
  created_at: string;
};

export type ModeloOficio = {
  id: string;
  chave: string;
  nome: string;
  cursos: string;
  modelo_html: string;
};

export type Configuracoes = {
  id: boolean;
  modelo: string;
  modelo_html: string;
  cabecalho_html: string;
  rodape_html: string;
  logo_url: string | null;
  assinatura_url: string | null;
  formato_numeracao: string;
  digitos: number;
  webhook_token: string;
  cidade: string;
  form_url: string;
  padrao_destinatario: string;
  padrao_seguradora: string;
  padrao_apolice: string;
  padrao_coordenador: string;
  padrao_cargo_coordenador: string;
  padrao_carga_horaria: string;
  padrao_periodo: string;
  padrao_area_estagio: string;
  padrao_professor: string;
  padrao_registro_professor: string;
  updated_at: string;
};

export const TAGS_MODELO = [
  "{{numero}}",
  "{{data}}",
  "{{cidade}}",
  "{{nome}}",
  "{{cpf}}",
  "{{curso}}",
  "{{modulo}}",
  "{{matricula}}",
  "{{destinatario}}",
  "{{area_estagio}}",
  "{{professor_orientador}}",
  "{{registro_professor}}",
  "{{carga_horaria}}",
  "{{periodo}}",
  "{{seguradora}}",
  "{{apolice}}",
  "{{coordenador}}",
  "{{cargo_coordenador}}",
  "{{instituicao}}",
  "{{cargo}}",
  "{{assunto}}",
];

export function formatarNumero(formato: string, seq: number, ano: number, digitos = 3) {
  return (formato || "Ofício nº. {{seq}}/{{ano}} Estágio")
    .replaceAll("{{seq}}", String(seq).padStart(digitos, "0"))
    .replaceAll("{{ano}}", String(ano));
}

export function formatarData(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${Number(d)} de ${meses[Number(m) - 1]} de ${y}`;
}

export function renderizarModelo(modelo: string, oficio: Oficio, config?: Configuracoes) {
  const mapa: Record<string, string> = {
    numero: oficio.numero_formatado,
    data: formatarData(oficio.data),
    cidade: config?.cidade ?? "",
    nome: oficio.nome,
    cpf: oficio.cpf,
    curso: oficio.curso,
    modulo: oficio.modulo ?? "",
    matricula: oficio.matricula,
    destinatario: oficio.destinatario || (config?.padrao_destinatario ?? ""),
    area_estagio: oficio.area_estagio || (config?.padrao_area_estagio ?? ""),
    professor_orientador: oficio.professor_orientador || (config?.padrao_professor ?? ""),
    registro_professor: oficio.registro_professor || (config?.padrao_registro_professor ?? ""),
    carga_horaria: oficio.carga_horaria || (config?.padrao_carga_horaria ?? ""),
    periodo: oficio.periodo || (config?.padrao_periodo ?? ""),
    seguradora: oficio.seguradora || (config?.padrao_seguradora ?? ""),
    apolice: oficio.apolice || (config?.padrao_apolice ?? ""),
    coordenador: oficio.coordenador || (config?.padrao_coordenador ?? ""),
    cargo_coordenador: config?.padrao_cargo_coordenador ?? "",
    instituicao: oficio.instituicao,
    cargo: oficio.cargo,
    assunto: oficio.assunto,
  };

  const substituido = Object.entries(mapa).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{{${chave}}}`, valor),
    modelo,
  );
  return limparTagsResiduais(substituido);
}

/** Remove tags automáticas que não foram preenchidas, evitando exibir "}}" no documento final. */
function limparTagsResiduais(texto: string) {
  return texto.replace(/\{\{[^}]+\}\}/g, "");
}

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function textoParaHtml(texto: string) {
  return escaparHtml(texto)
    .split(/\n{2,}/)
    .map((bloco) => `<p>${bloco.replaceAll("\n", "<br />")}</p>`)
    .join("");
}

/** Modelo em HTML salvo nas configurações (com fallback para o modelo antigo em texto). */
export function modeloHtmlAtual(config: Configuracoes) {
  const html = (config.modelo_html ?? "").trim();
  return html || textoParaHtml(config.modelo ?? "");
}

/** Corpo do modelo aplicável ao ofício (Enfermagem/Fisioterapia, Nutrição ou Psicologia). */
export function corpoModeloDoOficio(
  oficio: Oficio,
  config: Configuracoes,
  modelos?: ModeloOficio[],
) {
  const lista = modelos ?? [];
  const escolhido =
    lista.find((m) => m.chave === (oficio.modelo_chave || "padrao")) ??
    lista.find((m) => m.chave === "padrao");
  const html = (escolhido?.modelo_html ?? "").trim();
  return html || modeloHtmlAtual(config);
}

/** Documento final (cabeçalho + corpo + rodapé) já com as tags substituídas. */
export function montarDocumentoHtml(
  oficio: Oficio,
  config: Configuracoes,
  modelos?: ModeloOficio[],
) {
  if (oficio.conteudo_html && oficio.conteudo_html.trim()) return oficio.conteudo_html;
  const partes = [
    config.cabecalho_html?.trim(),
    corpoModeloDoOficio(oficio, config, modelos),
    config.rodape_html?.trim(),
  ].filter(Boolean) as string[];
  return renderizarModelo(partes.join(""), oficio, config);
}
