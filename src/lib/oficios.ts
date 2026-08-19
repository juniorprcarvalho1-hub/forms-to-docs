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
  origem: string;
  created_at: string;
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

  return Object.entries(mapa).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{{${chave}}}`, valor),
    modelo,
  );
}
