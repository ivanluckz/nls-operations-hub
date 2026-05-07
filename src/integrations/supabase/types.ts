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
          days_of_week: string[]
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
          days_of_week?: string[]
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
          days_of_week?: string[]
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
      activity_mentions: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          mentioned_user_id: string
          message_id: string
          read_at: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
          message_id: string
          read_at?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
          message_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_mentions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "activity_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_messages: {
        Row: {
          activity_id: string
          content: string
          created_at: string
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          sender_id: string
        }
        Insert: {
          activity_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          sender_id: string
        }
        Update: {
          activity_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_audit_log: {
        Row: {
          allocations_created: number | null
          completed_at: string | null
          error_message: string | null
          id: string
          started_at: string
          status: string
          triggered_by: string
          validation_errors: number | null
        }
        Insert: {
          allocations_created?: number | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string
          status: string
          triggered_by: string
          validation_errors?: number | null
        }
        Update: {
          allocations_created?: number | null
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
          validation_errors?: number | null
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
          slot_number: number
          status: Database["public"]["Enums"]["allocation_status"]
          student_id: string
        }
        Insert: {
          activity_id: string
          allocated_at?: string
          day_of_week?: string
          id?: string
          preference_rank: number
          slot_number?: number
          status?: Database["public"]["Enums"]["allocation_status"]
          student_id: string
        }
        Update: {
          activity_id?: string
          allocated_at?: string
          day_of_week?: string
          id?: string
          preference_rank?: number
          slot_number?: number
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
        ]
      }
      attendance_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          activity_id: string
          id: string
          notes: string | null
          notified_at: string | null
          session_id: string
          status: string
          student_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          activity_id: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          session_id: string
          status: string
          student_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          activity_id?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          session_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_notifications_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          id: string
          marked_at: string
          marked_by: string
          session_id: string
          status: string
          student_id: string
        }
        Insert: {
          id?: string
          marked_at?: string
          marked_by: string
          session_id: string
          status?: string
          student_id: string
        }
        Update: {
          id?: string
          marked_at?: string
          marked_by?: string
          session_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          activity_id: string
          created_at: string
          day_of_week: string
          finalized_at: string | null
          id: string
          session_date: string
          slot_number: number
          status: string
          teacher_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          day_of_week: string
          finalized_at?: string | null
          id?: string
          session_date: string
          slot_number: number
          status?: string
          teacher_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          day_of_week?: string
          finalized_at?: string | null
          id?: string
          session_date?: string
          slot_number?: number
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_streaks: {
        Row: {
          current_streak: number
          id: string
          last_recorded_date: string | null
          longest_streak: number
          streak_type: string
          student_id: string
          updated_at: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_recorded_date?: string | null
          longest_streak?: number
          streak_type: string
          student_id: string
          updated_at?: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_recorded_date?: string | null
          longest_streak?: number
          streak_type?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_streaks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_requests: {
        Row: {
          badge_name: string
          created_at: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
          target_admin_id: string | null
        }
        Insert: {
          badge_name: string
          created_at?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
          target_admin_id?: string | null
        }
        Update: {
          badge_name?: string
          created_at?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
          target_admin_id?: string | null
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          invited_at: string
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          activity_id: string | null
          call_type: string
          context_type: string
          dm_channel_id: string | null
          ended_at: string | null
          id: string
          initiator_id: string
          started_at: string
          status: string
        }
        Insert: {
          activity_id?: string | null
          call_type?: string
          context_type: string
          dm_channel_id?: string | null
          ended_at?: string | null
          id?: string
          initiator_id: string
          started_at?: string
          status?: string
        }
        Update: {
          activity_id?: string | null
          call_type?: string
          context_type?: string
          dm_channel_id?: string | null
          ended_at?: string | null
          id?: string
          initiator_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_dm_channel_id_fkey"
            columns: ["dm_channel_id"]
            isOneToOne: false
            referencedRelation: "dm_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          audio_duration_ms: number | null
          audio_url: string | null
          channel_id: string
          content: string | null
          created_at: string | null
          edited_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          channel_id: string
          content?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          channel_id?: string
          content?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "dm_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_channels: {
        Row: {
          created_at: string | null
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      dm_message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      houses: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      meal_attendance: {
        Row: {
          created_at: string
          house_id: string | null
          id: string
          meal_date: string
          meal_type: string
          scanned_at: string
          scanned_by: string
          student_id: string
        }
        Insert: {
          created_at?: string
          house_id?: string | null
          id?: string
          meal_date?: string
          meal_type: string
          scanned_at?: string
          scanned_by: string
          student_id: string
        }
        Update: {
          created_at?: string
          house_id?: string | null
          id?: string
          meal_date?: string
          meal_type?: string
          scanned_at?: string
          scanned_by?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_attendance_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_visits: {
        Row: {
          condition: string
          created_at: string
          id: string
          medical_staff_id: string
          notes: string | null
          scanned_at: string
          student_id: string
          treatment: string | null
          visit_date: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: string
          medical_staff_id: string
          notes?: string | null
          scanned_at?: string
          student_id: string
          treatment?: string | null
          visit_date?: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          medical_staff_id?: string
          notes?: string | null
          scanned_at?: string
          student_id?: string
          treatment?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "activity_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          friday_fifth_choice: string | null
          friday_first_choice: string | null
          friday_fourth_choice: string | null
          friday_second_choice: string | null
          friday_third_choice: string | null
          id: string
          monday_fifth_choice: string | null
          monday_first_choice: string | null
          monday_fourth_choice: string | null
          monday_second_choice: string | null
          monday_third_choice: string | null
          student_id: string
          submitted_at: string
          thursday_fifth_choice: string | null
          thursday_first_choice: string | null
          thursday_fourth_choice: string | null
          thursday_second_choice: string | null
          thursday_third_choice: string | null
          tuesday_fifth_choice: string | null
          tuesday_first_choice: string | null
          tuesday_fourth_choice: string | null
          tuesday_second_choice: string | null
          tuesday_third_choice: string | null
          updated_at: string
          wednesday_slot1_fifth_choice: string | null
          wednesday_slot1_first_choice: string | null
          wednesday_slot1_fourth_choice: string | null
          wednesday_slot1_second_choice: string | null
          wednesday_slot1_third_choice: string | null
          wednesday_slot2_fifth_choice: string | null
          wednesday_slot2_first_choice: string | null
          wednesday_slot2_fourth_choice: string | null
          wednesday_slot2_second_choice: string | null
          wednesday_slot2_third_choice: string | null
        }
        Insert: {
          friday_fifth_choice?: string | null
          friday_first_choice?: string | null
          friday_fourth_choice?: string | null
          friday_second_choice?: string | null
          friday_third_choice?: string | null
          id?: string
          monday_fifth_choice?: string | null
          monday_first_choice?: string | null
          monday_fourth_choice?: string | null
          monday_second_choice?: string | null
          monday_third_choice?: string | null
          student_id: string
          submitted_at?: string
          thursday_fifth_choice?: string | null
          thursday_first_choice?: string | null
          thursday_fourth_choice?: string | null
          thursday_second_choice?: string | null
          thursday_third_choice?: string | null
          tuesday_fifth_choice?: string | null
          tuesday_first_choice?: string | null
          tuesday_fourth_choice?: string | null
          tuesday_second_choice?: string | null
          tuesday_third_choice?: string | null
          updated_at?: string
          wednesday_slot1_fifth_choice?: string | null
          wednesday_slot1_first_choice?: string | null
          wednesday_slot1_fourth_choice?: string | null
          wednesday_slot1_second_choice?: string | null
          wednesday_slot1_third_choice?: string | null
          wednesday_slot2_fifth_choice?: string | null
          wednesday_slot2_first_choice?: string | null
          wednesday_slot2_fourth_choice?: string | null
          wednesday_slot2_second_choice?: string | null
          wednesday_slot2_third_choice?: string | null
        }
        Update: {
          friday_fifth_choice?: string | null
          friday_first_choice?: string | null
          friday_fourth_choice?: string | null
          friday_second_choice?: string | null
          friday_third_choice?: string | null
          id?: string
          monday_fifth_choice?: string | null
          monday_first_choice?: string | null
          monday_fourth_choice?: string | null
          monday_second_choice?: string | null
          monday_third_choice?: string | null
          student_id?: string
          submitted_at?: string
          thursday_fifth_choice?: string | null
          thursday_first_choice?: string | null
          thursday_fourth_choice?: string | null
          thursday_second_choice?: string | null
          thursday_third_choice?: string | null
          tuesday_fifth_choice?: string | null
          tuesday_first_choice?: string | null
          tuesday_fourth_choice?: string | null
          tuesday_second_choice?: string | null
          tuesday_third_choice?: string | null
          updated_at?: string
          wednesday_slot1_fifth_choice?: string | null
          wednesday_slot1_first_choice?: string | null
          wednesday_slot1_fourth_choice?: string | null
          wednesday_slot1_second_choice?: string | null
          wednesday_slot1_third_choice?: string | null
          wednesday_slot2_fifth_choice?: string | null
          wednesday_slot2_first_choice?: string | null
          wednesday_slot2_fourth_choice?: string | null
          wednesday_slot2_second_choice?: string | null
          wednesday_slot2_third_choice?: string | null
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
            foreignKeyName: "preferences_friday_second_choice_fkey"
            columns: ["friday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_friday_third_choice_fkey"
            columns: ["friday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_monday_first_choice_fkey"
            columns: ["monday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_monday_second_choice_fkey"
            columns: ["monday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_monday_third_choice_fkey"
            columns: ["monday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_thursday_first_choice_fkey"
            columns: ["thursday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_thursday_second_choice_fkey"
            columns: ["thursday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_thursday_third_choice_fkey"
            columns: ["thursday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_tuesday_first_choice_fkey"
            columns: ["tuesday_first_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_tuesday_second_choice_fkey"
            columns: ["tuesday_second_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_tuesday_third_choice_fkey"
            columns: ["tuesday_third_choice"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          created_at: string
          email: string
          full_name: string
          house_id: string | null
          id: string
          mentor_id: string | null
          student_class: string | null
          updated_at: string
          workout_location: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          email: string
          full_name: string
          house_id?: string | null
          id: string
          mentor_id?: string | null
          student_class?: string | null
          updated_at?: string
          workout_location?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          email?: string
          full_name?: string
          house_id?: string | null
          id?: string
          mentor_id?: string | null
          student_class?: string | null
          updated_at?: string
          workout_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      streak_milestones: {
        Row: {
          achieved_at: string
          id: string
          milestone_type: string
          streak_type: string
          student_id: string
        }
        Insert: {
          achieved_at?: string
          id?: string
          milestone_type: string
          streak_type: string
          student_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          milestone_type?: string
          streak_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_milestones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: Json | null
          id: string
          reason: string
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      theme_likes: {
        Row: {
          created_at: string
          id: string
          theme_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          theme_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          theme_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_likes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "user_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          awarded_by: string | null
          badge_name: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_name: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          created_at: string
          css_url: string
          description: string | null
          id: string
          install_count: number
          is_active: boolean | null
          is_public: boolean
          js_url: string | null
          like_count: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          css_url: string
          description?: string | null
          id?: string
          install_count?: number
          is_active?: boolean | null
          is_public?: boolean
          js_url?: string | null
          like_count?: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          css_url?: string
          description?: string | null
          id?: string
          install_count?: number
          is_active?: boolean | null
          is_public?: boolean
          js_url?: string | null
          like_count?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_attendance: {
        Row: {
          created_at: string
          id: string
          location: string
          scanned_at: string
          scanned_by: string
          status: string
          student_id: string
          workout_date: string
          workout_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location: string
          scanned_at?: string
          scanned_by: string
          status?: string
          student_id: string
          workout_date?: string
          workout_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          scanned_at?: string
          scanned_by?: string
          status?: string
          student_id?: string
          workout_date?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_attendance_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_clearances: {
        Row: {
          cleared_by: string
          created_at: string
          id: string
          restriction_reason: string | null
          status: string
          student_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          cleared_by: string
          created_at?: string
          id?: string
          restriction_reason?: string | null
          status?: string
          student_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          cleared_by?: string
          created_at?: string
          id?: string
          restriction_reason?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_clearances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          notes: string | null
          notified_at: string | null
          status: string
          student_id: string
          workout_date: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          status?: string
          student_id: string
          workout_date: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          status?: string
          student_id?: string
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_signups: {
        Row: {
          created_at: string
          id: string
          student_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_signups_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_teachers: {
        Row: {
          created_at: string
          id: string
          teacher_id: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          teacher_id: string
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          teacher_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_teachers_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          capacity: number
          created_at: string
          created_by: string
          days_of_week: string[]
          description: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          created_by: string
          days_of_week?: string[]
          description?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string
          days_of_week?: string[]
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_theme_install_count: {
        Args: { _theme_id: string }
        Returns: undefined
      }
      can_access_call: {
        Args: { _call_id: string; _user_id: string }
        Returns: boolean
      }
      count_allocated_students: { Args: never; Returns: number }
      get_profile_email: { Args: { _user_id: string }; Returns: string }
      get_profile_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_teacher_students: {
        Args: { teacher_user_id: string }
        Returns: {
          activity_id: string
          activity_title: string
          day_of_week: string
          student_email: string
          student_id: string
          student_name: string
          teacher_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_medical: { Args: { _user_id: string }; Returns: boolean }
      is_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_rl_coach: { Args: { _user_id: string }; Returns: boolean }
      search_users_for_dm: {
        Args: { _query: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
    }
    Enums: {
      allocation_status: "pending" | "allocated" | "waitlisted"
      app_role:
        | "student"
        | "moderator"
        | "admin"
        | "teacher"
        | "kitchen_staff"
        | "rl_coach"
        | "medical"
      message_type: "announcement" | "discussion"
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
      app_role: [
        "student",
        "moderator",
        "admin",
        "teacher",
        "kitchen_staff",
        "rl_coach",
        "medical",
      ],
      message_type: ["announcement", "discussion"],
      user_role: ["student", "moderator", "admin", "teacher"],
    },
  },
} as const
