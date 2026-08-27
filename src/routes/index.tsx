import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Entrar | Sistema Integrado de Cursos FACESF" },
      {
        name: "description",
        content: "Acesse o sistema de geração e gestão automática de ofícios.",
      },
      { property: "og:title", content: "Entrar | Sistema Integrado de Cursos FACESF" },
      {
        property: "og:description",
        content: "Acesse o sistema de geração e gestão automática de ofícios.",
      },
    ],
  }),
  component: () => null,
});
