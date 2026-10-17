export type DestinoImportacao = "pacientes" | "oficios" | "declaracoes" | "declaracoes_resposta";
export type CampoImportacao = {
  chave: string;
  rotulo: string;
  aliases?: string[];
  obrigatorio?: boolean;
};
export type TabelaImportacao = { colunas: string[]; linhas: string[][] };
export const MAX_LINHAS = 500;
export const MAX_ARQUIVO = 5 * 1024 * 1024;
const nome = {
  chave: "nome",
  rotulo: "Nome completo",
  aliases: [
    "nome completo",
    "nome do paciente",
    "paciente",
    "nome do aluno",
    "aluno(a)",
    "preceptor",
    "nome do preceptor",
  ],
  obrigatorio: true,
};
const cpf = { chave: "cpf", rotulo: "CPF", aliases: ["cpf do paciente", "seu cpf"] };
const email = {
  chave: "email",
  rotulo: "E-mail",
  aliases: ["endereço de e-mail", "email do paciente", "email do preceptor"],
};
const curso = {
  chave: "curso",
  rotulo: "Curso / especialidade",
  aliases: ["especialidade", "área de atendimento", "curso de estágio"],
};
const campos = (nomes: string[]): CampoImportacao[] =>
  nomes.map((chave) => ({ chave, rotulo: chave.replaceAll("_", " ") }));
export const DESTINOS: Record<DestinoImportacao, { rotulo: string; campos: CampoImportacao[] }> = {
  pacientes: {
    rotulo: "Pacientes",
    campos: [
      nome,
      cpf,
      email,
      {
        chave: "telefone",
        rotulo: "WhatsApp / telefone",
        aliases: ["whatsapp", "celular", "telefone para contato", "número de telefone"],
      },
      {
        chave: "data_nascimento",
        rotulo: "Data de nascimento",
        aliases: ["nascimento", "data de nascimento do paciente"],
      },
      {
        chave: "responsavel",
        rotulo: "Responsável",
        aliases: ["nome do responsável", "responsável legal"],
      },
      { chave: "endereco", rotulo: "Endereço", aliases: ["endereço completo"] },
      curso,
    ],
  },
  oficios: {
    rotulo: "Ofícios",
    campos: [
      nome,
      cpf,
      curso,
      ...campos([
        "matricula",
        "data",
        "instituicao",
        "cargo",
        "assunto",
        "destinatario",
        "modulo",
        "professor_orientador",
        "registro_professor",
        "carga_horaria",
        "periodo",
        "area_estagio",
        "seguradora",
        "apolice",
        "coordenador",
      ]),
    ],
  },
  declaracoes: {
    rotulo: "Declarações de preceptoria",
    campos: [
      { ...nome, rotulo: "Preceptor(a)" },
      email,
      { ...curso, obrigatorio: true },
      ...campos([
        "coren",
        "hospital",
        "data_inicio",
        "data_fim",
        "carga_horaria",
        "alunos",
        "data_emissao",
      ]),
    ],
  },
  declaracoes_resposta: {
    rotulo: "Declarações de resposta",
    campos: [
      {
        chave: "estagiario",
        rotulo: "Estagiário(a)",
        aliases: ["nome do aluno", "nome do estagiário", "aluno"],
        obrigatorio: true,
      },
      {
        chave: "supervisor",
        rotulo: "Supervisor(a)",
        aliases: ["nome do supervisor"],
        obrigatorio: true,
      },
      { ...curso, obrigatorio: true },
      ...campos(["tipo_avaliacao", "periodo", "email_supervisor", "email_destino", "data_emissao"]),
    ],
  },
};
export const normalizarCabecalho = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function tabelaDaMatriz(matriz: unknown[][]): TabelaImportacao {
  const texto = matriz.map((linha) =>
    linha.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim())),
  );
  const primeira = texto.findIndex((l) => l.some(Boolean));
  if (primeira < 0) throw new Error("O arquivo está vazio.");
  const colunas = texto[primeira]!.map((v) => v.replace(/^\uFEFF/, ""));
  if (colunas.some((v) => !v))
    throw new Error("Preencha todos os títulos de coluna da primeira linha.");
  if (colunas.length > 100) throw new Error("Use no máximo 100 colunas.");
  if (new Set(colunas.map(normalizarCabecalho)).size !== colunas.length)
    throw new Error("Existem títulos de coluna repetidos. Renomeie-os na planilha.");
  const linhas = texto.slice(primeira + 1).filter((l) => l.some(Boolean));
  if (!linhas.length) throw new Error("Não há respostas abaixo do cabeçalho.");
  if (linhas.length > MAX_LINHAS)
    throw new Error(
      `Importe até ${MAX_LINHAS} linhas por vez. Nenhuma linha foi descartada: divida o arquivo.`,
    );
  if (linhas.some((l) => l.length > colunas.length))
    throw new Error("Uma linha tem mais valores que o cabeçalho. Confira o separador e as aspas.");
  return { colunas, linhas: linhas.map((l) => colunas.map((_, i) => l[i] ?? "")) };
}

/** CSV RFC 4180, incluindo separadores e quebras de linha dentro de aspas. */
export function lerDelimitado(texto: string): TabelaImportacao {
  const entrada = texto.replace(/^\uFEFF/, "");
  const fim = entrada.search(/[\r\n]/);
  const primeira = fim < 0 ? entrada : entrada.slice(0, fim);
  const contar = (sep: string) => {
    let aspas = false,
      total = 0;
    for (let i = 0; i < primeira.length; i++) {
      if (primeira[i] === '"') {
        if (aspas && primeira[i + 1] === '"') i++;
        else aspas = !aspas;
      } else if (!aspas && primeira[i] === sep) total++;
    }
    return total;
  };
  const separador = ["\t", ";", ","].sort((a, b) => contar(b) - contar(a))[0];
  const linhas: string[][] = [];
  let linha: string[] = [],
    valor = "",
    aspas = false,
    fechou = false;
  const celula = () => {
    linha.push(valor);
    valor = "";
    fechou = false;
  };
  const novaLinha = () => {
    celula();
    linhas.push(linha);
    linha = [];
    if (linhas.length > MAX_LINHAS + 2) throw new Error(`Limite de ${MAX_LINHAS} linhas excedido.`);
  };
  for (let i = 0; i < entrada.length; i++) {
    const c = entrada[i]!;
    if (aspas) {
      if (c === '"') {
        if (entrada[i + 1] === '"') {
          valor += '"';
          i++;
        } else {
          aspas = false;
          fechou = true;
        }
      } else valor += c;
    } else if (c === '"' && valor === "" && !fechou) aspas = true;
    else if (c === separador) celula();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && entrada[i + 1] === "\n") i++;
      novaLinha();
    } else {
      if (fechou && c.trim()) throw new Error("CSV inválido: texto após o fechamento das aspas.");
      valor += c;
    }
  }
  if (aspas) throw new Error("CSV inválido: há aspas sem fechamento.");
  if (valor || linha.length) novaLinha();
  return tabelaDaMatriz(linhas);
}

export function lerJson(texto: string): TabelaImportacao {
  const json: unknown = JSON.parse(texto);
  const lista = Array.isArray(json)
    ? json
    : json && typeof json === "object" && "respostas" in json
      ? json.respostas
      : null;
  if (
    !Array.isArray(lista) ||
    !lista.length ||
    lista.some((v) => !v || typeof v !== "object" || Array.isArray(v))
  )
    throw new Error("Use um JSON com uma lista de objetos ou { respostas: [...] }.");
  const colunas = [...new Set(lista.flatMap((r) => Object.keys(r)))];
  return tabelaDaMatriz([
    colunas,
    ...lista.map((r) =>
      colunas.map((k) => {
        const v: unknown = r[k];
        if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.join("; ");
        if (v !== null && typeof v === "object")
          throw new Error("JSON com objetos aninhados não é aceito. Use campos de texto.");
        return v;
      }),
    ),
  ]);
}

export function sugerirMapeamento(
  colunas: string[],
  destino: DestinoImportacao,
): Record<string, string> {
  const usados = new Set<string>();
  const mapa: Record<string, string> = {};
  for (const campo of DESTINOS[destino].campos) {
    const nomes = [campo.chave, campo.rotulo, ...(campo.aliases ?? [])].map(normalizarCabecalho);
    const coluna = colunas.find((c) => !usados.has(c) && nomes.includes(normalizarCabecalho(c)));
    if (coluna) {
      mapa[campo.chave] = coluna;
      usados.add(coluna);
    }
  }
  return mapa;
}

export function dataISO(valor: string): string | null {
  if (!valor) return "";
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
  const iso = br ? `${br[3]}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}` : valor;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const data = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function cpfValido(valor: string): boolean {
  const n = valor.replace(/\D/g, "");
  if (!/^\d{11}$/.test(n) || /^(\d)\1+$/.test(n)) return false;
  for (const tamanho of [9, 10]) {
    const soma = [...n.slice(0, tamanho)].reduce((s, v, i) => s + Number(v) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(n[tamanho])) return false;
  }
  return true;
}

export type LinhaRevisao = {
  linha: number;
  dados: Record<string, string>;
  erros: string[];
  avisos: string[];
  duplicada: boolean;
};
export function revisarTabela(
  tabela: TabelaImportacao,
  mapa: Record<string, string>,
  destino: DestinoImportacao,
): LinhaRevisao[] {
  const vistos = new Set<string>();
  return tabela.linhas.map((linha, i) => {
    const dados: Record<string, string> = {};
    const erros: string[] = [],
      avisos: string[] = [];
    for (const campo of DESTINOS[destino].campos) {
      const indice = tabela.colunas.indexOf(mapa[campo.chave] ?? "");
      let valor = indice < 0 ? "" : (linha[indice] ?? "").trim();
      if (campo.obrigatorio && !valor) erros.push(`${campo.rotulo}: obrigatório.`);
      if (["nome", "estagiario", "supervisor"].includes(campo.chave) && valor && valor.length < 2)
        erros.push(`${campo.rotulo}: informe o nome completo.`);
      if (campo.chave === "nome" && destino === "pacientes" && valor.length > 200)
        erros.push("Nome: máximo de 200 caracteres.");
      if (valor.length > 2000) erros.push(`${campo.rotulo}: máximo de 2.000 caracteres.`);
      if (valor.includes("\0")) erros.push(`${campo.rotulo}: contém caractere inválido.`);
      if (campo.chave.includes("email") && valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))
        erros.push(`${campo.rotulo}: inválido.`);
      if (["data", "data_emissao", "data_nascimento"].includes(campo.chave) && valor) {
        const iso = dataISO(valor);
        if (iso === null) erros.push(`${campo.rotulo}: use dd/mm/aaaa ou aaaa-mm-dd.`);
        else valor = iso;
        if (campo.chave === "data_nascimento" && iso && iso > new Date().toISOString().slice(0, 10))
          erros.push("Data de nascimento no futuro.");
      }
      if (campo.chave === "cpf" && valor) {
        if (!cpfValido(valor))
          erros.push("CPF inválido. Confira a coluna e eventuais zeros à esquerda.");
        valor = valor.replace(/\D/g, "");
      }
      if (campo.chave === "telefone" && valor) {
        valor = valor.replace(/\D/g, "");
        if (valor.length < 10 || valor.length > 15) erros.push("Telefone: informe DDD e número.");
      }
      if (valor) dados[campo.chave] = valor;
    }
    if (destino === "pacientes" && !dados["cpf"])
      avisos.push("Sem CPF: conferir nome, nascimento e contato antes de salvar.");
    if (
      destino === "pacientes" &&
      !["cpf", "telefone", "email", "data_nascimento"].some((c) => dados[c])
    )
      erros.push("Informe CPF, telefone, e-mail ou nascimento para identificar o paciente.");
    if (
      destino.startsWith("declaracoes") &&
      dados["curso"] &&
      !/enferm|fisio|nutri|psico/.test(normalizarCabecalho(dados["curso"]))
    )
      erros.push("Curso não reconhecido. Use Enfermagem, Fisioterapia, Nutrição ou Psicologia.");
    const chave =
      destino === "pacientes" && dados["cpf"]
        ? `cpf:${dados["cpf"]}`
        : JSON.stringify(Object.entries(dados).sort());
    const duplicada = vistos.has(chave);
    if (!erros.length) vistos.add(chave);
    return { linha: i + 2, dados, erros, avisos, duplicada };
  });
}

export function escaparCelulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replaceAll('"', '""')}"`;
}
