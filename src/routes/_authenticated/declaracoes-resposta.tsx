import {caminhoPrivadoDocumento} from "@/lib/documento-path";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
  mensagemEmailResposta,
  montarDeclaracaoRespostaHtml,
  NOMES_CURSO,
  ORDEM_MODELOS_RESPOSTA,
  ROTULOS_DECLARACAO_RESPOSTA,
  type DeclaracaoResposta,
  type ModeloDeclaracaoResposta,
  type Orientador,
} from "@/lib/declaracoes-resposta";
import { enviarEmailComPdf } from "@/lib/email.functions";
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

async function blobParaBase64(blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    binario += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return btoa(binario);
}

async function buscarModelosResposta() {
  const { data, error } = await supabase.from("modelos_declaracao_resposta").select("*");
  if (error) throw error;
  return ((data ?? []) as unknown as ModeloDeclaracaoResposta[]).sort(
    (a, b) => ORDEM_MODELOS_RESPOSTA.indexOf(a.chave) - ORDEM_MODELOS_RESPOSTA.indexOf(b.chave),
  );
}

function DeclaracoesRespostaPage() {
  const queryClient = useQueryClient();
  const enviarEmail = useServerFn(enviarEmailComPdf);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<DeclaracaoResposta | null>(null);
  const [htmlAberto, setHtmlAberto] = useState("");
  const [editando, setEditando] = useState<DeclaracaoResposta | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [excluindo, setExcluindo] = useState<DeclaracaoResposta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const processados = useRef(new Set<string>());

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
      const html = await montarHtmlAtual(declaracao);
      const blob = await gerarPdfDeHtml(html);
      const path = await caminhoPrivadoDocumento(`declaracoes-resposta/${declaracao.id}.pdf`);
      try {
        await uploadArquivo(path, blob, "application/pdf");
        await supabase.from("declaracoes_resposta").update({ pdf_path: path }).eq("id", declaracao.id);
      } catch {
        /* arquivamento opcional */
      }
      if (acao === "baixar")
        baixarBlob(blob, `Declaracao-${declaracao.supervisor.replace(/[^\w]+/g, "-")}.pdf`);
      else imprimirBlob(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o PDF.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviarAoOrientador(declaracao: DeclaracaoResposta, automatico = false) {
    const destino = emailDoOrientador(declaracao);
    if (!destino) {
      if (!automatico) {
        toast.error(
          `Cadastre o e-mail do professor orientador de ${NOMES_CURSO[declaracao.modelo_chave] ?? declaracao.curso} em Configurações.`,
        );
      }
      return;
    }
    if (!automatico) setOcupado(true);
    try {
      const html = await montarHtmlAtual(declaracao);
      const blob = await gerarPdfDeHtml(html);
      const nomeArquivo = `Declaracao-${declaracao.supervisor.replace(/[^\w]+/g, "-")}.pdf`;

      try {
        const path = await caminhoPrivadoDocumento(`declaracoes-resposta/${declaracao.id}.pdf`);
        await uploadArquivo(path, blob, "application/pdf");
        await supabase.from("declaracoes_resposta").update({ pdf_path: path }).eq("id", declaracao.id);
      } catch {
        /* arquivamento opcional */
      }

      const { assunto, corpo } = mensagemEmailResposta(declaracao);
      await enviarEmail({
        data: {
          to: destino,
          assunto,
          corpo,
          nomeArquivo,
          pdfBase64: await blobParaBase64(blob),
        },
      });

      await supabase
        .from("declaracoes_resposta")
        .update({ email_enviado_em: new Date().toISOString(), email_destino: destino })
        .eq("id", declaracao.id);
      await queryClient.invalidateQueries({ queryKey: ["declaracoes_resposta"] });
      toast.success(`Declaração enviada para ${destino}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar o e-mail.");
    } finally {
      if (!automatico) setOcupado(false);
    }
  }

  // Envio automático das declarações novas para o orientador do curso.
  useEffect(() => {
    if (declaracoes.length === 0 || orientadores.length === 0) return;
    const pendentes = declaracoes.filter(
      (d) => !d.email_enviado_em && !processados.current.has(d.id) && emailDoOrientador(d),
    );
    if (pendentes.length === 0) return;
    pendentes.forEach((d) => processados.current.add(d.id));
    void (async () => {
      for (const pendente of pendentes) await enviarAoOrientador(pendente, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declaracoes, orientadores]);

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
                <TableCell className="font-medium">{d.supervisor}</TableCell>
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
