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
      admin_audit: {
        Row: {
          action: string
          actor: string | null
          actor_kind: string
          at: string
          details: Json
          id: number
          target_id: string | null
          team_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_kind: string
          at?: string
          details?: Json
          id?: number
          target_id?: string | null
          team_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_kind?: string
          at?: string
          details?: Json
          id?: number
          target_id?: string | null
          team_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          frozen_at: string | null
          id: number
          leaderboard_frozen: boolean
        }
        Insert: {
          frozen_at?: string | null
          id?: number
          leaderboard_frozen?: boolean
        }
        Update: {
          frozen_at?: string | null
          id?: number
          leaderboard_frozen?: boolean
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          avatar_path: string | null
          best_score: number
          best_scored_at: string
          best_submission_id: string | null
          rank: number
          team_id: string
          team_name: string
        }
        Insert: {
          avatar_path?: string | null
          best_score: number
          best_scored_at: string
          best_submission_id?: string | null
          rank: number
          team_id: string
          team_name: string
        }
        Update: {
          avatar_path?: string | null
          best_score?: number
          best_scored_at?: string
          best_submission_id?: string | null
          rank?: number
          team_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      replays: {
        Row: {
          created_at: string
          id: string
          puzzle: Json
          steps: Json
          submission_id: string
          summary: Json
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          puzzle: Json
          steps: Json
          submission_id: string
          summary: Json
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          puzzle?: Json
          steps?: Json
          submission_id?: string
          summary?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replays_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replays_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_purge_queue: {
        Row: {
          bucket: string
          id: number
          path: string
          queued_at: string
        }
        Insert: {
          bucket: string
          id?: number
          path: string
          queued_at?: string
        }
        Update: {
          bucket?: string
          id?: number
          path?: string
          queued_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          created_at: string
          error: string | null
          file_name: string
          file_path: string
          id: string
          metrics: Json | null
          score: number | null
          scored_at: string | null
          size_bytes: number
          source: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_name: string
          file_path: string
          id?: string
          metrics?: Json | null
          score?: number | null
          scored_at?: string | null
          size_bytes: number
          source: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          file_name?: string
          file_path?: string
          id?: string
          metrics?: Json | null
          score?: number | null
          scored_at?: string | null
          size_bytes?: number
          source?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          avatar_path: string | null
          created_at: string
          id: string
          role: string
          team_name: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          id: string
          role?: string
          team_name: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          id?: string
          role?: string
          team_name?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_freeze: { Args: { p_frozen: boolean }; Returns: undefined }
      admin_set_score: {
        Args: { p_metrics?: Json; p_score: number; p_submission: string }
        Returns: undefined
      }
      audit_actor_kind: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_team: { Args: never; Returns: boolean }
      own_submission_file_exists: { Args: { p_path: string }; Returns: boolean }
      prune_submissions: { Args: { p_team: string }; Returns: undefined }
      refresh_leaderboard: { Args: never; Returns: undefined }
      submission_orphan_files: {
        Args: { p_limit?: number }
        Returns: {
          name: string
        }[]
      }
      verify_purge_secret: { Args: { p: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
