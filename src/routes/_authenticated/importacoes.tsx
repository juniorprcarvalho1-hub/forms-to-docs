import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImportadorDados } from "@/components/ImportadorDados";
import { importarRegistros } from "@/lib/importacao-dados";

export const Route = createFileRoute("/_authenticated/importacoes")({
  head: () => ({ meta: [{ title: "Importar dados | FACESF" }] }),
  component: ImportacoesPage,
});

function ImportacoesPage() {
  const queryClient = useQueryClient();
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">
          Organizar entradas
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Importar dados</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Traga as respostas do Google Forms e os arquivos de outros sistemas. Confira os campos e
          revise tudo antes de salvar.
        </p>
      </header>
      <ImportadorDados
        destinoInicial="oficios"
        permitePacientes={false}
        onImportar={async (...args) => {
          const r = await importarRegistros(...args);
          await Promise.all(
            ["oficios", "declaracoes", "declaracoes_resposta", "importacoes"].map(
              (k) => queryClient.invalidateQueries({ queryKey: [k] }),
            ),
          );
          return r;
        }}
      />
    </div>
  );
}
