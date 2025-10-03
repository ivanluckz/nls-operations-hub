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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          capacity: number
          category: string
          created_at: string
          created_by: string
          current_enrollment: number
          day_of_week: string
          description: string
          id: string
          is_active: boolean
          schedule: string
          teacher_id: string | null
          teacher_in_charge: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity: number
          category: string
          created_at?: string
          created_by: string
          current_enrollment?: number
          day_of_week?: string
          description: string
          id?: string
          is_active?: boolean
          schedule: string
          teacher_id?: string | null
          teacher_in_charge: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          category?: string
          created_at?: string
          created_by?: string
          current_enrollment?: number
          day_of_week?: string
          description?: string
          id?: string
          is_active?: boolean
          schedule?: string
          teacher_id?: string | null
          teacher_in_charge?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      allocations: {
        Row: {
          activity_id: string
          allocated_at: string
          day_of_week: string
          id: string
          preference_rank: number
          status: Database["public"]["Enums"]["allocation_status"]
          student_id: string
        }
        Insert: {
          activity_id: string
          allocated_at?: string
          day_of_week?: string
          id?: string
          preference_rank: number
          status?: Database["public"]["Enums"]["allocation_status"]
          student_id: string
        }
        Update: {
          activity_id?: string
          allocated_at?: string
          day_of_week?: string
          id?: string
          preference_rank?: number
          status?: Database["public"]["Enums"]["allocation_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
        ]
      }
      preferences: {
        Row: {
          friday_first_choice: string | null
          friday_second_choice: string | null
          friday_third_choice: string | null
          id: string
          monday_first_choice: string | null
          monday_second_choice: string | null
          monday_third_choice: string | null
          student_id: string
          submitted_at: string
          thursday_first_choice: string | null
          thursday_second_choice: string | null
          thursday_third_choice: string | null
          tuesday_first_choice: string | null
          tuesday_second_choice: string | null
          tuesday_third_choice: string | null
          updated_at: string
          wednesday_first_choice: string | null
          wednesday_second_choice: string | null
          wednesday_third_choice: string | null
        }
        Insert: {
          friday_first_choice?: string | null
          friday_second_choice?: string | null
          friday_third_choice?: string | null
          id?: string
          monday_first_choice?: string | null
          monday_second_choice?: string | null
          monday_third_choice?: string | null
          student_id: string
          submitted_at?: string
          thursday_first_choice?: string | null
          thursday_second_choice?: string | null
          thursday_third_choice?: string | null
          tuesday_first_choice?: string | null
          tuesday_second_choice?: string | null
          tuesday_third_choice?: string | null
          updated_at?: string
          wednesday_first_choice?: string | null
          wednesday_second_choice?: string | null
          wednesday_third_choice?: string | null
        }
        Update: {
          friday_first_choice?: string | null
          friday_second_choice?: string | null
          friday_third_choice?: string | null
          id?: string
          monday_first_choice?: string | null
          monday_second_choice?: string | null
          monday_third_choice?: string | null
          student_id?: string
          submitted_at?: string
          thursday_first_choice?: string | null
          thursday_second_choice?: string | null
          thursday_third_choice?: string | null
          tuesday_first_choice?: string | null
          tuesday_second_choice?: string | null
          tuesday_third_choice?: string | null
          updated_at?: string
          wednesday_first_choice?: string | null
          wednesday_second_choice?: string | null
          wednesday_third_choice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferences_friday_first_choice_fkey"
            columns: ["friday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_friday_first_choice_fkey"
            columns: ["friday_first_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_friday_second_choice_fkey"
            columns: ["friday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_friday_second_choice_fkey"
            columns: ["friday_second_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_friday_third_choice_fkey"
            columns: ["friday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_friday_third_choice_fkey"
            columns: ["friday_third_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_monday_first_choice_fkey"
            columns: ["monday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_monday_first_choice_fkey"
            columns: ["monday_first_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_monday_second_choice_fkey"
            columns: ["monday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_monday_second_choice_fkey"
            columns: ["monday_second_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_monday_third_choice_fkey"
            columns: ["monday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_monday_third_choice_fkey"
            columns: ["monday_third_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_thursday_first_choice_fkey"
            columns: ["thursday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_thursday_first_choice_fkey"
            columns: ["thursday_first_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_thursday_second_choice_fkey"
            columns: ["thursday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_thursday_second_choice_fkey"
            columns: ["thursday_second_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_thursday_third_choice_fkey"
            columns: ["thursday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_thursday_third_choice_fkey"
            columns: ["thursday_third_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_tuesday_first_choice_fkey"
            columns: ["tuesday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_tuesday_first_choice_fkey"
            columns: ["tuesday_first_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_tuesday_second_choice_fkey"
            columns: ["tuesday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_tuesday_second_choice_fkey"
            columns: ["tuesday_second_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_tuesday_third_choice_fkey"
            columns: ["tuesday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_tuesday_third_choice_fkey"
            columns: ["tuesday_third_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_wednesday_first_choice_fkey"
            columns: ["wednesday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_wednesday_first_choice_fkey"
            columns: ["wednesday_first_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_wednesday_second_choice_fkey"
            columns: ["wednesday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_wednesday_second_choice_fkey"
            columns: ["wednesday_second_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "preferences_wednesday_third_choice_fkey"
            columns: ["wednesday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_wednesday_third_choice_fkey"
            columns: ["wednesday_third_choice"]
            isOneToOne: false
            referencedRelation: "teacher_students"
            referencedColumns: ["activity_id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          banned?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          banned?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      teacher_students: {
        Row: {
          activity_id: string | null
          activity_title: string | null
          day_of_week: string | null
          student_email: string | null
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_moderator: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      allocation_status: "pending" | "allocated" | "waitlisted"
      user_role: "student" | "moderator" | "admin" | "teacher"
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
    Enums: {
      allocation_status: ["pending", "allocated", "waitlisted"],
      user_role: ["student", "moderator", "admin", "teacher"],
    },
  },
} as const
