-- Create enum types
CREATE TYPE public.item_category AS ENUM (
  'sim_american',
  'sim_european',
  'device_simple',
  'device_smartphone',
  'modem',
  'netstick'
);

CREATE TYPE public.item_status AS ENUM (
  'available',
  'rented',
  'maintenance'
);

CREATE TYPE public.rental_status AS ENUM (
  'active',
  'overdue',
  'returned'
);

CREATE TYPE public.repair_status AS ENUM (
  'in_lab',
  'ready',
  'collected'
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  credit_card TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category item_category NOT NULL,
  name TEXT NOT NULL,
  local_number TEXT,
  israeli_number TEXT,
  expiry_date DATE,
  status item_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rentals table
CREATE TABLE public.rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS' CHECK (currency IN ('ILS', 'USD')),
  status rental_status NOT NULL DEFAULT 'active',
  deposit NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rental_items table
CREATE TABLE public.rental_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  item_category item_category NOT NULL,
  item_name TEXT NOT NULL,
  price_per_day NUMERIC(10,2),
  has_israeli_number BOOLEAN DEFAULT false,
  is_generic BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create repairs table
CREATE TABLE public.repairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_number TEXT NOT NULL,
  device_type TEXT NOT NULL,
  device_model TEXT,
  device_cost NUMERIC(10,2),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  problem_description TEXT NOT NULL,
  status repair_status NOT NULL DEFAULT 'in_lab',
  is_warranty BOOLEAN DEFAULT false,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_date DATE,
  collected_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (business management tool without auth)
CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on rentals" ON public.rentals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on rental_items" ON public.rental_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on repairs" ON public.repairs FOR ALL USING (true) WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rentals_updated_at
  BEFORE UPDATE ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_repairs_updated_at
  BEFORE UPDATE ON public.repairs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();