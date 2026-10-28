import {createClient} from "npm:@supabase/supabase-js@2.112.3";
import {handleFormsRequest,formsFailure} from "./forms-http.ts";
import {handleOficios,handleDeclaracoes,handleRespostas,type FormsAdmin} from "./forms-handlers.ts";
const url=Deno.env.get("SUPABASE_URL")!;
const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const handlers={oficios:handleOficios,declaracoes:handleDeclaracoes,"declaracoes-resposta":handleRespostas};
Deno.serve((request:Request)=>handleFormsRequest(request,{
 documents:async(destination,replay,_raw,token)=>{
  const {data,error}=await admin.rpc("forms_documentos_contexto",{p_token:token});
  if(error||typeof data!=="string")return formsFailure(error??{message:"FORMS_NOT_CONFIGURED"});
  return handlers[destination](replay,admin as unknown as FormsAdmin,token);
 },
}));
