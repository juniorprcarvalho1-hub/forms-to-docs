import {createClient} from "npm:@supabase/supabase-js@2.112.3";
import {handleWorkerRequest} from "./automacao-worker-http.ts";
import {processarDocumento,type DocumentoJob} from "../../src/lib/automacao-processador.ts";
import {incorporarImagensAutomacao,bytesBase64} from "../../src/lib/automacao-html.ts";
import {validarPdfA4} from "../../src/lib/pdf-validacao.ts";
import {mensagemEmailPreceptoria} from "../../src/lib/email-preceptoria.ts";
import {mensagemEmailResposta,type DeclaracaoResposta} from "../../src/lib/declaracoes-resposta.ts";
import {ErroAutomacao} from "../../src/lib/automacao-erros.ts";
import {renderizarCloudflare,enviarPeloBridge,lerBytesLimitados} from "./automacao-providers.ts";
const URL_SUPA="https://auxsyadqijcjngmujagx.supabase.co";
const db=createClient(URL_SUPA,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
async function rpc(name:string,args:Record<string,unknown>={}):Promise<any>{const {data,error}=await db.rpc(name,args);if(error)throw new ErroAutomacao("banco_indisponivel");return data;}
const args=(j:DocumentoJob)=>({p_job:j.id,p_lease:j.lease_token});
async function sha(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer))].map(b=>b.toString(16).padStart(2,"0")).join("");}
async function ler(path:string){const {data,error}=await db.storage.from("oficios").download(path);if(error||!data||data.size>8000000)throw new ErroAutomacao("storage_indisponivel");return new Uint8Array(await data.arrayBuffer());}
function cf(){return {accountId:Deno.env.get("CLOUDFLARE_ACCOUNT_ID"),token:Deno.env.get("CLOUDFLARE_BROWSER_TOKEN")};}
async function imagens(html:string){return incorporarImagensAutomacao(html,URL_SUPA,async ref=>{
 if(ref.kind==="storage"){const {data,error}=await db.storage.from("oficios").download(ref.path);if(error||!data||data.size>2000000)throw new ErroAutomacao("imagem_indisponivel");return{bytes:new Uint8Array(await data.arrayBuffer()),mime:data.type};}
 const response=await fetch("https://sintegradocursosfacesf.com.br/brand/facesf.png",{redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ErroAutomacao("imagem_indisponivel");
 return{bytes:await lerBytesLimitados(response,2000000),mime:"image/png"};
});}
async function processar(job:DocumentoJob){
 let hash:string|null=null;
 return processarDocumento(job,{
 rendererConfigurado:!!cf().accountId&&!!cf().token,gmailConfigurado:true,
 autorizar:j=>rpc("automacao_autorizar",args(j)),
 incorporar:imagens,renderizar:html=>renderizarCloudflare(html,cf()),validarPdf:validarPdfA4,
 recuperarPdf:async j=>{
  const raw=j as DocumentoJob&{pdf_base64?:string;pdf_sha256?:string;html?:string};
  if(!raw.pdf_base64)return null;
  if(!raw.html||!raw.pdf_sha256)throw new ErroAutomacao("pdf_invalido");
  const bytes=Uint8Array.from(atob(raw.pdf_base64),c=>c.charCodeAt(0));
  if(await sha(bytes)!==raw.pdf_sha256)throw new ErroAutomacao("pdf_invalido");
  return{bytes,html:raw.html};
 },
 salvar:async(path,bytes,html)=>{
  hash=await sha(bytes);
  if(!await rpc("automacao_pdf_reservar",{...args(job),p_sha256:hash,p_base64:bytesBase64(bytes),p_html:html}))throw new ErroAutomacao("tarefa_obsoleta");
  const {error}=await db.storage.from("oficios").upload(path,bytes,{contentType:"application/pdf",upsert:false});
  if(error){const old=await ler(path);if(await sha(old)!==hash)throw new ErroAutomacao("pdf_invalido");}
 },
 concluirPdf:(j,path,html)=>rpc("automacao_pdf_concluir",{...args(j),p_path:path,p_html:html,p_sha256:hash}),
 lerPdf:async path=>{const bytes=await ler(path);const raw=job as DocumentoJob&{pdf_sha256?:string};if(!raw.pdf_sha256||await sha(bytes)!==raw.pdf_sha256)throw new ErroAutomacao("pdf_invalido");return bytes;},
 iniciarEnvio:j=>rpc("automacao_email_iniciar",args(j)),
 enviar:async j=>{const ticket=await rpc("automacao_ticket_email",args(j));if(!ticket)throw new ErroAutomacao("ticket_invalido");return enviarPeloBridge(ticket);},
 concluirEnvio:(j,id)=>rpc("automacao_email_concluir",{...args(j),p_provider:id}),
 falhar:(j,codigo,incerto)=>rpc("automacao_falhar",{...args(j),p_codigo:codigo,p_incerto:incerto}),
 });
}
Deno.serve(req=>handleWorkerRequest(req,{
 consumir:ticket=>rpc("automacao_consumir_ticket",{p_ticket:ticket}),
 processar,
 diagnosticar:async modo=>{
  if(modo!=="verificar")throw new ErroAutomacao("diagnostico_indisponivel");
  if(!cf().accountId||!cf().token)return{renderizador_configurado:false,pdf_a4:false};
  const html=await imagens('<img src="/brand/facesf.png" style="width:110px"><h1>Verificação técnica</h1><p>Geração de PDF A4.</p>');
  await validarPdfA4(await renderizarCloudflare(html,cf()));
  return{renderizador_configurado:true,pdf_a4:true};
 },
 envelope:async ticket=>{
  const j=await rpc("automacao_consumir_ticket_email",{p_ticket:ticket,p_enviar:false});if(!j)return null;
  const expected=j.usuario_id+"/automacao/"+j.documento_id+"/v"+j.versao+".pdf";
  if(j.pdf_path!==expected||!j.pdf_sha256)throw new ErroAutomacao("pdf_invalido");
  const {data,error}=await db.storage.from("oficios").createSignedUrl(expected,60);if(error||!data)throw new ErroAutomacao("storage_indisponivel");
  const mensagem=j.tipo==="declaracoes"
   ? mensagemEmailPreceptoria(j.snapshot.documento)
   : mensagemEmailResposta(j.snapshot.documento as DeclaracaoResposta);
  return{tipo:j.tipo,job_id:j.id,to:j.email_destino,message_id:"<facesf."+j.id+"@sintegradocursosfacesf.com.br>",...mensagem,pdf_url:data.signedUrl,pdf_sha256:j.pdf_sha256};
 },
 autorizarEmail:async ticket=>!!(await rpc("automacao_consumir_ticket_email",{p_ticket:ticket,p_enviar:true}))?.autorizado,
}));
