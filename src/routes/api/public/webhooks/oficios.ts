import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function formatar(formato: string, seq: number, ano: number, digitos: number) {
  return (formato || "OFÍCIO Nº {{seq}}/{{ano}}")
    .replaceAll("{{seq}}", String(seq).padStart(digitos, "0"))
    .replaceAll("{{ano}}", String(ano));
}

export const Route = createFileRoute("/api/public/webhooks/oficios")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: config } = await supabaseAdmin
          .from("configuracoes")
          .select("*")
          .maybeSingle();
        if (!config) return json({ error: "Configuração ausente" }, 500);

        const cfg = config as unknown as {
          webhook_token: string;
          formato_numeracao: string;
          digitos: number;
        };

        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        const token =
          request.headers.get("x-webhook-token") ?? String(payload["token"] ?? "");
        if (!token || token !== cfg.webhook_token) {
          return json({ error: "Token inválido" }, 401);
        }

        const texto = (chave: string) => String(payload[chave] ?? "").trim();
        const dataStr = texto("data") || new Date().toISOString().slice(0, 10);
        const ano = Number(dataStr.slice(0, 4)) || new Date().getFullYear();

        for (let tentativa = 0; tentativa < 5; tentativa++) {
          const { data: ultimo } = await supabaseAdmin
            .from("oficios")
            .select("numero")
            .eq("ano", ano)
            .order("numero", { ascending: false })
            .limit(1)
            .maybeSingle();

          const seq = ((ultimo as { numero: number } | null)?.numero ?? 0) + 1;

          const { data: inserido, error } = await supabaseAdmin
            .from("oficios")
            .insert({
              numero: seq,
              ano,
              numero_formatado: formatar(cfg.formato_numeracao, seq, ano, cfg.digitos ?? 3),
              data: dataStr,
              nome: texto("nome"),
              cpf: texto("cpf"),
              instituicao: texto("instituicao") || texto("instituição"),
              cargo: texto("cargo"),
              assunto: texto("assunto"),
              corpo: texto("corpo"),
              origem: texto("origem") || "google_forms",
            })
            .select("id, numero_formatado")
            .single();

          if (!error) return json({ ok: true, oficio: inserido });
          if (error.code !== "23505") return json({ error: error.message }, 500);
        }

        return json({ error: "Não foi possível gerar a numeração" }, 409);
      },
    },
  },
});
