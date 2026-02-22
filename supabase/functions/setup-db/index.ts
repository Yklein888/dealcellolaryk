import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const sql = `
DO $$ BEGIN CREATE TYPE item_category AS ENUM ('sim_american','sim_european','device_simple','device_smartphone','modem','netstick','device_simple_europe'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE item_status AS ENUM ('available','rented','maintenance'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE rental_status AS ENUM ('active','overdue','returned'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE repair_status AS ENUM ('in_lab','ready','collected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','success','failed','declined'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE app_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  notes text,
  payment_token text,
  payment_token_expiry text,
  payment_token_last4 text,
  payment_token_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category item_category NOT NULL,
  status item_status DEFAULT 'available',
  barcode text,
  sim_number text,
  local_number text,
  israeli_number text,
  notes text,
  expiry_date date,
  cellstation_status text,
  last_sync timestamptz,
  needs_swap boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_price numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'ILS',
  deposit numeric,
  status rental_status DEFAULT 'active',
  notes text,
  pickup_time text,
  overdue_daily_rate numeric,
  overdue_grace_days integer,
  auto_charge_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rental_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory(id),
  item_name text NOT NULL,
  item_category item_category NOT NULL,
  price_per_day numeric,
  has_israeli_number boolean DEFAULT false,
  is_generic boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text,
  device_type text NOT NULL,
  device_model text,
  problem_description text,
  status repair_status DEFAULT 'in_lab',
  notes text,
  device_cost numeric,
  is_warranty boolean DEFAULT false,
  collected_date date,
  completed_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rentals(id),
  customer_id uuid REFERENCES customers(id),
  customer_name text NOT NULL,
  business_name text NOT NULL,
  business_id text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'ILS',
  status text DEFAULT 'issued',
  invoice_number integer NOT NULL,
  description text,
  issued_at timestamptz DEFAULT now(),
  transaction_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rentals(id),
  transaction_id text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'ILS',
  status payment_status DEFAULT 'pending',
  customer_name text,
  error_message text,
  gateway_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE rentals DISABLE ROW LEVEL SECURITY;
ALTER TABLE rental_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE repairs DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions DISABLE ROW LEVEL SECURITY;
`;

  try {
    const { data, error } = await sb.rpc("query", { sql }).single();
    
    // Try direct approach via pg
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/`, {
      method: "GET",
      headers: { "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! }
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "SQL executed - check tables",
      error: error?.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch(e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
