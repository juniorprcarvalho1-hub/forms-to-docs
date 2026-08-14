import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, FileStack, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatarData, type Oficio } from "@/lib/oficios";

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
    queryKey: ["dashboard"],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const inicio = inicioMes.toISOString().slice(0, 10);

      const [total, mes, ultimos] = await Promise.all([
        supabase.from("oficios").select("id", { count: "exact", head: true }),
        supabase
          .from("oficios")
          .select("id", { count: "exact", head: true })
          .gte("data", inicio),
        supabase
          .from("oficios")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      return {
        total: total.count ?? 0,
        mes: mes.count ?? 0,
        ultimos: (ultimos.data ?? []) as Oficio[],
      };
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Painel</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral dos ofícios recebidos do Google Forms.
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
          placeholder="Pesquisar por número, nome, instituição ou assunto"
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm">
          Pesquisar
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          icon={<FileStack className="size-5 text-primary" />}
          label="Total de ofícios gerados"
          value={isLoading ? "—" : String(data?.total ?? 0)}
        />
        <Card
          icon={<CalendarDays className="size-5 text-primary" />}
          label="Gerados neste mês"
          value={isLoading ? "—" : String(data?.mes ?? 0)}
        />
      </div>

      <section className="surface-card overflow-hidden">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-medium">Últimos documentos</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/oficios" search={{ q: "" }}>
              Ver todos
            </Link>
          </Button>
        </header>
        <ul className="divide-y">
          {(data?.ultimos ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="text-sm font-medium">{o.numero_formatado}</span>
              <span className="text-sm text-muted-foreground">{o.nome}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatarData(o.data)}</span>
            </li>
          ))}
          {!isLoading && (data?.ultimos.length ?? 0) === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum ofício ainda. Assim que o Google Forms enviar uma resposta, ela aparece aqui.
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
