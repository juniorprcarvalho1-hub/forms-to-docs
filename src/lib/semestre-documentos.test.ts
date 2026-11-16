import { expect, test } from "bun:test";
import { listarPaginas, semestreDaData } from "./semestre-documentos";
import { criarZip } from "./zip-documentos";

test("usa a data civil e o horário de Fortaleza no limite do semestre", () => {
  expect(semestreDaData("2026-06-30")).toBe("2026.1");
  expect(semestreDaData("2026-07-01")).toBe("2026.2");
  expect(semestreDaData("2026-07-01T02:59:59Z")).toBe("2026.1");
  expect(semestreDaData("2026-07-01T03:00:00Z")).toBe("2026.2");
  expect(semestreDaData("inválida")).toBeUndefined();
});

test("consulta além da primeira página", async () => {
  const itens = Array.from({length: 1001}, (_, i) => ({id: String(i)}));
  expect(await listarPaginas(async (inicio, fim) => ({data: itens.slice(inicio, fim + 1),error:null}))).toEqual(itens);
});

test("ZIP guarda o PDF, a posição do diretório e a soma de verificação", async () => {
  const zip = await criarZip([{nome:"Ofício.pdf",conteudo:new Blob(["123456789"])}]);
  const bytes = await zip.arrayBuffer();
  const v = new DataView(bytes);
  const central = v.getUint32(bytes.byteLength - 6, true);
  expect(v.getUint32(0,true)).toBe(0x04034b50);
  expect(v.getUint32(14,true)).toBe(0xcbf43926);
  expect(v.getUint32(central,true)).toBe(0x02014b50);
  expect(v.getUint32(central + 16,true)).toBe(0xcbf43926);
  expect(new TextDecoder().decode(new Uint8Array(bytes,30,v.getUint16(26,true)))).toBe("Ofício.pdf");
});
