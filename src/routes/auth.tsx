import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import facesf from "@/assets/facesf.png.asset.json";
import clinica from "@/assets/clinica-escola-branca.png.asset.json";
import nupes from "@/assets/nupes.png.asset.json";
import nupep from "@/assets/nupep.png.asset.json";
import technology from "@/assets/facesf-technology.jpg";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar | Sistema Integrado de Cursos FACESF" },
      { name: "description", content: "Acesse o painel de gestão e geração de ofícios." },
      { property: "og:title", content: "Entrar | Sistema Integrado de Cursos FACESF" },
      { property: "og:description", content: "Acesse o painel de gestão e geração de ofícios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else toast.success("Confira seu e-mail para confirmar a conta.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  async function entrarComGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha ao entrar com Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="auth-scene relative isolate flex min-h-screen flex-col bg-background">
      <img src={technology} alt="" aria-hidden="true" className="auth-art pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover" />
      <header className="flex items-center justify-between gap-4 px-6 py-6 md:px-12">
        <img src={facesf.url} alt="FACESF" className="h-16 w-auto" />
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4" /> Acesso institucional</span>
      </header>
      <main className="auth-content flex flex-1 items-center justify-end px-6 py-10 md:px-12 lg:px-24">
      <div className="auth-form w-full max-w-md">
        <div className="mb-8">
          <div>
            <div className="mb-5 h-1 w-12 rounded-full bg-primary" />
            <h1 className="text-3xl font-semibold leading-tight">Sistema Integrado<br />de Cursos FACESF</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {modo === "entrar" ? "Faça login para continuar" : "Crie sua conta de administrador"}
            </p>
          </div>
        </div>

        <div>
          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-12 bg-card/90"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@orgao.gov.br"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                className="h-12 bg-card/90"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="h-12 w-full justify-between" disabled={carregando}>
              {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}<ArrowRight className="size-4" />
            </Button>
          </form>
        </div>
      </div>
      </main>
      <footer className="flex min-h-28 flex-wrap items-center justify-end gap-6 border-t border-border/60 bg-card/90 px-6 py-5 md:gap-10 md:px-12">
        <img src={clinica.url} alt="Clínica Escola de Saúde Integrada" className="h-auto w-44 object-contain" />
        <span className="h-10 w-px bg-border" aria-hidden="true" />
        <img src={nupes.url} alt="NuPES — Núcleo de Práticas e Estudos em Saúde" className="h-auto w-36 object-contain" />
        <span className="h-10 w-px bg-border" aria-hidden="true" />
        <img src={nupep.url} alt="NuPEP — Núcleo de Práticas e Estudos em Psicologia" className="h-auto w-32 object-contain" />
      </footer>
    </div>
  );
}
