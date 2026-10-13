import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, FileStack, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatarData } from "@/lib/oficios";

function Mini({ label, value }: { label: string; value?: number }) {
  return (
    <div className="surface-card p-3 text-center">
      <p className="text-2xl font-light">{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel | Sistema de Ofícios" },
      { name: "description", content: "Resumo dos ofícios gerados e últimos documentos." },
      { property: "og:title", content: "Painel | Sistema de Ofícios" },
      { property: "og:description", content: "Resumo dos ofícios gerados e últimos documentos." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-todos"],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const inicio = inicioMes.toISOString();
      const tabelas = ["oficios", "declaracoes", "declaracoes_resposta"] as const;
      const contagens = await Promise.all(
        tabelas.flatMap((t) => [
          supabase.from(t).select("id", { count: "exact", head: true }),
          supabase.from(t).select("id", { count: "exact", head: true }).gte("created_at", inicio),
        ]),
      );
      const [of, de, dr] = await Promise.all([
        supabase.from("oficios").select("id,numero_formatado,nome,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("declaracoes").select("id,nome,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("declaracoes_resposta").select("id,supervisor,estagiario,created_at").order("created_at", { ascending: false }).limit(6),
      ]);
      const itens = [
        ...(of.data ?? []).map((o) => ({ id: "o" + o.id, tipo: o.numero_formatado, nome: o.nome, data: o.created_at, to: "/oficios" as const })),
        ...(de.data ?? []).map((d) => ({ id: "d" + d.id, tipo: "Declaração de Preceptoria", nome: d.nome, data: d.created_at, to: "/declaracoes" as const })),
        ...(dr.data ?? []).map((d) => ({ id: "r" + d.id, tipo: "Declaração de Resposta", nome: d.supervisor || d.estagiario, data: d.created_at, to: "/declaracoes-resposta" as const })),
      ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
      const c = contagens.map((r) => r.count ?? 0);
      return {
        total: c[0]! + c[2]! + c[4]!,
        mes: c[1]! + c[3]! + c[5]!,
        porTipo: { oficios: c[0]!, declaracoes: c[2]!, resposta: c[4]! },
        ultimos: itens,
      };
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Painel</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de todos os documentos gerados no sistema.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/oficios", search: { q: busca } });
        }}
        className="surface-card flex items-center gap-2 p-2"
      >
        <Search className="ml-2 size-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar ofícios por número, nome ou assunto"
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm">
          Pesquisar
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          icon={<FileStack className="size-5 text-primary" />}
          label="Total de documentos gerados"
          value={isLoading ? "—" : String(data?.total ?? 0)}
        />
        <Card
          icon={<CalendarDays className="size-5 text-primary" />}
          label="Gerados neste mês"
          value={isLoading ? "—" : String(data?.mes ?? 0)}
        />
      </div>
      <div className="grid gap-4 grid-cols-3">
        <Mini label="Ofícios" value={data?.porTipo.oficios} />
        <Mini label="Decl. Preceptoria" value={data?.porTipo.declaracoes} />
        <Mini label="Decl. Resposta" value={data?.porTipo.resposta} />
      </div>

      <section className="surface-card overflow-hidden">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-medium">Últimos documentos</h2>
        </header>
        <ul className="divide-y">
          {(data?.ultimos ?? []).map((o) => (
            <li key={o.id}>
              <Link to={o.to} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50">
                <span className="text-sm font-medium">{o.tipo}</span>
                <span className="text-sm text-muted-foreground">{o.nome}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatarData(o.data.slice(0, 10))}</span>
              </Link>
            </li>
          ))}
          {!isLoading && (data?.ultimos.length ?? 0) === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum documento ainda.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-4xl font-light">{value}</p>
    </div>
  );
}
