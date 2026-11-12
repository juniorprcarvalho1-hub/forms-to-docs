import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import puppeteer from "puppeteer-core";
import {paginaHtmlRenderizacao,incorporarImagensAutomacao,montarHtmlAutomacao} from "../../src/lib/automacao-html.ts";
import {validarPdfA4} from "../../src/lib/pdf-validacao.ts";
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
