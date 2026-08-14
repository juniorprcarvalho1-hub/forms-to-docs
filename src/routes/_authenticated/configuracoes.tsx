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
import { formatarNumero, type Configuracoes } from "@/lib/oficios";
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

  useEffect(() => setOrigem(window.location.origin), []);

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
        <p className="text-xs text-muted-foreground">
          Campos disponíveis: {"{{numero}} {{data}} {{nome}} {{cpf}} {{instituicao}} {{cargo}} {{assunto}}"}
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

      <section className="surface-card space-y-4 p-6">
        <h2 className="text-sm font-medium">Integração com o Google Forms</h2>
        <p className="text-sm text-muted-foreground">
          Envie um POST em JSON para o endereço abaixo a cada nova resposta (Apps Script, n8n ou
          Make). Campos aceitos: nome, cpf, instituicao, cargo, assunto, data.
        </p>
        <CampoCopiavel label="URL do webhook" valor={endpoint} />
        <CampoCopiavel label="Token (header x-webhook-token)" valor={form.webhook_token} />
        <details className="text-sm">
          <summary className="cursor-pointer text-primary">Ver exemplo de Google Apps Script</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs">{`function onFormSubmit(e) {
  var r = e.namedValues;
  UrlFetchApp.fetch("${endpoint}", {
    method: "post",
    contentType: "application/json",
    headers: { "x-webhook-token": "${form.webhook_token}" },
    payload: JSON.stringify({
      nome: r["Nome"][0],
      cpf: r["CPF"][0],
      instituicao: r["Instituição"][0],
      cargo: r["Cargo"][0],
      assunto: r["Assunto"][0]
    })
  });
}`}</pre>
        </details>
      </section>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
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
