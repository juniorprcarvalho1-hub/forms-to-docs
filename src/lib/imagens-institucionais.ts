export type ReferenciaImagem={kind:"storage";path:string}|{kind:"local";src:string};
const LEGACY_ORIGIN="https://qwhvceqqubofxpdxnhtz.supabase.co";
const LEGACY_MARCA="/__l5e/assets-v1/16f1a583-6782-48a0-947f-09226a225692/facesf.png";
export function caminhoImagemInstitucionalPermitido(path:unknown):path is string{
 return typeof path==="string"&&path.length<=256&&/^conteudo\/[a-z0-9_.-]+\.(png|jpe?g|gif|webp|avif)$/i.test(path);
}
export function identificarImagemInstitucional(src:string,origin:string):ReferenciaImagem|null{
 if(src.split("?")[0]===LEGACY_MARCA)return{kind:"local",src:"/brand/facesf.png"};
 try{
  const url=new URL(src);
  if(url.username||url.password||url.hash||(url.origin!==LEGACY_ORIGIN&&url.origin!==new URL(origin).origin))return null;
  const match=url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/oficios\/(.+)$/);
  if(!match)return null;
  const path=decodeURIComponent(match[1]!);
  return caminhoImagemInstitucionalPermitido(path)?{kind:"storage",path}:null;
 }catch{return null;}
}
export function normalizarReferenciasLegadas(html:string,origin:string):string{
 return html.replace(/(\bsrc\s*=\s*)(["'])([^"']*)\2/gi,(all,prefix,quote,src)=>{
  const ref=identificarImagemInstitucional(src,origin);
  if(!ref)return all;
  const next=ref.kind==="local"?ref.src:new URL(origin).origin+"/storage/v1/object/public/oficios/"+encodeURI(ref.path);
  return prefix+quote+next+quote;
 });
}
export async function resolverFontesImagens(srcs:string[],origin:string,sign:(path:string)=>Promise<string>):Promise<string[]>{
 const pending=new Map<string,Promise<string>>();
 return Promise.all(srcs.map(async(src)=>{
  const ref=identificarImagemInstitucional(src,origin);
  if(!ref)return src;
  if(ref.kind==="local")return ref.src;
  if(!pending.has(ref.path))pending.set(ref.path,(async()=>{
   const signed=await sign(ref.path);
   try{
    const url=new URL(signed);
    if(url.username||url.password||url.hash||url.origin!==new URL(origin).origin||
       decodeURIComponent(url.pathname)!=="/storage/v1/object/sign/oficios/"+ref.path||!url.searchParams.get("token"))throw Error();
    return signed;
   }catch{throw new Error("Resposta inválida ao carregar imagem institucional.");}
  })());
  return pending.get(ref.path)!;
 }));
}
