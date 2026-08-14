import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Eye, Printer, Search } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import {
  formatarData,
  renderizarModelo,
  type Configuracoes,
  type Oficio,
} from "@/lib/oficios";
import { baixarBlob, gerarPdf, imprimirBlob } from "@/lib/pdf";
import { uploadArquivo } from "@/lib/storage";

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
  const [busca, setBusca] = useState(q);
  const [aberto, setAberto] = useState<Oficio | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as Configuracoes | null;
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
    if (!config) return;
    setOcupado(true);
    try {
      const blob = await gerarPdf(oficio, config);
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
          placeholder="Pesquisar por número, nome, instituição ou assunto"
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
              <TableHead className="w-36 text-right">Ações</TableHead>
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
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setAberto(o)}>
                    <Eye className="size-4" />
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
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{aberto?.numero_formatado}</DialogTitle>
          </DialogHeader>
          {aberto && config && (
            <>
              <article className="print-area rounded-lg border bg-card p-8 font-serif text-sm leading-7 whitespace-pre-wrap">
                {config.logo_url && (
                  <img src={config.logo_url} alt="Logotipo" className="mx-auto mb-6 h-16 object-contain" />
                )}
                {renderizarModelo(config.modelo, aberto)}
                {config.assinatura_url && (
                  <img
                    src={config.assinatura_url}
                    alt="Assinatura"
                    className="mx-auto mt-6 h-20 object-contain"
                  />
                )}
              </article>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="mr-auto self-center text-xs text-muted-foreground">
                  Recebido em {formatarData(aberto.created_at.slice(0, 10))}
                </span>
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
    </div>
  );
}
