// @ts-nocheck -- depende de migrações ainda não aplicadas (docs/IMPORTACOES.md)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function validarTokenLegado(
  client: SupabaseClient<Database>,
  token: string,
  tokenAnterior: unknown,
): Promise<boolean> {
  if (!token || token.length > 256) return false;
  const { data, error } = await client.rpc("validar_webhook_legado", { p_token: token });
  if (!error) return data === true;
  // Compatibilidade somente enquanto a migração ainda não existe no banco.
  if (!["42883", "PGRST202"].includes(error.code))
    throw new Error("Não foi possível verificar a integração.");
  if (typeof tokenAnterior !== "string" || !tokenAnterior) return false;
  const bytes = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", bytes.encode(token)),
    crypto.subtle.digest("SHA-256", bytes.encode(tokenAnterior)),
  ]);
  const x = new Uint8Array(a),
    y = new Uint8Array(b);
  let diferenca = 0;
  for (let i = 0; i < x.length; i++) diferenca |= x[i]! ^ y[i]!;
  return diferenca === 0;
}
