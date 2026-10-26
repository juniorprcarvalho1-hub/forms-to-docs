import {createClient} from "npm:@supabase/supabase-js@2.112.3";
import {handleFormsRequest,formsFailure,formsJson} from "./forms-http.ts";
import {handleOficios,handleDeclaracoes,handleRespostas,type FormsAdmin} from "./forms-handlers.ts";
import {revisarTabela,sugerirMapeamento,tabelaDaMatriz} from "../../src/lib/importacao.ts";
const url=Deno.env.get("SUPABASE_URL")!;
const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const publicDb=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
const handlers={oficios:handleOficios,declaracoes:handleDeclaracoes,"declaracoes-resposta":handleRespostas};
Deno.serve((request:Request)=>handleFormsRequest(request,{
 documents:async(destination,replay,_raw,token)=>{
  const {data,error}=await admin.rpc("forms_documentos_contexto",{p_token:token});
  if(error||typeof data!=="string")return formsFailure(error??{message:"FORMS_NOT_CONFIGURED"});
  return handlers[destination](replay,admin as unknown as FormsAdmin,token);
 },
 patients:async(_request,raw,token)=>{
  if(!/^[a-f0-9]{64}$/.test(token))return formsJson({error:"Token inválido."},401);
  const columns=Object.keys(raw);
  const values=Object.values(raw).map(v=>Array.isArray(v)?v.flat(Infinity).map(String).join("; "):v===null?"":String(v));
  const [row]=revisarTabela(tabelaDaMatriz([columns,values]),sugerirMapeamento(columns,"pacientes"),"pacientes");
  if(!row||row.erros.length)return formsJson({error:"Confira os campos do cadastro.",campos:row?.erros??[]},422);
  const {data,error}=await publicDb.rpc("receber_paciente_forms",{p_token:token,p_dados:row.dados});
  if(error){
   if(error.message.includes("Limite de recebimentos"))return formsFailure(error);
   if(/integra[cç][aã]o|token/i.test(error.message))return formsJson({error:"Conexão inválida, revogada ou conta indisponível."},401);
   return formsJson({error:"Não foi possível receber o cadastro."},503);
  }
  return formsJson({ok:true,duplicado:!!(data&&typeof data==="object"&&!Array.isArray(data)&&data.duplicado)});
 }
}));
