import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { POSProduct, POSProductInsert } from '@/types/pos';
import { toast } from 'sonner';

export function usePOSProducts() {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_products')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as POSProduct[];
    },
  });

  const { data: allProducts = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['pos-products-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_products')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as POSProduct[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (product: POSProductInsert) => {
      const { data, error } = await supabase
        .from('pos_products')
        .insert(product)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products-all'] });
      toast.success('המוצר נוצר בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה ביצירת מוצר: ' + error.message);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<POSProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from('pos_products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products-all'] });
      toast.success('המוצר עודכן בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה בעדכון מוצר: ' + error.message);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pos_products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products-all'] });
      toast.success('המוצר נמחק בהצלחה');
    },
    onError: (error) => {
      toast.error('שגיאה במחיקת מוצר: ' + error.message);
    },
  });

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  return {
    products,
    allProducts,
    isLoading,
    isLoadingAll,
    error,
    categories,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
