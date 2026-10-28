import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "./supabase-config";
import { resolverFontesImagens } from "./imagens-institucionais";

export async function uploadArquivo(path: string, file: File | Blob, contentType?: string) {
  const { error } = await supabase.storage.from("oficios").upload(path, file, {
    upsert: true,
    contentType: contentType ?? (file instanceof File ? file.type : "application/pdf"),
  });
  if (error) throw error;
  return path;
}

export async function urlAssinada(path: string, segundos = 60 * 60 * 24 * 7) {
  const { data, error } = await supabase.storage.from("oficios").createSignedUrl(path, segundos);
  if (error) throw error;
  return data.signedUrl;
}

const imagensInstitucionais=new Map<string,{expires:number;pending:Promise<string>}>();
async function assinarImagemInstitucional(path:string):Promise<string>{
 const {data}=await supabase.auth.getSession();
 const user=data.session?.user.id;
 if(!user)throw new Error("Entre no sistema para carregar as imagens.");
 const key=user+":"+path, cached=imagensInstitucionais.get(key);
 if(cached&&cached.expires>Date.now())return cached.pending;
 if(imagensInstitucionais.size>100)imagensInstitucionais.clear();
 const pending=(async()=>{
  const result=await supabase.functions.invoke("arquivos-institucionais",{body:{path}});
  if(result.error||typeof result.data?.url!=="string")throw new Error("Não foi possível carregar a imagem institucional.");
  return result.data.url as string;
 })();
 imagensInstitucionais.set(key,{expires:Date.now()+240000,pending});
 try{return await pending;}catch(error){imagensInstitucionais.delete(key);throw error;}
}
/** Resolve somente imagens institucionais; os demais recursos permanecem intactos. */
export async function prepararImagensInstitucionais(root:ParentNode):Promise<void>{
 const nodes=Array.from(root.querySelectorAll<HTMLImageElement>("img"));
 const before=nodes.map(node=>node.getAttribute("src")??"");
 const after=await resolverFontesImagens(before,SUPABASE_URL,assinarImagemInstitucional);
 nodes.forEach((node,index)=>{if(node.getAttribute("src")===before[index]&&before[index]!==after[index])node.setAttribute("src",after[index]!);});
}
