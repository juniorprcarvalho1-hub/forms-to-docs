import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ListaUsuarios } from "./controle-usuarios";

export function controleServidor(client: SupabaseClient<Database>) {
  async function executar<T>(acao: string, dados: unknown): Promise<T> {
    const { data, error } = await client.functions.invoke("controle-master", { body: { acao, dados } });
    if (error || !data) throw new Error("Não foi possível concluir a operação. Verifique sua sessão e a função de gestão no Supabase.");
    return data as T;
  }
  return {
    listar: (dados: { pagina: number; busca: string }) => executar<ListaUsuarios>("listar", dados),
    cadastrar: (dados: unknown) => executar<{ userId: string }>("cadastrar", dados),
    salvarPlano: (dados: unknown) => executar<{ ok: boolean }>("plano", dados),
    suspender: (dados: unknown) => executar<{ ok: boolean; aviso: string | null }>("suspender", dados),
  };
}
