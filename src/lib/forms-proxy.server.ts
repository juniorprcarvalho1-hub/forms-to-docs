import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config";
type Destination="oficios"|"declaracoes"|"declaracoes-resposta";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function encaminharFormulario(request:Request,destination:Destination,send:typeof fetch=fetch):Promise<Response>{
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:"Dados ausentes."},400);
  const parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>64000){await reader.cancel();return json({error:"Resposta muito grande."},413)}parts.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}
  const body=new TextDecoder().decode(bytes);let raw:unknown;try{raw=JSON.parse(body)}catch{return json({error:"JSON inválido."},400)}
  const priorToken=raw&&typeof raw==="object"&&!Array.isArray(raw)?(raw as Record<string,unknown>)["token"]:"";
  const token=request.headers.get("x-webhook-token")??(typeof priorToken==="string"?priorToken:"");
  if(!token||token.length>256)return json({error:"Token obrigatório."},401);
  let id=request.headers.get("x-facesf-id");
  if(!id){const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(crypto.randomUUID()));id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("")}
  const response=await send(SUPABASE_URL+"/functions/v1/formularios/"+destination,{method:"POST",headers:{"content-type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY,"x-webhook-token":token,"x-facesf-id":id},body,redirect:"error",signal:AbortSignal.timeout(20000)});
  if(!response.headers.get("content-type")?.includes("application/json"))return json({error:"Serviço temporariamente indisponível."},503);
  const data:unknown=await response.json();
  if(response.status>=500)return json({error:"Serviço temporariamente indisponível. Reenvie com o mesmo identificador."},503);
  if(response.ok&&(!data||typeof data!=="object"||!("ok" in data)||(data as {ok:unknown}).ok!==true))return json({error:"Resposta inesperada do serviço."},503);
  return json(data,response.status);
 }catch{return json({error:"Serviço temporariamente indisponível. O envio pode ser repetido com o mesmo identificador."},503)}
}
