// @ts-nocheck -- depende de migrações ainda não aplicadas (docs/IMPORTACOES.md)
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ClipboardCopy,
  FileSpreadsheet,
  MessageCircle,
  Search,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ImportadorDados } from "@/components/ImportadorDados";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { verificarAcesso } from "@/lib/acesso.functions";
import { erroImportacao, importarRegistros, scriptGoogleForms } from "@/lib/importacao-dados";

export const Route = createFileRoute("/_authenticated/pacientes")({
  head: () => ({ meta: [{ title: "Pacientes | FACESF" }] }),
  component: PacientesPage,
});
type Paciente = Tables<"pacientes">;
const status: Record<string, string> = {
  novo: "Novo cadastro",
  em_contato: "Em contato",
  cadastrado: "Cadastrado",
};

function PacientesPage() {
  const acessoFn = useServerFn(verificarAcesso);
  const acesso = useQuery({ queryKey: ["acesso"], queryFn: () => acessoFn(), staleTime: 60_000 });
  const queryClient = useQueryClient();
  const [aba, setAba] = useState("cadastros");
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<Paciente | null>(null);
  const [novoStatus, setNovoStatus] = useState("novo");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const pacientes = useQuery({
    queryKey: ["pacientes", termo, pagina],
    enabled: !!acesso.data?.admin,
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select(
          "id,nome,cpf,email,telefone,data_nascimento,responsavel,endereco,curso,status,origem,created_by,created_at,updated_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(pagina * 30, pagina * 30 + 29);
      if (termo) q = q.ilike("nome", `%${termo.replace(/[%_\\]/g, "")}%`);
      const { data, error, count } = await q;
      if (error) throw erroImportacao(error);
      return { registros: data ?? [], total: count ?? 0 };
    },
  });
  async function atualizar() {
    if (!aberto) return;
    setSalvando(true);
    setErro("");
    try {
      const { error } = await supabase
        .from("pacientes")
        .update({ status: novoStatus })
        .eq("id", aberto.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setAberto(null);
    } catch {
      setErro("Não foi possível atualizar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }
  if (acesso.isPending) return <p role="status">Verificando acesso…</p>;
  if (!acesso.data?.admin)
    return (
      <section className="mx-auto max-w-lg rounded-2xl border bg-card p-8">
        <ShieldCheck aria-hidden="true" className="mb-3 size-8 text-primary" />
        <h1 className="text-xl font-semibold">Cadastro de pacientes</h1>
        <p className="mt-2 text-muted-foreground">
          Esta área é restrita aos administradores autorizados da clínica.
        </p>
      </section>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">
            Clínica Escola
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Pacientes</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Do primeiro contato ao cadastro, sem redigitar as respostas do formulário.
          </p>
        </div>
        <Button className="min-h-11 gap-2" onClick={() => setAba("importar")}>
          <FileSpreadsheet aria-hidden="true" className="size-4" />
          Importar respostas
        </Button>
      </header>
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="mb-6 h-auto flex-wrap gap-1">
          <TabsTrigger className="min-h-11 gap-2" value="cadastros">
            <Users aria-hidden="true" className="size-4" />
            Cadastros
          </TabsTrigger>
          <TabsTrigger className="min-h-11 gap-2" value="importar">
            <FileSpreadsheet aria-hidden="true" className="size-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger className="min-h-11 gap-2" value="forms">
            <Workflow aria-hidden="true" className="size-4" />
            Google Forms
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cadastros" className="space-y-5">
          <form
            className="flex max-w-xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTermo(busca.trim());
              setPagina(0);
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="buscar-pacientes">Buscar paciente pelo nome</Label>
              <Input
                id="buscar-pacientes"
                className="h-11"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome"
              />
            </div>
            <Button type="submit" className="min-h-11 gap-2">
              <Search aria-hidden="true" className="size-4" />
              Buscar
            </Button>
          </form>
          {pacientes.isPending ? (
            <p role="status">Carregando cadastros…</p>
          ) : pacientes.error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 p-5">
              <p>{pacientes.error.message}</p>
              <Button variant="outline" className="mt-3" onClick={() => void pacientes.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : pacientes.data?.registros.length ? (
            <>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Cadastros de pacientes</caption>
                  <thead className="bg-muted">
                    <tr>
                      {["Paciente", "Contato", "Especialidade", "Situação", ""].map((c, i) => (
                        <th key={i} className="p-4">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pacientes.data.registros.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-4">
                          <p className="font-medium">{p.nome}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Recebido em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </td>
                        <td className="p-4">
                          {p.telefone ? `•••• ${p.telefone.slice(-4)}` : "Não informado"}
                        </td>
                        <td className="p-4">{p.curso || "Não informada"}</td>
                        <td className="p-4">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                            {status[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={() => {
                              setAberto(p);
                              setNovoStatus(p.status);
                              setErro("");
                            }}
                          >
                            Abrir cadastro<span className="sr-only"> de {p.nome}</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {pacientes.data.total} cadastros · página {pagina + 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    disabled={(pagina + 1) * 30 >= pacientes.data.total}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border bg-card px-6 py-14 text-center">
              <Users aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
              <h2 className="text-lg font-semibold">
                {termo ? "Nenhum paciente encontrado" : "Seu próximo cadastro começa aqui"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {termo
                  ? "Confira o nome ou limpe a busca."
                  : "Importe a planilha de respostas do Google Forms ou conecte as novas respostas automaticamente."}
              </p>
              <Button className="mt-5 min-h-11" onClick={() => setAba("importar")}>
                Importar uma planilha
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="importar">
          <ImportadorDados
            onImportar={async (...args) => {
              const r = await importarRegistros(...args);
              await Promise.all(
                ["pacientes", "oficios", "declaracoes", "declaracoes_resposta"].map((k) =>
                  queryClient.invalidateQueries({ queryKey: [k] }),
                ),
              );
              return r;
            }}
          />
        </TabsContent>
        <TabsContent value="forms">
          <ConectarForms />
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!aberto}
        onOpenChange={(v) => {
          if (!v && !salvando) setAberto(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{aberto?.nome}</DialogTitle>
            <DialogDescription>
              Cadastro administrativo do paciente. Não é um prontuário clínico.
            </DialogDescription>
          </DialogHeader>
          {aberto && (
            <>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {[
                  ["CPF", aberto.cpf],
                  ["WhatsApp / telefone", aberto.telefone],
                  ["E-mail", aberto.email],
                  ["Nascimento", aberto.data_nascimento?.split("-").reverse().join("/")],
                  ["Responsável", aberto.responsavel],
                  ["Endereço", aberto.endereco],
                  ["Especialidade", aberto.curso],
                  ["Origem", aberto.origem],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="mt-1 break-words font-medium">{v || "Não informado"}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-2">
                <Label htmlFor="situacao-paciente">Situação do cadastro</Label>
                <select
                  id="situacao-paciente"
                  className="h-11 w-full rounded-lg border bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring"
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value)}
                >
                  {Object.entries(status).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              {erro && (
                <p role="alert" className="text-sm text-destructive">
                  {erro}
                </p>
              )}
              <Button
                className="min-h-11"
                disabled={salvando || novoStatus === aberto.status}
                onClick={() => void atualizar()}
              >
                {salvando ? "Salvando…" : "Salvar situação"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConectarForms() {
  const queryClient = useQueryClient();
  const conexoes = useQuery({
    queryKey: ["integracoes_pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_integracoes_pacientes", {});
      if (error) throw erroImportacao(error);
      return data;
    },
  });
  const [urlForm, setUrlForm] = useState("");
  const [integracao, setIntegracao] = useState<{ id: string; token: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const endpoint =
    typeof window === "undefined" ? "" : `${window.location.origin}/api/public/webhooks/pacientes`;
  const script = scriptGoogleForms(endpoint);
  let urlSegura = "";
  try {
    const url = new URL(urlForm);
    if (
      url.protocol === "https:" &&
      (url.hostname === "forms.gle" ||
        (url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/")))
    )
      urlSegura = url.href;
  } catch {
    /* entrada incompleta */
  }
  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setMensagem("Copiado.");
    } catch {
      setErro("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }
  async function criar() {
    setOcupado(true);
    setErro("");
    try {
      const { data, error } = await supabase.rpc("criar_integracao_pacientes", {});
      if (error) throw erroImportacao(error);
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        typeof data["id"] !== "string" ||
        typeof data["token"] !== "string"
      )
        throw new Error("Resposta inesperada.");
      setIntegracao({ id: data["id"], token: data["token"] });
      await queryClient.invalidateQueries({ queryKey: ["integracoes_pacientes"] });
      setMensagem("Token criado. Guarde-o nas Propriedades do script antes de sair desta tela.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a integração.");
    } finally {
      setOcupado(false);
    }
  }
  async function revogar(id = integracao?.id) {
    if (!id) return;
    setOcupado(true);
    setErro("");
    const { error } = await supabase.rpc("revogar_integracao_pacientes", { p_id: id });
    if (error) setErro("Não foi possível revogar o token.");
    else {
      if (integracao?.id === id) setIntegracao(null);
      await queryClient.invalidateQueries({ queryKey: ["integracoes_pacientes"] });
      setMensagem("Token revogado. Esse conector não pode mais enviar respostas.");
    }
    setOcupado(false);
  }
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-semibold">WhatsApp → Google Forms → cadastro</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Continue enviando seu formulário pelo WhatsApp. As novas respostas podem entrar como “Novo
          cadastro”, sem alterar pacientes já cadastrados.
        </p>
        <ol className="mt-5 grid gap-4 text-sm md:grid-cols-3">
          {[
            "Envie o link do formulário ao paciente.",
            "O paciente preenche os dados de cadastro.",
            "Confira o novo cadastro e marque como em contato.",
          ].map((t, i) => (
            <li key={t} className="rounded-xl bg-muted/60 p-4">
              <span className="mb-2 block text-lg font-semibold text-primary">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <div className="mt-6 max-w-xl space-y-2">
          <Label htmlFor="link-forms-paciente">Link do formulário do paciente</Label>
          <Input
            id="link-forms-paciente"
            value={urlForm}
            onChange={(e) => setUrlForm(e.target.value)}
            placeholder="https://forms.gle/…"
            className="h-11"
            type="url"
          />
          <Button
            variant="outline"
            className="min-h-11 gap-2"
            disabled={!urlSegura}
            onClick={() =>
              void copiar(
                `Olá! Para iniciarmos seu cadastro na Clínica Escola FACESF, preencha este formulário: ${urlSegura}`,
              )
            }
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Copiar mensagem para WhatsApp
          </Button>
          <p className="text-xs text-muted-foreground">
            Você confere a mensagem e envia na conversa do paciente.
          </p>
        </div>
      </div>
      <section className="rounded-2xl border bg-card p-6">
        <h3 className="text-lg font-semibold">Conectar novas respostas</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          O conector precisa ser instalado na planilha de respostas do Google Forms. Não publique a
          planilha de pacientes na internet.
        </p>
        <ol className="my-5 list-decimal space-y-3 pl-5 text-sm">
          <li>
            No Google Forms, abra <strong>Respostas → Vincular ao Planilhas</strong>.
          </li>
          <li>
            Na planilha, abra <strong>Extensões → Apps Script</strong> e cole o script abaixo.
          </li>
          <li>
            Crie um token aqui. Nas configurações do Apps Script, adicione a propriedade{" "}
            <strong>FACESF_TOKEN</strong> com esse valor.
          </li>
          <li>
            Execute <strong>instalarIntegracao</strong> na conta responsável e autorize o Google.
            Faça um envio de teste com dados fictícios.
          </li>
        </ol>
        <p className="mb-4 text-sm text-muted-foreground">
          Use perguntas com títulos como Nome completo, CPF, WhatsApp, E-mail, Data de nascimento,
          Responsável, Endereço e Especialidade. O nome é obrigatório. Respostas antigas podem ser
          importadas por arquivo.
        </p>
        {!integracao ? (
          <Button className="min-h-11" disabled={ocupado} onClick={() => void criar()}>
            {ocupado ? "Criando…" : "Criar token desta integração"}
          </Button>
        ) : (
          <div className="rounded-xl border bg-muted/40 p-4">
            <Label htmlFor="token-integracao">Token mostrado uma única vez — não compartilhe</Label>
            <Input
              id="token-integracao"
              className="mt-2 font-mono text-xs"
              value={integracao.token}
              readOnly
              type="password"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void copiar(integracao.token)}
              >
                Copiar token
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={ocupado}
                onClick={() => void revogar()}
              >
                Revogar este token
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Limite de 100 recebimentos por hora. O token permite apenas novos cadastros e não
              consulta pacientes.
            </p>
          </div>
        )}
        <div className="mt-5 space-y-2">
          <Label htmlFor="script-forms">Script para a planilha de respostas</Label>
          <Textarea
            id="script-forms"
            value={script}
            readOnly
            className="min-h-52 font-mono text-xs"
          />
          <Button variant="outline" className="min-h-11 gap-2" onClick={() => void copiar(script)}>
            <ClipboardCopy aria-hidden="true" className="size-4" />
            Copiar script
          </Button>
        </div>
        {mensagem && (
          <p role="status" className="mt-4 text-sm">
            {mensagem}
          </p>
        )}
        {erro && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="mt-6 border-t pt-5">
          <h4 className="font-semibold">Suas conexões</h4>
          {conexoes.error ? (
            <p className="mt-2 text-sm text-muted-foreground">{conexoes.error.message}</p>
          ) : conexoes.data?.length ? (
            <ul className="mt-3 space-y-3">
              {conexoes.data.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <span>
                    Criada em {new Date(c.created_at).toLocaleString("pt-BR")} ·{" "}
                    {c.ativa ? "Ativa" : "Revogada"}
                  </span>
                  {c.ativa && (
                    <Button variant="outline" disabled={ocupado} onClick={() => void revogar(c.id)}>
                      Revogar conexão
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma conexão cadastrada.</p>
          )}
        </div>
      </section>
    </div>
  );
}
