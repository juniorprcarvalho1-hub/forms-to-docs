import {parseHTML} from "linkedom";
import {PDFDocument} from "pdf-lib";
import {montarDocumentoHtml,type Oficio,type Configuracoes,type ModeloOficio} from "./oficios.ts";
import {montarDeclaracaoHtml,type Declaracao,type ModeloDeclaracao} from "./declaracoes.ts";
import {montarDeclaracaoRespostaHtml,type DeclaracaoResposta,type ModeloDeclaracaoResposta} from "./declaracoes-resposta.ts";
import {identificarImagemInstitucional,type ReferenciaImagem} from "./imagens-institucionais.ts";
import {ErroAutomacao} from "./automacao-erros.ts";
export type TipoDocumento="oficios"|"declaracoes"|"declaracoes_resposta";
export type SnapshotDocumento={documento:Record<string,unknown>;config:Record<string,unknown>;modelos:Array<Record<string,unknown>>};
export function montarHtmlAutomacao(tipo:TipoDocumento,snapshot:SnapshotDocumento):string{
 const d=snapshot.documento,c=snapshot.config;
 if(typeof d["conteudo_html"]==="string"&&d["conteudo_html"].trim())return d["conteudo_html"];
 const modelo=snapshot.modelos.find(m=>m["chave"]===d["modelo_chave"]);
 if(!modelo||typeof modelo["modelo_html"]!=="string"||!modelo["modelo_html"].trim())throw new ErroAutomacao("modelo_ausente");
 const texto=[tipo==="oficios"?c["cabecalho_html"]:"",modelo["modelo_html"],tipo==="oficios"?c["rodape_html"]:""].filter(Boolean).join("");
 const calculados=new Set(["conselho","departamento","nucleo","portaria"]);
 for(const tag of texto.matchAll(/\{\{([^}]+)\}\}/g)){
  const k=tag[1]!;
  if(calculados.has(k))continue;
  const value=k==="numero"?d["numero_formatado"]:k==="cargo_coordenador"?c["padrao_cargo_coordenador"]:d[k]??c["padrao_"+k]??c[k];
  if(value===null||value===undefined||!String(value).trim())throw new ErroAutomacao("campo_ausente");
 }
 const config=c as unknown as Configuracoes;
 if(tipo==="oficios")return montarDocumentoHtml(d as unknown as Oficio,config,snapshot.modelos as unknown as ModeloOficio[]);
 if(tipo==="declaracoes")return montarDeclaracaoHtml(d as unknown as Declaracao,config,snapshot.modelos as unknown as ModeloDeclaracao[]);
 return montarDeclaracaoRespostaHtml(d as unknown as DeclaracaoResposta,snapshot.modelos as unknown as ModeloDeclaracaoResposta[]);
}
export type ImagemAutomacao={bytes:Uint8Array;mime:string};
export function bytesBase64(bytes:Uint8Array):string{
 let s="";for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);
}
async function imagemBase64(image:ImagemAutomacao):Promise<string>{
 const bytes=image.bytes;if(bytes.length>2000000)throw new ErroAutomacao("imagem_invalida");
 try{
  const p=await PDFDocument.create();
  if(image.mime==="image/png")await p.embedPng(bytes);
  else if(image.mime==="image/jpeg")await p.embedJpg(bytes);
  else throw Error();
 }catch{throw new ErroAutomacao("imagem_invalida");}
 return "data:"+image.mime+";base64,"+bytesBase64(bytes);
}
export async function incorporarImagensAutomacao(html:string,origin:string,load:(ref:ReferenciaImagem)=>Promise<ImagemAutomacao>):Promise<string>{
 if(html.length>2000000)throw new ErroAutomacao("pdf_layout");
 const {document}=parseHTML("<html><head></head><body>"+html+"</body></html>");
 if(document.querySelector("script,iframe,object,embed,base,link,meta,svg,form"))throw new ErroAutomacao("imagem_invalida");
 for(const node of document.querySelectorAll("*")){
  for(const attr of [...node.attributes])if(/^on/i.test(attr.name)||attr.name==="srcdoc")throw new ErroAutomacao("imagem_invalida");
 }
 const imgs=[...document.querySelectorAll("img")];if(imgs.length>20)throw new ErroAutomacao("imagem_invalida");
 const cache=new Map<string,Promise<string>>();
 await Promise.all(imgs.map(async img=>{
  const src=img.getAttribute("src")??"";
  let ref:ReferenciaImagem|null=src==="/brand/facesf.png"?{kind:"local",src}:identificarImagemInstitucional(src,origin);
  try{const u=new URL(src);if(u.origin==="https://sintegradocursosfacesf.com.br"&&u.pathname==="/brand/facesf.png"&&!u.search&&!u.hash)ref={kind:"local",src:"/brand/facesf.png"};}catch{}
  if(!ref)throw new ErroAutomacao("imagem_invalida");
  const key=ref.kind==="storage"?"storage:"+ref.path:"local:"+ref.src;
  if(!cache.has(key)){const captured=ref;cache.set(key,(async()=>{
   let image:ImagemAutomacao;try{image=await load(captured);}catch{throw new ErroAutomacao("imagem_indisponivel");}
   return imagemBase64(image);
  })());}
  img.setAttribute("src",await cache.get(key)!);img.removeAttribute("srcset");img.removeAttribute("sizes");
 }));
 return document.body.innerHTML;
}
/** Apenas este script, com nonce aleatório, pode executar no navegador de impressão. */
export function paginaHtmlRenderizacao(html:string,nonce:string):{html:string;seletor:string}{
 if(!/^[a-f0-9]{32}$/.test(nonce))throw new ErroAutomacao("pdf_invalido");
 const {document}=parseHTML("<html><head></head><body>"+html+"</body></html>");
 if(document.querySelector("script,iframe,object,embed,base,link,meta,svg,form"))throw new ErroAutomacao("imagem_invalida");
 for(const node of document.querySelectorAll("*"))for(const a of [...node.attributes])if(/^on/i.test(a.name)||a.name==="srcdoc")throw new ErroAutomacao("imagem_invalida");
 for(const img of document.querySelectorAll("img"))if(!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(img.getAttribute("src")??""))throw new ErroAutomacao("imagem_invalida");
 const seletor="#facesf-ready-"+nonce;
 const script="(async function(nonce){\n let valido=true;\n try{\n  await document.fonts.ready;\n  await Promise.all(Array.from(document.images).map(async img=>{await img.decode();if(!img.naturalWidth)throw Error();}));\n  const root=document.getElementById(\"facesf-document\"),box=root.getBoundingClientRect();\n  if(!root.textContent.trim()||box.width<700||root.scrollHeight>1123||root.scrollWidth>795)throw Error();\n  for(const node of root.querySelectorAll(\"*\")){\n   const r=node.getBoundingClientRect();\n   if(r.width===0&&r.height===0)continue;\n   if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.top+1123||\n      (node.clientHeight>0&&node.scrollHeight>node.clientHeight+1)||(node.clientWidth>0&&node.scrollWidth>node.clientWidth+1))throw Error();\n  }\n }catch{valido=false;}\n if(!valido){document.body.innerHTML='<div style=\"height:400mm;break-after:page\">Documento inválido: composição ou imagem incompleta.</div><p>Não arquivar.</p>';}\n const ready=document.createElement(\"span\");ready.id=\"facesf-ready-\"+nonce;ready.style.display=\"none\";document.body.appendChild(ready);\n})";
 const executable=script+"("+JSON.stringify(nonce)+");";
 return {seletor,html:'<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-'+nonce+'\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; base-uri \'none\'; form-action \'none\'"><style>*{box-sizing:border-box}html,body{margin:0;width:210mm;background:#fff}.pagina-a4{width:210mm;min-height:297mm;padding:38px 48px;overflow:visible;background:#fff;color:#000;font-family:\'Times New Roman\',serif;font-size:14px;line-height:1.35}h1{font-size:1.6em}h2{font-size:1.35em}h3{font-size:1.15em}h1,h2,h3{font-weight:700;margin:.45em 0}p{margin:0 0 .4em}ul,ol{padding-left:1.6em;margin:0 0 .6em}blockquote{border-left:3px solid #d1d5db;padding-left:1em;margin:0 0 .6em}img{display:inline-block;max-width:100%}table{max-width:100%}.img-selecionada{outline:none!important}</style></head><body><div id="facesf-document" class="prose-oficio pagina-a4">'+document.body.innerHTML+'</div><style>@page{size:A4!important;margin:0!important}</style><script nonce="'+nonce+'">'+executable+'</script></body></html>'};
}
