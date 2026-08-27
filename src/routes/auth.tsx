import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import facesf from "@/assets/facesf.png.asset.json";
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={facesf.url} alt="FACESF" className="h-14 w-auto" />
          <div>
            <h1 className="text-2xl font-normal">Sistema Integrado de Cursos FACESF</h1>
            <p className="text-sm text-muted-foreground">
              {modo === "entrar" ? "Faça login para continuar" : "Crie sua conta de administrador"}
            </p>
          </div>
        </div>

        <div className="surface-card p-6">
          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
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
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={carregando}>
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={entrarComGoogle}>
            Continuar com Google
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {modo === "entrar" ? "Ainda não tem conta?" : "Já possui conta?"}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          >
            {modo === "entrar" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
}
