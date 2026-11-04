import {ErroAutomacao} from "./automacao-erros.ts";
import {montarHtmlAutomacao,type SnapshotDocumento,type TipoDocumento} from "./automacao-html.ts";
export type DocumentoJob={id:string;tipo:TipoDocumento;documento_id:string;usuario_id:string;versao:number;etapa:"pdf"|"email";lease_token:string;snapshot:SnapshotDocumento;pdf_path:string|null};
export type DestinoEnvio={to:string;message_id:string};
export type ProcessadorPorts={
 rendererConfigurado:boolean;gmailConfigurado:boolean;
 autorizar:(job:DocumentoJob)=>Promise<boolean>;
 incorporar:(html:string)=>Promise<string>;renderizar:(html:string)=>Promise<Uint8Array>;validarPdf:(bytes:Uint8Array)=>Promise<void>;
 salvar:(path:string,bytes:Uint8Array)=>Promise<void>;concluirPdf:(job:DocumentoJob,path:string,html:string)=>Promise<boolean>;
 lerPdf:(path:string)=>Promise<Uint8Array>;iniciarEnvio:(job:DocumentoJob)=>Promise<DestinoEnvio|null>;
 enviar:(job:DocumentoJob,destino:DestinoEnvio,bytes:Uint8Array)=>Promise<{id:string}>;
 concluirEnvio:(job:DocumentoJob,id:string)=>Promise<boolean>;
 falhar:(job:DocumentoJob,codigo:string,incerto:boolean)=>Promise<unknown>;
};
export async function processarDocumento(job:DocumentoJob,ports:ProcessadorPorts):Promise<"concluido"|"pendente"|"obsoleto">{
 let fase="autorizar",envioIniciado=false;
 try{
  if(!await ports.autorizar(job))return "obsoleto";
  if(job.etapa==="pdf"){
   if(!ports.rendererConfigurado)throw new ErroAutomacao("renderizador_ausente");
   fase="compor";const html=montarHtmlAutomacao(job.tipo,job.snapshot);
   fase="imagens";const incorporado=await ports.incorporar(html);
   fase="render";const bytes=await ports.renderizar(incorporado);
   fase="validar";await ports.validarPdf(bytes);
   if(!await ports.autorizar(job))return "obsoleto";
   const path=job.usuario_id+"/automacao/"+job.documento_id+"/v"+job.versao+".pdf";
   fase="storage";await ports.salvar(path,bytes);
   fase="concluir";return await ports.concluirPdf(job,path,html)?"concluido":"obsoleto";
  }
  if(!ports.gmailConfigurado)throw new ErroAutomacao("gmail_ausente");
  const expected=job.usuario_id+"/automacao/"+job.documento_id+"/v"+job.versao+".pdf";
  if(job.pdf_path!==expected)throw new ErroAutomacao("pdf_invalido");
  fase="storage";const bytes=await ports.lerPdf(expected);
  fase="validar";await ports.validarPdf(bytes);
  if(!await ports.autorizar(job))return "obsoleto";
  fase="destino";const destino=await ports.iniciarEnvio(job);
  if(!destino)return "pendente";
  envioIniciado=true;fase="enviar";
  const recibo=await ports.enviar(job,destino,bytes);
  fase="concluir";return await ports.concluirEnvio(job,recibo.id)?"concluido":"pendente";
 }catch(error){
  const codigo=error instanceof ErroAutomacao?error.codigo:
   envioIniciado?"gmail_indisponivel":fase==="storage"?"storage_indisponivel":fase==="imagens"?"imagem_indisponivel":fase==="render"?"renderizador_indisponivel":"processamento_indisponivel";
  const incerto=error instanceof ErroAutomacao?error.incerto:envioIniciado;
  await ports.falhar(job,codigo,incerto);
  return "pendente";
 }
}
