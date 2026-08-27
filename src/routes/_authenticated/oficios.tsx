import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Eye, Pencil, Printer, Search, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  formatarData,
  montarDocumentoHtml,
  type Configuracoes,
  type ModeloOficio,
  type Oficio,
} from "@/lib/oficios";
import { baixarBlob, gerarPdfDeHtml, imprimirBlob } from "@/lib/pdf";
import { uploadArquivo } from "@/lib/storage";
import { buscarFontesOficioAtuais } from "@/lib/documentos-data";

export const Route = createFileRoute("/_authenticated/oficios")({
  validateSearch: (search: Record<string, unknown>) => ({ q: String(search["q"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Ofícios | Sistema de Ofícios" },
      { name: "description", content: "Lista completa de ofícios com busca, PDF e impressão." },
      { property: "og:title", content: "Ofícios | Sistema de Ofícios" },
      {
        property: "og:description",
        content: "Lista completa de ofícios com busca, PDF e impressão.",
      },
    ],
  }),
  component: OficiosPage,
});

function OficiosPage() {
  const { q } = Route.useSearch();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState(q);
  const [aberto, setAberto] = useState<Oficio | null>(null);
  const [htmlAberto, setHtmlAberto] = useState("");
  const [editando, setEditando] = useState<Oficio | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [excluindo, setExcluindo] = useState<Oficio | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as Configuracoes | null;
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos_oficio"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modelos_oficio").select("*").order("chave");
      if (error) throw error;
      return (data ?? []) as unknown as ModeloOficio[];
    },
  });

  const { data: oficios = [], isLoading } = useQuery({
    queryKey: ["oficios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oficios")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as Oficio[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return oficios;
    return oficios.filter((o) =>
      [o.numero_formatado, o.nome, o.curso, o.matricula, o.cpf, o.destinatario]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [oficios, busca]);

  async function comPdf(oficio: Oficio, acao: "baixar" | "imprimir") {
    setOcupado(true);
    try {
      const fontes = await buscarFontesOficioAtuais();
      const blob = await gerarPdfDeHtml(montarDocumentoHtml(oficio, fontes.config, fontes.modelos));
      const path = `documentos/${oficio.ano}/${oficio.numero_formatado.replace(/[^\w]+/g, "-")}.pdf`;
      try {
        await uploadArquivo(path, blob, "application/pdf");
        await supabase.from("oficios").update({ pdf_path: path }).eq("id", oficio.id);
      } catch {
        /* arquivamento opcional */
      }
      if (acao === "baixar") baixarBlob(blob, `${oficio.numero_formatado}.pdf`);
      else imprimirBlob(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar o PDF.");
    } finally {
      setOcupado(false);
    }
  }

  async function abrirEditor(oficio: Oficio) {
    setOcupado(true);
    try {
      const fontes = await buscarFontesOficioAtuais();
      setConteudo(montarDocumentoHtml(oficio, fontes.config, fontes.modelos));
      setEditando(oficio);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar o modelo atual.");
    } finally {
      setOcupado(false);
    }
  }

  async function abrirVisualizacao(oficio: Oficio) {
    setOcupado(true);
    try {
      const fontes = await buscarFontesOficioAtuais();
      setHtmlAberto(montarDocumentoHtml(oficio, fontes.config, fontes.modelos));
      setAberto(oficio);
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
      .from("oficios")
      .update({ conteudo_html: conteudo })
      .eq("id", editando.id);
    setOcupado(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ofício atualizado.");
    setEditando(null);
    queryClient.invalidateQueries({ queryKey: ["oficios"] });
  }

  async function excluir() {
    if (!excluindo) return;
    setOcupado(true);
    const { error } = await supabase.from("oficios").delete().eq("id", excluindo.id);
    setOcupado(false);
    setExcluindo(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ofício excluído.");
    queryClient.invalidateQueries({ queryKey: ["oficios"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Ofícios</h1>
        <p className="text-sm text-muted-foreground">
          {filtrados.length} documento(s) encontrados.
        </p>
      </div>

      <div className="surface-card flex items-center gap-2 p-2">
        <Search className="ml-2 size-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por número, aluno, CPF, curso ou matrícula"
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="surface-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Número</TableHead>
              <TableHead>Aluno(a)</TableHead>
              <TableHead className="hidden md:table-cell">Curso</TableHead>
              <TableHead className="hidden lg:table-cell">Matrícula</TableHead>
              <TableHead className="w-28">Data</TableHead>
              <TableHead className="w-52 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.numero_formatado}</TableCell>
                <TableCell>{o.nome}</TableCell>
                <TableCell className="hidden md:table-cell">{o.curso}</TableCell>
                <TableCell className="hidden max-w-xs truncate lg:table-cell">
                  {o.matricula}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {o.data.slice(8, 10)}/{o.data.slice(5, 7)}/{o.data.slice(0, 4)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => abrirVisualizacao(o)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => abrirEditor(o)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Baixar PDF"
                    disabled={ocupado}
                    onClick={() => comPdf(o, "baixar")}
                  >
                    <Download className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Imprimir"
                    disabled={ocupado}
                    onClick={() => comPdf(o, "imprimir")}
                  >
                    <Printer className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setExcluindo(o)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  Nenhum ofício encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{aberto?.numero_formatado}</DialogTitle>
          </DialogHeader>
          {aberto && config && (
            <>
              <EscalaA4 className="rounded-lg border bg-muted/30 p-2">
                <article
                  className="print-area prose-oficio pagina-a4"
                  dangerouslySetInnerHTML={{ __html: htmlAberto }}
                />
              </EscalaA4>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="mr-auto self-center text-xs text-muted-foreground">
                  Recebido em {formatarData(aberto.created_at.slice(0, 10))}
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
            <DialogTitle>Editar {editando?.numero_formatado}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Edição livre do documento: formate o texto, ajuste alinhamentos e insira imagens PNG em
            qualquer ponto — inclusive no cabeçalho.
          </p>
          <RichEditor value={conteudo} onChange={setConteudo} minHeight={420} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={ocupado}>
              {ocupado ? "Salvando…" : "Salvar ofício"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluindo?.numero_formatado}?</AlertDialogTitle>
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
