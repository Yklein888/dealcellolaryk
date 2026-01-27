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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_card: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_token: string | null
          payment_token_expiry: string | null
          payment_token_last4: string | null
          payment_token_updated_at: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_card?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_token?: string | null
          payment_token_expiry?: string | null
          payment_token_last4?: string | null
          payment_token_updated_at?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_card?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_token?: string | null
          payment_token_expiry?: string | null
          payment_token_last4?: string | null
          payment_token_updated_at?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          expiry_date: string | null
          id: string
          israeli_number: string | null
          local_number: string | null
          name: string
          notes: string | null
          sim_number: string | null
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          created_at?: string
          expiry_date?: string | null
          id?: string
          israeli_number?: string | null
          local_number?: string | null
          name: string
          notes?: string | null
          sim_number?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          expiry_date?: string | null
          id?: string
          israeli_number?: string | null
          local_number?: string | null
          name?: string
          notes?: string | null
          sim_number?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          business_id: string
          business_name: string
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string
          description: string | null
          id: string
          invoice_number: number
          issued_at: string
          rental_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          business_id?: string
          business_name?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name: string
          description?: string | null
          id?: string
          invoice_number?: number
          issued_at?: string
          rental_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          business_name?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          id?: string
          invoice_number?: number
          issued_at?: string
          rental_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      overdue_charges: {
        Row: {
          amount: number
          charge_date: string
          created_at: string
          currency: string
          customer_id: string | null
          days_overdue: number
          error_message: string | null
          id: string
          rental_id: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          charge_date: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          days_overdue: number
          error_message?: string | null
          id?: string
          rental_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_date?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          days_overdue?: number
          error_message?: string | null
          id?: string
          rental_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "overdue_charges_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overdue_charges_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overdue_charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_name: string | null
          error_message: string | null
          gateway_response: Json | null
          id: string
          rental_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_name?: string | null
          error_message?: string | null
          gateway_response?: Json | null
          id?: string
          rental_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_name?: string | null
          error_message?: string | null
          gateway_response?: Json | null
          id?: string
          rental_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_items: {
        Row: {
          created_at: string
          has_israeli_number: boolean | null
          id: string
          inventory_item_id: string | null
          is_generic: boolean | null
          item_category: Database["public"]["Enums"]["item_category"]
          item_name: string
          price_per_day: number | null
          rental_id: string
        }
        Insert: {
          created_at?: string
          has_israeli_number?: boolean | null
          id?: string
          inventory_item_id?: string | null
          is_generic?: boolean | null
          item_category: Database["public"]["Enums"]["item_category"]
          item_name: string
          price_per_day?: number | null
          rental_id: string
        }
        Update: {
          created_at?: string
          has_israeli_number?: boolean | null
          id?: string
          inventory_item_id?: string | null
          is_generic?: boolean | null
          item_category?: Database["public"]["Enums"]["item_category"]
          item_name?: string
          price_per_day?: number | null
          rental_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_items_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          auto_charge_enabled: boolean | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string
          deposit: number | null
          end_date: string
          id: string
          notes: string | null
          overdue_daily_rate: number | null
          overdue_grace_days: number | null
          start_date: string
          status: Database["public"]["Enums"]["rental_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          auto_charge_enabled?: boolean | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name: string
          deposit?: number | null
          end_date: string
          id?: string
          notes?: string | null
          overdue_daily_rate?: number | null
          overdue_grace_days?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          auto_charge_enabled?: boolean | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string
          deposit?: number | null
          end_date?: string
          id?: string
          notes?: string | null
          overdue_daily_rate?: number | null
          overdue_grace_days?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          collected_date: string | null
          completed_date: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          device_cost: number | null
          device_model: string | null
          device_type: string
          id: string
          is_warranty: boolean | null
          notes: string | null
          problem_description: string
          received_date: string
          repair_number: string
          status: Database["public"]["Enums"]["repair_status"]
          updated_at: string
        }
        Insert: {
          collected_date?: string | null
          completed_date?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          device_cost?: number | null
          device_model?: string | null
          device_type: string
          id?: string
          is_warranty?: boolean | null
          notes?: string | null
          problem_description: string
          received_date?: string
          repair_number: string
          status?: Database["public"]["Enums"]["repair_status"]
          updated_at?: string
        }
        Update: {
          collected_date?: string | null
          completed_date?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          device_cost?: number | null
          device_model?: string | null
          device_type?: string
          id?: string
          is_warranty?: boolean | null
          notes?: string | null
          problem_description?: string
          received_date?: string
          repair_number?: string
          status?: Database["public"]["Enums"]["repair_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      item_category:
        | "sim_american"
        | "sim_european"
        | "device_simple"
        | "device_smartphone"
        | "modem"
        | "netstick"
      item_status: "available" | "rented" | "maintenance"
      payment_status: "pending" | "success" | "failed" | "declined"
      rental_status: "active" | "overdue" | "returned"
      repair_status: "in_lab" | "ready" | "collected"
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
      app_role: ["admin", "user"],
      item_category: [
        "sim_american",
        "sim_european",
        "device_simple",
        "device_smartphone",
        "modem",
        "netstick",
      ],
      item_status: ["available", "rented", "maintenance"],
      payment_status: ["pending", "success", "failed", "declined"],
      rental_status: ["active", "overdue", "returned"],
      repair_status: ["in_lab", "ready", "collected"],
    },
  },
} as const
