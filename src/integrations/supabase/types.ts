export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      configuracoes: {
        Row: {
          assinatura_url: string | null
          cidade: string
          digitos: number
          form_url: string
          formato_numeracao: string
          id: boolean
          logo_url: string | null
          modelo: string
          padrao_apolice: string
          padrao_area_estagio: string
          padrao_carga_horaria: string
          padrao_cargo_coordenador: string
          padrao_coordenador: string
          padrao_destinatario: string
          padrao_periodo: string
          padrao_professor: string
          padrao_registro_professor: string
          padrao_seguradora: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          assinatura_url?: string | null
          cidade?: string
          digitos?: number
          form_url?: string
          formato_numeracao?: string
          id?: boolean
          logo_url?: string | null
          modelo?: string
          padrao_apolice?: string
          padrao_area_estagio?: string
          padrao_carga_horaria?: string
          padrao_cargo_coordenador?: string
          padrao_coordenador?: string
          padrao_destinatario?: string
          padrao_periodo?: string
          padrao_professor?: string
          padrao_registro_professor?: string
          padrao_seguradora?: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          assinatura_url?: string | null
          cidade?: string
          digitos?: number
          form_url?: string
          formato_numeracao?: string
          id?: boolean
          logo_url?: string | null
          modelo?: string
          padrao_apolice?: string
          padrao_area_estagio?: string
          padrao_carga_horaria?: string
          padrao_cargo_coordenador?: string
          padrao_coordenador?: string
          padrao_destinatario?: string
          padrao_periodo?: string
          padrao_professor?: string
          padrao_registro_professor?: string
          padrao_seguradora?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      oficios: {
        Row: {
          ano: number
          apolice: string
          area_estagio: string
          assunto: string
          carga_horaria: string
          cargo: string
          coordenador: string
          corpo: string
          cpf: string
          created_at: string
          curso: string
          data: string
          destinatario: string
          id: string
          instituicao: string
          matricula: string
          nome: string
          numero: number
          numero_formatado: string
          origem: string
          pdf_path: string | null
          periodo: string
          professor_orientador: string
          registro_professor: string
          seguradora: string
        }
        Insert: {
          ano: number
          apolice?: string
          area_estagio?: string
          assunto?: string
          carga_horaria?: string
          cargo?: string
          coordenador?: string
          corpo?: string
          cpf?: string
          created_at?: string
          curso?: string
          data?: string
          destinatario?: string
          id?: string
          instituicao?: string
          matricula?: string
          nome?: string
          numero: number
          numero_formatado: string
          origem?: string
          pdf_path?: string | null
          periodo?: string
          professor_orientador?: string
          registro_professor?: string
          seguradora?: string
        }
        Update: {
          ano?: number
          apolice?: string
          area_estagio?: string
          assunto?: string
          carga_horaria?: string
          cargo?: string
          coordenador?: string
          corpo?: string
          cpf?: string
          created_at?: string
          curso?: string
          data?: string
          destinatario?: string
          id?: string
          instituicao?: string
          matricula?: string
          nome?: string
          numero?: number
          numero_formatado?: string
          origem?: string
          pdf_path?: string | null
          periodo?: string
          professor_orientador?: string
          registro_professor?: string
          seguradora?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
