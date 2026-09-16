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
    PostgrestVersion: "14.5"
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
      ai_scan_rate_limit: {
        Row: {
          kind: string
          last_request_at: string
          user_id: string
        }
        Insert: {
          kind?: string
          last_request_at?: string
          user_id: string
        }
        Update: {
          kind?: string
          last_request_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          app_version: string | null
          context: Json | null
          created_at: string
          git_commit: string | null
          id: string
          message: string
          platform: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          context?: Json | null
          created_at?: string
          git_commit?: string | null
          id?: string
          message: string
          platform?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          context?: Json | null
          created_at?: string
          git_commit?: string | null
          id?: string
          message?: string
          platform?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conteneurs: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_conteneur_id: string | null
          parent_emplacement_id: string | null
          photo_url: string | null
          preset_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_conteneur_id?: string | null
          parent_emplacement_id?: string | null
          photo_url?: string | null
          preset_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_conteneur_id?: string | null
          parent_emplacement_id?: string | null
          photo_url?: string | null
          preset_key?: string | null
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
      corbeille: {
        Row: {
          deleted_at: string
          id: string
          kind: string
          label: string
          payload: Json
          photo_url: string | null
          resume: Json
          user_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          kind: string
          label: string
          payload: Json
          photo_url?: string | null
          resume?: Json
          user_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          kind?: string
          label?: string
          payload?: Json
          photo_url?: string | null
          resume?: Json
          user_id?: string
        }
        Relationships: []
      }
      emplacements: {
        Row: {
          created_at: string
          id: string
          name: string
          photo_url: string | null
          piece_id: string
          preset_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          piece_id: string
          preset_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
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
      facture_objets: {
        Row: {
          amount: number | null
          facture_id: string
          id: string
          objet_id: string
          warranty_until: string | null
        }
        Insert: {
          amount?: number | null
          facture_id: string
          id?: string
          objet_id: string
          warranty_until?: string | null
        }
        Update: {
          amount?: number | null
          facture_id?: string
          id?: string
          objet_id?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facture_objets_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_objets_objet_id_fkey"
            columns: ["objet_id"]
            isOneToOne: false
            referencedRelation: "objets"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          amount: number | null
          created_at: string
          document_kind: string
          document_url: string | null
          id: string
          purchase_date: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          document_kind?: string
          document_url?: string | null
          id?: string
          purchase_date?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          document_kind?: string
          document_url?: string | null
          id?: string
          purchase_date?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
      friend_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
        }
        Relationships: []
      }
      friend_category_members: {
        Row: {
          category_id: string
          created_at: string
          friend_user_id: string
          owner_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          friend_user_id: string
          owner_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          friend_user_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_category_members_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "friend_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          source_invite_id: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          source_invite_id?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          source_invite_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_source_invite_fkey"
            columns: ["source_invite_id"]
            isOneToOne: false
            referencedRelation: "share_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      habitation_favorites: {
        Row: {
          created_at: string
          habitation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habitation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          habitation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habitation_favorites_habitation_id_fkey"
            columns: ["habitation_id"]
            isOneToOne: false
            referencedRelation: "habitations"
            referencedColumns: ["id"]
          },
        ]
      }
      habitation_shares: {
        Row: {
          created_at: string
          habitation_id: string
          id: string
          permission: string
          shared_by: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          habitation_id: string
          id?: string
          permission: string
          shared_by: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          habitation_id?: string
          id?: string
          permission?: string
          shared_by?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habitation_shares_habitation_id_fkey"
            columns: ["habitation_id"]
            isOneToOne: false
            referencedRelation: "habitations"
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
          photo_url: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          photo_url?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      moving_boxes: {
        Row: {
          category: string | null
          container_id: string | null
          created_at: string
          description: string | null
          destination_piece_id: string | null
          id: string
          name: string
          number: number
          photo_url: string | null
          deleted_at: string | null
          project_id: string
          status: string
        }
        Insert: {
          deleted_at?: string | null
          category?: string | null
          container_id?: string | null
          created_at?: string
          description?: string | null
          destination_piece_id?: string | null
          id?: string
          name: string
          number: number
          photo_url?: string | null
          project_id: string
          status?: string
        }
        Update: {
          deleted_at?: string | null
          category?: string | null
          container_id?: string | null
          created_at?: string
          description?: string | null
          destination_piece_id?: string | null
          id?: string
          name?: string
          number?: number
          photo_url?: string | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "moving_boxes_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: true
            referencedRelation: "conteneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_boxes_destination_piece_id_fkey"
            columns: ["destination_piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_boxes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "moving_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      moving_items: {
        Row: {
          box_id: string
          name: string
          object_id: string
          origin_id: string | null
          origin_label: string | null
          origin_type: string | null
          outcome: string
          packed_at: string
          project_id: string
          resolved_at: string | null
        }
        Insert: {
          box_id: string
          name: string
          object_id: string
          origin_id?: string | null
          origin_label?: string | null
          origin_type?: string | null
          outcome?: string
          packed_at?: string
          project_id: string
          resolved_at?: string | null
        }
        Update: {
          box_id?: string
          name?: string
          object_id?: string
          origin_id?: string | null
          origin_label?: string | null
          origin_type?: string | null
          outcome?: string
          packed_at?: string
          project_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moving_items_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "moving_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "moving_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      moving_projects: {
        Row: {
          completed_at: string | null
          created_at: string
          destination_id: string | null
          id: string
          name: string
          next_number: number
          planned_date: string | null
          recovery_location_id: string | null
          source_id: string | null
          staging_location_id: string | null
          staging_piece_id: string | null
          status: string
          shared_with: string[]
          deleted_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          destination_id?: string | null
          id?: string
          name: string
          next_number?: number
          planned_date?: string | null
          recovery_location_id?: string | null
          source_id?: string | null
          staging_location_id?: string | null
          staging_piece_id?: string | null
          status?: string
          shared_with?: string[]
          deleted_at?: string | null
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          destination_id?: string | null
          id?: string
          name?: string
          next_number?: number
          planned_date?: string | null
          recovery_location_id?: string | null
          source_id?: string | null
          staging_location_id?: string | null
          staging_piece_id?: string | null
          status?: string
          shared_with?: string[]
          deleted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moving_projects_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "habitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_projects_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "habitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_projects_recovery_location_id_fkey"
            columns: ["recovery_location_id"]
            isOneToOne: false
            referencedRelation: "emplacements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_projects_staging_location_id_fkey"
            columns: ["staging_location_id"]
            isOneToOne: false
            referencedRelation: "emplacements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moving_projects_staging_piece_id_fkey"
            columns: ["staging_piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
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
      objet_prets: {
        Row: {
          counterpart_label: string
          counterpart_user_id: string | null
          created_at: string
          direction: string
          due_at: string | null
          id: string
          note: string | null
          objet_id: string
          returned_at: string | null
          started_at: string
        }
        Insert: {
          counterpart_label: string
          counterpart_user_id?: string | null
          created_at?: string
          direction: string
          due_at?: string | null
          id?: string
          note?: string | null
          objet_id: string
          returned_at?: string | null
          started_at?: string
        }
        Update: {
          counterpart_label?: string
          counterpart_user_id?: string | null
          created_at?: string
          direction?: string
          due_at?: string | null
          id?: string
          note?: string | null
          objet_id?: string
          returned_at?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objet_prets_objet_id_fkey"
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
          color: string | null
          created_at: string
          habitation_id: string
          id: string
          is_default: boolean
          name: string
          photo_url: string | null
          preset_key: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          habitation_id: string
          id?: string
          is_default?: boolean
          name: string
          photo_url?: string | null
          preset_key?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          habitation_id?: string
          id?: string
          is_default?: boolean
          name?: string
          photo_url?: string | null
          preset_key?: string | null
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
      plan_doors: {
        Row: {
          created_at: string
          edge: string
          forme_id: string
          id: string
          plan_id: string
          position: number
        }
        Insert: {
          created_at?: string
          edge?: string
          forme_id: string
          id?: string
          plan_id: string
          position?: number
        }
        Update: {
          created_at?: string
          edge?: string
          forme_id?: string
          id?: string
          plan_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_doors_forme_id_fkey"
            columns: ["forme_id"]
            isOneToOne: false
            referencedRelation: "plan_formes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_doors_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
      plan_pins: {
        Row: {
          created_at: string
          emplacement_id: string
          forme_id: string
          id: string
          plan_id: string
          rel_x: number
          rel_y: number
        }
        Insert: {
          created_at?: string
          emplacement_id: string
          forme_id: string
          id?: string
          plan_id: string
          rel_x?: number
          rel_y?: number
        }
        Update: {
          created_at?: string
          emplacement_id?: string
          forme_id?: string
          id?: string
          plan_id?: string
          rel_x?: number
          rel_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_pins_emplacement_id_fkey"
            columns: ["emplacement_id"]
            isOneToOne: true
            referencedRelation: "emplacements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_pins_forme_id_fkey"
            columns: ["forme_id"]
            isOneToOne: false
            referencedRelation: "plan_formes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_pins_plan_id_fkey"
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
          ai_assistant_consent_at: string | null
          ai_photo_consent_at: string | null
          ai_voice_live_consent_at: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          friend_code: string
          id: string
          locale: string
          onboarding_done_at: string | null
        }
        Insert: {
          ai_assistant_consent_at?: string | null
          ai_photo_consent_at?: string | null
          ai_voice_live_consent_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          friend_code: string
          id: string
          locale?: string
          onboarding_done_at?: string | null
        }
        Update: {
          ai_assistant_consent_at?: string | null
          ai_photo_consent_at?: string | null
          ai_voice_live_consent_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          friend_code?: string
          id?: string
          locale?: string
          onboarding_done_at?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      share_invite_redemptions: {
        Row: {
          id: string
          invite_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          invite_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          invite_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_invite_redemptions_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "share_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      share_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          habitation_ids: string[]
          id: string
          label: string | null
          max_uses: number | null
          permission: string
          remind_days_before: number | null
          target_type: string
          use_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          habitation_ids: string[]
          id?: string
          label?: string | null
          max_uses?: number | null
          permission: string
          remind_days_before?: number | null
          target_type: string
          use_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          habitation_ids?: string[]
          id?: string
          label?: string | null
          max_uses?: number | null
          permission?: string
          remind_days_before?: number | null
          target_type?: string
          use_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      billing_snapshot: { Args: Record<PropertyKey, never>; Returns: Json }
      apply_plan_template: {
        Args: { p_plan_id: string; p_rooms: Json }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "plan_formes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_manage_habitation_sharing: {
        Args: { p_habitation_id: string; p_user_id: string }
        Returns: boolean
      }
      can_read_media: {
        Args: { p_bucket: string; p_name: string }
        Returns: boolean
      }
      check_and_touch_ai_rate_limit: {
        Args: { p_cooldown_seconds: number; p_kind: string; p_user_id: string }
        Returns: boolean
      }
      check_and_touch_ai_scan_rate_limit: {
        Args: { p_cooldown_seconds: number; p_user_id: string }
        Returns: boolean
      }
      conteneur_habitation: {
        Args: { p_conteneur_id: string }
        Returns: string
      }
      conteneur_root_emplacement: {
        Args: { p_conteneur_id: string }
        Returns: string
      }
      corbeille_deposer: {
        Args: { p_id: string; p_kind: string }
        Returns: string
      }
      corbeille_lister: {
        Args: never
        Returns: {
          deleted_at: string
          id: string
          kind: string
          label: string
          photo_url: string
          resume: Json
        }[]
      }
      corbeille_restaurer: { Args: { p_id: string }; Returns: string }
      corbeille_vider: { Args: never; Returns: undefined }
      create_share_invite: {
        Args: {
          p_expires_at?: string
          p_habitation_ids: string[]
          p_label?: string
          p_max_uses?: number
          p_permission: string
          p_remind_days_before?: number
          p_target_type: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          habitation_ids: string[]
          id: string
          label: string | null
          max_uses: number | null
          permission: string
          remind_days_before: number | null
          target_type: string
          use_count: number
        }
        SetofOptions: {
          from: "*"
          to: "share_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      emplacement_habitation: {
        Args: { p_emplacement_id: string }
        Returns: string
      }
      factures_a_rattacher: {
        Args: { p_limite?: number; p_objet_id: string }
        Returns: {
          amount: number
          created_at: string
          document_kind: string
          document_url: string
          facture_amount: number
          id: string
          lignes: Json
          purchase_date: string
          vendor: string
        }[]
      }
      factures_export_rows: {
        Args: never
        Returns: {
          amount: number
          chain: Json
          created_at: string
          document_kind: string
          document_url: string
          facture_amount: number
          facture_id: string
          objet_id: string
          objet_name: string
          purchase_date: string
          vendor: string
          warranty_until: string
        }[]
      }
      factures_for_habitation: {
        Args: { p_habitation_id: string }
        Returns: {
          amount: number
          created_at: string
          document_kind: string
          document_url: string
          facture_amount: number
          id: string
          lignes: Json
          purchase_date: string
          vendor: string
        }[]
      }
      factures_for_objet: {
        Args: { p_objet_id: string }
        Returns: {
          amount: number
          created_at: string
          document_kind: string
          document_url: string
          facture_amount: number
          id: string
          lignes: Json
          purchase_date: string
          vendor: string
          warranty_until: string
        }[]
      }
      friend_shared_habitation_counts: {
        Args: never
        Returns: {
          friend_user_id: string
          habitation_count: number
        }[]
      }
      generate_friend_code: { Args: never; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      get_effective_habitation_permission: {
        Args: { p_habitation_id: string }
        Returns: string
      }
      habitation_id_for_node: {
        Args: { p_id: string; p_kind: string }
        Returns: string
      }
      habitation_node_counts: {
        Args: { p_habitation_id: string }
        Returns: {
          node_id: string
          node_kind: string
          objet_count: number
        }[]
      }
      habitation_object_counts: {
        Args: never
        Returns: {
          habitation_id: string
          objet_count: number
        }[]
      }
      habitation_share_permission: {
        Args: { p_habitation_id: string; p_user_id: string }
        Returns: string
      }
      has_habitation_access: {
        Args: {
          p_habitation_id: string
          p_min_permission: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_accepted_friend: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      is_anonymous: { Args: never; Returns: boolean }
      list_friendships: {
        Args: never
        Returns: {
          created_at: string
          direction: string
          id: string
          other_avatar_url: string
          other_display_name: string
          other_friend_code: string
          other_user_id: string
          responded_at: string
          source_invite_id: string
          status: string
        }[]
      }
      list_habitation_shares: {
        Args: { p_habitation_id: string }
        Returns: {
          created_at: string
          id: string
          permission: string
          shared_with_user_display_name: string
          shared_with_user_id: string
        }[]
      }
      list_my_share_invites: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expires_at: string
          habitation_ids: string[]
          habitation_names: string[]
          id: string
          label: string
          max_uses: number
          permission: string
          remind_days_before: number
          target_type: string
          use_count: number
        }[]
      }
      list_objet_prets: {
        Args: { p_include_closed?: boolean }
        Returns: {
          counterpart_avatar_url: string
          counterpart_label: string
          counterpart_user_id: string
          direction: string
          due_at: string
          id: string
          note: string
          objet_id: string
          objet_name: string
          objet_photo_url: string
          returned_at: string
          started_at: string
        }[]
      }
      location_habitation: {
        Args: { p_parent_conteneur_id: string; p_parent_emplacement_id: string }
        Returns: string
      }
      media_habitation: { Args: { p_name: string }; Returns: string }
      move_objet: {
        Args: { p_objet_id: string; p_to_id: string; p_to_type: string }
        Returns: undefined
      }
      moving_access: {
        Args: { p_id: string; p_permission?: string }
        Returns: boolean
      }
      moving_manage: {
        Args: { p_action: string; p_payload: Json }
        Returns: Json
      }
      moving_share_candidates: {
        Args: { p_id: string }
        Returns: Json
      }
      moving_command: {
        Args: { p_action: string; p_payload: Json }
        Returns: Json
      }
      moving_read: { Args: { p_project_id?: string }; Returns: Json }
      moving_search_index: {
        Args: never
        Returns: {
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
      my_guest_access_status: { Args: never; Returns: Json }
      objet_location_chain: {
        Args: { p_objet_id: string }
        Returns: {
          id: string
          is_default: boolean
          kind: string
          name: string
          preset_key: string
        }[]
      }
      objets_sans_facture: {
        Args: { p_habitation_id: string }
        Returns: {
          id: string
          name: string
          parent_label: string
          photo_url: string
          piece_name: string
        }[]
      }
      piece_habitation: { Args: { p_piece_id: string }; Returns: string }
      piece_object_counts: {
        Args: { p_habitation_id: string }
        Returns: {
          objet_count: number
          piece_id: string
        }[]
      }
      plan_habitation: { Args: { p_plan_id: string }; Returns: string }
      redeem_share_invite: { Args: { p_code: string }; Returns: Json }
      remove_friend: { Args: { p_friend_user_id: string }; Returns: undefined }
      resolve_location_habitation: {
        Args: { p_id: string; p_type: string }
        Returns: string
      }
      respond_to_friendship: {
        Args: { p_accept: boolean; p_friendship_id: string }
        Returns: undefined
      }
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
      send_friend_request: { Args: { p_friend_code: string }; Returns: string }
      shares_context_with: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      update_share_invite: {
        Args: {
          p_expires_at: string
          p_invite_id: string
          p_label?: string
          p_max_uses: number
          p_remind_days_before?: number
          p_reset_uses?: boolean
        }
        Returns: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          habitation_ids: string[]
          id: string
          label: string | null
          max_uses: number | null
          permission: string
          remind_days_before: number | null
          target_type: string
          use_count: number
        }
        SetofOptions: {
          from: "*"
          to: "share_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_habitation_share: {
        Args: {
          p_habitation_id: string
          p_permission: string
          p_shared_with_user_id: string
        }
        Returns: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
