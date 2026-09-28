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

export const Route = createFileRoute("/api/public/webhooks/declaracoes-resposta")({
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

        const supervisor = buscar(
          ["nomedosupervisor", "supervisor", "nomecompletodosupervisor", "nome"],
          ["estagiario", "aluno", "discente", "curso", "email"],
        );
        if (!supervisor) return json({ error: "Campo Nome do supervisor não recebido" }, 422);

        const estagiario = buscar(
          ["nomedoestagiario", "estagiario", "aluno", "nomedoaluno", "discente"],
          ["supervisor"],
        );

        const cursoForm = texto("curso", "cursodoestagiario", "areadeestagio", "area");
        const { data: cursos } = await supabaseAdmin
          .from("cursos")
          .select("nome_formulario, nome_oficial");
        const cursoCad = (cursos ?? []).find(
          (c) => normalizar(String(c.nome_formulario)) === normalizar(cursoForm),
        );
        const curso = cursoCad?.nome_oficial?.trim() || cursoForm;

        const modeloChave = (() => {
          const t = normalizar(curso || cursoForm);
          if (t.includes("fisio")) return "fisioterapia";
          if (t.includes("nutri")) return "nutricao";
          if (t.includes("psico")) return "psicologia";
          return "enfermagem";
        })();

        const avaliacaoBruta = texto(
          "tipodeavaliacao",
          "avaliacao",
          "avaliacaoparcialfinal",
          "parcialoufinal",
        );
        const tipoAvaliacao = normalizar(avaliacaoBruta).includes("final")
          ? "AVALIAÇÃO FINAL"
          : normalizar(avaliacaoBruta).includes("parcial")
            ? "AVALIAÇÃO PARCIAL"
            : avaliacaoBruta;

        const periodoFormulario = buscar([
          "periodo",
          "periododoestagiario",
          "periododoaluno",
          "periodoqueoalunoestamatriculado",
          "periodoqueoestagiarioestamatriculado",
          "periodomatriculado",
          "semestre",
        ]);
        const periodo = periodoFormulario.match(/\d+/)?.[0] ?? periodoFormulario;

        const registro = {
          supervisor,
          estagiario,
          curso,
          modelo_chave: modeloChave,
          tipo_avaliacao: tipoAvaliacao,
          periodo,
          email_supervisor: texto("emaildosupervisor", "email", "enderecodeemail"),
          origem: "google_forms",
        };

        const { data: inserido, error } = await supabaseAdmin
          .from("declaracoes_resposta")
          .insert(registro)
          .select("id, supervisor, estagiario, curso, modelo_chave")
          .single();

        if (error) return json({ error: error.message }, 500);

        return json({ ok: true, mensagem: "Declaração de resposta salva", declaracao: inserido });
      },
    },
  },
});
