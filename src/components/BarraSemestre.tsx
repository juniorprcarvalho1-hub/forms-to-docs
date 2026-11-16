import { useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baixarBlob } from "@/lib/pdf";
import { semestreDaData } from "@/lib/semestre-documentos";

export function useSemestreDocumentos<T extends { id: string; created_at: string }>(
  documentos: T[], dataEmissao: (documento: T) => string,
) {
  const atual = semestreDaData(new Date().toISOString())!;
  const [escolhido, escolher] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, marcar] = useState<Set<string>>(() => new Set());
  const semestre = escolhido ?? atual;
  const grupos = new Map<string, T[]>([[atual, []]]);
  for (const documento of documentos) {
    const chave = semestreDaData(dataEmissao(documento)) ?? semestreDaData(documento.created_at) ?? "sem-data";
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(documento);
    else grupos.set(chave, [documento]);
  }
  const itens = grupos.get(semestre) ?? [];
  return {
    atual, semestre, itens, marcados, selecionando,
    iniciarSelecao: () => setSelecionando(true),
    cancelarSelecao: () => { setSelecionando(false); marcar(new Set()); },
    opcoes: [...grupos.keys()].sort((a, b) => a === "sem-data" ? 1 : b === "sem-data" ? -1 : b.localeCompare(a)),
    selecionados: itens.filter((item) => marcados.has(item.id)),
    trocar: (valor: string) => { escolher(valor === atual ? null : valor); setSelecionando(false); marcar(new Set()); },
    alternar: (ids: string[], checked: boolean) => marcar((anteriores) => {
      const novos = new Set(anteriores);
      for (const id of ids) checked ? novos.add(id) : novos.delete(id);
      return novos;
    }),
  };
}

export function BarraSemestre(props: {
  busca: string; atualizarBusca: (texto: string) => void; placeholder: string;
  atual: string; semestre: string; opcoes: string[]; trocar: (valor: string) => void;
  total: number; marcados: number; ocupado: boolean; progresso: string;
  baixarSemestre: () => void; baixarSelecionados: () => void;
  selecionando: boolean; iniciarSelecao: () => void; cancelarSelecao: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="surface-card flex min-w-[min(100%,16rem)] flex-1 items-center gap-2 px-3 sm:max-w-lg">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <Input aria-label="Pesquisar documentos" value={props.busca} onChange={(e) => props.atualizarBusca(e.target.value)}
            placeholder={props.placeholder} className="border-0 shadow-none" />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          Semestre
          <select className="h-9 rounded-md border bg-background px-3" value={props.semestre}
            disabled={props.ocupado} onChange={(e) => props.trocar(e.target.value)}>
            {props.opcoes.map((s) => <option key={s} value={s}>{s === "sem-data" ? "Sem data" : s + (s === props.atual ? " (atual)" : "")}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={props.ocupado || !props.total} onClick={props.baixarSemestre}>
            <Download className="size-4" /> Baixar semestre ({props.total})
          </Button>
          {props.selecionando ? (
            <>
              <Button disabled={props.ocupado || !props.marcados} onClick={props.baixarSelecionados}>
                Baixar selecionados ({props.marcados})
              </Button>
              <Button variant="ghost" disabled={props.ocupado} onClick={props.cancelarSelecao}>Cancelar seleção</Button>
            </>
          ) : (
            <Button variant="outline" disabled={props.ocupado || !props.total} onClick={props.iniciarSelecao}>
              Baixar selecionados
            </Button>
          )}
        </div>
      </div>
      {props.progresso && <p role="status" className="text-sm text-muted-foreground">{props.progresso}</p>}
    </div>
  );
}

export async function baixarDocumentosEmLote<T>(
  itens: T[], semestre: string, categoria: string,
  gerar: (item: T) => Promise<Blob>, nome: (item: T) => string,
  progresso: (texto: string) => void,
) {
  const { criarZip } = await import("@/lib/zip-documentos");
  const arquivos: { nome: string; conteudo: Blob }[] = [];
  const falhas: string[] = [];
  for (const [i, item] of itens.entries()) {
    progresso("Preparando " + (i + 1) + " de " + itens.length + " PDFs…");
    const titulo = nome(item).replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-").trim().slice(0, 100);
    const arquivo = (i + 1) + "-" + (titulo || "documento") + ".pdf";
    try {
      arquivos.push({ nome: arquivo, conteudo: await gerar(item) });
    } catch {
      falhas.push(arquivo);
    }
  }
  if (!arquivos.length) throw new Error("Nenhum PDF pôde ser incluído no download.");
  if (falhas.length) {
    arquivos.push({ nome: "documentos-nao-incluidos.txt", conteudo: new Blob([falhas.join("\n")]) });
  }
  progresso("Montando o arquivo ZIP…");
  baixarBlob(await criarZip(arquivos), categoria + "-" + semestre + ".zip");
  if (falhas.length) toast.warning(falhas.length + " PDF(s) não incluído(s). Confira a lista no ZIP.");
}
