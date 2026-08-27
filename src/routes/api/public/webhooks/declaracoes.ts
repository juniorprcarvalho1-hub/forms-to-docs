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

        /** Procura o valor por correspondência exata e, depois, aproximada do título da pergunta. */
        const buscar = (chaves: string[], evitar: string[] = []) => {
          const alvos = chaves.map(normalizar);
          const usavel = (k: string) => !evitar.some((e) => k.includes(normalizar(e)));
          const valor = (k: string) => {
            const v = payload[k];
            return v !== undefined && String(v).trim() !== "" ? String(v).trim() : "";
          };
          for (const alvo of alvos) {
            if (usavel(alvo) && valor(alvo)) return valor(alvo);
          }
          for (const alvo of alvos) {
            for (const k of Object.keys(payload)) {
              if (!usavel(k)) continue;
              if ((k.includes(alvo) || alvo.includes(k)) && valor(k)) return valor(k);
            }
          }
          return "";
        };
        const texto = (...chaves: string[]) => buscar(chaves);

        const nome = buscar(
          ["nome", "preceptor", "nomedopreceptor", "nomecompleto"],
          ["aluno", "estudante", "discente", "curso", "hospital", "email"],
        );
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
          carga_horaria: texto("cargahoraria", "horas", "totaldehoras", "cargahorariatotal"),
          alunos: texto("alunos", "aluno", "nomedosalunos", "nomedoaluno", "estudantes", "discentes"),
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
