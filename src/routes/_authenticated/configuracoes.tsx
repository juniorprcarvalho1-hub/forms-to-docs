import { useServerFn } from "@tanstack/react-start";
import { verificarAcesso } from "@/lib/acesso.functions";
import { IntegracoesLegadas } from "@/components/IntegracoesLegadas";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FileText, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/RichEditor";
import { EscalaA4 } from "@/components/PaginaA4";
import { prepararImagensInstitucionais } from "@/lib/storage";
import { preencherModeloSeguro } from "@/lib/modelo-seguro";
import { CadastrosAuxiliares } from "@/components/CadastrosAuxiliares";
import { OrientadoresCurso } from "@/components/OrientadoresCurso";
import {
  ORDEM_MODELOS_RESPOSTA,
  ROTULOS_DECLARACAO_RESPOSTA,
  TAGS_DECLARACAO_RESPOSTA,
  type ModeloDeclaracaoResposta,
} from "@/lib/declaracoes-resposta";

import { supabase } from "@/integrations/supabase/client";
import {
  formatarNumero,
  TAGS_MODELO,
   type Configuracoes,
 } from "@/lib/oficios";
import {
  mapaDoCurso,
  ORDEM_MODELOS_DECLARACAO,
  ROTULOS_DECLARACAO,
  TAGS_DECLARACAO,
 } from "@/lib/declaracoes";
import { uploadArquivo, urlAssinada } from "@/lib/storage";
import {
  buscarConfiguracoesAtuais,
  buscarModelosDeclaracaoAtuais,
  buscarModelosOficioAtuais,
} from "@/lib/documentos-data";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Sistema de Ofícios" },
      { name: "description", content: "Modelo do ofício, logo, assinatura e numeração." },
      { property: "og:title", content: "Configurações | Sistema de Ofícios" },
      { property: "og:description", content: "Modelo do ofício, logo, assinatura e numeração." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const acessoFn = useServerFn(verificarAcesso);
  const acesso = useQuery({ queryKey: ["acesso"], queryFn: () => acessoFn() });
  if (acesso.isPending) return <p role="status">Verificando permissões…</p>;
  if (!acesso.data?.dono) return <p role="alert">Configurações disponíveis somente para a conta master.</p>;
  return <ConfiguracoesEditor />;
}

function ConfiguracoesEditor() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Configuracoes | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"modelos" | "ajustes">("modelos");
  const [documento, setDocumento] = useState<"oficios" | "preceptoria" | "respostas">("oficios");
  const [parte, setParte] = useState<"corpo" | "cabecalho" | "rodape">("corpo");
  const [previa, setPrevia] = useState(false);
  const [modeloAtivo, setModeloAtivo] = useState("padrao");
  const [corposModelo, setCorposModelo] = useState<Record<string, string>>({});
  const [declaracaoAtiva, setDeclaracaoAtiva] = useState("enfermagem");
  const [corposDeclaracao, setCorposDeclaracao] = useState<Record<string, string>>({});
  const [respostaAtiva, setRespostaAtiva] = useState("enfermagem");
  const [corposResposta, setCorposResposta] = useState<Record<string, string>>({});

  const modelosResposta = useQuery({
    queryKey: ["modelos_declaracao_resposta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modelos_declaracao_resposta").select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as ModeloDeclaracaoResposta[]).sort(
        (a, b) => ORDEM_MODELOS_RESPOSTA.indexOf(a.chave) - ORDEM_MODELOS_RESPOSTA.indexOf(b.chave),
      );
    },
  });
  const respostaSelecionada = (modelosResposta.data ?? []).find((m) => m.chave === respostaAtiva);

  const modelosDeclaracao = useQuery({
    queryKey: ["modelos_declaracao"],
    queryFn: async () => {
      const data = await buscarModelosDeclaracaoAtuais();
      return data.sort(
        (a, b) =>
          ORDEM_MODELOS_DECLARACAO.indexOf(a.chave) - ORDEM_MODELOS_DECLARACAO.indexOf(b.chave),
      );
    },
  });
  const declaracaoSelecionada = (modelosDeclaracao.data ?? []).find(
    (m) => m.chave === declaracaoAtiva,
  );

  const modelos = useQuery({
    queryKey: ["modelos_oficio"],
    queryFn: async () => {
      const data = await buscarModelosOficioAtuais();
      const ordem = ["padrao", "nutricao", "psicologia"];
      return data.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
    },
  });
  const modeloSelecionado = (modelos.data ?? []).find((m) => m.chave === modeloAtivo);

  const { data } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: buscarConfiguracoesAtuais,
  });

  useEffect(() => {
    if (data && !form) {
      setForm(data);
    }
  }, [data, form]);

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
      const rascunhos = [...Object.values(corposModelo), ...Object.values(corposDeclaracao), ...Object.values(corposResposta)];
      if (rascunhos.some((html) => !html.trim())) throw new Error("Preencha o corpo dos modelos antes de salvar.");
      for (const modelo of modelos.data ?? []) {
        const html = corposModelo[modelo.chave];
        if (html === undefined || html === modelo.modelo_html) continue;
        const { data: confirmado, error } = await supabase
          .from("modelos_oficio")
          .update({ modelo_html: html })
          .eq("id", modelo.id)
          .select("modelo_html")
          .single();
        if (error) throw error;
        if (confirmado.modelo_html !== html)
          throw new Error(`O modelo ${modelo.nome} não foi confirmado pelo banco.`);
      }
      for (const modelo of modelosDeclaracao.data ?? []) {
        const html = corposDeclaracao[modelo.chave];
        if (html === undefined || html === modelo.modelo_html) continue;
        const { data: confirmado, error } = await supabase
          .from("modelos_declaracao")
          .update({ modelo_html: html })
          .eq("id", modelo.id)
          .select("modelo_html")
          .single();
        if (error || confirmado?.modelo_html !== html) {
          throw error ?? new Error("O modelo de Preceptoria não foi confirmado.");
        }
      }

      for (const modelo of modelosResposta.data ?? []) {
        const html = corposResposta[modelo.chave];
        if (html === undefined || html === modelo.modelo_html) continue;
        const { data: confirmado, error } = await supabase
          .from("modelos_declaracao_resposta")
          .update({ modelo_html: html })
          .eq("id", modelo.id)
          .select("modelo_html")
          .single();
        if (error || confirmado?.modelo_html !== html) {
          throw error ?? new Error("O modelo de resposta não foi confirmado.");
        }
      }

      if (JSON.stringify(form) !== JSON.stringify(data)) {
      const { data: confirmado, error } = await supabase
        .from("configuracoes")
        .update({
          modelo: form.modelo,
          modelo_html: form.modelo_html,
          cabecalho_html: form.cabecalho_html,
          rodape_html: form.rodape_html,
          formato_numeracao: form.formato_numeracao,
          digitos: form.digitos,
          logo_url: form.logo_url,
          assinatura_url: form.assinatura_url,
          cidade: form.cidade,
          form_url: form.form_url,
          form_declaracao_url: form.form_declaracao_url ?? "",
          form_resposta_url: form.form_resposta_url ?? "",
          padrao_destinatario: form.padrao_destinatario,
          padrao_area_estagio: form.padrao_area_estagio,
          padrao_professor: form.padrao_professor,
          padrao_registro_professor: form.padrao_registro_professor,
          padrao_carga_horaria: form.padrao_carga_horaria,
          padrao_periodo: form.padrao_periodo,
          padrao_seguradora: form.padrao_seguradora,
          padrao_apolice: form.padrao_apolice,
          padrao_coordenador: form.padrao_coordenador,
          padrao_cargo_coordenador: form.padrao_cargo_coordenador,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true)
        .select("id")
        .single();
      if (error || !confirmado) throw error ?? new Error("As configurações não foram confirmadas.");
      }

      const [configAtual, oficiosAtuais, declaracoesAtuais] = await Promise.all([
        buscarConfiguracoesAtuais(),
        buscarModelosOficioAtuais(),
        buscarModelosDeclaracaoAtuais(),
      ]);
      queryClient.setQueryData(["configuracoes"], configAtual);
      queryClient.setQueryData(["modelos_oficio"], oficiosAtuais);
      queryClient.setQueryData(["modelos_declaracao"], declaracoesAtuais);
      setForm(configAtual);
      setCorposModelo({});
      setCorposDeclaracao({});
      setCorposResposta({});
      await queryClient.invalidateQueries({ queryKey: ["modelos_declaracao_resposta"] });
      toast.success("Configurações salvas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar as configurações.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarImagem(campo: "logo_url" | "assinatura_url", file: File) {
    try {
      const path = `branding/${campo}-${Date.now()}-${file.name}`;
      await uploadArquivo(path, file);
      const url = await urlAssinada(path, 60 * 60 * 24 * 365);
      setForm((f) => (f ? { ...f, [campo]: url } : f));
      toast.success("Imagem carregada. Clique em Salvar para confirmar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    }
  }

  if (!form) return <p className="text-sm text-muted-foreground">Carregando…</p>;


  const grupos = [
    { id: "oficios", label: "Ofícios" },
    { id: "preceptoria", label: "Preceptoria" },
    { id: "respostas", label: "Declarações de resposta" },
  ] as const;
  const lista = documento === "oficios" ? modelos.data :
    documento === "preceptoria" ? modelosDeclaracao.data : modelosResposta.data;
  const ativo = documento === "oficios" ? modeloAtivo :
    documento === "preceptoria" ? declaracaoAtiva : respostaAtiva;
  const atual = documento === "oficios" ? modeloSelecionado :
    documento === "preceptoria" ? declaracaoSelecionada : respostaSelecionada;
  const corpo = documento === "oficios" ? corposModelo[ativo] :
    documento === "preceptoria" ? corposDeclaracao[ativo] : corposResposta[ativo];
  const secao = documento === "oficios" && parte !== "corpo"
    ? (parte === "cabecalho" ? "cabecalho_html" : "rodape_html")
    : null;
  const valor = secao ? form[secao] : (corpo ?? atual?.modelo_html ?? "");
  const campos = documento === "oficios" ? TAGS_MODELO :
    documento === "preceptoria" ? TAGS_DECLARACAO : TAGS_DECLARACAO_RESPOSTA;
  const rotulos = documento === "preceptoria" ? ROTULOS_DECLARACAO :
    documento === "respostas" ? ROTULOS_DECLARACAO_RESPOSTA : undefined;
  const alteracoes = JSON.stringify(form) !== JSON.stringify(data) ||
    [corposModelo, corposDeclaracao, corposResposta].some((grupo) => Object.keys(grupo).length > 0);

  function alterarHtml(html: string) {
    if (html === valor) return;
    if (secao) setForm((f) => f ? { ...f, [secao]: html } : f);
    else if (documento === "oficios") setCorposModelo((c) => ({ ...c, [ativo]: html }));
    else if (documento === "preceptoria") setCorposDeclaracao((c) => ({ ...c, [ativo]: html }));
    else setCorposResposta((c) => ({ ...c, [ativo]: html }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (alteracoes && !salvando) void salvar();
        }
      }}>
      <header className="sticky top-0 z-10 flex flex-wrap items-end justify-between gap-4 border-b bg-background/95 py-4 backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Edite os modelos e gerencie os dados usados nos documentos.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" role="status">
            {alteracoes ? "Alterações não salvas" : "Tudo salvo"}
          </span>
          <Button onClick={salvar} disabled={salvando || !alteracoes}>
            {salvando ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </header>

      <nav className="flex gap-2" aria-label="Configurações">
        <Button type="button" variant={aba === "modelos" ? "default" : "outline"} aria-pressed={aba === "modelos"} onClick={() => setAba("modelos")}>
          <FileText className="size-4" /> Modelos
        </Button>
        <Button type="button" variant={aba === "ajustes" ? "default" : "outline"} aria-pressed={aba === "ajustes"} onClick={() => setAba("ajustes")}>
          <Settings2 className="size-4" /> Ajustes
        </Button>
      </nav>

      {aba === "modelos" ? (
        <section className="surface-card space-y-4 p-3 sm:p-5" aria-label="Editor de modelos">
          <div className="flex flex-wrap gap-2" aria-label="Tipo de documento">
            {grupos.map((g) => (
              <Button key={g.id} type="button" size="sm"
                variant={documento === g.id ? "default" : "outline"} aria-pressed={documento === g.id}
                onClick={() => { setDocumento(g.id); setPrevia(false); }}>
                {g.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44 flex-1 space-y-1.5">
              <Label htmlFor="modelo-documento">Modelo</Label>
              <select id="modelo-documento" value={ativo}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                onChange={(e) => {
                  const v = e.target.value;
                  if (documento === "oficios") setModeloAtivo(v);
                  else if (documento === "preceptoria") setDeclaracaoAtiva(v);
                  else setRespostaAtiva(v);
                }}>
                {(lista ?? []).map((m) => <option key={m.chave} value={m.chave}>{m.nome}</option>)}
              </select>
            </div>
            {documento === "oficios" && (
              <div className="space-y-1.5">
                <Label htmlFor="parte-oficio">Parte do ofício</Label>
                <select id="parte-oficio" value={parte}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  onChange={(e) => setParte(e.target.value as typeof parte)}>
                  <option value="corpo">Corpo</option>
                  <option value="cabecalho">Cabeçalho comum</option>
                  <option value="rodape">Rodapé comum</option>
                </select>
              </div>
            )}
            <Button variant="outline" type="button" aria-pressed={previa} onClick={() => setPrevia((v) => !v)}>
              {previa ? "Voltar à edição" : "Prévia A4"}
            </Button>
          </div>
          {!atual && !secao ? (
            <p className="py-8 text-sm text-muted-foreground">Nenhum modelo disponível para edição.</p>
          ) : previa ? (
            <PreviaDocumento html={documento === "oficios"
              ? [form.cabecalho_html, corpo ?? atual?.modelo_html, form.rodape_html].filter(Boolean).join("")
              : valor} rotulos={rotulos} curso={ativo} />
          ) : (
            <RichEditor key={documento + "-" + ativo + "-" + (secao ?? "corpo")} value={valor}
              minHeight={1123} campos={campos} rotulos={rotulos} disabled={salvando}
              placeholder="Modelo do documento" onChange={alterarHtml} />
          )}
        </section>
      ) : (
        <section className="space-y-3" aria-label="Ajustes do sistema">
      <GrupoAjustes titulo="Numeração dos ofícios"><div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="formato">Formato</Label>
          <Input
            id="formato"
            value={form.formato_numeracao}
            onChange={(e) => setForm({ ...form, formato_numeracao: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Use seq e ano para montar a numeração.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="digitos">Dígitos</Label>
          <Input
            id="digitos"
            type="number"
            min={1}
            max={6}
            value={form.digitos}
            onChange={(e) => setForm({ ...form, digitos: Number(e.target.value) })}
          />
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Prévia:{" "}
          <span className="font-medium text-foreground">
            {formatarNumero(form.formato_numeracao, 1, new Date().getFullYear(), form.digitos)}
          </span>
        </p>
      </div></GrupoAjustes>

      <GrupoAjustes titulo="Logotipo e assinatura padrão"><div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Logotipo</Label>
          {form.logo_url && (
            <img src={form.logo_url} alt="Logotipo atual" className="h-16 object-contain" />
          )}
          <Input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => e.target.files?.[0] && enviarImagem("logo_url", e.target.files[0])}
          />
        </div>
        <div className="space-y-2">
          <Label>Assinatura</Label>
          {form.assinatura_url && (
            <img src={form.assinatura_url} alt="Assinatura atual" className="h-16 object-contain" />
          )}
          <Input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) =>
              e.target.files?.[0] && enviarImagem("assinatura_url", e.target.files[0])
            }
          />
        </div>
      </div></GrupoAjustes>

      <GrupoAjustes titulo="Cursos, módulos e orientadores">
        <CadastrosAuxiliares />
        <OrientadoresCurso />
      </GrupoAjustes>

      <GrupoAjustes titulo="Dados padrão dos ofícios"><div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          label="Cidade"
          valor={form.cidade}
          onChange={(v) => setForm({ ...form, cidade: v })}
        />
        <CampoTexto
          label="Destinatário"
          valor={form.padrao_destinatario}
          onChange={(v) => setForm({ ...form, padrao_destinatario: v })}
        />
        <CampoTexto
          label="Área do estágio"
          valor={form.padrao_area_estagio}
          onChange={(v) => setForm({ ...form, padrao_area_estagio: v })}
        />
        <CampoTexto
          label="Professor(a) orientador(a)"
          valor={form.padrao_professor}
          onChange={(v) => setForm({ ...form, padrao_professor: v })}
        />
        <CampoTexto
          label="Registro do professor (COREN, CRP…)"
          valor={form.padrao_registro_professor}
          onChange={(v) => setForm({ ...form, padrao_registro_professor: v })}
        />
        <CampoTexto
          label="Carga horária"
          valor={form.padrao_carga_horaria}
          onChange={(v) => setForm({ ...form, padrao_carga_horaria: v })}
        />
        <CampoTexto
          label="Período"
          valor={form.padrao_periodo}
          onChange={(v) => setForm({ ...form, padrao_periodo: v })}
        />
        <CampoTexto
          label="Seguradora"
          valor={form.padrao_seguradora}
          onChange={(v) => setForm({ ...form, padrao_seguradora: v })}
        />
        <CampoTexto
          label="Apólice"
          valor={form.padrao_apolice}
          onChange={(v) => setForm({ ...form, padrao_apolice: v })}
        />
        <CampoTexto
          label="Coordenador(a)"
          valor={form.padrao_coordenador}
          onChange={(v) => setForm({ ...form, padrao_coordenador: v })}
        />
        <CampoTexto
          label="Cargo do coordenador"
          valor={form.padrao_cargo_coordenador}
          onChange={(v) => setForm({ ...form, padrao_cargo_coordenador: v })}
        />
      </div></GrupoAjustes>

          <GrupoAjustes titulo="Google Forms e integração">
            <div className="grid gap-4">
              <CampoTexto label="Formulário de ofícios" valor={form.form_url}
                onChange={(v) => setForm({ ...form, form_url: v })} />
              <CampoTexto label="Formulário de preceptoria" valor={form.form_declaracao_url ?? ""}
                onChange={(v) => setForm({ ...form, form_declaracao_url: v })} />
              <CampoTexto label="Formulário de avaliação" valor={form.form_resposta_url ?? ""}
                onChange={(v) => setForm({ ...form, form_resposta_url: v })} />
              <IntegracoesLegadas />
            </div>
          </GrupoAjustes>
        </section>
      )}
    </div>
  );
}

function GrupoAjustes({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="surface-card group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold focus-visible:outline-offset-2">
        {titulo}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t p-4">{children}</div>
    </details>
  );
}

function PreviaDocumento({ html, rotulos, curso }: { html: string; rotulos?: Record<string, string> | undefined; curso: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const info = mapaDoCurso(curso === "padrao" ? "enfermagem" : curso);
  const exemplo: Record<string, string> = {
    nome: "Nome de exemplo", coren: "000.000", conselho: info?.conselho ?? "Conselho",
    curso: info?.curso ?? "Curso do formulário", cidade: "Belém do São Francisco",
    departamento: info?.departamento ?? "DEPARTAMENTO DO CURSO", alunos: "Estudante Exemplo",
    nucleo: info?.nucleo ?? "", portaria: info?.portaria ?? "",
    data_inicio: "10/03/2026", data_fim: "16/06/2026", carga_horaria: "356",
    data_emissao: "30 de Junho de 2026", numero: "001/2026",
  };
  for (const match of html.matchAll(/\{\{([^}]+)\}\}/g)) {
    const chave = match[1]!;
    exemplo[chave] ??= rotulos?.[chave] ?? chave.replaceAll("_", " ");
  }
  useEffect(() => {
    if (ref.current) void prepararImagensInstitucionais(ref.current).catch(() => {});
  }, [html, curso]);
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="mb-3 text-xs text-muted-foreground">Prévia com dados de exemplo</p>
      <EscalaA4>
        <div ref={ref} className="pagina-a4 prose-oficio shadow-sm"
          dangerouslySetInnerHTML={{ __html: preencherModeloSeguro(html, exemplo) }} />
      </EscalaA4>
    </div>
  );
}

function CampoTexto({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

