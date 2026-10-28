export type AssetDependencies={authorize:(token:string)=>Promise<"active"|"inactive"|"invalid">;sign:(path:string)=>Promise<string>};
export async function handleArquivoInstitucional(request:Request,deps:AssetDependencies):Promise<Response>{return new Response(null,{status:501});}
