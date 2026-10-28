import {createClient} from "npm:@supabase/supabase-js@2.112.3";
import {handleArquivoInstitucional} from "./arquivos-institucionais-http.ts";
const url=Deno.env.get("SUPABASE_URL")!;
const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
Deno.serve((request:Request)=>handleArquivoInstitucional(request,{
 authorize:async(token)=>{
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data.user||!data.user.email_confirmed_at)return "invalid";
  const user=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const result=await user.rpc("acesso_documentos_aprovado");
  if(result.error)throw Error("Account check unavailable");
  return result.data===true?"active":"inactive";
 },
 sign:async(path)=>{
  const {data,error}=await admin.storage.from("oficios").createSignedUrl(path,300);
  if(error||!data?.signedUrl)throw Error("Storage unavailable");
  return data.signedUrl;
 }
}));
