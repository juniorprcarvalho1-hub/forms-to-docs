import {validarPdfA4} from "./pdf-validacao.ts";
import {bytesBase64} from "./automacao-bytes.ts";
import {ErroAutomacao} from "./automacao-erros.ts";
export type EnvelopeEmail={job_id:string;to:string;message_id:string;assunto:string;corpo:string;pdf_url:string;pdf_sha256:string};
export type EmailBridgePorts={configurado:boolean;consumir:(ticket:string)=>Promise<EnvelopeEmail|null>;lerPdf:(envelope:EnvelopeEmail)=>Promise<Uint8Array>;autorizar:(ticket:string)=>Promise<boolean>;enviarMime:(raw:string)=>Promise<{id:string}>};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
function validarEnvelope(e:EnvelopeEmail|null):e is EnvelopeEmail{
 if(!e||typeof e.job_id!=="string"||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(e.job_id)||
  typeof e.to!=="string"||e.to.length>254||!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e.to)||
  e.message_id!=="<facesf."+e.job_id+"@sintegradocursosfacesf.com.br>"||
  typeof e.assunto!=="string"||!e.assunto.trim()||e.assunto.length>1000||
  typeof e.corpo!=="string"||e.corpo.length>20000||typeof e.pdf_sha256!=="string"||!/^[a-f0-9]{64}$/.test(e.pdf_sha256))return false;
 try{const u=new URL(e.pdf_url),path=decodeURIComponent(u.pathname);return u.origin==="https://auxsyadqijcjngmujagx.supabase.co"&&!u.username&&!u.password&&!u.hash&&path.startsWith("/storage/v1/object/sign/oficios/")&&path.endsWith(".pdf")&&!path.includes("..")&&!!u.searchParams.get("token");}catch{return false;}
}
function base64Utf8(text:string){return bytesBase64(new TextEncoder().encode(text));}
function assuntoMime(text:string){
 const pieces:string[]=[];let part="";
 for(const char of text){if(new TextEncoder().encode(part+char).length>42){pieces.push(part);part=char;}else part+=char;}
 if(part)pieces.push(part);
 return pieces.map(s=>"=?UTF-8?B?"+base64Utf8(s)+"?=").join("\r\n ");
}
function mimeMensagem(e:EnvelopeEmail,bytes:Uint8Array):string{
 const boundary="facesf_"+crypto.randomUUID().replaceAll("-","");
 const mime=[
  "To: "+e.to,"Message-ID: "+e.message_id,"Subject: "+assuntoMime(e.assunto),"MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="'+boundary+'"',"","--"+boundary,
  'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: base64","",base64Utf8(e.corpo),"",
  "--"+boundary,"Content-Type: application/pdf","Content-Transfer-Encoding: base64",
  'Content-Disposition: attachment; filename="declaracao-avaliacao.pdf"',"",bytesBase64(bytes).replace(/(.{76})/g,"$1\r\n"),"",
  "--"+boundary+"--","",
 ].join("\r\n");
 return base64Utf8(mime).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
export async function handleEmailBridge(request:Request,ports:EmailBridgePorts):Promise<Response>{
 if(request.method!=="POST")return json({codigo:"metodo_invalido",incerto:false},405);
 if(!request.headers.get("content-type")?.includes("application/json"))return json({codigo:"formato_invalido",incerto:false},415);
 let ticket:string;
 try{
  const reader=request.body?.getReader();if(!reader)return json({codigo:"ticket_invalido",incerto:false},400);
  let body="",size=0;const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json({codigo:"ticket_invalido",incerto:false},413);}body+=decoder.decode(value,{stream:true});}
  body+=decoder.decode();const p=JSON.parse(body);
  if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).length!==1||typeof p.ticket!=="string"||!/^[a-f0-9]{64}$/.test(p.ticket))return json({codigo:"ticket_invalido",incerto:false},400);
  ticket=p.ticket;
 }catch{return json({codigo:"ticket_invalido",incerto:false},400);}
 if(!ports.configurado)return json({codigo:"gmail_ausente",incerto:false},503);
 let sending=false;
 try{
  const envelope=await ports.consumir(ticket);
  if(!validarEnvelope(envelope))return json({codigo:"ticket_invalido",incerto:false},401);
  let bytes:Uint8Array;try{bytes=await ports.lerPdf(envelope);}catch{throw new ErroAutomacao("storage_indisponivel");}
  await validarPdfA4(bytes);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer)),b=>b.toString(16).padStart(2,"0")).join("");
  if(hash!==envelope.pdf_sha256)throw new ErroAutomacao("pdf_invalido");
  const raw=mimeMensagem(envelope,bytes);
  if(!await ports.autorizar(ticket))return json({codigo:"ticket_invalido",incerto:false},401);
  sending=true;const receipt=await ports.enviarMime(raw);
  if(!receipt||typeof receipt.id!=="string"||!/^[A-Za-z0-9_-]{1,256}$/.test(receipt.id))throw new ErroAutomacao("gmail_indisponivel",true);
  return json({id:receipt.id});
 }catch(error){
  const codigo=error instanceof ErroAutomacao?error.codigo:sending?"gmail_indisponivel":"storage_indisponivel";
  const incerto=error instanceof ErroAutomacao?error.incerto:sending;
  return json({codigo,incerto},codigo==="pdf_invalido"||codigo==="pdf_layout"?422:503);
 }
}
