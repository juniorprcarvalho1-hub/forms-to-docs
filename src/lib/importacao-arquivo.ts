import {
  lerDelimitado,
  lerJson,
  MAX_ARQUIVO,
  tabelaDaMatriz,
  type TabelaImportacao,
} from "./importacao";

export async function lerArquivoImportacao(arquivo: File, aba = 1): Promise<TabelaImportacao> {
  if (arquivo.size > MAX_ARQUIVO) throw new Error("O limite é 5 MB por arquivo.");
  const extensao = arquivo.name.split(".").pop()?.toLowerCase();
  if (extensao === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    const matriz = await readSheet(arquivo, aba);
    return tabelaDaMatriz(matriz);
  }
  if (!["csv", "tsv", "txt", "json"].includes(extensao ?? ""))
    throw new Error(
      "Formato não aceito. Exporte a planilha do Forms como CSV ou Excel (.xlsx). Também aceitamos TSV, TXT tabulado e JSON.",
    );
  const buffer = await arquivo.arrayBuffer();
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    texto = new TextDecoder("windows-1252").decode(buffer);
  }
  return extensao === "json" ? lerJson(texto) : lerDelimitado(texto);
}

export async function listarAbas(arquivo: File): Promise<string[]> {
  if (arquivo.size > MAX_ARQUIVO) throw new Error("O limite é 5 MB por arquivo.");
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  return (await readXlsxFile(arquivo)).map((sheet) => sheet.sheet);
}
