-- Create enum for POS sale status
CREATE TYPE pos_sale_status AS ENUM (
  'created',
  'awaiting_payment', 
  'payment_approved',
  'document_generated',
  'completed',
  'failed'
);

-- Create pos_products table
CREATE TABLE public.pos_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_sales table
CREATE TABLE public.pos_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_number SERIAL,
  status pos_sale_status NOT NULL DEFAULT 'created',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  cash_received NUMERIC,
  cash_change NUMERIC,
  payment_reference TEXT,
  ypay_document_number TEXT,
  ypay_document_url TEXT,
  ypay_document_type TEXT,
  cashier_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_sale_items table
CREATE TABLE public.pos_sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pos_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_audit_log table
CREATE TABLE public.pos_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  sale_id UUID REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_products (all authenticated users can read, only admins can modify)
CREATE POLICY "Authenticated users can view active products" 
ON public.pos_products 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage products" 
ON public.pos_products 
FOR ALL 
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for pos_sales
CREATE POLICY "Users can view own sales or admins can view all" 
ON public.pos_sales 
FOR SELECT 
TO authenticated
USING (cashier_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can create sales" 
ON public.pos_sales 
FOR INSERT 
TO authenticated
WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Users can update own pending sales" 
ON public.pos_sales 
FOR UPDATE 
TO authenticated
USING (cashier_id = auth.uid() AND status NOT IN ('document_generated', 'completed'));

CREATE POLICY "Admins can update any sale" 
ON public.pos_sales 
FOR UPDATE 
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for pos_sale_items
CREATE POLICY "Users can manage sale items for own sales" 
ON public.pos_sale_items 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pos_sales 
    WHERE id = pos_sale_items.sale_id 
    AND (cashier_id = auth.uid() OR public.is_admin(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pos_sales 
    WHERE id = pos_sale_items.sale_id 
    AND cashier_id = auth.uid()
  )
);

-- RLS Policies for pos_audit_log
CREATE POLICY "Users can view own audit logs or admins can view all" 
ON public.pos_audit_log 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can create audit logs" 
ON public.pos_audit_log 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_pos_products_updated_at
BEFORE UPDATE ON public.pos_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_sales_updated_at
BEFORE UPDATE ON public.pos_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_pos_products_category ON public.pos_products(category);
CREATE INDEX idx_pos_products_active ON public.pos_products(is_active);
CREATE INDEX idx_pos_sales_cashier ON public.pos_sales(cashier_id);
CREATE INDEX idx_pos_sales_status ON public.pos_sales(status);
CREATE INDEX idx_pos_sales_created ON public.pos_sales(created_at);
CREATE INDEX idx_pos_sale_items_sale ON public.pos_sale_items(sale_id);
CREATE INDEX idx_pos_audit_log_sale ON public.pos_audit_log(sale_id);
CREATE INDEX idx_pos_audit_log_user ON public.pos_audit_log(user_id);