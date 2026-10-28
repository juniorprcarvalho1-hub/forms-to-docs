import { enviarDocumentoAutorizado, validarReferenciaEmail, type ReferenciaEmail } from "./email-documento";
import { comContaAtiva } from "./conta-ativa";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ControleDatabase } from "./controle-usuarios.db";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Entrada = ReferenciaEmail & {
  to: string;
  assunto: string;
  corpo: string;
  nomeArquivo: string;
  pdfBase64: string;
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function base64Utf8(texto: string) {
  return btoa(Array.from(new TextEncoder().encode(texto), (b) => String.fromCharCode(b)).join(""));
}

/** Cabeçalhos com acento precisam do formato RFC 2047. */
function cabecalho(valor: string) {
  return /^[\x00-\x7F]*$/.test(valor) ? valor : `=?UTF-8?B?${base64Utf8(valor)}?=`;
}

/** Envia o documento em anexo pela conta Gmail conectada ao sistema. */
export const enviarEmailComPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Entrada) => {
    validarReferenciaEmail(input);
    if (!input || typeof input.to !== "string" || !input.to.includes("@")) {
      throw new Error("E-mail de destino inválido.");
    }
    if (!input.pdfBase64) throw new Error("Documento em PDF ausente.");
    return input;
  })
  .handler(async ({ data, context }) =>
    comContaAtiva(
      () =>
        (context.supabase as unknown as SupabaseClient<ControleDatabase>).rpc(
          "status_acesso_usuario",
          { p_ip: "" },
        ),
      async () => enviarDocumentoAutorizado(data, {
        carregar: async (tipo, id) => {
          const result = await context.supabase.from(tipo).select("origem").eq("id", id).maybeSingle();
          if (result.error) throw new Error("Documento indisponível.");
          return result.data;
        },
        enviar: async () => {
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
        if (!lovableKey || !gmailKey) {
          throw new Error("A conta de e-mail do sistema não está conectada.");
        }

        const limite = `lim_${Math.random().toString(36).slice(2)}`;
        const anexo = data.pdfBase64.replace(/^data:[^,]+,/, "");
        const mime = [
          `To: ${data.to}`,
          `Subject: ${cabecalho(data.assunto)}`,
          "MIME-Version: 1.0",
          `Content-Type: multipart/mixed; boundary="${limite}"`,
          "",
          `--${limite}`,
          'Content-Type: text/plain; charset="UTF-8"',
          "Content-Transfer-Encoding: base64",
          "",
          base64Utf8(data.corpo),
          "",
          `--${limite}`,
          "Content-Type: application/pdf",
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${data.nomeArquivo}"`,
          "",
          anexo.replace(/(.{76})/g, "$1\r\n"),
          "",
          `--${limite}--`,
          "",
        ].join("\r\n");

        const raw = base64Utf8(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        const resposta = await fetch(`${GATEWAY}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmailKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });

        if (!resposta.ok) {
          const detalhe = await resposta.text();
          console.error(`Falha ao enviar e-mail [${resposta.status}]: ${detalhe}`);
          throw new Error(`Falha ao enviar o e-mail [${resposta.status}]: ${detalhe}`);
        }

        return { enviado: true as const };
        },
      }),
    ),
  );
