import { Database } from '@/integrations/supabase/types';

export type POSProduct = Database['public']['Tables']['pos_products']['Row'];
export type POSProductInsert = Database['public']['Tables']['pos_products']['Insert'];
export type POSSale = Database['public']['Tables']['pos_sales']['Row'];
export type POSSaleInsert = Database['public']['Tables']['pos_sales']['Insert'];
export type POSSaleItem = Database['public']['Tables']['pos_sale_items']['Row'];
export type POSSaleItemInsert = Database['public']['Tables']['pos_sale_items']['Insert'];
export type POSAuditLog = Database['public']['Tables']['pos_audit_log']['Row'];
export type POSSaleStatus = Database['public']['Enums']['pos_sale_status'];

export interface CartItem {
  product: POSProduct;
  quantity: number;
}

export type PaymentMethod = 'credit' | 'cash';

export interface ProcessingSaleState {
  saleId: string | null;
  status: POSSaleStatus;
  step: 'idle' | 'creating' | 'processing_payment' | 'generating_document' | 'completed' | 'failed';
  error: string | null;
  documentNumber: string | null;
  documentUrl: string | null;
  documentType: string | null;
  cashChange: number | null;
}
