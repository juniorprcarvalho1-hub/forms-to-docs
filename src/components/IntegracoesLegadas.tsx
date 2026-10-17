import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { erroImportacao } from "@/lib/importacao-dados";

export function IntegracoesLegadas() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function alterar(revogar: boolean) {
    if (
      !window.confirm(
        revogar
          ? "Desativar o token dos três webhooks de documentos? Os formulários conectados deixarão de enviar."
          : "Gerar outro token? O token anterior dos três webhooks deixará de funcionar. Atualize as propriedades dos scripts de todos os formulários.",
      )
    )
      return;
    setOcupado(true);
    setMensagem("");
    setToken("");
    try {
      const { data, error } = await supabase.rpc("gerenciar_webhook_legado", {
        p_revogar: revogar,
      });
      if (error) throw erroImportacao(error);
      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        typeof data["token"] === "string"
      )
        setToken(data["token"]);
      setMensagem(
        revogar
          ? "Integração de documentos desativada."
          : "Token gerado. Copie agora: ele não será exibido novamente.",
      );
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Não foi possível atualizar a integração.");
    } finally {
      setOcupado(false);
    }
  }
  async function aprovar(ativo: boolean) {
    setOcupado(true);
    setMensagem("");
    try {
      const { error } = await supabase.rpc("autorizar_usuario_documentos", {
        p_email: email,
        p_ativo: ativo,
      });
      if (error) throw erroImportacao(error);
      setMensagem(
        ativo
          ? "Acesso aprovado: o usuário pode gerenciar seus próprios documentos."
          : "Acesso de documentos suspenso.",
      );
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Não foi possível atualizar o acesso.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="mb-6 rounded-2xl border bg-card p-5 space-y-3">
      <h2 className="text-lg font-semibold">Acessos e integrações</h2>
      <p className="text-sm text-muted-foreground">
        Convites e criação de contas são feitos pelo administrador do Supabase. Após a migração,
        administradores consultam todos os documentos; usuários aprovados consultam somente os
        próprios. Cadastros antigos sem responsável ficam restritos a administradores.
      </p>
      <label className="text-sm" htmlFor="email-aprovacao">
        E-mail de uma conta já convidada
      </label>
      <input
        id="email-aprovacao"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border p-2"
      />
      <div className="flex gap-2 flex-wrap">
        <Button disabled={ocupado || !email.includes("@")} onClick={() => aprovar(true)}>
          Aprovar usuário
        </Button>
        <Button
          variant="outline"
          disabled={ocupado || !email.includes("@")}
          onClick={() => aprovar(false)}
        >
          Suspender usuário
        </Button>
      </div>
      <h3 className="font-semibold">Webhooks de documentos</h3>
      <p className="text-sm text-muted-foreground">
        Ofícios e declarações compartilham o token legado. Após aplicar a migração, somente o hash
        fica armazenado; a revogação e a troca exigem administrador.
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button disabled={ocupado} onClick={() => alterar(false)}>
          Trocar token
        </Button>
        <Button variant="outline" disabled={ocupado} onClick={() => alterar(true)}>
          Revogar token
        </Button>
      </div>
      {mensagem && (
        <p role="status" className="text-sm">
          {mensagem}
        </p>
      )}
      {token && (
        <div className="space-y-2">
          <label className="text-sm" htmlFor="token-legado">
            Novo token — exibição única
          </label>
          <input
            id="token-legado"
            type="password"
            readOnly
            value={token}
            className="w-full rounded-md border p-2"
            autoComplete="off"
          />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(token);
                setMensagem(
                  "Token copiado. Guarde nas Propriedades do script, nunca em planilha pública.",
                );
              } catch {
                setMensagem("Não foi possível copiar. Selecione o campo para copiar manualmente.");
              }
            }}
          >
            Copiar novo token
          </Button>
        </div>
      )}
    </section>
  );
}
