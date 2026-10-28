export type ReferenciaImagem={kind:"storage";path:string}|{kind:"local";src:string};
export function caminhoImagemInstitucionalPermitido(path:unknown):path is string{return false;}
export function identificarImagemInstitucional(src:string,origin:string):ReferenciaImagem|null{return null;}
export function normalizarReferenciasLegadas(html:string,origin:string):string{return html;}
export async function resolverFontesImagens(srcs:string[],origin:string,sign:(path:string)=>Promise<string>):Promise<string[]>{return srcs;}
