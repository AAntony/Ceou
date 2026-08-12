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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      conteneurs: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_conteneur_id: string | null
          parent_emplacement_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_conteneur_id?: string | null
          parent_emplacement_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_conteneur_id?: string | null
          parent_emplacement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conteneurs_parent_conteneur_id_fkey"
            columns: ["parent_conteneur_id"]
            isOneToOne: false
            referencedRelation: "conteneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteneurs_parent_emplacement_id_fkey"
            columns: ["parent_emplacement_id"]
            isOneToOne: false
            referencedRelation: "emplacements"
            referencedColumns: ["id"]
          },
        ]
      }
      emplacements: {
        Row: {
          created_at: string
          id: string
          name: string
          piece_id: string
          preset_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          piece_id: string
          preset_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          piece_id?: string
          preset_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emplacements_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      habitations: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      objet_deplacements: {
        Row: {
          from_location_id: string | null
          from_location_label: string | null
          from_location_type: string | null
          id: string
          moved_at: string
          objet_id: string
          to_location_id: string
          to_location_label: string
          to_location_type: string
        }
        Insert: {
          from_location_id?: string | null
          from_location_label?: string | null
          from_location_type?: string | null
          id?: string
          moved_at?: string
          objet_id: string
          to_location_id: string
          to_location_label: string
          to_location_type: string
        }
        Update: {
          from_location_id?: string | null
          from_location_label?: string | null
          from_location_type?: string | null
          id?: string
          moved_at?: string
          objet_id?: string
          to_location_id?: string
          to_location_label?: string
          to_location_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "objet_deplacements_objet_id_fkey"
            columns: ["objet_id"]
            isOneToOne: false
            referencedRelation: "objets"
            referencedColumns: ["id"]
          },
        ]
      }
      objets: {
        Row: {
          barcode: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          parent_conteneur_id: string | null
          parent_emplacement_id: string | null
          photo_url: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_conteneur_id?: string | null
          parent_emplacement_id?: string | null
          photo_url?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_conteneur_id?: string | null
          parent_emplacement_id?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objets_parent_conteneur_id_fkey"
            columns: ["parent_conteneur_id"]
            isOneToOne: false
            referencedRelation: "conteneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objets_parent_emplacement_id_fkey"
            columns: ["parent_emplacement_id"]
            isOneToOne: false
            referencedRelation: "emplacements"
            referencedColumns: ["id"]
          },
        ]
      }
      pieces: {
        Row: {
          created_at: string
          habitation_id: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          habitation_id: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          habitation_id?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pieces_habitation_id_fkey"
            columns: ["habitation_id"]
            isOneToOne: false
            referencedRelation: "habitations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_formes: {
        Row: {
          created_at: string
          height: number
          id: string
          piece_id: string | null
          plan_id: string
          rotation: number
          shape_type: string
          width: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          piece_id?: string | null
          plan_id: string
          rotation?: number
          shape_type: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          piece_id?: string | null
          plan_id?: string
          rotation?: number
          shape_type?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_formes_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_formes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          floor_order: number
          habitation_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          floor_order?: number
          habitation_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          floor_order?: number
          habitation_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_habitation_id_fkey"
            columns: ["habitation_id"]
            isOneToOne: false
            referencedRelation: "habitations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      conteneur_owner: { Args: { p_conteneur_id: string }; Returns: string }
      conteneur_parent_owner: {
        Args: { p_parent_conteneur_id: string; p_parent_emplacement_id: string }
        Returns: string
      }
      conteneur_root_emplacement: {
        Args: { p_conteneur_id: string }
        Returns: string
      }
      emplacement_owner: { Args: { p_emplacement_id: string }; Returns: string }
      habitation_owner: { Args: { p_habitation_id: string }; Returns: string }
      move_objet: {
        Args: { p_objet_id: string; p_to_id: string; p_to_type: string }
        Returns: undefined
      }
      objet_owner: {
        Args: { p_parent_conteneur_id: string; p_parent_emplacement_id: string }
        Returns: string
      }
      piece_owner: { Args: { p_piece_id: string }; Returns: string }
      search_index: {
        Args: never
        Returns: {
          habitation_icon: string
          habitation_id: string
          habitation_name: string
          id: string
          kind: string
          name: string
          parent_label: string
          photo_url: string
          piece_id: string
          piece_name: string
          preset_key: string
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
