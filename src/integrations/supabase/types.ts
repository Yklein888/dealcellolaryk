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
      call_logs: {
        Row: {
          call_message: string | null
          call_status: string
          call_type: string
          campaign_id: string | null
          created_at: string
          customer_id: string | null
          customer_phone: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          call_message?: string | null
          call_status?: string
          call_type?: string
          campaign_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_phone: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          call_message?: string | null
          call_status?: string
          call_type?: string
          campaign_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_phone?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
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
          barcode: string | null
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
          barcode?: string | null
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
          barcode?: string | null
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
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_secure"
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
            foreignKeyName: "overdue_charges_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_secure"
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
      pending_users: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          sale_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          sale_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          sale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_audit_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_products: {
        Row: {
          category: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pos_sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pos_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          cash_change: number | null
          cash_received: number | null
          cashier_id: string
          completed_at: string | null
          created_at: string
          id: string
          payment_method: string | null
          payment_reference: string | null
          sale_number: number
          status: Database["public"]["Enums"]["pos_sale_status"]
          total_amount: number
          updated_at: string
          ypay_document_number: string | null
          ypay_document_type: string | null
          ypay_document_url: string | null
        }
        Insert: {
          cash_change?: number | null
          cash_received?: number | null
          cashier_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          sale_number?: number
          status?: Database["public"]["Enums"]["pos_sale_status"]
          total_amount?: number
          updated_at?: string
          ypay_document_number?: string | null
          ypay_document_type?: string | null
          ypay_document_url?: string | null
        }
        Update: {
          cash_change?: number | null
          cash_received?: number | null
          cashier_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          sale_number?: number
          status?: Database["public"]["Enums"]["pos_sale_status"]
          total_amount?: number
          updated_at?: string
          ypay_document_number?: string | null
          ypay_document_type?: string | null
          ypay_document_url?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_secure"
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
      sim_cards: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          is_active: boolean | null
          is_rented: boolean | null
          israeli_number: string | null
          last_synced: string | null
          local_number: string | null
          notes: string | null
          package_name: string | null
          short_number: string | null
          sim_number: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          is_rented?: boolean | null
          israeli_number?: string | null
          last_synced?: string | null
          local_number?: string | null
          notes?: string | null
          package_name?: string | null
          short_number?: string | null
          sim_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          is_rented?: boolean | null
          israeli_number?: string | null
          last_synced?: string | null
          local_number?: string | null
          notes?: string | null
          package_name?: string | null
          short_number?: string | null
          sim_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          browser: string | null
          created_at: string
          device_fingerprint: string
          device_name: string | null
          id: string
          is_approved: boolean
          last_used_at: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          device_name?: string | null
          id?: string
          is_approved?: boolean
          last_used_at?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          device_name?: string | null
          id?: string
          is_approved?: boolean
          last_used_at?: string | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_approved: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_approved?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_approved?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_webauthn_credentials: {
        Row: {
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customers_secure: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          notes: string | null
          payment_token_expiry: string | null
          payment_token_last4: string | null
          payment_token_updated_at: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          payment_token_expiry?: string | null
          payment_token_last4?: string | null
          payment_token_updated_at?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          payment_token_expiry?: string | null
          payment_token_last4?: string | null
          payment_token_updated_at?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      customer_has_payment_token: {
        Args: { customer_id: string }
        Returns: boolean
      }
      get_customer_payment_token: {
        Args: { customer_id: string }
        Returns: {
          expiry: string
          last4: string
          token: string
        }[]
      }
      get_stock_items: {
        Args: never
        Returns: {
          barcode: string | null
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
        }[]
        SetofOptions: {
          from: "*"
          to: "inventory"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_device_approved: {
        Args: { _fingerprint: string; _user_id: string }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      register_device: {
        Args: {
          _browser?: string
          _device_name?: string
          _fingerprint: string
          _os?: string
          _user_id: string
        }
        Returns: boolean
      }
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
        | "device_simple_europe"
      item_status: "available" | "rented" | "maintenance"
      payment_status: "pending" | "success" | "failed" | "declined"
      pos_sale_status:
        | "created"
        | "awaiting_payment"
        | "payment_approved"
        | "document_generated"
        | "completed"
        | "failed"
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
        "device_simple_europe",
      ],
      item_status: ["available", "rented", "maintenance"],
      payment_status: ["pending", "success", "failed", "declined"],
      pos_sale_status: [
        "created",
        "awaiting_payment",
        "payment_approved",
        "document_generated",
        "completed",
        "failed",
      ],
      rental_status: ["active", "overdue", "returned"],
      repair_status: ["in_lab", "ready", "collected"],
    },
  },
} as const
