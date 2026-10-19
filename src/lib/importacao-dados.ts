// @ts-nocheck -- depende de migrações ainda não aplicadas (docs/IMPORTACOES.md)
import { supabase } from "@/integrations/supabase/client";
import type { DestinoImportacao } from "./importacao";
import type { ResultadoImportacao } from "@/components/ImportadorDados";

export function erroImportacao(error: { code?: string; message: string }): Error {
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? ""))
    return new Error(
      "A importação ainda precisa ser ativada no banco. Peça ao administrador para aplicar a atualização de importações e pacientes.",
    );
  return new Error(error.message);
}

export async function importarRegistros(
  destino: DestinoImportacao,
  registros: Record<string, string>[],
  origem: string,
  chave: string,
): Promise<ResultadoImportacao> {
  const { data, error } = await supabase.rpc("importar_registros", {
    p_destino: destino,
    p_registros: registros,
    p_origem: origem,
    p_chave: chave,
  });
  if (error) throw erroImportacao(error);
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data["inseridos"] !== "number" ||
    typeof data["ignorados"] !== "number"
  )
    throw new Error("Resposta inesperada. Atualize a lista antes de tentar novamente.");
  return { inseridos: data["inseridos"], ignorados: data["ignorados"] };
}

export function scriptGoogleForms(endpoint: string): string {
  return `// Vincule este script à PLANILHA DE RESPOSTAS do Google Forms.
// Nas Propriedades do script, cadastre FACESF_TOKEN com o token gerado no sistema.
// Depois execute instalarIntegracao() uma única vez e autorize a conta responsável.
const FACESF_ENDPOINT = ${JSON.stringify(endpoint)};

function enviarCadastroFACESF(e) {
  if (!e || !e.namedValues) throw new Error("Use o gatilho Ao enviar formulário da planilha de respostas.");
  const token = PropertiesService.getScriptProperties().getProperty("FACESF_TOKEN");
  if (!token) throw new Error("Configure FACESF_TOKEN nas Propriedades do script.");
  const resposta = UrlFetchApp.fetch(FACESF_ENDPOINT, {
    method: "post", contentType: "application/json",
    headers: { "x-webhook-token": token },
    payload: JSON.stringify(e.namedValues), muteHttpExceptions: true
  });
  // Não registre respostas, CPF, telefone ou tokens nos logs.
  if (resposta.getResponseCode() >= 400) throw new Error("Cadastro não recebido. HTTP " + resposta.getResponseCode() + ". Confira o mapeamento no sistema antes de reenviar.");
}

function instalarIntegracao() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) throw new Error("Abra este projeto a partir da planilha de respostas.");
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "enviarCadastroFACESF")) {
    ScriptApp.newTrigger("enviarCadastroFACESF").forSpreadsheet(planilha).onFormSubmit().create();
  }
}
`;
}
