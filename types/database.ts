export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      staff_members: {
        Row: {
          id: string
          first_name: string
          last_name: string
          avatar_url: string | null
          pin_hash: string
          role: 'chef' | 'cook' | 'cleaner' | 'manager'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          avatar_url?: string | null
          pin_hash: string
          role?: 'chef' | 'cook' | 'cleaner' | 'manager'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          avatar_url?: string | null
          pin_hash?: string
          role?: 'chef' | 'cook' | 'cleaner' | 'manager'
          is_active?: boolean
          created_at?: string
        }
      }
      supplier_batches: {
        Row: {
          id: string
          product_name: string
          supplier_name: string
          original_lot_code: string | null
          delivery_date: string
          expiry_date: string
          risk_level: 'high' | 'medium' | 'low'
          is_compliant: boolean
          registered_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_name: string
          supplier_name: string
          original_lot_code?: string | null
          delivery_date?: string
          expiry_date: string
          risk_level?: 'high' | 'medium' | 'low'
          is_compliant?: boolean
          registered_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_name?: string
          supplier_name?: string
          original_lot_code?: string | null
          delivery_date?: string
          expiry_date?: string
          risk_level?: 'high' | 'medium' | 'low'
          is_compliant?: boolean
          registered_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      internal_batches: {
        Row: {
          id: string
          name: string
          description: string | null
          prepared_at: string
          expires_at: string
          qr_code_token: string
          prepared_by: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          prepared_at?: string
          expires_at: string
          qr_code_token?: string
          prepared_by?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          prepared_at?: string
          expires_at?: string
          qr_code_token?: string
          prepared_by?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      blast_chiller_logs: {
        Row: {
          id: string
          internal_batch_id: string | null
          cycle_type: 'positive_3c' | 'negative_18c'
          start_time: string
          end_time: string | null
          start_temp: number
          end_temp: number | null
          target_time_minutes: number
          is_compliant: boolean
          corrective_action: string | null
          operator_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          internal_batch_id?: string | null
          cycle_type: 'positive_3c' | 'negative_18c'
          start_time?: string
          end_time?: string | null
          start_temp: number
          end_temp?: number | null
          target_time_minutes: number
          is_compliant?: boolean
          corrective_action?: string | null
          operator_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          internal_batch_id?: string | null
          cycle_type?: 'positive_3c' | 'negative_18c'
          start_time?: string
          end_time?: string | null
          start_temp?: number
          end_temp?: number | null
          target_time_minutes?: number
          is_compliant?: boolean
          corrective_action?: string | null
          operator_id?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      temperature_logs: {
        Row: {
          id: string
          equipment_name: string
          temperature: number
          min_threshold: number | null
          max_threshold: number | null
          is_compliant: boolean
          recorded_by: string | null
          recorded_at: string
        }
        Insert: {
          id?: string
          equipment_name: string
          temperature: number
          min_threshold?: number | null
          max_threshold?: number | null
          is_compliant?: boolean
          recorded_by?: string | null
          recorded_at?: string
        }
        Update: {
          id?: string
          equipment_name?: string
          temperature?: number
          min_threshold?: number | null
          max_threshold?: number | null
          is_compliant?: boolean
          recorded_by?: string | null
          recorded_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      role_type: 'chef' | 'cook' | 'cleaner' | 'manager'
      risk_level_type: 'high' | 'medium' | 'low'
      cycle_type: 'positive_3c' | 'negative_18c'
    }
  }
}
