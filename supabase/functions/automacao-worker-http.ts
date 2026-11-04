import {ErroAutomacao} from "../../src/lib/automacao-erros.ts";
type Ticket={modo:"processar"|"verificar"|"auditar";job?:unknown;indice?:number};
export type WorkerPorts={
 consumir:(ticket:string)=>Promise<Ticket|null>;
 processar:(job:any)=>Promise<string>;
 diagnosticar:(modo:string,indice:number)=>Promise<unknown>;
 envelope:(ticket:string)=>Promise<unknown>;
 autorizarEmail:(ticket:string)=>Promise<boolean>;
};
export async function handleWorkerRequest(req:Request,ports:WorkerPorts):Promise<Response>{
 const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
 const path=new URL(req.url).pathname;
 if(req.method==="GET"&&path.endsWith("/health"))return respond({ok:true,service:"documentos-worker"});
 if(req.method!=="POST")return respond({erro:"metodo_invalido"},405);
 try{
  const declared=Number(req.headers.get("content-length")??0);if(declared>4096)return respond({erro:"payload_excessivo"},413);
  const bytes=new Uint8Array(await new Response(req.body).arrayBuffer());if(bytes.length>4096)return respond({erro:"payload_excessivo"},413);
  let b:Record<string,unknown>;try{b=JSON.parse(new TextDecoder().decode(bytes));}catch{return respond({erro:"payload_invalido"},400);}
  const email=path.endsWith("/email");
  if(!b||typeof b!=="object"||Array.isArray(b)||Object.keys(b).some(k=>!(email?["ticket","etapa"]:["ticket"]).includes(k))||typeof b.ticket!=="string"||!/^[a-f0-9]{64}$/.test(b.ticket))return respond({erro:"payload_invalido"},400);
  if(email){
   if(b.etapa==="envelope"){const result=await ports.envelope(b.ticket);return result?respond(result):respond({erro:"ticket_invalido"},401);}
   if(b.etapa==="enviar")return await ports.autorizarEmail(b.ticket)?respond({autorizado:true}):respond({erro:"ticket_invalido"},401);
   return respond({erro:"payload_invalido"},400);
  }
  const cap=await ports.consumir(b.ticket);if(!cap)return respond({erro:"ticket_invalido"},401);
  if(cap.modo!=="processar")return respond(await ports.diagnosticar(cap.modo,cap.indice??0));
  if(!cap.job)return respond({processados:0});
  return respond({processados:1,resultado:await ports.processar(cap.job)});
 }catch(e){return respond({erro:e instanceof ErroAutomacao?e.codigo:"servico_indisponivel"},503);}
}
