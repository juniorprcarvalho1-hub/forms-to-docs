import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import puppeteer from "puppeteer-core";
import {paginaHtmlRenderizacao,incorporarImagensAutomacao,montarHtmlAutomacao} from "../../src/lib/automacao-html.ts";
import {validarPdfA4} from "../../src/lib/pdf-validacao.ts";
import { prepararRodapeParaPdf } from "../../src/lib/pdf-rodape.ts";
import { normalizarCoresParaPdf } from "../../src/lib/pdf-cores.ts";

const browser=await puppeteer.launch({headless:true,executablePath:process.env["CHROME_BIN"]||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--host-resolver-rules=MAP * ~NOTFOUND"]});
const out=new URL("./artifacts/",import.meta.url);await mkdir(out,{recursive:true});
async function imprimir(html:string,name:string){
 const page=await browser.newPage();let requests=0;
 await page.setRequestInterception(true);page.on("request",request=>{if(/^(?:https?|file|ftp):/.test(request.url())){requests++;void request.abort();}else void request.continue();});
 const ready=paginaHtmlRenderizacao(html,crypto.randomUUID().replaceAll("-",""));
 await page.setContent(ready.html,{waitUntil:"load",timeout:20000});await page.waitForSelector(ready.seletor,{timeout:20000});
 const pdf=await page.pdf({format:"A4",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
 await writeFile(new URL(name+".pdf",out),pdf);
 await page.screenshot({path:new URL(name+".png",out).pathname,fullPage:true});
 assert.equal(requests,0,"nenhuma requisição externa pode sair do documento");
 await page.close();return pdf;
}
try{
 const paginaPdf = await browser.newPage();
 await paginaPdf.setContent('<main style="background: white"><p style="color: oklch(55% .2 30); border: 1px solid oklch(.905 .006 255); background: linear-gradient(oklch(.9 .03 45), #fff)">Ofício</p></main>');
 await paginaPdf.addScriptTag({path:new URL("../../node_modules/html2canvas/dist/html2canvas.min.js",import.meta.url).pathname});
 const desenhar = () => paginaPdf.evaluate(async () => {
   const gerar = Reflect.get(window, "html2canvas");
   const canvas: HTMLCanvasElement = await gerar(document.querySelector("main"), { logging: false });
   return canvas.width;
 });
 await assert.rejects(desenhar(), /unsupported color function "oklch"/);
 const documento = await paginaPdf.$("main");
 assert.ok(documento);
 await paginaPdf.evaluate(normalizarCoresParaPdf, documento);
 assert.ok(await desenhar() > 0);
 await paginaPdf.setContent(`<main style="width:794px;background:#fff;color:#8c1b1b">
   <footer data-rodape-oficio style="text-align:center">
     <p style="margin:0;font:10px/8px Calibri,Arial,sans-serif;background:white">Credenciada pela Portaria de 09/07/2007</p>
     <p style="margin:0;font:10px/8px Calibri,Arial,sans-serif;background:white;color:black">Rua Cel. Trapiá</p>
     <p style="margin:0;background:#ffebc5">Fundo intencional</p>
   </footer>
 </main>`);
 await paginaPdf.addScriptTag({path:new URL("../../node_modules/html2canvas/dist/html2canvas.min.js",import.meta.url).pathname});
 const contarPixelsVermelhos = () => paginaPdf.evaluate(async () => {
   const gerar = Reflect.get(window, "html2canvas");
   const canvas: HTMLCanvasElement = await gerar(document.querySelector("main"), { logging: false, scale: 2 });
   const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
   let vermelhos = 0;
   for (let i = 0; i < pixels.length; i += 4) {
     if (pixels[i]! < 210 && pixels[i + 1]! < 130 && pixels[i]! > pixels[i + 1]! + 40) vermelhos++;
   }
   return vermelhos;
 });
 const cortado = await contarPixelsVermelhos();
 const paginaOficio = await paginaPdf.$("main");
 assert.ok(paginaOficio);
 await paginaPdf.evaluate(prepararRodapeParaPdf, paginaOficio);
 const completo = await contarPixelsVermelhos();
 assert.ok(completo > cortado, `O texto do rodapé deve ganhar os pixels recortados: ${cortado} -> ${completo}`);
 assert.equal(await paginaPdf.$eval("footer p:last-child", (p) => getComputedStyle(p).backgroundColor), "rgb(255, 235, 197)");
 await paginaPdf.close();

 const image=await readFile(new URL("../../public/brand/facesf.png",import.meta.url));
 const html=await incorporarImagensAutomacao('<img src="/brand/facesf.png" style="width:110px"><h1>Verificação técnica</h1><p>PDF A4 com imagem institucional carregada.</p>',"https://auxsyadqijcjngmujagx.supabase.co",async()=>({bytes:new Uint8Array(image),mime:"image/png"}));
 await validarPdfA4(await imprimir(html,"a4-valido"));console.log("PASS: imagem completa e uma página A4");
 await assert.rejects(validarPdfA4(await imprimir('<p style="height:400mm">Conteúdo além de uma página</p>',"excesso-vertical")),(e:any)=>e.codigo==="pdf_layout");console.log("PASS: excesso vertical recusado");
 const clipped='<style>@media print{.cortado{height:5px;overflow:hidden}}</style><p class="cortado">'+Array(30).fill("Texto que não pode ser cortado<br>").join("")+'</p>';
 await assert.rejects(validarPdfA4(await imprimir(clipped,"recorte-na-impressao")),(e:any)=>e.codigo==="pdf_layout");console.log("PASS: recorte em CSS de impressão recusado");
 const fixtures=JSON.parse(await readFile(new URL("./modelos-originais.json",import.meta.url),"utf8"));
 const migration=await readFile(new URL("../../supabase/migrations/20261112013705_modelo_preceptoria_importacao_master.sql",import.meta.url),"utf8");
 const preceptoria=migration.split("$modelo$")[1];
 assert.ok(preceptoria?.includes("preceptoria-a4"));
 for(const fixture of fixtures.perfis){
  const grupo=fixture.tipo==="oficios"?"oficios":fixture.tipo==="declaracoes"?"preceptoria":"avaliacao";
  const original=fixtures.modelos[grupo].find((m:any)=>m.chave===fixture.chave);
  const modelo=fixture.tipo==="declaracoes"
   ? {chave:fixture.chave,html:preceptoria.replace("__NUCLEO__",fixture.chave==="psicologia"?"nupep":"nupes")}
   : original;
  const snapshot={config:fixtures.config,documento:{...fixtures.documento,curso:fixture.curso,modelo_chave:fixture.chave,periodo:fixture.periodo},modelos:[{chave:modelo.chave,modelo_html:modelo.html}]};
  const rendered=montarHtmlAutomacao(fixture.tipo,snapshot);
  // Este teste mede o layout original com o logo público da instituição; o Storage real é verificado no servidor.
  const html=await incorporarImagensAutomacao(rendered,"https://auxsyadqijcjngmujagx.supabase.co",async()=>({bytes:new Uint8Array(image),mime:"image/png"}));
  await validarPdfA4(await imprimir(html,fixture.nome));console.log("PASS: modelo "+fixture.nome);
 }
}finally{await browser.close();}
