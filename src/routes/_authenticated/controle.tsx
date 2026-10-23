import { ControleIps } from "@/components/ControleIps";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ControleUsuarios } from "@/components/ControleUsuarios";
import { verificarAcesso } from "@/lib/acesso.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/controle")({
  head: () => ({ meta: [{ title: "Painel de Controle — FACESF" }] }),
  component: Controle,
});

function Controle() {
  const acessoFn = useServerFn(verificarAcesso);
  const acesso = useQuery({ queryKey: ["acesso"], queryFn: () => acessoFn() });
  if (acesso.isPending) return <p role="status">Verificando acesso…</p>;
  if (!acesso.data?.dono) return <p role="alert">Área exclusiva do proprietário do sistema.</p>;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Painel de Controle</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre usuários e gerencie o plano e o acesso de cada conta.
        </p>
      </header>
      <ControleUsuarios />
      <HistoricoFinanceiro />
      <ControleIps />
    </div>
  );
}

function HistoricoFinanceiro() {
  const pagamentos = useQuery({
    queryKey: ["pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Histórico de faturamento</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Registros anteriores da instituição. Alterar o plano de um usuário não registra pagamento.
      </p>
      {pagamentos.isPending ? (
        <p className="mt-4" role="status">
          Carregando histórico…
        </p>
      ) : pagamentos.isError ? (
        <p className="mt-4" role="alert">
          Não foi possível carregar o histórico.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Data</th>
                <th className="p-2">Plano</th>
                <th className="p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.data.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-2">{p.data.split("-").reverse().join("/")}</td>
                  <td className="p-2">{p.plano}</td>
                  <td className="p-2">
                    {Number(p.valor).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pagamentos.data.length && <p className="p-2">Nenhum pagamento registrado.</p>}
        </div>
      )}
    </section>
  );
}
