import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatarNumero, TAGS_MODELO, type Configuracoes } from "@/lib/oficios";
import { uploadArquivo, urlAssinada } from "@/lib/storage";

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
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Configuracoes | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [origem, setOrigem] = useState("");

  // A URL do editor (id-preview…) exige login e responde 302 a chamadas externas.
  // Para integrações (Google Forms/Apps Script) usamos a URL estável do projeto.
  useEffect(() => {
    const atual = window.location.origin;
    setOrigem(
      atual.includes("id-preview--")
        ? atual.replace("id-preview--", "project--").replace(".lovable.app", "-dev.lovable.app")
        : atual,
    );
  }, []);

  const { data } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracoes").select("*").maybeSingle();
      if (error) throw error;
      return data as unknown as Configuracoes | null;
    },
  });

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    const { error } = await supabase
      .from("configuracoes")
      .update({
        modelo: form.modelo,
        formato_numeracao: form.formato_numeracao,
        digitos: form.digitos,
        logo_url: form.logo_url,
        assinatura_url: form.assinatura_url,
        cidade: form.cidade,
        form_url: form.form_url,
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
    setSalvando(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Configurações salvas.");
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
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

  const endpoint = `${origem}/api/public/webhooks/oficios`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Modelo do documento, identidade visual, numeração e integração.
        </p>
      </div>

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Modelo do ofício</h2>
        <p className="text-xs break-words text-muted-foreground">
          Campos disponíveis: {TAGS_MODELO.join(" ")}
        </p>
        <Textarea
          rows={16}
          value={form.modelo}
          onChange={(e) => setForm({ ...form, modelo: e.target.value })}
          className="font-mono text-sm"
        />
      </section>

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Numeração</h2>
        <div className="space-y-1.5">
          <Label htmlFor="formato">Formato</Label>
          <Input
            id="formato"
            value={form.formato_numeracao}
            onChange={(e) => setForm({ ...form, formato_numeracao: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Use {"{{seq}}"} e {"{{ano}}"}.
          </p>
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

      <section className="surface-card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Dados padrão do ofício de estágio</h2>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Usados quando o Google Forms não envia o campo (o formulário atual envia Aluno, CPF,
          Curso e Matrícula).
        </p>
        <CampoTexto label="Cidade" valor={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
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
          <a
            href={form.form_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-primary underline"
          >
            Abrir formulário em nova aba
          </a>
        )}
        <p className="text-sm text-muted-foreground">
          Cole o script abaixo no editor do formulário (Extensões › Apps Script) e crie o acionador
          “Ao enviar formulário”. Cada resposta gera automaticamente um ofício numerado.
        </p>
        <CampoCopiavel label="URL do webhook" valor={endpoint} />
        <CampoCopiavel label="Token (header x-webhook-token)" valor={form.webhook_token} />
        <details className="text-sm" open>
          <summary className="cursor-pointer text-primary">Ver Google Apps Script</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs">{`function onFormSubmit(e) {
  var r = e.namedValues;
  function v(k) { return r[k] ? r[k][0] : ""; }
  UrlFetchApp.fetch("${endpoint}", {
    method: "post",
    contentType: "application/json",
    headers: { "x-webhook-token": "${form.webhook_token}" },
    payload: JSON.stringify({
      nome: v("Aluno(a)"),
      cpf: v("CPF"),
      curso: v("CURSO"),
      matricula: v("MATRÍCULA")
    })
  });
}`}</pre>
        </details>
        {form.form_url && (
          <iframe
            src={form.form_url.replace("/viewform", "/viewform?embedded=true")}
            title="Formulário de solicitação de estágio"
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
