import { useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DESTINOS,
  escaparCelulaCsv,
  lerDelimitado,
  MAX_ARQUIVO,
  revisarTabela,
  sugerirMapeamento,
  type DestinoImportacao,
  type TabelaImportacao,
} from "@/lib/importacao";
import { lerArquivoImportacao, listarAbas } from "@/lib/importacao-arquivo";

export type ResultadoImportacao = { inseridos: number; ignorados: number };
type Props = {
  destinoInicial?: DestinoImportacao;
  permitePacientes?: boolean;
  onImportar: (
    destino: DestinoImportacao,
    registros: Record<string, string>[],
    origem: string,
    chave: string,
  ) => Promise<ResultadoImportacao>;
};
const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
function baixarTexto(nome: string, texto: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportadorDados({
  destinoInicial = "oficios",
  permitePacientes = false,
  onImportar,
}: Props) {
  const [destino, setDestino] = useState<DestinoImportacao>(destinoInicial);
  const [tabela, setTabela] = useState<TabelaImportacao | null>(null);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [abas, setAbas] = useState<string[]>([]);
  const [aba, setAba] = useState(1);
  const [origem, setOrigem] = useState("");
  const [texto, setTexto] = useState("");
  const [etapa, setEtapa] = useState(1);
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [ignoradas, setIgnoradas] = useState<Set<number>>(new Set());
  const operacao = useRef(0);
  const envio = useRef<{ assinatura: string; chave: string } | null>(null);
  const arquivoInput = useRef<HTMLInputElement>(null);
  const erroRef = useRef<HTMLDivElement>(null);
  const linhas = useMemo(
    () => (tabela ? revisarTabela(tabela, mapa, destino) : []),
    [tabela, mapa, destino],
  );
  const validas = linhas.filter((l) => !l.erros.length && !l.duplicada && !ignoradas.has(l.linha));
  const campos = DESTINOS[destino].campos;
  const mapeado = campos.every((c) => !c.obrigatorio || mapa[c.chave]);

  function falhar(e: unknown) {
    setErro(e instanceof Error ? e.message : "Não foi possível ler os dados.");
    requestAnimationFrame(() => erroRef.current?.focus());
  }
  function carregar(dados: TabelaImportacao, nome: string) {
    setTabela(dados);
    setMapa(sugerirMapeamento(dados.colunas, destino));
    setOrigem(nome);
    setIgnoradas(new Set());
    setResultado(null);
    setErro("");
    setEtapa(2);
  }
  async function abrirArquivo(file: File, numeroAba = 1) {
    const geracao = ++operacao.current;
    setLendo(true);
    setErro("");
    try {
      if (file.size > MAX_ARQUIVO) throw new Error("O limite é 5 MB por arquivo.");
      const nomes = file.name.toLowerCase().endsWith(".xlsx") ? await listarAbas(file) : [];
      const dados = await lerArquivoImportacao(file, numeroAba);
      if (geracao !== operacao.current) return;
      setArquivo(file);
      setAbas(nomes);
      setAba(numeroAba);
      carregar(dados, `arquivo:${file.name}`);
    } catch (e) {
      if (geracao === operacao.current) falhar(e);
    } finally {
      if (geracao === operacao.current) setLendo(false);
    }
  }
  function mudarDestino(novo: DestinoImportacao) {
    if (salvando || lendo) return;
    setDestino(novo);
    if (tabela) setMapa(sugerirMapeamento(tabela.colunas, novo));
    setResultado(null);
    setEtapa(tabela ? 2 : 1);
    setIgnoradas(new Set());
    setErro("");
  }
  async function salvar() {
    setConfirmar(false);
    setSalvando(true);
    setErro("");
    try {
      const registros = validas.map((l) => l.dados);
      const assinatura = JSON.stringify({ destino, registros, origem });
      if (envio.current?.assinatura !== assinatura)
        envio.current = { assinatura, chave: crypto.randomUUID() };
      const resposta = await onImportar(destino, registros, origem, envio.current.chave);
      setResultado(resposta);
      setEtapa(4);
      setTabela(null);
      setArquivo(null);
      setTexto("");
    } catch (e) {
      falhar(e);
    } finally {
      setSalvando(false);
    }
  }
  function exportarErros() {
    baixarTexto(
      "pendencias-importacao.csv",
      "\uFEFF" +
        [
          ["linha", "pendencias"],
          ...linhas
            .filter((l) => l.erros.length || l.duplicada)
            .map((l) => [
              String(l.linha),
              [...l.erros, ...(l.duplicada ? ["Duplicada no arquivo"] : [])].join(" "),
            ]),
        ]
          .map((l) => l.map(escaparCelulaCsv).join(";"))
          .join("\r\n"),
    );
  }

  return (
    <div className="space-y-6" aria-busy={lendo || salvando}>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas da importação">
        {["Escolher dados", "Conferir colunas", "Revisar", "Concluir"].map((titulo, i) => (
          <li
            key={titulo}
            className={`flex items-center gap-2 rounded-full px-3 py-2 ${etapa === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            aria-current={etapa === i + 1 ? "step" : undefined}
          >
            <span aria-hidden="true">{etapa > i + 1 ? <Check className="size-4" /> : i + 1}</span>
            {titulo}
          </li>
        ))}
      </ol>
      {erro && (
        <div
          ref={erroRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <strong>Confira antes de continuar</strong>
          <p className="mt-1">{erro}</p>
        </div>
      )}
      {etapa !== 4 && (
        <div className="max-w-md space-y-2">
          <Label htmlFor="importar-destino">O que você quer importar?</Label>
          <select
            id="importar-destino"
            className={selectClass}
            value={destino}
            disabled={salvando || lendo}
            onChange={(e) => mudarDestino(e.target.value as DestinoImportacao)}
          >
            {Object.entries(DESTINOS)
              .filter(([chave]) => permitePacientes || chave !== "pacientes")
              .map(([chave, d]) => (
                <option key={chave} value={chave}>
                  {d.rotulo}
                </option>
              ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Escolha o tipo de documento correspondente a cada arquivo.
          </p>
        </div>
      )}
      {etapa === 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-xl bg-primary/10 p-3 text-primary">
                <FileSpreadsheet aria-hidden="true" className="size-6" />
              </span>
              <div>
                <h2 className="font-semibold">Planilha de respostas</h2>
                <p className="text-sm text-muted-foreground">
                  Google Forms, Excel ou outro sistema
                </p>
              </div>
            </div>
            <label
              className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/30 p-6 text-center focus-within:ring-2 focus-within:ring-ring ${lendo ? "pointer-events-none opacity-60" : "hover:border-primary/50"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!lendo && e.dataTransfer.files[0]) void abrirArquivo(e.dataTransfer.files[0]);
              }}
            >
              {lendo ? (
                <Loader2
                  aria-hidden="true"
                  className="size-7 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Upload aria-hidden="true" className="size-7 text-primary" />
              )}
              <span className="font-medium">
                {lendo ? "Lendo arquivo…" : "Escolha ou arraste seu arquivo"}
              </span>
              <span className="text-xs text-muted-foreground">
                CSV, TSV, XLSX, TXT tabulado ou JSON · até 5 MB e 500 respostas
              </span>
              <input
                ref={arquivoInput}
                type="file"
                className="sr-only"
                accept=".csv,.tsv,.xlsx,.txt,.json"
                disabled={lendo}
                onChange={(e) => {
                  if (e.target.files?.[0]) void abrirArquivo(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              variant="ghost"
              className="mt-3 min-h-11 gap-2"
              onClick={() =>
                baixarTexto(
                  `modelo-${destino}.csv`,
                  "\uFEFF" + campos.map((c) => escaparCelulaCsv(c.rotulo)).join(";"),
                )
              }
            >
              <Download aria-hidden="true" className="size-4" />
              Baixar modelo de colunas
            </Button>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">Colar da planilha</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Copie os títulos e as linhas das respostas no Google Sheets e cole abaixo.
            </p>
            <Label htmlFor="dados-colados">Títulos na primeira linha</Label>
            <Textarea
              id="dados-colados"
              className="mt-2 min-h-40 font-mono text-xs"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={"Nome completo\tWhatsApp\tE-mail\n"}
            />
            <Button
              className="mt-4 min-h-11"
              disabled={!texto.trim() || lendo}
              onClick={() => {
                try {
                  if (new Blob([texto]).size > MAX_ARQUIVO) throw new Error("O limite é 5 MB.");
                  carregar(lerDelimitado(texto), "planilha-colada");
                } catch (e) {
                  falhar(e);
                }
              }}
            >
              Conferir dados
              <ChevronRight aria-hidden="true" className="ml-2 size-4" />
            </Button>
          </section>
        </div>
      )}
      {etapa === 2 && tabela && (
        <section className="rounded-2xl border bg-card p-5 md:p-6">
          <h2 className="text-lg font-semibold">Conecte as colunas aos campos</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Encontramos {tabela.linhas.length}{" "}
            {tabela.linhas.length === 1 ? "resposta" : "respostas"}. Confira as sugestões; campos
            sem coluna serão ignorados.
          </p>
          {abas.length > 1 && (
            <div className="mb-5 max-w-sm space-y-2">
              <Label htmlFor="aba-excel">Aba do Excel</Label>
              <select
                id="aba-excel"
                className={selectClass}
                value={aba}
                disabled={lendo}
                onChange={(e) => {
                  if (arquivo) void abrirArquivo(arquivo, Number(e.target.value));
                }}
              >
                {abas.map((n, i) => (
                  <option value={i + 1} key={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campos.map((c) => (
              <div key={c.chave} className="space-y-2">
                <Label htmlFor={`coluna-${c.chave}`}>
                  {c.rotulo}
                  {c.obrigatorio ? " *" : ""}
                </Label>
                <select
                  id={`coluna-${c.chave}`}
                  className={selectClass}
                  value={mapa[c.chave] ?? ""}
                  disabled={lendo}
                  onChange={(e) => setMapa({ ...mapa, [c.chave]: e.target.value })}
                >
                  <option value="">
                    {c.obrigatorio ? "Escolha uma coluna" : "Não importar este campo"}
                  </option>
                  {tabela.colunas.map((coluna) => (
                    <option key={coluna} value={coluna}>
                      {coluna}
                    </option>
                  ))}
                </select>
                {mapa[c.chave] && (
                  <p className="truncate text-xs text-muted-foreground">
                    Exemplo:{" "}
                    {tabela.linhas[0]?.[tabela.colunas.indexOf(mapa[c.chave] ?? "")] || "vazio"}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={lendo}
              onClick={() => {
                setEtapa(1);
                setTabela(null);
                setErro("");
              }}
            >
              Trocar arquivo
            </Button>
            <Button
              className="min-h-11"
              disabled={!mapeado || lendo}
              onClick={() => {
                setEtapa(3);
                setErro("");
              }}
            >
              Revisar {tabela.linhas.length} {tabela.linhas.length === 1 ? "resposta" : "respostas"}
              <ChevronRight aria-hidden="true" className="ml-2 size-4" />
            </Button>
          </div>
        </section>
      )}
      {etapa === 3 && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [validas.length, "registros prontos"],
              [linhas.filter((l) => l.erros.length).length, "com pendências"],
              [linhas.filter((l) => l.duplicada).length, "duplicados no arquivo"],
            ].map(([n, t]) => (
              <div key={t} className="rounded-xl border bg-card p-5">
                <p className="text-2xl font-semibold">{n}</p>
                <p className="text-sm text-muted-foreground">{t}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Revise antes de salvar</h2>
              <p className="text-sm text-muted-foreground">
                Desmarque respostas que não devem entrar. Registros existentes serão ignorados, sem
                sobrescrever dados.
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              disabled={!linhas.some((l) => l.erros.length || l.duplicada)}
              onClick={exportarErros}
            >
              <Download aria-hidden="true" className="size-4" />
              Baixar pendências
            </Button>
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Respostas para importar em {DESTINOS[destino].rotulo}
              </caption>
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-3">Importar</th>
                  <th className="p-3">Linha</th>
                  {campos
                    .filter((c) => mapa[c.chave])
                    .map((c) => (
                      <th key={c.chave} className="min-w-36 p-3">
                        {c.rotulo}
                      </th>
                    ))}
                  <th className="min-w-64 p-3">Conferência</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className="border-t align-top hover:bg-muted/40">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        aria-label={`Importar linha ${l.linha}`}
                        disabled={!!l.erros.length || l.duplicada || salvando}
                        checked={!l.erros.length && !l.duplicada && !ignoradas.has(l.linha)}
                        onChange={(e) =>
                          setIgnoradas((anterior) => {
                            const n = new Set(anterior);
                            if (e.target.checked) n.delete(l.linha);
                            else n.add(l.linha);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{l.linha}</td>
                    {campos
                      .filter((c) => mapa[c.chave])
                      .map((c) => (
                        <td key={c.chave} className="max-w-64 break-words p-3">
                          {l.dados[c.chave] || "—"}
                        </td>
                      ))}
                    <td className="p-3">
                      {l.duplicada ? (
                        "Duplicada: será ignorada."
                      ) : l.erros.length ? (
                        <ul className="space-y-1 text-destructive">
                          {l.erros.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="flex items-center gap-1 text-primary">
                          <CheckCircle2 aria-hidden="true" className="size-4" />
                          Pronta
                        </span>
                      )}
                      {l.avisos.map((a) => (
                        <p key={a} className="mt-1 text-xs text-muted-foreground">
                          {a}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={salvando}
              onClick={() => setEtapa(2)}
            >
              Ajustar colunas
            </Button>
            <Button
              className="min-h-11 gap-2"
              disabled={!validas.length || salvando}
              onClick={() => setConfirmar(true)}
            >
              {salvando ? (
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
              {salvando
                ? "Salvando…"
                : `Importar ${validas.length} ${validas.length === 1 ? "registro" : "registros"}`}
            </Button>
          </div>
        </section>
      )}
      {etapa === 4 && resultado && (
        <section role="status" className="rounded-2xl border bg-card px-6 py-12 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto mb-4 size-12 text-primary" />
          <h2 className="text-2xl font-semibold">Importação concluída</h2>
          <p className="mt-2 text-muted-foreground">
            {resultado.inseridos}{" "}
            {resultado.inseridos === 1 ? "registro salvo" : "registros salvos"} em{" "}
            {DESTINOS[destino].rotulo.toLowerCase()}. {resultado.ignorados} já existentes foram
            ignorados.
          </p>
          <Button
            className="mt-6 min-h-11"
            onClick={() => {
              setResultado(null);
              setEtapa(1);
              setErro("");
            }}
          >
            Importar outro arquivo
          </Button>
        </section>
      )}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />O arquivo é lido neste
        navegador. Apenas os campos selecionados são enviados ao banco ao confirmar. Não inclua
        diagnóstico ou prontuário nos campos cadastrais.
      </p>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Salvar {validas.length} {validas.length === 1 ? "registro" : "registros"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Destino: {DESTINOS[destino].rotulo}. As linhas com erro, duplicadas ou desmarcadas não
              serão importadas. Nenhum cadastro existente será alterado. Documentos importados não
              são enviados por e-mail automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar à revisão</AlertDialogCancel>
            <AlertDialogAction onClick={() => void salvar()}>
              Confirmar importação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
