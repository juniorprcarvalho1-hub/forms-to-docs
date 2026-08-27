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
import { supabase } from "@/integrations/supabase/client";
import {
  mensagemEmailDeclaracao,
  montarDeclaracaoHtml,
  pendenciaDeclaracao,

  ORDEM_MODELOS_DECLARACAO,
  ROTULOS_DECLARACAO,
  type ConfiguracoesDeclaracao,
  type Declaracao,
  type ModeloDeclaracao,
} from "@/lib/declaracoes";
import { formatarData } from "@/lib/oficios";
import { baixarBlob, gerarPdfDeHtml, imprimirBlob } from "@/lib/pdf";
import { uploadArquivo, urlAssinada } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/declaracoes")({
  head: () => ({
    meta: [
      { title: "Declarações de Preceptoria | Sistema de Ofícios" },
      {
        name: "description",
        content:
          "Declarações de preceptoria geradas automaticamente a partir do formulário do preceptor.",
      },
      { property: "og:title", content: "Declarações de Preceptoria" },
      {
        property: "og:description",
        content: "Certificados de preceptoria gerados automaticamente pelo sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeclaracoesPage,
});

function DeclaracoesPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Declaracao | null>(null);
  const [editando, setEditando] = useState<Declaracao | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [excluindo, setExcluindo] = useState<Declaracao | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as ConfiguracoesDeclaracao | null;
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos_declaracao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modelos_declaracao").select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as ModeloDeclaracao[]).sort(
        (a, b) =>
          ORDEM_MODELOS_DECLARACAO.indexOf(a.chave) - ORDEM_MODELOS_DECLARACAO.indexOf(b.chave),
      );
    },
  });

  const { data: declaracoes = [], isLoading } = useQuery({
    queryKey: ["declaracoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("declaracoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Declaracao[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return declaracoes;
    return declaracoes.filter((d) =>
      [d.nome, d.coren, d.hospital, d.email].join(" ").toLowerCase().includes(termo),
    );
  }, [declaracoes, busca]);

  function gerarHtml(declaracao: Declaracao): string | null {
    if (!config) return null;
    try {
      return montarDeclaracaoHtml(declaracao, config, modelos);
    } catch {
      return null;
    }
  }

  async function comPdf(declaracao: Declaracao, acao: "baixar" | "imprimir") {
    if (!config) return;
    const html = gerarHtml(declaracao);
    if (!html) {
      toast.error(pendenciaDeclaracao(declaracao) ?? "Não foi possível gerar a declaração.");
      return;
    }
    setOcupado(true);
    try {
      const blob = await gerarPdfDeHtml(html);

      const path = `declaracoes/${declaracao.id}.pdf`;
      try {
        await uploadArquivo(path, blob, "application/pdf");
        await supabase.from("declaracoes").update({ pdf_path: path }).eq("id", declaracao.id);
      } catch {
        /* arquivamento opcional */
      }
      if (acao === "baixar")
        baixarBlob(blob, `Declaracao-${declaracao.nome.replace(/[^\w]+/g, "-")}.pdf`);
      else imprimirBlob(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o PDF.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviarPorEmail(declaracao: Declaracao) {
    if (!config) return;
    if (!declaracao.email) {
      toast.error("Esta declaração não tem e-mail do preceptor.");
      return;
    }
    const html = gerarHtml(declaracao);
    if (!html) {
      toast.error(pendenciaDeclaracao(declaracao) ?? "Não foi possível gerar a declaração.");
      return;
    }
    setOcupado(true);
    try {
      const blob = await gerarPdfDeHtml(html);

      const arquivo = `Declaracao-${declaracao.nome.replace(/[^\w]+/g, "-")}.pdf`;
      let link: string | undefined;
      try {
        const path = `declaracoes/${declaracao.id}.pdf`;
        await uploadArquivo(path, blob, "application/pdf");
        await supabase.from("declaracoes").update({ pdf_path: path }).eq("id", declaracao.id);
        link = await urlAssinada(path);
      } catch {
        /* link opcional */
      }
      baixarBlob(blob, arquivo);
      const { assunto, corpo } = mensagemEmailDeclaracao(declaracao, link);
      const mailto = `mailto:${encodeURIComponent(declaracao.email)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
      window.location.href = mailto;
      await supabase
        .from("declaracoes")
        .update({ email_enviado_em: new Date().toISOString() })
        .eq("id", declaracao.id);
      queryClient.invalidateQueries({ queryKey: ["declaracoes"] });
      toast.success("E-mail aberto. O PDF foi baixado — anexe o arquivo e clique em enviar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao preparar o e-mail.");
    } finally {
      setOcupado(false);
    }
  }

  function abrirEditor(declaracao: Declaracao) {
    if (!config) return;
    const html = gerarHtml(declaracao);
    if (!html) {
      toast.error(pendenciaDeclaracao(declaracao) ?? "Não foi possível gerar a declaração.");
      return;
    }
    setConteudo(html);
    setEditando(declaracao);
  }


  async function salvarEdicao() {
    if (!editando) return;
    setOcupado(true);
    const { error } = await supabase
      .from("declaracoes")
      .update({ conteudo_html: conteudo })
      .eq("id", editando.id);
    setOcupado(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Declaração atualizada.");
    setEditando(null);
    queryClient.invalidateQueries({ queryKey: ["declaracoes"] });
  }

  async function excluir() {
    if (!excluindo) return;
    setOcupado(true);
    const { error } = await supabase.from("declaracoes").delete().eq("id", excluindo.id);
    setOcupado(false);
    setExcluindo(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Declaração excluída.");
    queryClient.invalidateQueries({ queryKey: ["declaracoes"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Declarações de Preceptoria</h1>
        <p className="text-sm text-muted-foreground">
          {filtrados.length} declaração(ões) recebida(s) do formulário do preceptor.
        </p>
      </div>

      <div className="surface-card flex items-center gap-2 p-2">
        <Search className="ml-2 size-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por preceptor, registro, hospital ou e-mail"
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="surface-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preceptor(a)</TableHead>
              <TableHead className="hidden md:table-cell">Registro</TableHead>
              <TableHead className="hidden lg:table-cell">Hospital</TableHead>
              <TableHead className="w-40">Período</TableHead>
              <TableHead className="w-64 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.nome}</TableCell>
                <TableCell className="hidden md:table-cell">{d.coren}</TableCell>
                <TableCell className="hidden max-w-xs truncate lg:table-cell">
                  {d.hospital}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.data_inicio} a {d.data_fim}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setAberto(d)}>
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
                    title="Enviar por e-mail"
                    disabled={ocupado}
                    onClick={() => enviarPorEmail(d)}
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
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
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
            <DialogTitle>Declaração de {aberto?.nome}</DialogTitle>
          </DialogHeader>
          {aberto && config && (
            <>
              <EscalaA4 className="rounded-lg border bg-muted/30 p-2">
                <article
                  className="print-area prose-oficio pagina-a4"
                  dangerouslySetInnerHTML={{ __html: gerarHtml(aberto) ?? "" }}
                />
              </EscalaA4>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="mr-auto self-center text-xs text-muted-foreground">
                  Recebida em {formatarData(aberto.created_at.slice(0, 10))}
                </span>
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
                <Button
                  variant="outline"
                  onClick={() => enviarPorEmail(aberto)}
                  disabled={ocupado}
                >
                  <Mail className="size-4" /> Enviar por e-mail
                </Button>
                <Button
                  variant="outline"
                  onClick={() => comPdf(aberto, "imprimir")}
                  disabled={ocupado}
                >
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
            <DialogTitle>Editar declaração de {editando?.nome}</DialogTitle>
          </DialogHeader>
          <RichEditor
            value={conteudo}
            onChange={setConteudo}
            minHeight={420}
            rotulos={ROTULOS_DECLARACAO}
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
            <AlertDialogTitle>Excluir declaração de {excluindo?.nome}?</AlertDialogTitle>
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
