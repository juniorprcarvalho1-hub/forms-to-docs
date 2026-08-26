import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function normalizar(chave: string) {
  return chave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const Route = createFileRoute("/api/public/webhooks/declaracoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: config } = await supabaseAdmin
          .from("configuracoes")
          .select("*")
          .maybeSingle();
        if (!config) return json({ error: "Configuração ausente" }, 500);
        const cfg = config as unknown as Record<string, string | number>;

        let bruto: Record<string, unknown> = {};
        try {
          bruto = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        const payload: Record<string, unknown> = {};
        for (const [chave, valor] of Object.entries(bruto)) {
          payload[normalizar(chave)] = Array.isArray(valor) ? valor[0] : valor;
        }

        const token = request.headers.get("x-webhook-token") ?? String(payload["token"] ?? "");
        if (!token || token !== cfg["webhook_token"]) {
          return json({ error: "Token inválido" }, 401);
        }

        const texto = (...chaves: string[]) => {
          for (const chave of chaves) {
            const valor = payload[normalizar(chave)];
            if (valor !== undefined && String(valor).trim() !== "") return String(valor).trim();
          }
          return "";
        };

        const nome = texto("nome", "preceptor", "nomedopreceptor", "nomecompleto");
        if (!nome) return json({ error: "Campo Nome não recebido" }, 422);

        const curso = texto("curso", "cursodeestagio", "areadeestagio", "area");
        const modeloChave = (() => {
          const t = curso
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          if (t.includes("fisio")) return "fisioterapia";
          if (t.includes("nutri")) return "nutricao";
          if (t.includes("psico")) return "psicologia";
          return "enfermagem";
        })();

        const registro = {
          nome,
          curso,
          modelo_chave: modeloChave,
          coren: texto("coren", "corennº", "registrocoren", "registro"),
          hospital: texto("hospital", "campodeestagio", "campoestagio", "instituicao"),
          data_inicio: texto("datainicio", "datadeinicio", "inicio", "periodoinicio"),
          data_fim: texto("datafim", "datadefim", "fim", "periodofim", "termino"),
          email: texto("email", "emaildopreceptor", "enderecodeemail"),
          origem: texto("origem") || "google_forms",
        };

        const { data: inserido, error } = await supabaseAdmin
          .from("declaracoes")
          .insert(registro)
          .select("id, nome, email, curso, modelo_chave")
          .single();

        if (error) return json({ error: error.message }, 500);

        return json({ ok: true, mensagem: "Declaração salva com sucesso", declaracao: inserido });
      },
    },
  },
});
