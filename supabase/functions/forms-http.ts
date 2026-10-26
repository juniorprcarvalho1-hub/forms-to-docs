type Destination="oficios"|"declaracoes"|"declaracoes-resposta";
export type FormsPorts={
 documents:(destination:Destination,request:Request,raw:Record<string,unknown>,token:string,id:string,hash:string)=>Promise<Response>;
 patients:(request:Request,raw:Record<string,unknown>,token:string,id:string)=>Promise<Response>;
};
export const formsJson=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export function formsFailure(error:{message?:string;code?:string}|null):Response{
 const message=error?.message??"";
 if(message.includes("FORMS_TOKEN_INVALID"))return formsJson({error:"Token inválido ou revogado."},401);
 if(message.includes("FORMS_ACCOUNT_INACTIVE"))return formsJson({error:"Conta responsável suspensa ou vencida."},403);
 if(message.includes("FORMS_RESPONSE_CHANGED"))return formsJson({error:"Esta resposta já foi recebida com outros dados. Confira no sistema."},409);
 if(message.includes("FORMS_NUMBERING_BUSY"))return formsJson({error:"Numeração ocupada. Tente novamente."},503);
 if(message.includes("FORMS_RATE_LIMIT")||message.includes("Limite de recebimentos"))return formsJson({error:"Limite de recebimentos atingido."},429);
 if(/FORMS_(FIELDS|ID|DESTINATION)_INVALID/.test(message)||["22007","22008","22P02"].includes(error?.code??""))return formsJson({error:"Confira os campos e as datas do formulário."},422);
 if(message.includes("FORMS_NOT_CONFIGURED"))return formsJson({error:"Configure a conta responsável pelos documentos no sistema."},503);
 return formsJson({error:"Não foi possível receber a resposta. Tente novamente."},503);
}
export async function hashFormsResponses(raw:Record<string,unknown>):Promise<string>{
 const stable=JSON.stringify(Object.keys(raw).sort().filter(k=>k.toLowerCase()!=="token").map(k=>[k,raw[k]]));
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(stable));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export async function handleFormsRequest(request:Request,ports:FormsPorts):Promise<Response>{
 const destination=new URL(request.url).pathname.split("/").filter(Boolean).pop()??"";
 if(request.method==="GET"&&destination==="health")return formsJson({ok:true,service:"formularios"});
 if(request.method!=="POST")return formsJson({error:"Envie POST."},405);
 if(!["oficios","declaracoes","declaracoes-resposta","pacientes"].includes(destination))return formsJson({error:"Destino inexistente."},404);
 const token=(request.headers.get("x-webhook-token")??"").trim();
 if(!token||token.length>256)return formsJson({error:"Token obrigatório."},401);
 const id=request.headers.get("x-facesf-id")??"";
 if(!/^[a-f0-9]{64}$/.test(id))return formsJson({error:"Identificador da resposta inválido."},400);
 if(!request.headers.get("content-type")?.includes("application/json"))return formsJson({error:"Envie application/json."},415);
 const reader=request.body?.getReader();if(!reader)return formsJson({error:"Resposta vazia."},400);
 let size=0;const chunks:Uint8Array[]=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>64000){await reader.cancel();return formsJson({error:"Resposta muito grande."},413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const text=new TextDecoder().decode(bytes);let raw:unknown;
  try{raw=JSON.parse(text)}catch{return formsJson({error:"JSON inválido."},400)}
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).length>100)return formsJson({error:"Envie as respostas como um objeto."},400);
  const data=raw as Record<string,unknown>;
  const valid=(v:unknown,depth=0):boolean=>v===null||["string","number","boolean"].includes(typeof v)||(depth<4&&Array.isArray(v)&&v.every(x=>valid(x,depth+1)));
  if(!Object.values(data).every(v=>valid(v)))return formsJson({error:"Formato de resposta inválido."},400);
  const headers=new Headers(request.headers);const hash=await hashFormsResponses(data);headers.set("x-facesf-source-hash",hash);
  const replay=new Request(request.url,{method:"POST",headers,body:text});
  if(destination==="pacientes")return await ports.patients(replay,data,token,id);
  return await ports.documents(destination as Destination,replay,data,token,id,hash);
 }catch{return formsJson({error:"Serviço indisponível. O reenvio pode ser feito com o mesmo identificador."},503)}
}
