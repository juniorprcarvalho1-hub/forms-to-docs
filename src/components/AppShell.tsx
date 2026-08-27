import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Files, Award, Settings, LogOut, Menu } from "lucide-react";
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
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map((l) => (
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
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
