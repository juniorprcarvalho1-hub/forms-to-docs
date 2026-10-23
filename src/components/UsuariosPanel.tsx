import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Pencil, Ban, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PLANOS,
  calcularVencimento,
  cadastroUsuarioSchema,
  alteracaoPlanoSchema,
  situacaoAssinatura,
  type Plano,
  type UsuarioGerenciado,
  type ListaUsuarios,
} from "@/lib/controle-usuarios";

type Api = {
  listar: (d: { data: { pagina: number; busca: string } }) => Promise<ListaUsuarios>;
  cadastrar: (d: {
    data: { nome: string; email: string; senha: string; plano: Plano; vencimento: string };
  }) => Promise<unknown>;
  plano: (d: { data: { userId: string; plano: Plano; vencimento: string } }) => Promise<unknown>;
  suspender: (d: {
    data: { userId: string; suspenso: boolean };
  }) => Promise<{ ok: boolean; aviso: string | null }>;
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR");
const mensagem = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.";
function OpcoesPlano() {
  return Object.entries(PLANOS).map(([key, p]) => (
    <option value={key} key={key}>
      {p.nome} — {brl(p.valor)}
    </option>
  ));
}
const selectClass = "mt-1 block h-10 w-full rounded-md border bg-background px-3 text-sm";

// Separado da autenticação para testes visuais com dados fictícios. A rota monta este painel somente para o dono.
export function UsuariosPanel({ api }: { api: Api }) {
  const qc = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<UsuarioGerenciado | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [plano, setPlano] = useState<Plano>("mensal");
  const [vencimento, setVencimento] = useState(() => calcularVencimento("mensal"));
  const [salvando, setSalvando] = useState(false);
  const [alterando, setAlterando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const lista = useQuery({
    queryKey: ["controle-usuarios", pagina, filtro],
    queryFn: () => api.listar({ data: { pagina, busca: filtro } }),
  });
  async function atualizar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["controle-usuarios"] }),
      qc.invalidateQueries({ queryKey: ["acesso"] }),
    ]);
  }
  function cadastrar() {
    setEditando(null);
    setNome("");
    setEmail("");
    setSenha("");
    setPlano("mensal");
    setVencimento(calcularVencimento("mensal"));
    setErro("");
    setAberto(true);
  }
  function editar(u: UsuarioGerenciado) {
    setEditando(u);
    setPlano(u.plano ?? "mensal");
    setVencimento(u.vencimento ?? calcularVencimento("mensal"));
    setErro("");
    setSenha("");
    setAberto(true);
  }
  function fechar(open: boolean) {
    if (salvando) return;
    setAberto(open);
    if (!open) {
      setSenha("");
      setErro("");
    }
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro("");
    const parsed = editando
      ? alteracaoPlanoSchema.safeParse({ userId: editando.userId, plano, vencimento })
      : cadastroUsuarioSchema.safeParse({ nome, email, senha, plano, vencimento });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Confira os dados.");
      return;
    }
    setSalvando(true);
    try {
      if (editando) await api.plano({ data: { userId: editando.userId, plano, vencimento } });
      else await api.cadastrar({ data: { nome, email, senha, plano, vencimento } });
      setSenha("");
      setAberto(false);
      toast.success(editando ? "Plano salvo." : "Usuário cadastrado.");
      await atualizar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }
  async function mudarSuspensao(u: UsuarioGerenciado) {
    if (alterando) return;
    const suspender = !u.suspenso;
    if (
      !window.confirm(
        (suspender ? "Suspender o acesso de " : "Reativar o acesso de ") +
          u.email +
          "?" +
          (suspender
            ? " O usuário perderá o acesso aos dados do sistema."
            : " O acesso depende de um plano não vencido."),
      )
    )
      return;
    setAlterando(u.userId);
    try {
      const r = await api.suspender({ data: { userId: u.userId, suspenso: suspender } });
      toast.success(suspender ? "Acesso suspenso." : "Acesso reativado.");
      if (r.aviso) toast.warning(r.aviso);
      await atualizar();
    } catch (e) {
      toast.error(mensagem(e));
    } finally {
      setAlterando(null);
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="usuarios-titulo">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="usuarios-titulo" className="text-lg font-semibold">
            Usuários e planos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie o plano, o vencimento e o acesso de cada conta.
          </p>
        </div>
        <Button className="gap-2" onClick={cadastrar}>
          <UserPlus className="size-4" />
          Cadastrar usuário
        </Button>
      </div>
      <form
        className="my-5 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPagina(1);
          setFiltro(busca.trim());
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="busca-usuario">Buscar usuário</Label>
          <Input
            id="busca-usuario"
            className="mt-1"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            maxLength={200}
            placeholder="Nome ou e-mail"
          />
        </div>
        <Button variant="outline" type="submit" className="gap-2">
          <Search className="size-4" />
          Buscar
        </Button>
      </form>
      {lista.isPending ? (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          Carregando usuários…
        </p>
      ) : lista.isError ? (
        <div role="alert" className="space-y-3 py-4">
          <p className="text-sm">{mensagem(lista.error)}</p>
          <Button variant="outline" onClick={() => void lista.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          {lista.data.usuarios.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              {filtro
                ? "Nenhum usuário encontrado."
                : "Nenhum usuário cadastrado. Use o botão acima para começar."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <caption className="sr-only">
                  Usuários, planos individuais e situação de acesso
                </caption>
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Usuário</th>
                    <th className="pb-3 font-medium">Plano</th>
                    <th className="pb-3 font-medium">Vencimento</th>
                    <th className="pb-3 font-medium">Situação</th>
                    <th className="pb-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.data.usuarios.map((u) => {
                    const status =
                      u.plano && u.vencimento
                        ? situacaoAssinatura({ suspenso: u.suspenso, vencimento: u.vencimento })
                        : "pendente";
                    return (
                      <tr key={u.userId} className="border-t">
                        <td className="py-4 pr-3">
                          <p className="font-medium">{u.nome || "Nome não informado"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="pr-3">{u.plano ? PLANOS[u.plano].nome : "Sem plano"}</td>
                        <td className="pr-3">{u.vencimento ? dataBR(u.vencimento) : "—"}</td>
                        <td className="pr-3">
                          <span
                            className={
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium " +
                              (status === "ativo"
                                ? "bg-emerald-50 text-emerald-800"
                                : status === "suspenso"
                                  ? "bg-red-50 text-red-800"
                                  : "bg-amber-50 text-amber-900")
                            }
                          >
                            {status === "ativo"
                              ? "Ativo"
                              : status === "suspenso"
                                ? "Suspenso"
                                : status === "vencido"
                                  ? "Vencido"
                                  : "Sem plano"}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editar(u)}
                              disabled={alterando !== null}
                              className="gap-1.5"
                              aria-label={"Alterar plano de " + u.email}
                            >
                              <Pencil className="size-3.5" />
                              Plano
                            </Button>
                            <Button
                              size="sm"
                              variant={u.suspenso ? "outline" : "destructive"}
                              onClick={() => void mudarSuspensao(u)}
                              disabled={alterando !== null || !u.plano}
                              className="gap-1.5"
                              aria-label={(u.suspenso ? "Reativar " : "Suspender ") + u.email}
                            >
                              {u.suspenso ? (
                                <RotateCcw className="size-3.5" />
                              ) : (
                                <Ban className="size-3.5" />
                              )}
                              {alterando === u.userId
                                ? "Aguarde…"
                                : u.suspenso
                                  ? "Reativar"
                                  : "Suspender"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
            <p className="text-muted-foreground">
              {lista.data.total} {lista.data.total === 1 ? "usuário" : "usuários"} · Página {pagina}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagina === 1 || lista.isFetching}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagina * 20 >= lista.data.total || lista.isFetching}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Alterar plano" : "Cadastrar usuário"}</DialogTitle>
            <DialogDescription>
              {editando ? editando.email : "Crie uma conta com acesso individual ao sistema."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            {!editando && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="novo-nome">Nome</Label>
                  <Input
                    id="novo-nome"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={120}
                    required
                    disabled={salvando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="novo-email">E-mail</Label>
                  <Input
                    id="novo-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    required
                    disabled={salvando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nova-senha">Senha inicial</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    minLength={8}
                    required
                    disabled={salvando}
                  />
                  <p className="text-xs text-muted-foreground">
                    No mínimo 8 caracteres. Entregue a senha ao usuário por um canal seguro.
                  </p>
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="usuario-plano">Plano</Label>
                <select
                  id="usuario-plano"
                  className={selectClass}
                  value={plano}
                  disabled={salvando}
                  onChange={(e) => {
                    const p = e.target.value as Plano;
                    setPlano(p);
                    if (!editando) setVencimento(calcularVencimento(p));
                  }}
                >
                  <OpcoesPlano />
                </select>
              </div>
              <div>
                <Label htmlFor="usuario-vencimento">Vencimento</Label>
                <Input
                  id="usuario-vencimento"
                  className="mt-1"
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  required
                  disabled={salvando}
                />
              </div>
            </div>
            {editando && (
              <p className="text-xs text-muted-foreground">
                Salvar o plano mantém a situação de suspensão e não registra um pagamento.
              </p>
            )}
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fechar(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando…" : editando ? "Salvar plano" : "Cadastrar usuário"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
