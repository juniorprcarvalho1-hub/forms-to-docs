import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verificarAcesso } from "@/lib/acesso.functions";
import {
  LayoutDashboard,
  Files,
  Award,
  FileCheck2,
  Settings,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Upload,
} from "lucide-react";
import facesf from "@/assets/facesf.png.asset.json";
import nupep from "@/assets/nupep.png.asset.json";
import clinica from "@/assets/clinica-escola.png.asset.json";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/oficios", label: "Ofícios", icon: Files },
  { to: "/declaracoes", label: "Declarações", icon: Award },
  { to: "/declaracoes-resposta", label: "Declarações de Resposta", icon: FileCheck2 },
  { to: "/importacoes", label: "Importar dados", icon: Upload },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);
  const acessoFn = useServerFn(verificarAcesso);
  const acesso = useQuery({ queryKey: ["acesso"], queryFn: () => acessoFn(), staleTime: 60_000 });
  const itens = acesso.data?.admin
    ? [
        ...links,
        { to: "/configuracoes", label: "Configurações", icon: Settings } as const,
        { to: "/pacientes", label: "Pacientes", icon: Users } as const,
        { to: "/controle", label: "Painel de Controle", icon: ShieldCheck } as const,
      ]
    : links;

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {itens.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={() => setAberto(false)}
          className={cn(
            "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
            pathname === l.to
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <l.icon className="size-4" />
          {l.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setAberto((v) => !v)}
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex items-center gap-3">
          <img src={facesf.url} alt="FACESF" className="h-9 w-auto" />
          <span className="hidden text-base font-medium sm:inline">
            Sistema Integrado de Cursos FACESF
          </span>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto gap-2" onClick={sair}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-3 md:flex">
          {nav}
          <div className="mt-auto flex flex-col items-center gap-3 pt-6 opacity-80">
            <img src={clinica.url} alt="Clínica Escola de Saúde Integrada" className="w-36" />
            <img src={nupep.url} alt="NuPEP" className="w-28" />
          </div>
        </aside>
        {aberto && <div className="w-full border-b bg-sidebar p-3 md:hidden">{nav}</div>}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          {acesso.isPending ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              Verificando acesso…
            </p>
          ) : acesso.isError ? (
            <div role="alert" className="mx-auto mt-12 max-w-lg rounded-2xl border bg-card p-6">
              <h1 className="text-xl font-semibold">Não foi possível verificar seu acesso</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tente novamente antes de continuar.
              </p>
              <Button className="mt-4" onClick={() => void acesso.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : acesso.data && !acesso.data.liberado ? (
            <div className="mx-auto mt-20 max-w-md rounded-2xl border bg-card p-8 text-center">
              <h1 className="mb-2 text-xl font-semibold">Acesso indisponível</h1>
              <p className="text-muted-foreground">{acesso.data.motivo}</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
