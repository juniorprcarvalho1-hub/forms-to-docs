import type { Database, Json } from "@/integrations/supabase/types";
export type ControleDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      status_acesso_usuario: { Args: { p_ip: string }; Returns: Json };
      receber_paciente_forms: { Args: { p_token: string; p_dados: Json }; Returns: Json };
      listar_usuarios_controle: { Args: { p_pagina: number; p_busca: string }; Returns: Json };
      salvar_plano_usuario: {
        Args: { p_user_id: string; p_plano: string; p_vencimento: string; p_nome?: string };
        Returns: undefined;
      };
      suspender_usuario_controle: {
        Args: { p_user_id: string; p_suspenso: boolean };
        Returns: undefined;
      };
    };
  };
};
