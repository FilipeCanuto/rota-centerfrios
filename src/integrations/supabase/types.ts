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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alertas: {
        Row: {
          cliente_id: string | null
          created_at: string
          data: string
          demo: boolean
          empresa_id: string
          id: string
          lido: boolean
          mensagem: string
          origem: Database["public"]["Enums"]["origem_dado"]
          tipo: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id: string
          id?: string
          lido?: boolean
          mensagem: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          tipo: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          lido?: boolean
          mensagem?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          tipo?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cidade: string | null
          created_at: string
          data_ultima_compra: string | null
          demo: boolean
          empresa_id: string
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
          segmento: string | null
          telefone: string | null
          vendedor_id: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          data_ultima_compra?: string | null
          demo?: boolean
          empresa_id: string
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          segmento?: string | null
          telefone?: string | null
          vendedor_id?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string
          data_ultima_compra?: string | null
          demo?: boolean
          empresa_id?: string
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          segmento?: string | null
          telefone?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_regras: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          valor: number
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          valor: number
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          demo: boolean
          empresa_id: string | null
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
          slug: string
        }
        Insert: {
          created_at?: string
          demo?: boolean
          empresa_id?: string | null
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          slug: string
        }
        Update: {
          created_at?: string
          demo?: boolean
          empresa_id?: string | null
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          slug?: string
        }
        Relationships: []
      }
      equipes: {
        Row: {
          created_at: string
          demo: boolean
          empresa_id: string
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
          supervisor_id: string | null
        }
        Insert: {
          created_at?: string
          demo?: boolean
          empresa_id: string
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          supervisor_id?: string | null
        }
        Update: {
          created_at?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_supervisor_fk"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          abrangencia: string
          created_at: string
          data: string
          empresa_id: string | null
          id: string
          localidade: string | null
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
        }
        Insert: {
          abrangencia: string
          created_at?: string
          data: string
          empresa_id?: string | null
          id?: string
          localidade?: string | null
          nome: string
          origem?: Database["public"]["Enums"]["origem_dado"]
        }
        Update: {
          abrangencia?: string
          created_at?: string
          data?: string
          empresa_id?: string | null
          id?: string
          localidade?: string | null
          nome?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
        }
        Relationships: [
          {
            foreignKeyName: "feriados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      interacoes: {
        Row: {
          cliente_id: string
          cliente_respondeu: boolean
          created_at: string
          data: string
          demo: boolean
          empresa_id: string
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          resultado: string | null
          tipo: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id: string
          cliente_respondeu?: boolean
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          resultado?: string | null
          tipo: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string
          cliente_respondeu?: boolean
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          resultado?: string | null
          tipo?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      links: {
        Row: {
          created_at: string
          demo: boolean
          descricao: string | null
          empresa_id: string
          icone: string | null
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          publico: string
          titulo: string
          url: string
        }
        Insert: {
          created_at?: string
          demo?: boolean
          descricao?: string | null
          empresa_id: string
          icone?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          publico?: string
          titulo: string
          url: string
        }
        Update: {
          created_at?: string
          demo?: boolean
          descricao?: string | null
          empresa_id?: string
          icone?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          publico?: string
          titulo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          created_at: string
          demo: boolean
          empresa_id: string
          id: string
          mes: string
          meta_cobertura: number
          meta_orcamentos: number
          meta_reativacao: number
          meta_vendas: number
          origem: Database["public"]["Enums"]["origem_dado"]
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          demo?: boolean
          empresa_id: string
          id?: string
          mes: string
          meta_cobertura?: number
          meta_orcamentos?: number
          meta_reativacao?: number
          meta_vendas?: number
          origem?: Database["public"]["Enums"]["origem_dado"]
          vendedor_id: string
        }
        Update: {
          created_at?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          mes?: string
          meta_cobertura?: number
          meta_orcamentos?: number
          meta_reativacao?: number
          meta_vendas?: number
          origem?: Database["public"]["Enums"]["origem_dado"]
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          demo: boolean
          empresa_id: string
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          status: string
          ultimo_followup: string | null
          valor: number
          vendedor_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          status?: string
          ultimo_followup?: string | null
          valor?: number
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          status?: string
          ultimo_followup?: string | null
          valor?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      papeis_pre_cadastro: {
        Row: {
          created_at: string
          empresa_id: string | null
          origem: Database["public"]["Enums"]["origem_dado"]
          role: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          origem?: Database["public"]["Enums"]["origem_dado"]
          role: Database["public"]["Enums"]["app_role"]
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          origem?: Database["public"]["Enums"]["origem_dado"]
          role?: Database["public"]["Enums"]["app_role"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "papeis_pre_cadastro_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "papeis_pre_cadastro_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos: {
        Row: {
          created_at: string
          data: string
          demo: boolean
          empresa_id: string
          id: string
          indicador: string
          origem: Database["public"]["Enums"]["origem_dado"]
          pontos: number
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id: string
          id?: string
          indicador: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          pontos: number
          vendedor_id: string
        }
        Update: {
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          indicador?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          pontos?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          empresa_id: string | null
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          registro_id: string | null
          tabela: string | null
          usuario_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          registro_id?: string | null
          tabela?: string | null
          usuario_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          registro_id?: string | null
          tabela?: string | null
          usuario_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_auditoria_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      selos: {
        Row: {
          conquistado_em: string
          created_at: string
          demo: boolean
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
          vendedor_id: string
        }
        Insert: {
          conquistado_em?: string
          created_at?: string
          demo?: boolean
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          vendedor_id: string
        }
        Update: {
          conquistado_em?: string
          created_at?: string
          demo?: boolean
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "selos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_agenda: {
        Row: {
          cliente_id: string | null
          concluida: boolean
          created_at: string
          data: string
          demo: boolean
          empresa_id: string
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          titulo: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          concluida?: boolean
          created_at?: string
          data: string
          demo?: boolean
          empresa_id: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          titulo: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          concluida?: boolean
          created_at?: string
          data?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          titulo?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_agenda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_agenda_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_agenda_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_empresas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          apelido_copiloto: string
          auth_user_id: string | null
          created_at: string
          demo: boolean
          email: string | null
          empresa_id: string | null
          equipe_id: string | null
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
          perfil: Database["public"]["Enums"]["app_role"]
          tema: string
        }
        Insert: {
          apelido_copiloto?: string
          auth_user_id?: string | null
          created_at?: string
          demo?: boolean
          email?: string | null
          empresa_id?: string | null
          equipe_id?: string | null
          id?: string
          nome: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          perfil?: Database["public"]["Enums"]["app_role"]
          tema?: string
        }
        Update: {
          apelido_copiloto?: string
          auth_user_id?: string | null
          created_at?: string
          demo?: boolean
          email?: string | null
          empresa_id?: string | null
          equipe_id?: string | null
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          perfil?: Database["public"]["Enums"]["app_role"]
          tema?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_id: string
          created_at: string
          data_faturamento: string
          demo: boolean
          empresa_id: string
          id: string
          origem: Database["public"]["Enums"]["origem_dado"]
          valor: number
          vendedor_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_faturamento: string
          demo?: boolean
          empresa_id: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          valor: number
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_faturamento?: string
          demo?: boolean
          empresa_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["origem_dado"]
          valor?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_atualizar_usuario: {
        Args: { _dados: Json; _usuario_id: string }
        Returns: {
          apelido_copiloto: string
          auth_user_id: string | null
          created_at: string
          demo: boolean
          email: string | null
          empresa_id: string | null
          equipe_id: string | null
          id: string
          nome: string
          origem: Database["public"]["Enums"]["origem_dado"]
          perfil: Database["public"]["Enums"]["app_role"]
          tema: string
        }
        SetofOptions: {
          from: "*"
          to: "usuarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apagar_dados_demo: { Args: never; Returns: undefined }
      auditar: {
        Args: {
          _acao: string
          _detalhes: Json
          _empresa: string
          _registro: string
          _tabela: string
          _vendedor: string
        }
        Returns: undefined
      }
      cobertura_vendedor: {
        Args: { _empresa_id: string; _hoje: string; _vendedor_id: string }
        Returns: Json
      }
      eh_admin: { Args: never; Returns: boolean }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _empresa_id: string
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      meu_usuario_id: { Args: never; Returns: string }
      painel_vendedor: {
        Args: { _empresa_id: string; _hoje: string; _vendedor_id: string }
        Returns: Json
      }
      pode_ver_vendedor: { Args: { _vendedor_id: string }; Returns: boolean }
      remanejar_cliente: {
        Args: {
          _cliente_id: string
          _motivo: string
          _novo_vendedor_id: string
        }
        Returns: undefined
      }
      tem_empresa: { Args: { _empresa_id: string }; Returns: boolean }
      ve_tudo: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "vendedor" | "supervisor" | "diretoria" | "administrador"
      origem_dado: "manual" | "importacao" | "integracao"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["vendedor", "supervisor", "diretoria", "administrador"],
      origem_dado: ["manual", "importacao", "integracao"],
    },
  },
} as const
