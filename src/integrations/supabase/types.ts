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
      judicial_actions: {
        Row: {
          created_at: string
          id: string
          projeto_id: string
          tipo_acao: string
          ultima_movimentacao: string | null
          updated_at: string
          vara: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          projeto_id: string
          tipo_acao: string
          ultima_movimentacao?: string | null
          updated_at?: string
          vara?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          projeto_id?: string
          tipo_acao?: string
          ultima_movimentacao?: string | null
          updated_at?: string
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "judicial_actions_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          agencia: string | null
          banco: string | null
          celulares: string[]
          cidade: string | null
          conta: string | null
          created_at: string
          data_nascimento: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          celulares?: string[]
          cidade?: string | null
          conta?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          celulares?: string[]
          cidade?: string | null
          conta?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_managers: {
        Row: {
          assessor_id: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          assessor_id: string
          created_at?: string
          id?: string
          project_id: string
          user_id?: string
        }
        Update: {
          assessor_id?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_managers_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_managers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_fotos: {
        Row: {
          created_at: string
          display_order: number
          file_name: string
          file_path: string
          id: string
          is_main: boolean
          projeto_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_name: string
          file_path: string
          id?: string
          is_main?: boolean
          projeto_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          file_name?: string
          file_path?: string
          id?: string
          is_main?: boolean
          projeto_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_fotos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_participantes: {
        Row: {
          created_at: string
          id: string
          nome: string
          papel: string
          percentual: number
          pessoa_id: string | null
          projeto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          papel: string
          percentual?: number
          pessoa_id?: string | null
          projeto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          papel?: string
          percentual?: number
          pessoa_id?: string | null
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_participantes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_participantes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          area: string | null
          averbacao_status: string | null
          bailiff_costs: number | null
          built_area: number | null
          carta_arrematacao_status: string | null
          cep: string | null
          cidade: string | null
          codigo: string | null
          condominio_debitos_anteriores: number | null
          condominio_debitos_status: string | null
          condominio_responsabilidade: string | null
          condominio_taxa_mensal: number | null
          created_at: string
          credor: string | null
          data_aquisicao: string | null
          endereco: string | null
          expected_possession_date: string | null
          forma_pagamento: string | null
          foto_principal: string | null
          fotos: string[]
          id: string
          iptu: string | null
          iptu_responsabilidade: string | null
          iptu_status: string | null
          iptu_valor: number | null
          itbi_valor: number | null
          land_area: number | null
          legal_costs: number | null
          leiloeiro_id: string | null
          leiloeiro_nome: string | null
          locksmith_security_costs: number | null
          matricula: string | null
          modalidade: string | null
          nome: string | null
          observacoes: string | null
          occupancy_status: string | null
          origem: string | null
          percentual_comissao: number
          percentual_honorarios: number
          possession_action_required: boolean | null
          possession_completed_date: string | null
          protocolo_cartorio: string | null
          quantidade_parcelas: number
          settlement_costs: number | null
          tem_condominio: boolean | null
          tem_minimo: boolean
          tipo_imovel: string | null
          total_area: number | null
          transferencia_cadastral_status: string | null
          updated_at: string
          user_id: string
          valor_aquisicao: number
          valor_comissao: number
          valor_honorarios: number
          valor_minimo: number
          valor_parcela: number
          valor_parcelado: number
        }
        Insert: {
          area?: string | null
          averbacao_status?: string | null
          bailiff_costs?: number | null
          built_area?: number | null
          carta_arrematacao_status?: string | null
          cep?: string | null
          cidade?: string | null
          codigo?: string | null
          condominio_debitos_anteriores?: number | null
          condominio_debitos_status?: string | null
          condominio_responsabilidade?: string | null
          condominio_taxa_mensal?: number | null
          created_at?: string
          credor?: string | null
          data_aquisicao?: string | null
          endereco?: string | null
          expected_possession_date?: string | null
          forma_pagamento?: string | null
          foto_principal?: string | null
          fotos?: string[]
          id?: string
          iptu?: string | null
          iptu_responsabilidade?: string | null
          iptu_status?: string | null
          iptu_valor?: number | null
          itbi_valor?: number | null
          land_area?: number | null
          legal_costs?: number | null
          leiloeiro_id?: string | null
          leiloeiro_nome?: string | null
          locksmith_security_costs?: number | null
          matricula?: string | null
          modalidade?: string | null
          nome?: string | null
          observacoes?: string | null
          occupancy_status?: string | null
          origem?: string | null
          percentual_comissao?: number
          percentual_honorarios?: number
          possession_action_required?: boolean | null
          possession_completed_date?: string | null
          protocolo_cartorio?: string | null
          quantidade_parcelas?: number
          settlement_costs?: number | null
          tem_condominio?: boolean | null
          tem_minimo?: boolean
          tipo_imovel?: string | null
          total_area?: number | null
          transferencia_cadastral_status?: string | null
          updated_at?: string
          user_id: string
          valor_aquisicao?: number
          valor_comissao?: number
          valor_honorarios?: number
          valor_minimo?: number
          valor_parcela?: number
          valor_parcelado?: number
        }
        Update: {
          area?: string | null
          averbacao_status?: string | null
          bailiff_costs?: number | null
          built_area?: number | null
          carta_arrematacao_status?: string | null
          cep?: string | null
          cidade?: string | null
          codigo?: string | null
          condominio_debitos_anteriores?: number | null
          condominio_debitos_status?: string | null
          condominio_responsabilidade?: string | null
          condominio_taxa_mensal?: number | null
          created_at?: string
          credor?: string | null
          data_aquisicao?: string | null
          endereco?: string | null
          expected_possession_date?: string | null
          forma_pagamento?: string | null
          foto_principal?: string | null
          fotos?: string[]
          id?: string
          iptu?: string | null
          iptu_responsabilidade?: string | null
          iptu_status?: string | null
          iptu_valor?: number | null
          itbi_valor?: number | null
          land_area?: number | null
          legal_costs?: number | null
          leiloeiro_id?: string | null
          leiloeiro_nome?: string | null
          locksmith_security_costs?: number | null
          matricula?: string | null
          modalidade?: string | null
          nome?: string | null
          observacoes?: string | null
          occupancy_status?: string | null
          origem?: string | null
          percentual_comissao?: number
          percentual_honorarios?: number
          possession_action_required?: boolean | null
          possession_completed_date?: string | null
          protocolo_cartorio?: string | null
          quantidade_parcelas?: number
          settlement_costs?: number | null
          tem_condominio?: boolean | null
          tem_minimo?: boolean
          tipo_imovel?: string | null
          total_area?: number | null
          transferencia_cadastral_status?: string | null
          updated_at?: string
          user_id?: string
          valor_aquisicao?: number
          valor_comissao?: number
          valor_honorarios?: number
          valor_minimo?: number
          valor_parcela?: number
          valor_parcelado?: number
        }
        Relationships: [
          {
            foreignKeyName: "projetos_leiloeiro_id_fkey"
            columns: ["leiloeiro_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
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
