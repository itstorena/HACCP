export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type StaffRole = 'chef' | 'cook' | 'cleaner' | 'manager'
export type RiskLevel = 'high' | 'medium' | 'low'
export type BlastCycleType = 'positive_3c' | 'negative_18c'
export type BatchStatus = 'valid' | 'blocked' | 'used' | 'discarded'
export type EquipmentType = 'fridge' | 'freezer' | 'blast_chiller' | 'hot_holding' | 'probe' | 'other'
export type OperationalCheckType = 'cleaning' | 'oil_quality' | 'pest_control' | 'allergen_control' | 'maintenance' | 'training' | 'generic'
export type NonConformitySource = 'receiving' | 'blast_chiller' | 'temperature' | 'cleaning' | 'lot' | 'allergen' | 'pest' | 'maintenance' | 'other'
export type NonConformitySeverity = 'low' | 'medium' | 'high' | 'critical'
export type NonConformityStatus = 'open' | 'in_progress' | 'closed' | 'void'

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
          role: StaffRole
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          avatar_url?: string | null
          pin_hash: string
          role?: StaffRole
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          avatar_url?: string | null
          pin_hash?: string
          role?: StaffRole
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
          document_number: string | null
          delivery_date: string
          expiry_date: string
          received_temp: number | null
          packaging_ok: boolean
          label_ok: boolean
          accepted: boolean
          rejection_reason: string | null
          photo_url: string | null
          risk_level: RiskLevel
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
          document_number?: string | null
          delivery_date?: string
          expiry_date: string
          received_temp?: number | null
          packaging_ok?: boolean
          label_ok?: boolean
          accepted?: boolean
          rejection_reason?: string | null
          photo_url?: string | null
          risk_level?: RiskLevel
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
          document_number?: string | null
          delivery_date?: string
          expiry_date?: string
          received_temp?: number | null
          packaging_ok?: boolean
          label_ok?: boolean
          accepted?: boolean
          rejection_reason?: string | null
          photo_url?: string | null
          risk_level?: RiskLevel
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
          source_supplier_batch_ids: string[]
          allergen_notes: string | null
          shelf_life_hours: number | null
          batch_status: BatchStatus
          quantity: number | null
          unit: string | null
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
          source_supplier_batch_ids?: string[]
          allergen_notes?: string | null
          shelf_life_hours?: number | null
          batch_status?: BatchStatus
          quantity?: number | null
          unit?: string | null
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
          source_supplier_batch_ids?: string[]
          allergen_notes?: string | null
          shelf_life_hours?: number | null
          batch_status?: BatchStatus
          quantity?: number | null
          unit?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      blast_chiller_logs: {
        Row: {
          id: string
          internal_batch_id: string | null
          profile_id: string | null
          cycle_type: BlastCycleType
          product_category: string | null
          start_time: string
          end_time: string | null
          start_temp: number
          end_temp: number | null
          target_time_minutes: number
          probe_code: string | null
          quantity: number | null
          unit: string | null
          is_compliant: boolean
          corrective_action: string | null
          operator_id: string | null
          verified_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          internal_batch_id?: string | null
          profile_id?: string | null
          cycle_type: BlastCycleType
          product_category?: string | null
          start_time?: string
          end_time?: string | null
          start_temp: number
          end_temp?: number | null
          target_time_minutes: number
          probe_code?: string | null
          quantity?: number | null
          unit?: string | null
          is_compliant?: boolean
          corrective_action?: string | null
          operator_id?: string | null
          verified_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          internal_batch_id?: string | null
          profile_id?: string | null
          cycle_type?: BlastCycleType
          product_category?: string | null
          start_time?: string
          end_time?: string | null
          start_temp?: number
          end_temp?: number | null
          target_time_minutes?: number
          probe_code?: string | null
          quantity?: number | null
          unit?: string | null
          is_compliant?: boolean
          corrective_action?: string | null
          operator_id?: string | null
          verified_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      blast_chiller_profiles: {
        Row: {
          id: string
          code: string
          label: string
          cycle_type: BlastCycleType
          product_category: string
          target_temp: number
          target_time_minutes: number
          min_start_temp: number | null
          legal_reference: string | null
          notes: string | null
          is_default: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          label: string
          cycle_type: BlastCycleType
          product_category?: string
          target_temp: number
          target_time_minutes: number
          min_start_temp?: number | null
          legal_reference?: string | null
          notes?: string | null
          is_default?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['blast_chiller_profiles']['Insert']>
      }
      equipment: {
        Row: {
          id: string
          name: string
          equipment_type: EquipmentType
          location: string | null
          min_temp: number | null
          max_temp: number | null
          check_frequency_hours: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          equipment_type: EquipmentType
          location?: string | null
          min_temp?: number | null
          max_temp?: number | null
          check_frequency_hours?: number
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['equipment']['Insert']>
      }
      temperature_logs: {
        Row: {
          id: string
          equipment_id: string | null
          equipment_name: string
          temperature: number
          min_threshold: number | null
          max_threshold: number | null
          is_compliant: boolean
          corrective_action: string | null
          notes: string | null
          recorded_by: string | null
          recorded_at: string
        }
        Insert: {
          id?: string
          equipment_id?: string | null
          equipment_name: string
          temperature: number
          min_threshold?: number | null
          max_threshold?: number | null
          is_compliant?: boolean
          corrective_action?: string | null
          notes?: string | null
          recorded_by?: string | null
          recorded_at?: string
        }
        Update: {
          id?: string
          equipment_id?: string | null
          equipment_name?: string
          temperature?: number
          min_threshold?: number | null
          max_threshold?: number | null
          is_compliant?: boolean
          corrective_action?: string | null
          notes?: string | null
          recorded_by?: string | null
          recorded_at?: string
        }
      }
      operational_checks: {
        Row: {
          id: string
          check_type: OperationalCheckType
          area: string
          item: string
          expected_result: string | null
          actual_result: string | null
          is_compliant: boolean
          corrective_action: string | null
          checked_by: string | null
          checked_at: string
          created_at: string
        }
        Insert: {
          id?: string
          check_type: OperationalCheckType
          area: string
          item: string
          expected_result?: string | null
          actual_result?: string | null
          is_compliant?: boolean
          corrective_action?: string | null
          checked_by?: string | null
          checked_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['operational_checks']['Insert']>
      }
      internal_batch_ingredients: {
        Row: {
          id: string
          internal_batch_id: string | null
          supplier_batch_id: string | null
          ingredient_name: string
          quantity: number | null
          unit: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          internal_batch_id?: string | null
          supplier_batch_id?: string | null
          ingredient_name: string
          quantity?: number | null
          unit?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['internal_batch_ingredients']['Insert']>
      }
      haccp_plan_items: {
        Row: {
          id: string
          code: string
          area: string
          process_step: string
          hazard: string
          control_measure: string
          critical_limit: string
          monitoring_frequency: string
          corrective_action: string
          owner_role: StaffRole
          is_ccp: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          area: string
          process_step: string
          hazard: string
          control_measure: string
          critical_limit: string
          monitoring_frequency: string
          corrective_action: string
          owner_role?: StaffRole
          is_ccp?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['haccp_plan_items']['Insert']>
      }
      non_conformities: {
        Row: {
          id: string
          source_type: NonConformitySource
          severity: NonConformitySeverity
          status: NonConformityStatus
          title: string
          description: string
          detected_at: string
          detected_by: string | null
          related_table: string | null
          related_id: string | null
          immediate_action: string | null
          corrective_action: string | null
          preventive_action: string | null
          closed_at: string | null
          closed_by: string | null
          manager_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          source_type: NonConformitySource
          severity?: NonConformitySeverity
          status?: NonConformityStatus
          title: string
          description: string
          detected_at?: string
          detected_by?: string | null
          related_table?: string | null
          related_id?: string | null
          immediate_action?: string | null
          corrective_action?: string | null
          preventive_action?: string | null
          closed_at?: string | null
          closed_by?: string | null
          manager_notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['non_conformities']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string | null
          action: 'insert' | 'update' | 'delete' | 'login' | 'report' | 'print'
          actor_id: string | null
          actor_label: string | null
          before_data: Json | null
          after_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id?: string | null
          action: 'insert' | 'update' | 'delete' | 'login' | 'report' | 'print'
          actor_id?: string | null
          actor_label?: string | null
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      role_type: StaffRole
      risk_level_type: RiskLevel
      cycle_type: BlastCycleType
    }
  }
}
