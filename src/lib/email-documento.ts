export type ReferenciaEmail={tipoDocumento:"declaracoes"|"declaracoes_resposta";registroId:string;automatico:boolean};
export function validarReferenciaEmail(input:unknown):ReferenciaEmail{throw new Error("Referência não implementada.");}
export async function enviarDocumentoAutorizado<T>(input:unknown,deps:{carregar:(tipo:ReferenciaEmail["tipoDocumento"],id:string)=>Promise<{origem:string}|null>;enviar:()=>Promise<T>}):Promise<T>{throw new Error("Envio vinculado não implementado.");}
