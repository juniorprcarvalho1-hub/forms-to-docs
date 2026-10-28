import {caminhoImagemInstitucionalPermitido} from "../../src/lib/imagens-institucionais.ts";
export type AssetDependencies={authorize:(token:string)=>Promise<"active"|"inactive"|"invalid">;sign:(path:string)=>Promise<string>};
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function handleArquivoInstitucional(request:Request,deps:AssetDependencies):Promise<Response>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST")return json({error:"Método não permitido."},405);
 const auth=request.headers.get("authorization")??"";
 const token=auth.match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!token||token.length>8192)return json({error:"Entre no sistema para carregar imagens."},401);
 try{
  const state=await deps.authorize(token);
  if(state==="invalid")return json({error:"Sessão inválida."},401);
  if(state!=="active")return json({error:"Conta sem acesso ativo."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"Envie JSON."},415);
  if(Number(request.headers.get("content-length"))>2048)return json({error:"Solicitação muito grande."},413);
  const reader=request.body?.getReader();if(!reader)return json({error:"Dados ausentes."},400);
  const parts:Uint8Array[]=[];let size=0;
  try{
   while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel().catch(()=>{});return json({error:"Solicitação muito grande."},413)}parts.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  let body:unknown;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:"JSON inválido."},400);}
  const path=body&&typeof body==="object"&&!Array.isArray(body)?(body as Record<string,unknown>).path:undefined;
  if(!caminhoImagemInstitucionalPermitido(path))return json({error:"Imagem institucional não encontrada."},404);
  return json({url:await deps.sign(path),expiresIn:300},200);
 }catch{return json({error:"Não foi possível carregar a imagem institucional. Tente novamente."},503);}
}
