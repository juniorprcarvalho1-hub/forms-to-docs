import type {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "@/integrations/supabase/client";
import {selecionarPdfArquivado,type Andamento} from "./automacao-client";
export async function obterPdfArquivado(tipo:"oficios"|"declaracoes"|"declaracoes_resposta",id:string):Promise<Blob|null>{
 const {data,error}=await (supabase as unknown as SupabaseClient<any>).rpc("automacao_status",{p_tipo:tipo,p_documento:id});
 if(error)throw new Error("Não foi possível conferir o PDF arquivado. Tente novamente.");
 if(!data)return null;
 const andamento=data as Andamento,path=selecionarPdfArquivado(andamento);
 if(!path){if(andamento.pdf?.estado==="concluido")throw new Error("Referência do PDF inválida.");return null;}
 const arquivo=await supabase.storage.from("oficios").download(path);
 if(arquivo.error||!arquivo.data)throw new Error("PDF arquivado indisponível. Tente novamente.");
 return arquivo.data;
}
