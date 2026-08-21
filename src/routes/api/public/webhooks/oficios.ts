import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function formatar(formato: string, seq: number, ano: number, digitos: number) {
  return (formato || "Ofício nº. {{seq}}/{{ano}} Estágio")
    .replaceAll("{{seq}}", String(seq).padStart(digitos, "0"))
    .replaceAll("{{ano}}", String(ano));
}

function normalizar(chave: string) {
  return chave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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

        const cfg = config as unknown as Record<string, string | number>;

        let bruto: Record<string, unknown> = {};
        try {
          bruto = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        // Aceita chaves do Google Forms com acento/maiúsculas ("Aluno(a)", "MATRÍCULA"...)
        const payload: Record<string, unknown> = {};
        for (const [chave, valor] of Object.entries(bruto)) {
          payload[normalizar(chave)] = Array.isArray(valor) ? valor[0] : valor;
        }

        const token =
          request.headers.get("x-webhook-token") ?? String(payload["token"] ?? "");
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
        const padrao = (chave: string) => String(cfg[chave] ?? "");

        const dataStr = texto("data") || new Date().toISOString().slice(0, 10);
        const ano = Number(dataStr.slice(0, 4)) || new Date().getFullYear();

        const nome = texto("aluno", "alunoa", "nome");
        if (!nome) return json({ error: "Campo Aluno(a) não recebido" }, 422);

        // Cadastros auxiliares: curso e professor escolhidos no formulário
        const cursoForm = texto("curso");
        const professorForm = texto("professor", "professororientador");

        const { data: cursos } = await supabaseAdmin
          .from("cursos")
          .select("nome_formulario, nome_oficial, area_estagio");
        const { data: professores } = await supabaseAdmin
          .from("professores")
          .select("nome_formulario, nome_oficial, registro, curso");

        const cursoCad = (cursos ?? []).find(
          (c) => normalizar(String(c.nome_formulario)) === normalizar(cursoForm),
        );
        const curso = cursoCad?.nome_oficial?.trim() || cursoForm;

        const professorCad = (professores ?? []).find((p) => {
          const alvo = normalizar(String(p.nome_formulario));
          return (
            (professorForm && alvo === normalizar(professorForm)) ||
            (!professorForm && normalizar(String(p.curso)) === normalizar(cursoForm))
          );
        });
        const professor =
          professorCad?.nome_oficial?.trim() || professorForm || padrao("padrao_professor");

        const registro = {
          data: dataStr,
          nome,
          cpf: texto("cpf"),
          curso,
          matricula: texto("matricula"),
          instituicao: texto("instituicao"),
          cargo: texto("cargo"),
          assunto: texto("assunto") || "Estágio Curricular Obrigatório",
          corpo: texto("corpo"),
          destinatario: texto("destinatario") || padrao("padrao_destinatario"),
          area_estagio:
            texto("areaestagio", "area") ||
            cursoCad?.area_estagio?.trim() ||
            padrao("padrao_area_estagio"),
          professor_orientador: professor,
          registro_professor:
            texto("registroprofessor", "conselho") ||
            professorCad?.registro?.trim() ||
            padrao("padrao_registro_professor"),
          carga_horaria: texto("cargahoraria") || padrao("padrao_carga_horaria"),
          periodo: texto("periodo") || padrao("padrao_periodo"),
          seguradora: texto("seguradora") || padrao("padrao_seguradora"),
          apolice: texto("apolice") || padrao("padrao_apolice"),
          coordenador: texto("coordenador") || padrao("padrao_coordenador"),
          origem: texto("origem") || "google_forms",
        };


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
              ...registro,
              numero: seq,
              ano,
              numero_formatado: formatar(
                String(cfg["formato_numeracao"] ?? ""),
                seq,
                ano,
                Number(cfg["digitos"] ?? 2),
              ),
            })
            .select("id, numero_formatado")
            .single();

          if (!error) {
            return json({
              ok: true,
              mensagem: "Ofício salvo com sucesso",
              oficio: inserido,
            });
          }
          if (error.code !== "23505") return json({ error: error.message }, 500);
        }

        return json({ error: "Não foi possível gerar a numeração" }, 409);
      },
    },
  },
});
