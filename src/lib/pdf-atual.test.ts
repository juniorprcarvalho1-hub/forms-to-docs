import {expect,test} from "bun:test";
import {gerarPdfAtual} from "./pdf-atual";
test("exporta exatamente o HTML visualizado sem buscar outro documento",async()=>{
 let buscou=false;let recebido="";
 const visivel="<p>junto aos(às) alunos(as) Pessoa Um e Pessoa Dois</p>";
 const blob=await gerarPdfAtual(async()=>{buscou=true;return "<p>junto a Pessoa Um; Pessoa Dois</p>";},async html=>{recebido=html;return new Blob([html]);},visivel);
 expect(buscou).toBe(false);expect(recebido).toBe(visivel);expect(await blob.text()).toBe(visivel);
});
test("ações na lista e em lote montam o conteúdo atual a cada exportação",async()=>{
 let atual="<p>Versão 1</p>";const montar=async()=>atual;
 const render=async(html:string)=>new Blob([html]);
 expect(await (await gerarPdfAtual(montar,render)).text()).toBe("<p>Versão 1</p>");
 atual="<p>Versão corrigida</p>";
 expect(await (await gerarPdfAtual(montar,render)).text()).toBe("<p>Versão corrigida</p>");
});
test("falha ao montar o documento atual não entrega um arquivo antigo",async()=>{
 let renderizou=false;
 await expect(gerarPdfAtual(async()=>{throw new Error("Sem acesso ao modelo");},async()=>{renderizou=true;return new Blob();})).rejects.toThrow("Sem acesso ao modelo");
 expect(renderizou).toBe(false);
});
test("visualização vazia não gera um PDF em branco",async()=>{
 await expect(gerarPdfAtual(async()=>"<p>Outro</p>",async html=>new Blob([html]),"")).rejects.toThrow("conteúdo atual");
});
