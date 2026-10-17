import { useServerFn } from "@tanstack/react-start";
import { verificarAcesso } from "@/lib/acesso.functions";
import { IntegracoesLegadas } from "@/components/IntegracoesLegadas";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/RichEditor";
import { CadastrosAuxiliares } from "@/components/CadastrosAuxiliares";
import { OrientadoresCurso } from "@/components/OrientadoresCurso";
import {
  ORDEM_MODELOS_RESPOSTA,
  ROTULOS_DECLARACAO_RESPOSTA,
  type ModeloDeclaracaoResposta,
} from "@/lib/declaracoes-resposta";

import { supabase } from "@/integrations/supabase/client";
import {
  formatarNumero,
  TAGS_MODELO,
  textoParaHtml,
  type Configuracoes,
  type ModeloOficio,
} from "@/lib/oficios";
import {
  ORDEM_MODELOS_DECLARACAO,
  ROTULOS_DECLARACAO,
  type ModeloDeclaracao,
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
  if (!acesso.data?.admin) return <p role="alert">Configurações restritas a administradores.</p>;
  return (
    <>
      <IntegracoesLegadas />
      <ConfiguracoesEditor />
    </>
  );
}

function ConfiguracoesEditor() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Configuracoes | null>(null);
  const [salvando, setSalvando] = useState(false);
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
      setForm({
        ...data,
        modelo_html: (data.modelo_html ?? "").trim() || textoParaHtml(data.modelo ?? ""),
      });
    }
  }, [data, form]);

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    try {
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
      const modeloDeclaracaoEditado = corposDeclaracao[declaracaoAtiva];
      if (modeloDeclaracaoEditado !== undefined) {
        const { data: confirmados, error } = await supabase
          .from("modelos_declaracao")
          .update({ modelo_html: modeloDeclaracaoEditado })
          .in("chave", ORDEM_MODELOS_DECLARACAO)
          .select("chave, modelo_html");
        if (error) throw error;
        if (
          (confirmados ?? []).length !== ORDEM_MODELOS_DECLARACAO.length ||
          (confirmados ?? []).some((modelo) => modelo.modelo_html !== modeloDeclaracaoEditado)
        ) {
          throw new Error("O modelo da declaração não foi confirmado para todos os cursos.");
        }
      }

      const modeloRespostaEditado = corposResposta[respostaAtiva];
      if (modeloRespostaEditado !== undefined) {
        const { error } = await supabase
          .from("modelos_declaracao_resposta")
          .update({ modelo_html: modeloRespostaEditado })
          .eq("chave", respostaAtiva);
        if (error) throw error;
      }

      const { error } = await supabase
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
        .eq("id", true);
      if (error) throw error;

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

  const endpoint = `${window.location.origin}/api/public/webhooks/oficios`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Modelo do documento, identidade visual, numeração e integração.
        </p>
      </div>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Modelo do ofício (edição livre)</h2>
        <p className="text-xs break-words text-muted-foreground">
          Formate como no Word: fontes, tamanhos, cores, alinhamento, listas e imagens PNG em
          qualquer ponto. Os campos automáticos são preenchidos pelos dados do formulário.
        </p>

        <div className="space-y-2">
          <Label>Cabeçalho (repetido no topo do documento)</Label>
          <RichEditor
            value={form.cabecalho_html}
            minHeight={140}
            placeholder="Insira aqui o logotipo e os dados da instituição…"
            onChange={(html) => setForm((f) => (f ? { ...f, cabecalho_html: html } : f))}
          />
        </div>

        <div className="space-y-2">
          <Label>Corpo do ofício</Label>
          <p className="text-xs text-muted-foreground">
            Três modelos com a mesma estrutura. O sistema escolhe sozinho conforme o curso e o
            módulo respondidos no formulário.
          </p>
          <div className="flex flex-wrap gap-2">
            {(modelos.data ?? []).map((m) => (
              <Button
                key={m.chave}
                type="button"
                size="sm"
                variant={m.chave === modeloAtivo ? "default" : "outline"}
                onClick={() => setModeloAtivo(m.chave)}
              >
                {m.nome}
              </Button>
            ))}
          </div>
          {modeloSelecionado && (
            <>
              <p className="text-xs text-muted-foreground">
                Cursos atendidos: {modeloSelecionado.cursos}
              </p>
              <RichEditor
                key={modeloSelecionado.id}
                value={corposModelo[modeloSelecionado.chave] ?? modeloSelecionado.modelo_html}
                minHeight={360}
                placeholder="Texto do ofício…"
                onChange={(html) =>
                  setCorposModelo((c) => ({ ...c, [modeloSelecionado.chave]: html }))
                }
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Rodapé</Label>
          <RichEditor
            value={form.rodape_html}
            minHeight={140}
            placeholder="Assinatura, endereço, contatos…"
            onChange={(html) => setForm((f) => (f ? { ...f, rodape_html: html } : f))}
          />
        </div>
      </section>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Modelos de declaração de preceptoria</h2>
        <p className="text-xs text-muted-foreground">
          O layout salvo é aplicado a todos os cursos. Curso, conselho, núcleo e portaria são
          preenchidos automaticamente conforme a resposta do formulário.
        </p>
        <div className="flex flex-wrap gap-2">
          {(modelosDeclaracao.data ?? []).map((m) => (
            <Button
              key={m.chave}
              type="button"
              size="sm"
              variant={m.chave === declaracaoAtiva ? "default" : "outline"}
              onClick={() => setDeclaracaoAtiva(m.chave)}
            >
              {m.nome}
            </Button>
          ))}
        </div>
        {declaracaoSelecionada && (
          <>
            <p className="text-xs text-muted-foreground">
              Curso atendido: {declaracaoSelecionada.cursos}
            </p>
            <RichEditor
              key={declaracaoSelecionada.id}
              rotulos={ROTULOS_DECLARACAO}
              value={
                corposDeclaracao[declaracaoSelecionada.chave] ?? declaracaoSelecionada.modelo_html
              }
              minHeight={360}
              placeholder="Texto da declaração…"
              onChange={(html) =>
                setCorposDeclaracao((c) => ({ ...c, [declaracaoSelecionada.chave]: html }))
              }
            />
          </>
        )}
      </section>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Modelos da declaração de resposta</h2>
        <p className="text-xs text-muted-foreground">
          Declaração de que o supervisor de campo preencheu a avaliação do estagiário. Um modelo por
          curso; o sistema escolhe conforme o curso informado no formulário.
        </p>
        <div className="flex flex-wrap gap-2">
          {(modelosResposta.data ?? []).map((m) => (
            <Button
              key={m.chave}
              type="button"
              size="sm"
              variant={m.chave === respostaAtiva ? "default" : "outline"}
              onClick={() => setRespostaAtiva(m.chave)}
            >
              {m.nome}
            </Button>
          ))}
        </div>
        {respostaSelecionada && (
          <>
            <p className="text-xs text-muted-foreground">
              Curso atendido: {respostaSelecionada.cursos}
            </p>
            <RichEditor
              key={respostaSelecionada.id}
              rotulos={ROTULOS_DECLARACAO_RESPOSTA}
              value={corposResposta[respostaSelecionada.chave] ?? respostaSelecionada.modelo_html}
              minHeight={360}
              placeholder="Texto da declaração…"
              onChange={(html) =>
                setCorposResposta((c) => ({ ...c, [respostaSelecionada.chave]: html }))
              }
            />
          </>
        )}
      </section>

      <OrientadoresCurso />

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Numeração</h2>
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
      </section>

      <section className="surface-card grid gap-6 p-6 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Identidade visual</h2>
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
      </section>

      <CadastrosAuxiliares />

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Dados padrão do ofício de estágio</h2>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Usados quando o Google Forms não envia o campo (o formulário atual envia Aluno, CPF, Curso
          e Matrícula).
        </p>
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
      </section>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Integração com o Google Forms</h2>
        <CampoTexto
          label="Link do formulário"
          valor={form.form_url}
          onChange={(v) => setForm({ ...form, form_url: v })}
        />
        {form.form_url && (
          <iframe
            src={form.form_url.replace("/viewform", "/viewform?embedded=true")}
            title="Formulário de solicitação de estágio"
            className="h-[520px] w-full rounded-lg border"
          />
        )}
      </section>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Formulário da declaração de preceptoria</h2>
        <p className="text-xs text-muted-foreground">
          Perguntas do formulário: Nome completo do preceptor, Curso, Registro profissional, Campo
          de estágio, Data de início, Data de fim, Nome(s) do(s) aluno(s) e E-mail do preceptor. A
          carga horária e o nome oficial do campo de estágio são preenchidos automaticamente pelo
          cadastro do sistema.
        </p>
        <CampoTexto
          label="Link do formulário"
          valor={form.form_declaracao_url ?? ""}
          onChange={(v) => setForm({ ...form, form_declaracao_url: v })}
        />
        {form.form_declaracao_url && (
          <iframe
            src={form.form_declaracao_url.replace("/viewform", "/viewform?embedded=true")}
            title="Formulário de declaração de preceptoria"
            className="h-[520px] w-full rounded-lg border"
          />
        )}
      </section>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Formulário da declaração de resposta</h2>
        <p className="text-xs text-muted-foreground">
          Perguntas do formulário: Nome completo do supervisor, Curso, Tipo de avaliação (parcial ou
          final), Nome do estagiário, Período e E-mail do supervisor. O documento é gerado e enviado
          automaticamente ao professor orientador do curso.
        </p>
        <CampoTexto
          label="Link do formulário"
          valor={form.form_resposta_url ?? ""}
          onChange={(v) => setForm({ ...form, form_resposta_url: v })}
        />
        {form.form_resposta_url && (
          <iframe
            src={form.form_resposta_url.replace("/viewform", "/viewform?embedded=true")}
            title="Formulário da declaração de resposta"
            className="h-[520px] w-full rounded-lg border"
          />
        )}
      </section>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
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

function CampoCopiavel({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={valor} className="font-mono text-xs" />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(valor);
            toast.success("Copiado.");
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}
