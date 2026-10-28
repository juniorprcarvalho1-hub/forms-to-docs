export type ReferenciaEmail={tipoDocumento:"declaracoes"|"declaracoes_resposta";registroId:string;automatico:boolean};
export function validarReferenciaEmail(input:unknown):ReferenciaEmail{
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Recarregue o sistema antes de enviar o documento.");
 const p=input as Record<string,unknown>,tipo=p.tipoDocumento,id=p.registroId,automatico=p.automatico;
 if((tipo!=="declaracoes"&&tipo!=="declaracoes_resposta")||typeof id!=="string"||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)||typeof automatico!=="boolean")
  throw new Error("Recarregue o sistema antes de enviar o documento.");
 return{tipoDocumento:tipo,registroId:id,automatico};
}
export async function enviarDocumentoAutorizado<T>(input:unknown,deps:{carregar:(tipo:ReferenciaEmail["tipoDocumento"],id:string)=>Promise<{origem:string}|null>;enviar:()=>Promise<T>}):Promise<T>{
 const ref=validarReferenciaEmail(input);
 let documento:{origem:string}|null;
 try{documento=await deps.carregar(ref.tipoDocumento,ref.registroId);}catch{throw new Error("Não foi possível verificar o documento para envio.");}
 if(!documento)throw new Error("Documento não encontrado ou sem permissão.");
 if(ref.automatico&&documento.origem==="lovable_migracao")throw new Error("Este documento histórico só pode ser enviado por uma ação manual.");
 return deps.enviar();
}
