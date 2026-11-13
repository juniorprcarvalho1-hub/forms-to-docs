import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function salvarConteudoDocumental<T extends { id: string; conteudo_html?: string | null }>(
  tipo: "oficios" | "declaracoes" | "declaracoes_resposta",
  documento: T,
  html: string,
): Promise<T> {
  const { data, error } = await (supabase as unknown as SupabaseClient).rpc("salvar_conteudo_documental", {
    p_tipo: tipo, p_id: documento.id, p_original: documento.conteudo_html ?? null, p_html: html,
  });
  if (error?.message === "DOCUMENTO_ALTERADO_OU_INDISPONIVEL") {
    throw new Error("O documento mudou ou ficou indisponível. Copie suas alterações e reabra a edição.");
  }
  if (error?.message === "ENVIO_PRECISA_CONFIRMACAO") {
    throw new Error("Confirme a situação do e-mail antes de editar este documento.");
  }
  if (error || data?.id !== documento.id || data?.conteudo_html !== html) {
    throw new Error("Não foi possível confirmar o salvamento. Sua edição continua aberta.");
  }
  return data as T;
}
