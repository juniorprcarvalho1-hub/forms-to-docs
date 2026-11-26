import assert from "node:assert/strict";
import path from "node:path";
import {mkdir} from "node:fs/promises";
import puppeteer from "puppeteer-core";
const raiz=path.resolve(import.meta.dir,"../..");
const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const bundle=await Bun.build({
 entrypoints:[path.join(import.meta.dir,"editor-fixture.tsx")],target:"browser",format:"iife",
 plugins:[{name:"editor-sem-servicos-externos",setup(build){
  build.onResolve({filter:/^@\/lib\/(storage|supabase-config)$/},args=>({path:args.path,namespace:"editor-mock"}));
  build.onLoad({filter:/.*/,namespace:"editor-mock"},args=>({loader:"ts",contents:args.path.endsWith("storage")
   ? 'export async function uploadArquivo(){};export async function urlAssinada(){return '+JSON.stringify(png)+'};export async function prepararImagensInstitucionais(){};'
   : 'export const SUPABASE_URL="https://auxsyadqijcjngmujagx.supabase.co";'}));
  build.onResolve({filter:/^@\//},args=>{
   const p=path.join(raiz,"src",args.path.slice(2));
   return {path:Bun.resolveSync(p,raiz)};
  });
 }}],
});
assert(bundle.success,bundle.logs.map(String).join("\n"));
const browser=await puppeteer.launch({headless:true,executablePath:process.env["CHROME_BIN"]||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--host-resolver-rules=MAP * ~NOTFOUND"]});
try{
 const page=await browser.newPage(),erros:string[]=[];
 page.on("pageerror",e=>erros.push(String(e)));
 await page.setViewport({width:1280,height:1600});
 await page.setContent('<html><head><style>*{box-sizing:border-box}body{margin:20px;font:14px Arial;background:#f6f6f6}.pagina-a4{width:794px;min-height:1123px;padding:38px 48px;background:white}.relative{position:relative}.flex{display:flex}.flex-wrap{flex-wrap:wrap}.gap-1{gap:4px}.gap-2{gap:8px}.gap-3{gap:12px}fieldset{border:1px solid #ddd;padding:10px}button,input,select{font:inherit;min-height:30px}.hidden{display:none}.space-y-3>div{margin-bottom:10px}h1{font-size:20px}.border-b{border-bottom:1px solid #ddd}</style></head><body><main id="root" style="max-width:940px"></main></body></html>');
 await page.addScriptTag({content:await bundle.outputs[0]!.text()});
 const selector="[data-editor-documento] img";
 await page.waitForSelector(selector);
 const geometria=()=>page.$eval(selector,(i:HTMLImageElement)=>({x:parseFloat(i.style.left),y:parseFloat(i.style.top),width:i.offsetWidth,height:i.offsetHeight}));
 const caixa=async()=>{const i=await page.$(selector);assert(i);const b=await i.boundingBox();assert(b);return b;};
 let b=await caixa();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
 await page.mouse.move(b.x+b.width/2+80,b.y+b.height/2+40,{steps:8});
 const durante=await caixa();assert(Math.abs(durante.y-(b.y+40))<2,"o painel não pode deslocar a página durante o arraste");
 await page.mouse.up();
 let g=await geometria();assert(Math.abs(g.x-180)<2&&Math.abs(g.y-840)<2);
 await page.focus('[aria-label="Posição vertical da imagem"]');
 await page.keyboard.down("Control");await page.keyboard.press("A");await page.keyboard.up("Control");await page.keyboard.type("920");await page.keyboard.press("Tab");
 assert.equal((await geometria()).y,920);
 await page.evaluate(()=>{Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Centro")!.click();});
 assert.equal((await geometria()).x,297);
 const h=await page.$('[aria-label="Redimensionar imagem"]');assert(h);b=(await h.boundingBox())!;
 await page.mouse.move(b.x+7,b.y+7);await page.mouse.down();await page.mouse.move(b.x+107,b.y+47,{steps:6});await page.mouse.up();
 g=await geometria();assert.equal(g.width,300);assert.equal(g.height,120);
 await page.click('[aria-label="Desfazer"]');assert.equal((await geometria()).width,200);
 await page.click('[aria-label="Refazer"]');g=await geometria();assert.equal(g.width,300);
 const html=await page.$eval("#html-salvo",(e:HTMLTextAreaElement)=>e.value);
 assert(html.includes("{{nome}}")&&html.includes("padding:0!important"));
 assert(!html.includes("img-selecionada")&&!html.includes("Redimensionar imagem"));
 await page.click("#reabrir");assert.deepEqual(await geometria(),g);
 const out=new URL("./artifacts/",import.meta.url);await mkdir(out,{recursive:true});
 await page.screenshot({path:path.join(out.pathname,"editor-desktop.png"),fullPage:true});
 await page.setViewport({width:560,height:1300});
 await page.click(selector);b=await caixa();const escala=b.width/g.width;
 const largura=await page.$eval('[aria-label="Largura da imagem"]',(e:HTMLInputElement)=>Number(e.value));assert.equal(largura,g.width);
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-40,b.y+b.height/2-40,{steps:6});await page.mouse.up();
 const depois=await geometria();assert(Math.abs(depois.x-(g.x-40/escala))<2&&Math.abs(depois.y-(g.y-40/escala))<2);
 await page.screenshot({path:path.join(out.pathname,"editor-estreito.png"),fullPage:true});
 assert.deepEqual(erros,[]);
 console.log("Editor: arraste sem salto, coordenadas, proporção, desfazer/refazer, salvar/reabrir e escala reduzida verificados.");
}finally{await browser.close();}
