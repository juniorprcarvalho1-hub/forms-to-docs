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
  pdf_path: string | null;
  origem: string;
  created_at: string;
};

export type Configuracoes = {
  id: boolean;
  modelo: string;
  logo_url: string | null;
  assinatura_url: string | null;
  formato_numeracao: string;
  digitos: number;
  webhook_token: string;
  updated_at: string;
};

export const MODELO_PADRAO = `{{numero}}

{{data}}

Ao(À) Senhor(a)
{{nome}}
CPF: {{cpf}}
{{cargo}} - {{instituicao}}

Assunto: {{assunto}}

Prezado(a) Senhor(a),

Cumprimentando-o(a) cordialmente, vimos por meio deste ofício tratar do assunto acima referido, solicitando as providências cabíveis.

Atenciosamente,`;

export function formatarNumero(formato: string, seq: number, ano: number, digitos = 3) {
  return (formato || "OFÍCIO Nº {{seq}}/{{ano}}")
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

export function renderizarModelo(modelo: string, oficio: Oficio) {
  return modelo
    .replaceAll("{{numero}}", oficio.numero_formatado)
    .replaceAll("{{data}}", formatarData(oficio.data))
    .replaceAll("{{nome}}", oficio.nome)
    .replaceAll("{{cpf}}", oficio.cpf)
    .replaceAll("{{instituicao}}", oficio.instituicao)
    .replaceAll("{{cargo}}", oficio.cargo)
    .replaceAll("{{assunto}}", oficio.assunto);
}
