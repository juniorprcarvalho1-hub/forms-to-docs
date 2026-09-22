import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { NOMES_CURSO, ORDEM_MODELOS_RESPOSTA, type Orientador } from "@/lib/declaracoes-resposta";

/** Cadastro manual do professor orientador (nome e e-mail) de cada curso. */
export function OrientadoresCurso() {
  const queryClient = useQueryClient();
  const [edicao, setEdicao] = useState<Record<string, { nome: string; email: string }>>({});
  const [salvando, setSalvando] = useState(false);

  const { data: orientadores = [] } = useQuery({
    queryKey: ["orientadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orientadores").select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as Orientador[]).sort(
        (a, b) =>
          ORDEM_MODELOS_RESPOSTA.indexOf(a.curso) - ORDEM_MODELOS_RESPOSTA.indexOf(b.curso),
      );
    },
  });

  useEffect(() => {
    if (orientadores.length === 0) return;
    setEdicao((atual) =>
      Object.keys(atual).length > 0
        ? atual
        : Object.fromEntries(
            orientadores.map((o) => [o.curso, { nome: o.nome, email: o.email }]),
          ),
    );
  }, [orientadores]);

  async function salvar() {
    setSalvando(true);
    try {
      for (const orientador of orientadores) {
        const valores = edicao[orientador.curso];
        if (!valores) continue;
        if (valores.nome === orientador.nome && valores.email === orientador.email) continue;
        const { error } = await supabase
          .from("orientadores")
          .update({ nome: valores.nome.trim(), email: valores.email.trim() })
          .eq("id", orientador.id);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["orientadores"] });
      toast.success("Professores orientadores salvos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="surface-card space-y-4 p-6">
      <div>
        <h2 className="text-sm font-medium">Professor(a) orientador(a) por curso</h2>
        <p className="text-xs text-muted-foreground">
          A declaração de resposta é enviada automaticamente para o e-mail cadastrado aqui, conforme
          o curso informado no formulário.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {orientadores.map((o) => (
          <div key={o.id} className="space-y-1.5 rounded-lg border p-3">
            <Label className="text-xs font-medium">{NOMES_CURSO[o.curso] ?? o.curso}</Label>
            <Input
              placeholder="Nome do professor(a)"
              value={edicao[o.curso]?.nome ?? o.nome}
              onChange={(e) =>
                setEdicao((c) => ({
                  ...c,
                  [o.curso]: { nome: e.target.value, email: c[o.curso]?.email ?? o.email },
                }))
              }
            />
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={edicao[o.curso]?.email ?? o.email}
              onChange={(e) =>
                setEdicao((c) => ({
                  ...c,
                  [o.curso]: { nome: c[o.curso]?.nome ?? o.nome, email: e.target.value },
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar orientadores"}
        </Button>
      </div>
    </section>
  );
}
