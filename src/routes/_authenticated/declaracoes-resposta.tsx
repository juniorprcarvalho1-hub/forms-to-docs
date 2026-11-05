import {obterPdfArquivado} from "@/lib/automacao-arquivo";
import {AndamentoDocumento} from "@/components/AndamentoDocumento";
import {caminhoPrivadoDocumento} from "@/lib/documento-path";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Eye, Mail, Pencil, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RichEditor } from "@/components/RichEditor";
import { EscalaA4 } from "@/components/PaginaA4";
import { supabase } from "@/integrations/supabase/client";
import {
  montarDeclaracaoRespostaHtml,
  NOMES_CURSO,
  ORDEM_MODELOS_RESPOSTA,
  ROTULOS_DECLARACAO_RESPOSTA,
  type DeclaracaoResposta,
  type ModeloDeclaracaoResposta,
  type Orientador,
} from "@/lib/declaracoes-resposta";
import { baixarBlob, gerarPdfDeHtml, imprimirBlob } from "@/lib/pdf";
import { uploadArquivo } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/declaracoes-resposta")({
  head: () => ({
    meta: [
      { title: "Declarações de Resposta | Sistema Integrado de Cursos FACESF" },
      {
        name: "description",
        content:
          "Declarações de preenchimento da avaliação do estagiário, enviadas automaticamente ao professor orientador do curso.",
      },
      { property: "og:title", content: "Declarações de Resposta | FACESF" },
      {
        property: "og:description",
        content: "Declarações geradas pelo formulário do supervisor de campo e enviadas por e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeclaracoesRespostaPage,
});

async function buscarModelosResposta() {
  const { data, error } = await supabase.from("modelos_declaracao_resposta").select("*");
  if (error) throw error;
  return ((data ?? []) as unknown as ModeloDeclaracaoResposta[]).sort(
    (a, b) => ORDEM_MODELOS_RESPOSTA.indexOf(a.chave) - ORDEM_MODELOS_RESPOSTA.indexOf(b.chave),
  );
}

function DeclaracoesRespostaPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<DeclaracaoResposta | null>(null);
  const [htmlAberto, setHtmlAberto] = useState("");
  const [editando, setEditando] = useState<DeclaracaoResposta | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [excluindo, setExcluindo] = useState<DeclaracaoResposta | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: orientadores = [] } = useQuery({
    queryKey: ["orientadores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orientadores").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Orientador[];
    },
  });

  const { data: declaracoes = [], isLoading } = useQuery({
    queryKey: ["declaracoes_resposta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("declaracoes_resposta")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DeclaracaoResposta[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return declaracoes;
    return declaracoes.filter((d) =>
      [d.supervisor, d.estagiario, d.curso, d.tipo_avaliacao, d.email_supervisor]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [declaracoes, busca]);

  function emailDoOrientador(declaracao: DeclaracaoResposta) {
    return (orientadores.find((o) => o.curso === declaracao.modelo_chave)?.email ?? "").trim();
  }

  async function montarHtmlAtual(declaracao: DeclaracaoResposta) {
    const modelos = await buscarModelosResposta();
    return montarDeclaracaoRespostaHtml(declaracao, modelos);
  }

  async function comPdf(declaracao: DeclaracaoResposta, acao: "baixar" | "imprimir") {
    setOcupado(true);
    try {
      const arquivado=await obterPdfArquivado("declaracoes_resposta",declaracao.id);
      if(arquivado){if(acao==="baixar")baixarBlob(arquivado,"documento.pdf");else imprimirBlob(arquivado);return;}
      const html = await montarHtmlAtual(declaracao);
      const blob = await gerarPdfDeHtml(html);
      if (acao === "baixar")
        baixarBlob(blob, `Declaracao-${declaracao.supervisor.replace(/[^\w]+/g, "-")}.pdf`);
      else imprimirBlob(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o PDF.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviarAoOrientador(declaracao: DeclaracaoResposta) {
    setOcupado(true);
    try {
      const {error}=await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient<any>).rpc("automacao_pedir_envio",{p_documento:declaracao.id});
      if(error)throw new Error("Não foi possível agendar. Confira o andamento do documento.");
      await queryClient.invalidateQueries({queryKey:["automacao"]});
      toast.success("Envio solicitado. Acompanhe a confirmação do servidor.");
    } catch(error) {toast.error(error instanceof Error?error.message:"Falha ao solicitar envio.");}
    finally {setOcupado(false);}
  }

  async function abrirEditor(declaracao: DeclaracaoResposta) {
    setOcupado(true);
    try {
      setConteudo(await montarHtmlAtual(declaracao));
      setEditando(declaracao);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar o modelo atual.");
    } finally {
      setOcupado(false);
    }
  }

  async function abrirVisualizacao(declaracao: DeclaracaoResposta) {
    setOcupado(true);
    try {
      setHtmlAberto(await montarHtmlAtual(declaracao));
      setAberto(declaracao);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar o modelo atual.");
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEdicao() {
    if (!editando) return;
    setOcupado(true);
    const { error } = await supabase
      .from("declaracoes_resposta")
      .update({ conteudo_html: conteudo })
      .eq("id", editando.id);
    setOcupado(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Declaração atualizada.");
    setEditando(null);
    queryClient.invalidateQueries({ queryKey: ["declaracoes_resposta"] });
  }

  async function excluir() {
    if (!excluindo) return;
    setOcupado(true);
    const { error } = await supabase.from("declaracoes_resposta").delete().eq("id", excluindo.id);
    setOcupado(false);
    setExcluindo(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Declaração excluída.");
    queryClient.invalidateQueries({ queryKey: ["declaracoes_resposta"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Declarações de Resposta</h1>
        <p className="text-sm text-muted-foreground">
          {filtrados.length} declaração(ões) de preenchimento da avaliação do estagiário. O envio ao
          professor orientador do curso é automático.
        </p>
      </div>

      <div className="surface-card flex items-center gap-2 p-2">
        <Search className="ml-2 size-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por supervisor, estagiário, curso ou avaliação"
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="surface-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supervisor(a)</TableHead>
              <TableHead className="hidden md:table-cell">Estagiário(a)</TableHead>
              <TableHead className="hidden lg:table-cell">Curso</TableHead>
              <TableHead className="w-40">Avaliação</TableHead>
              <TableHead className="w-32">Envio</TableHead>
              <TableHead className="w-64 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.supervisor}<AndamentoDocumento tipo="declaracoes_resposta" id={d.id}/></TableCell>
                <TableCell className="hidden md:table-cell">{d.estagiario}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {NOMES_CURSO[d.modelo_chave] ?? d.curso}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.tipo_avaliacao}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.email_enviado_em ? "Enviada" : "Pendente"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => abrirVisualizacao(d)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => abrirEditor(d)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Baixar PDF"
                    disabled={ocupado}
                    onClick={() => comPdf(d, "baixar")}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Enviar ao professor orientador"
                    disabled={ocupado}
                    onClick={() => enviarAoOrientador(d)}
                  >
                    <Mail className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Imprimir"
                    disabled={ocupado}
                    onClick={() => comPdf(d, "imprimir")}
                  >
                    <Printer className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setExcluindo(d)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  Nenhuma declaração encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Declaração de {aberto?.supervisor}</DialogTitle>
          </DialogHeader>
          {aberto && (
            <>
              <EscalaA4 className="rounded-lg border bg-muted/30 p-2">
                <article
                  className="print-area prose-oficio pagina-a4"
                  dangerouslySetInnerHTML={{ __html: htmlAberto }}
                />
              </EscalaA4>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const alvo = aberto;
                    setAberto(null);
                    abrirEditor(alvo);
                  }}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button variant="outline" onClick={() => enviarAoOrientador(aberto)} disabled={ocupado}>
                  <Mail className="size-4" /> Enviar ao orientador
                </Button>
                <Button variant="outline" onClick={() => comPdf(aberto, "imprimir")} disabled={ocupado}>
                  <Printer className="size-4" /> Imprimir
                </Button>
                <Button onClick={() => comPdf(aberto, "baixar")} disabled={ocupado}>
                  <Download className="size-4" /> Baixar PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar declaração de {editando?.supervisor}</DialogTitle>
          </DialogHeader>
          <RichEditor
            value={conteudo}
            onChange={setConteudo}
            minHeight={420}
            rotulos={ROTULOS_DECLARACAO_RESPOSTA}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={ocupado}>
              {ocupado ? "Salvando…" : "Salvar declaração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir declaração de {excluindo?.supervisor}?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento será removido permanentemente do sistema. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
