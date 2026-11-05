import {ErroAutomacao} from "../../src/lib/automacao-erros.ts";
import {paginaHtmlRenderizacao} from "../../src/lib/automacao-html.ts";
export async function lerBytesLimitados(response:Response,limit=8000000):Promise<Uint8Array>{
 if(Number(response.headers.get("content-length")||0)>limit)throw new ErroAutomacao("pdf_invalido");
 const reader=response.body?.getReader();if(!reader)throw new ErroAutomacao("pdf_invalido");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new ErroAutomacao("pdf_invalido");}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function renderizarCloudflare(html:string,env:{accountId:string|undefined;token:string|undefined},request:typeof fetch=fetch):Promise<Uint8Array>{
 const account=env.accountId?.trim(),token=env.token?.trim();
 if(!account||!/^[a-f0-9]{32}$/.test(account)||!token||token.length>512||/[\r\n]/.test(token))throw new ErroAutomacao("renderizador_ausente");
 const page=paginaHtmlRenderizacao(html,crypto.randomUUID().replaceAll("-",""));
 let response:Response;
 try{response=await request("https://api.cloudflare.com/client/v4/accounts/"+account+"/browser-run/pdf",{
  method:"POST",redirect:"error",signal:AbortSignal.timeout(60000),
  headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({html:page.html,setJavaScriptEnabled:true,rejectRequestPattern:["^(?:https?|file|ftp|wss?):"],viewport:{width:794,height:1123},waitForSelector:{selector:page.seletor,timeout:20000},
   pdfOptions:{format:"a4",landscape:false,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margin:{top:"0",bottom:"0",left:"0",right:"0"}}}),
 });}catch{throw new ErroAutomacao("renderizador_indisponivel");}
 if(!response.ok)throw new ErroAutomacao([401,403,404].includes(response.status)?"renderizador_ausente":response.status===400||response.status===413?"pdf_layout":"renderizador_indisponivel");
 return lerBytesLimitados(response);
}
export async function enviarPeloBridge(ticket:string,request:typeof fetch=fetch):Promise<{id:string}>{
 if(!/^[a-f0-9]{64}$/.test(ticket))throw new ErroAutomacao("ticket_invalido");
 let response:Response;
 try{response=await request("https://forms-to-docs.lovable.app/api/internal/documentos-email",{method:"POST",redirect:"error",signal:AbortSignal.timeout(75000),headers:{"content-type":"application/json"},body:JSON.stringify({ticket})});}catch{throw new ErroAutomacao("gmail_indisponivel",true);}
 let body:unknown;
 try{body=await response.json();}catch{throw new ErroAutomacao("gmail_indisponivel",true);}
 const p=body&&typeof body==="object"?body as Record<string,unknown>:{};
 if(response.ok&&typeof p["id"]==="string"&&/^[A-Za-z0-9_-]{1,256}$/.test(p["id"]))return{id:p["id"]};
 const safe=new Set(["gmail_ausente","gmail_recusado","ticket_invalido","pdf_invalido","storage_indisponivel","gmail_indisponivel"]);
 const code=typeof p["codigo"]==="string"&&safe.has(p["codigo"])?p["codigo"]:"gmail_indisponivel";
 throw new ErroAutomacao(code,typeof p["incerto"]==="boolean"?p["incerto"]:true);
}
