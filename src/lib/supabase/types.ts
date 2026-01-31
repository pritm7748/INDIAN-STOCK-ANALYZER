// src/lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          telegram_chat_id: string | null
          telegram_username: string | null
          telegram_connection_token: string | null
          notification_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          telegram_chat_id?: string | null
          telegram_username?: string | null
          telegram_connection_token?: string | null
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          telegram_chat_id?: string | null
          telegram_username?: string | null
          telegram_connection_token?: string | null
          notification_preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string
          icon: string
          is_default: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          description?: string | null
          color?: string
          icon?: string
          is_default?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string
          icon?: string
          is_default?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          id: string
          watchlist_id: string
          user_id: string
          symbol: string
          added_price: number | null
          notes: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          watchlist_id: string
          user_id: string
          symbol: string
          added_price?: number | null
          notes?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          watchlist_id?: string
          user_id?: string
          symbol?: string
          added_price?: number | null
          notes?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          symbol: string
          stock_name: string | null
          alert_type: string
          condition: Json
          notification_channels: string[]
          is_active: boolean
          is_triggered: boolean
          is_recurring: boolean
          triggered_at: string | null
          triggered_value: number | null
          last_checked_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symbol: string
          stock_name?: string | null
          alert_type: string
          condition: Json
          notification_channels?: string[]
          is_active?: boolean
          is_triggered?: boolean
          is_recurring?: boolean
          triggered_at?: string | null
          triggered_value?: number | null
          last_checked_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          stock_name?: string | null
          alert_type?: string
          condition?: Json
          notification_channels?: string[]
          is_active?: boolean
          is_triggered?: boolean
          is_recurring?: boolean
          triggered_at?: string | null
          triggered_value?: number | null
          last_checked_at?: string | null
          expires_at?: string | null
        }
        Relationships: []
      }
      alert_history: {
        Row: {
          id: string
          alert_id: string | null
          user_id: string
          symbol: string
          alert_type: string
          condition: Json
          triggered_value: number | null
          message: string | null
          notification_sent_to: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          alert_id?: string | null
          user_id: string
          symbol: string
          alert_type: string
          condition: Json
          triggered_value?: number | null
          message?: string | null
          notification_sent_to?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          alert_id?: string | null
          user_id?: string
          symbol?: string
          alert_type?: string
          condition?: Json
          triggered_value?: number | null
          message?: string | null
          notification_sent_to?: string[] | null
        }
        Relationships: []
      }
      analysis_history: {
        Row: {
          id: string
          user_id: string
          symbol: string
          stock_name: string | null
          timeframe: string
          score: number | null
          recommendation: string | null
          price: number | null
          analyzed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symbol: string
          stock_name?: string | null
          timeframe: string
          score?: number | null
          recommendation?: string | null
          price?: number | null
          analyzed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          stock_name?: string | null
          timeframe?: string
          score?: number | null
          recommendation?: string | null
          price?: number | null
          analyzed_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          keys: Json
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          keys: Json
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          keys?: Json
          user_agent?: string | null
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
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Watchlist = Database['public']['Tables']['watchlists']['Row']
export type WatchlistInsert = Database['public']['Tables']['watchlists']['Insert']
export type WatchlistUpdate = Database['public']['Tables']['watchlists']['Update']

export type WatchlistItem = Database['public']['Tables']['watchlist_items']['Row']
export type WatchlistItemInsert = Database['public']['Tables']['watchlist_items']['Insert']

export type Alert = Database['public']['Tables']['alerts']['Row']
export type AlertInsert = Database['public']['Tables']['alerts']['Insert']

export type AlertHistory = Database['public']['Tables']['alert_history']['Row']
export type AnalysisHistory = Database['public']['Tables']['analysis_history']['Row']
export type AnalysisHistoryInsert = Database['public']['Tables']['analysis_history']['Insert']

// Extended types with relations
export type WatchlistWithItems = Watchlist & {
  items: WatchlistItem[]
}

// Notification preferences type
export interface NotificationPreferences {
  email: boolean
  telegram: boolean
  browser_push: boolean
  in_app: boolean
}