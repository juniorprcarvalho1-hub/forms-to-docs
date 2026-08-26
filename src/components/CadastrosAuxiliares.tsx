import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Curso = {
  id: string;
  nome_formulario: string;
  nome_oficial: string;
  area_estagio: string;
};

type Modulo = {
  id: string;
  curso: string;
  nome_formulario: string;
  nome_oficial: string;
  carga_horaria: string;
  area_estagio: string;
};

type Professor = {
  id: string;
  nome_formulario: string;
  nome_oficial: string;
  registro: string;
  curso: string;
};

type Tabela = "cursos" | "professores" | "modulos_estagio";

export function CadastrosAuxiliares() {
  const queryClient = useQueryClient();

  const cursos = useQuery({
    queryKey: ["cursos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select("*")
        .order("nome_formulario");
      if (error) throw error;
      return (data ?? []) as Curso[];
    },
  });

  const professores = useQuery({
    queryKey: ["professores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professores")
        .select("*")
        .order("nome_formulario");
      if (error) throw error;
      return (data ?? []) as Professor[];
    },
  });

  const modulos = useQuery({
    queryKey: ["modulos_estagio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos_estagio")
        .select("*")
        .order("curso")
        .order("nome_formulario");
      if (error) throw error;
      return (data ?? []) as Modulo[];
    },
  });

  async function salvarLinha(tabela: Tabela, id: string, campos: object) {
    const { error } = await supabase.from(tabela).update(campos).eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: [tabela] });
  }

  async function adicionar(tabela: Tabela) {
    const { error } = await supabase.from(tabela).insert({});
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: [tabela] });
  }

  async function remover(tabela: Tabela, id: string) {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: [tabela] });
  }

  return (
    <>
      <section className="surface-card space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Cursos</h2>
            <p className="text-xs text-muted-foreground">
              Quando o aluno escolhe o curso no formulário, o ofício usa o nome oficial e a área
              cadastrados aqui.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => adicionar("cursos")}>
            <Plus className="size-4" /> Curso
          </Button>
        </div>

        {(cursos.data ?? []).map((curso) => (
          <div key={curso.id} className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Campo
              label="Opção no formulário"
              valor={curso.nome_formulario}
              onSalvar={(v) => salvarLinha("cursos", curso.id, { nome_formulario: v })}
            />
            <Campo
              label="Nome oficial no ofício"
              valor={curso.nome_oficial}
              onSalvar={(v) => salvarLinha("cursos", curso.id, { nome_oficial: v })}
            />
            <Campo
              label="Área do estágio"
              valor={curso.area_estagio}
              onSalvar={(v) => salvarLinha("cursos", curso.id, { area_estagio: v })}
            />
            <BotaoRemover onClick={() => remover("cursos", curso.id)} />
          </div>
        ))}
      </section>

      <section className="surface-card space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Módulos de estágio (Nutrição e Psicologia)</h2>
            <p className="text-xs text-muted-foreground">
              Cadastre o módulo exatamente como aparece no formulário e sua carga horária. Para
              Enfermagem e Fisioterapia a carga é fixa de 420 horas.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => adicionar("modulos_estagio")}>
            <Plus className="size-4" /> Módulo
          </Button>
        </div>

        {(modulos.data ?? []).map((mod) => (
          <div
            key={mod.id}
            className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
          >
            <Campo
              label="Curso"
              valor={mod.curso}
              onSalvar={(v) => salvarLinha("modulos_estagio", mod.id, { curso: v })}
            />
            <Campo
              label="Opção no formulário"
              valor={mod.nome_formulario}
              onSalvar={(v) => salvarLinha("modulos_estagio", mod.id, { nome_formulario: v })}
            />
            <Campo
              label="Nome no ofício"
              valor={mod.nome_oficial}
              onSalvar={(v) => salvarLinha("modulos_estagio", mod.id, { nome_oficial: v })}
            />
            <Campo
              label="Carga horária"
              valor={mod.carga_horaria}
              onSalvar={(v) => salvarLinha("modulos_estagio", mod.id, { carga_horaria: v })}
            />
            <Campo
              label="Área do estágio (opcional)"
              valor={mod.area_estagio}
              onSalvar={(v) => salvarLinha("modulos_estagio", mod.id, { area_estagio: v })}
            />
            <BotaoRemover onClick={() => remover("modulos_estagio", mod.id)} />
          </div>
        ))}
      </section>

      <section className="surface-card space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Professores orientadores</h2>
            <p className="text-xs text-muted-foreground">
              Ao escolher o professor no formulário, o nome e o registro do conselho entram
              automaticamente no ofício.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => adicionar("professores")}>
            <Plus className="size-4" /> Professor
          </Button>
        </div>

        {(professores.data ?? []).map((prof) => (
          <div
            key={prof.id}
            className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          >
            <Campo
              label="Opção no formulário"
              valor={prof.nome_formulario}
              onSalvar={(v) => salvarLinha("professores", prof.id, { nome_formulario: v })}
            />
            <Campo
              label="Nome oficial"
              valor={prof.nome_oficial}
              onSalvar={(v) => salvarLinha("professores", prof.id, { nome_oficial: v })}
            />
            <Campo
              label="Registro (COREN, CREFITO…)"
              valor={prof.registro}
              onSalvar={(v) => salvarLinha("professores", prof.id, { registro: v })}
            />
            <Campo
              label="Curso vinculado (opcional)"
              valor={prof.curso}
              onSalvar={(v) => salvarLinha("professores", prof.id, { curso: v })}
            />
            <BotaoRemover onClick={() => remover("professores", prof.id)} />
          </div>
        ))}
      </section>
    </>
  );
}

function Campo({
  label,
  valor,
  onSalvar,
}: {
  label: string;
  valor: string;
  onSalvar: (valor: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        defaultValue={valor}
        onBlur={(e) => e.target.value !== valor && onSalvar(e.target.value)}
      />
    </div>
  );
}

function BotaoRemover({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-end">
      <Button variant="ghost" size="icon" aria-label="Remover" onClick={onClick}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
