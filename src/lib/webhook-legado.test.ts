import { expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { validarTokenLegado } from "./webhook-legado.server";
const client = (data: unknown, error: unknown = null) =>
  ({ rpc: async () => ({ data, error }) }) as unknown as SupabaseClient<Database>;
test("token legado revogado nunca usa fallback em claro", async () => {
  expect(await validarTokenLegado(client(false), "exemplo", "exemplo")).toBe(false);
});
test("verificação hash aceita somente resultado booleano verdadeiro", async () => {
  expect(await validarTokenLegado(client(true), "exemplo", "")).toBe(true);
  expect(await validarTokenLegado(client("true"), "exemplo", "")).toBe(false);
});
test("compatibilidade somente com função ainda ausente", async () => {
  const c = client(null, { code: "PGRST202" });
  expect(await validarTokenLegado(c, "exemplo", "exemplo")).toBe(true);
  expect(await validarTokenLegado(c, "outro", "exemplo")).toBe(false);
});
test("erro de permissão não permite token antigo", async () => {
  await expect(
    validarTokenLegado(client(null, { code: "42501" }), "exemplo", "exemplo"),
  ).rejects.toThrow();
});
test("token vazio ou desproporcional é rejeitado", async () => {
  expect(await validarTokenLegado(client(true), "", "")).toBe(false);
  expect(await validarTokenLegado(client(true), "x".repeat(257), "")).toBe(false);
});
