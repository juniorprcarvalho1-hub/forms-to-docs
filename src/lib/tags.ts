/**
 * Conversão entre as tags do modelo ({{nome}}) e "etiquetas" visuais no editor.
 * No editor o usuário vê apenas o rótulo limpo, sem chaves/colchetes.
 */
export const ROTULOS_TAGS: Record<string, string> = {
  numero: "Número do ofício",
  data: "Data",
  cidade: "Cidade",
  nome: "Aluno(a)",
  cpf: "CPF",
  curso: "Curso",
  modulo: "Módulo do estágio",
  matricula: "Matrícula",
  destinatario: "Destinatário",
  area_estagio: "Área do estágio",
  professor_orientador: "Professor(a) orientador(a)",
  registro_professor: "Registro do professor",
  carga_horaria: "Carga horária",
  periodo: "Período",
  seguradora: "Seguradora",
  apolice: "Apólice",
  coordenador: "Coordenador(a)",
  cargo_coordenador: "Cargo do coordenador",
  instituicao: "Instituição",
  cargo: "Cargo",
  assunto: "Assunto",
};

export function rotuloTag(tag: string) {
  return ROTULOS_TAGS[tag] ?? tag.replaceAll("_", " ");
}

/** Substitui {{tag}} por uma etiqueta não editável, exibida sem chaves. */
export function tagsParaEtiquetas(html: string) {
  return (html ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, tag: string) => {
    const chave = tag.toLowerCase();
    return `<span class="tag-campo" data-tag="${chave}" contenteditable="false">${rotuloTag(chave)}</span>`;
  });
}

/** Volta as etiquetas para as tags {{tag}} antes de salvar. */
export function etiquetasParaTags(html: string) {
  if (typeof document === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html ?? ""}</body>`, "text/html");
  doc.querySelectorAll<HTMLElement>("[data-tag]").forEach((el) => {
    el.replaceWith(doc.createTextNode(`{{${el.dataset["tag"]}}}`));
  });
  return doc.body.innerHTML;
}
