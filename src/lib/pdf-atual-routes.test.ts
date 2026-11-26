import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
for(const pagina of ["oficios","declaracoes","declaracoes-resposta"]) {
 const source=readFileSync(new URL("../routes/_authenticated/"+pagina+".tsx",import.meta.url),"utf8");
 test(pagina+": baixar, imprimir e baixar em lote não entregam um PDF arquivado antigo",()=>{
  expect(source).not.toContain("obterPdfArquivado");
 });
 test(pagina+": os botões da visualização exportam o mesmo HTML exibido",()=>{
  expect(source).toContain('comPdf(aberto, "baixar", htmlAberto)');
  expect(source).toContain('comPdf(aberto, "imprimir", htmlAberto)');
 });
}
