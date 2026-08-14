import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Search, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ofícios | Geração automática via Google Forms" },
      {
        name: "description",
        content:
          "Receba respostas do Google Forms e gere ofícios numerados automaticamente, com PDF, busca instantânea e impressão.",
      },
      { property: "og:title", content: "Ofícios | Geração automática via Google Forms" },
      {
        property: "og:description",
        content: "Gere, numere e localize ofícios em segundos, direto do Google Forms.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 font-medium">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="size-4" />
          </span>
          Ofícios
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-6 pt-20 pb-24 text-center">
        <h1 className="text-4xl font-normal tracking-tight sm:text-5xl">
          Ofícios gerados automaticamente a partir do Google Forms
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          O estagiário preenche o formulário. O sistema numera, gera o documento e arquiva o PDF —
          sem nenhum cadastro manual.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Acessar o sistema</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, t: "Numeração automática", d: "OFÍCIO Nº 001/2026, sem repetições." },
            { icon: Search, t: "Busca instantânea", d: "Por número, nome, instituição ou assunto." },
            { icon: FileText, t: "PDF e impressão", d: "Visualize, baixe ou imprima em um clique." },
          ].map((f) => (
            <div key={f.t} className="surface-card p-5 text-left">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-sm font-medium">{f.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
