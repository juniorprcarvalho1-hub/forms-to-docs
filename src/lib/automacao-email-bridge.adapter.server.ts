import {handleEmailBridge,type EnvelopeEmail} from "./automacao-email-bridge.server";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config";
import {ErroAutomacao} from "./automacao-erros";
export async function executarBridgeEmail(request:Request):Promise<Response>{
 const lovableKey=process.env["LOVABLE_API_KEY"],gmailKey=process.env["GOOGLE_MAIL_API_KEY"];
 async function worker(ticket:string,etapa:"envelope"|"enviar"){
  const response=await fetch(SUPABASE_URL+"/functions/v1/documentos-worker/email",{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"content-type":"application/json",apikey:SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({ticket,etapa})});
  if(response.status===401)return null;
  if(!response.ok)throw new ErroAutomacao("storage_indisponivel");
  return response.json();
 }
 return handleEmailBridge(request,{
  configurado:!!lovableKey&&!!gmailKey,
  consumir:async ticket=>(await worker(ticket,"envelope")) as EnvelopeEmail|null,
  autorizar:async ticket=>!!(await worker(ticket,"enviar"))?.autorizado,
  lerPdf:async e=>{
   const response=await fetch(e.pdf_url,{redirect:"error",signal:AbortSignal.timeout(15000)});
   if(!response.ok||Number(response.headers.get("content-length")??0)>8000000)throw new ErroAutomacao("storage_indisponivel");
   const reader=response.body?.getReader();if(!reader)throw new ErroAutomacao("storage_indisponivel");
   const chunks:Uint8Array[]=[];let size=0;while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>8000000){await reader.cancel();throw new ErroAutomacao("pdf_invalido");}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
  },
  enviarMime:async raw=>{
   let response:Response;
   try{response=await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",{method:"POST",redirect:"error",signal:AbortSignal.timeout(30000),headers:{Authorization:"Bearer "+lovableKey,"X-Connection-Api-Key":gmailKey!,"content-type":"application/json"},body:JSON.stringify({raw})});}catch{throw new ErroAutomacao("gmail_indisponivel",true);}
   if(!response.ok)throw new ErroAutomacao([401,403].includes(response.status)?"gmail_ausente":"gmail_recusado",response.status>=500||response.status===408);
   try{return await response.json();}catch{throw new ErroAutomacao("gmail_indisponivel",true);}
  },
 });
}
