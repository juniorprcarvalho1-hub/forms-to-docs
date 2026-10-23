import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";
// @ts-nocheck -- depende de migrações ainda não aplicadas (docs/IMPORTACOES.md)
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { revisarTabela, sugerirMapeamento, tabelaDaMatriz } from "@/lib/importacao";

const resposta = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function receberCadastro(request: Request): Promise<Response> {
  const token = request.headers.get("x-webhook-token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return resposta({ error: "Integração não autorizada." }, 401);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return resposta({ error: "Envie application/json." }, 415);
  // Limita o corpo real, inclusive quando Content-Length não foi enviado.
  const reader = request.body?.getReader();
  if (!reader) return resposta({ error: "Dados ausentes." }, 400);
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > 64_000) {
        await reader.cancel();
        return resposta({ error: "Envio muito grande." }, 413);
      }
      partes.push(value);
    }
    const total = new Uint8Array(tamanho);
    let offset = 0;
    for (const parte of partes) {
      total.set(parte, offset);
      offset += parte.length;
    }
    const payload: unknown = JSON.parse(new TextDecoder().decode(total));
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return resposta({ error: "Envie um objeto de respostas." }, 400);
    const colunas = Object.keys(payload);
    const valores = Object.values(payload).map((v) =>
      Array.isArray(v) ? v.join("; ") : typeof v === "string" ? v : v === null ? "" : String(v),
    );
    const tabela = tabelaDaMatriz([colunas, valores]);
    const [linha] = revisarTabela(tabela, sugerirMapeamento(colunas, "pacientes"), "pacientes");
    if (!linha) return resposta({ error: "Resposta vazia." }, 422);
    if (linha.erros.length)
      return resposta({ error: "Confira as respostas do formulário.", campos: linha.erros }, 422);
    const url = SUPABASE_URL;
    const key =
      SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key)
      return resposta({ error: "Integração indisponível. Contate o administrador." }, 503);
    // Só pode executar a RPC com o segredo específico da integração; nunca usa service_role.
    const db = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_publishable_") && headers.get("authorization") === `Bearer ${key}`)
            headers.delete("authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data, error } = await db.rpc("receber_paciente_forms", {
      p_token: token,
      p_dados: linha.dados,
    });
    if (error) {
      if (error.message.includes("Limite de recebimentos"))
        return resposta({ error: "Limite de recebimentos atingido." }, 429);
      if (error.code === "PGRST202")
        return resposta({ error: "Integração ainda não ativada." }, 503);
      return resposta({ error: "Não foi possível receber o cadastro. Confira a integração." }, 400);
    }
    return resposta({
      ok: true,
      duplicado: !!(data && typeof data === "object" && !Array.isArray(data) && data["duplicado"]),
    });
  } catch {
    return resposta({ error: "Formato de respostas inválido." }, 400);
  }
}

export const Route = createFileRoute("/api/public/webhooks/pacientes")({
  server: { handlers: { POST: ({ request }) => receberCadastro(request) } },
});
