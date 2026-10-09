import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { verificarAcesso } from "@/lib/acesso.functions";

export const Route = createFileRoute("/_authenticated/controle")({
  head: () => ({
    meta: [
      { title: "Painel de Controle — Sistema Integrado de Cursos FACESF" },
      { name: "description", content: "Assinatura, faturamento e bloqueios de acesso." },
      { property: "og:title", content: "Painel de Controle — FACESF" },
      { property: "og:description", content: "Assinatura, faturamento e bloqueios de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Controle,
});

const PLANOS: Record<string, { nome: string; valor: number; meses: number }> = {
  mensal: { nome: "Mensal", valor: 250, meses: 1 },
  semestral: { nome: "Semestral", valor: 1500, meses: 6 },
  anual: { nome: "Anual", valor: 3000, meses: 12 },
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Controle() {
  const qc = useQueryClient();
  const acessoFn = useServerFn(verificarAcesso);
  const acesso = useQuery({ queryKey: ["acesso"], queryFn: () => acessoFn() });

  const ass = useQuery({
    queryKey: ["assinatura"],
    queryFn: async () => (await supabase.from("assinatura").select("*").maybeSingle()).data,
  });
  const pags = useQuery({
    queryKey: ["pagamentos"],
    queryFn: async () =>
      (await supabase.from("pagamentos").select("*").order("data", { ascending: false })).data ?? [],
  });
  const ips = useQuery({
    queryKey: ["ips"],
    queryFn: async () =>
      (await supabase.from("ips_bloqueados").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const [plano, setPlano] = useState("mensal");
  const [venc, setVenc] = useState("");
  const [novoIp, setNovoIp] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (ass.data) {
      setPlano(ass.data.plano);
      setVenc(ass.data.vencimento);
    }
  }, [ass.data]);

  if (acesso.isLoading) return <><p>Carregando…</p></>;
  if (!acesso.data?.admin)
    return <><p className="text-muted-foreground">Área restrita ao administrador.</p></>;

  const a = ass.data;
  const vencido = a ? a.vencimento < new Date().toISOString().slice(0, 10) : false;
  const hoje = new Date();
  const mesAtual = (pags.data ?? []).filter((p) => {
    const d = new Date(p.data + "T12:00:00");
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  });
  const anoAtual = (pags.data ?? []).filter((p) => p.data.startsWith(String(hoje.getFullYear())));
  const soma = (l: { valor: number }[]) => l.reduce((s, p) => s + Number(p.valor), 0);

  async function salvarAss(campos: Record<string, unknown>) {
    const { error } = await supabase.from("assinatura").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["assinatura"] });
  }

  async function registrarPagamento() {
    const p = PLANOS[plano] ?? PLANOS["mensal"]!;
    const base = a && !vencido ? new Date(a.vencimento + "T12:00:00") : new Date();
    base.setMonth(base.getMonth() + p.meses);
    const novoVenc = base.toISOString().slice(0, 10);
    const { error } = await supabase.from("pagamentos").insert({ valor: p.valor, plano });
    if (error) { toast.error(error.message); return; }
    await salvarAss({ plano, valor: p.valor, vencimento: novoVenc, status: "ativa" });
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  }

  async function excluirPagamento(id: string, planoPag: string) {
    if (!confirm("Excluir este pagamento? O vencimento volta ao valor anterior.")) return;
    const { error } = await supabase.from("pagamentos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (a) {
      const d = new Date(a.vencimento + "T12:00:00");
      d.setMonth(d.getMonth() - (PLANOS[planoPag]?.meses ?? 1));
      await salvarAss({ vencimento: d.toISOString().slice(0, 10) });
    }
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  }

  async function bloquearIp() {
    if (!novoIp.trim()) return;
    const { error } = await supabase.from("ips_bloqueados").insert({ ip: novoIp.trim(), motivo });
    if (error) { toast.error(error.message); return; }
    setNovoIp("");
    setMotivo("");
    qc.invalidateQueries({ queryKey: ["ips"] });
  }

  async function liberarIp(id: string) {
    await supabase.from("ips_bloqueados").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["ips"] });
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold">Painel de Controle</h1>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Situação</p>
            <p className="text-xl font-semibold">
              {a?.status === "bloqueada" ? "Bloqueada" : vencido ? "Vencida" : "Ativa"}
            </p>
            {a && <p className="text-sm text-muted-foreground">Vence em {dataBR(a.vencimento)}</p>}
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Recebido no mês</p>
            <p className="text-xl font-semibold">{brl(soma(mesAtual))}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Recebido no ano</p>
            <p className="text-xl font-semibold">{brl(soma(anoAtual))}</p>
          </div>
        </div>

        <Card titulo={`Cliente: ${a?.cliente ?? "FACESF"}`}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Plano
              <select
                className="mt-1 block h-10 rounded-md border bg-background px-3"
                value={plano}
                onChange={(e) => setPlano(e.target.value)}
              >
                {Object.entries(PLANOS).map(([k, p]) => (
                  <option key={k} value={k}>{p.nome} — {brl(p.valor)}</option>
                ))}
              </select>
            </label>
            <Button onClick={registrarPagamento}>Registrar pagamento e renovar</Button>
            <label className="text-sm">
              Vencimento
              <Input type="date" className="mt-1" value={venc} onChange={(e) => setVenc(e.target.value)} />
            </label>
            <Button variant="outline" onClick={() => salvarAss({ vencimento: venc })}>Salvar data</Button>
            {a?.status === "bloqueada" ? (
              <Button variant="secondary" onClick={() => salvarAss({ status: "ativa" })}>Liberar acesso</Button>
            ) : (
              <Button variant="destructive" onClick={() => salvarAss({ status: "bloqueada" })}>Bloquear acesso</Button>
            )}
          </div>
        </Card>

        <Card titulo="Faturamento">
          {(pags.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">Data</th><th>Plano</th><th>Valor</th><th></th></tr>
              </thead>
              <tbody>
                {pags.data!.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2">{dataBR(p.data)}</td>
                    <td>{PLANOS[p.plano]?.nome ?? p.plano}</td>
                    <td>{brl(Number(p.valor))}</td>
                    <td className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => excluirPagamento(p.id, p.plano)} aria-label="Excluir">
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card titulo="Bloqueio por IP">
          <p className="mb-3 text-sm text-muted-foreground">Seu endereço atual: <b>{acesso.data.ip}</b></p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input placeholder="Endereço IP" value={novoIp} onChange={(e) => setNovoIp(e.target.value)} className="max-w-48" />
            <Input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="max-w-xs" />
            <Button onClick={bloquearIp}>Bloquear IP</Button>
          </div>
          {(ips.data ?? []).map((i) => (
            <div key={i.id} className="flex items-center justify-between border-t py-2 text-sm">
              <span><b>{i.ip}</b> {i.motivo && `— ${i.motivo}`}</span>
              <Button size="sm" variant="outline" onClick={() => liberarIp(i.id)}>Liberar</Button>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
