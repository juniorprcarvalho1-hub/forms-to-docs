import { supabase } from "@/integrations/supabase/client";

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
