import { supabase } from "@/integrations/supabase/client";
export async function caminhoPrivadoDocumento(nome: string): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Entre novamente para arquivar o documento.");
  return `${user.id}/${nome}`;
}
