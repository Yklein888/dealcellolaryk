import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CartItem, PaymentMethod, ProcessingSaleState, POSSaleStatus } from '@/types/pos';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

const initialState: ProcessingSaleState = {
  saleId: null,
  status: 'created',
  step: 'idle',
  error: null,
  documentNumber: null,
  documentUrl: null,
  documentType: null,
  cashChange: null,
};

export function usePOSSale() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [processingState, setProcessingState] = useState<ProcessingSaleState>(initialState);

  const addToCart = useCallback((product: CartItem['product']) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev =>
        prev.map(item =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const updateSaleStatus = async (saleId: string, status: POSSaleStatus, additionalData?: Record<string, unknown>) => {
    const { error } = await supabase
      .from('pos_sales')
      .update({ status, ...additionalData })
      .eq('id', saleId);
    
    if (error) throw error;
  };

  const logAuditAction = async (action: string, saleId: string | null, details?: Record<string, unknown>) => {
    if (!user) return;
    
    await supabase.from('pos_audit_log').insert([{
      action,
      sale_id: saleId,
      user_id: user.id,
      details: (details || null) as Json,
    }]);
  };

  const processSale = async (paymentMethod: PaymentMethod, cashReceived?: number) => {
    if (!user || cart.length === 0) {
      toast.error('אין פריטים בעגלה');
      return;
    }

    setProcessingState({
      ...initialState,
      step: 'creating',
    });

    try {
      // Step 1: Create the sale
      const { data: sale, error: saleError } = await supabase
        .from('pos_sales')
        .insert({
          cashier_id: user.id,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          status: 'created',
          cash_received: paymentMethod === 'cash' ? cashReceived : null,
          cash_change: paymentMethod === 'cash' && cashReceived ? cashReceived - totalAmount : null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      setProcessingState(prev => ({
        ...prev,
        saleId: sale.id,
        status: 'created',
      }));

      // Step 2: Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        line_total: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('pos_sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      await logAuditAction('sale_created', sale.id, { items: cart.length, total: totalAmount });

      // Step 3: Process payment
      setProcessingState(prev => ({
        ...prev,
        step: 'processing_payment',
        status: 'awaiting_payment',
      }));

      await updateSaleStatus(sale.id, 'awaiting_payment');

      if (paymentMethod === 'credit') {
        // Call Pelecard for credit card payment
        // For now, we'll simulate success - this will be replaced with actual Pelecard integration
        const pelecardResponse = await processCreditPayment(sale.id, totalAmount);
        
        if (!pelecardResponse.success) {
          throw new Error(pelecardResponse.error || 'תשלום באשראי נכשל');
        }

        await updateSaleStatus(sale.id, 'payment_approved', {
          payment_reference: pelecardResponse.transactionId,
        });
      } else {
        // Cash payment - mark as approved immediately
        await updateSaleStatus(sale.id, 'payment_approved');
      }

      setProcessingState(prev => ({
        ...prev,
        status: 'payment_approved',
      }));

      await logAuditAction('payment_processed', sale.id, { method: paymentMethod });

      // Step 4: Generate document via YPAY
      setProcessingState(prev => ({
        ...prev,
        step: 'generating_document',
      }));

      const documentResponse = await generateYPayDocument(sale.id, totalAmount, paymentMethod);

      if (!documentResponse.success) {
        throw new Error(documentResponse.error || 'יצירת מסמך נכשלה');
      }

      await updateSaleStatus(sale.id, 'document_generated', {
        ypay_document_number: documentResponse.documentNumber,
        ypay_document_url: documentResponse.documentUrl,
        ypay_document_type: documentResponse.documentType,
      });

      await logAuditAction('document_generated', sale.id, { 
        documentNumber: documentResponse.documentNumber 
      });

      // Step 5: Complete the sale
      await updateSaleStatus(sale.id, 'completed', {
        completed_at: new Date().toISOString(),
      });

      setProcessingState({
        saleId: sale.id,
        status: 'completed',
        step: 'completed',
        error: null,
        documentNumber: documentResponse.documentNumber,
        documentUrl: documentResponse.documentUrl,
        documentType: documentResponse.documentType,
        cashChange: paymentMethod === 'cash' && cashReceived ? cashReceived - totalAmount : null,
      });

      clearCart();
      toast.success('העסקה הושלמה בהצלחה!');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה';
      
      setProcessingState(prev => ({
        ...prev,
        step: 'failed',
        status: 'failed',
        error: errorMessage,
      }));

      if (processingState.saleId) {
        await updateSaleStatus(processingState.saleId, 'failed');
        await logAuditAction('sale_failed', processingState.saleId, { error: errorMessage });
      }

      toast.error(errorMessage);
    }
  };

  const resetSale = useCallback(() => {
    setProcessingState(initialState);
    clearCart();
  }, [clearCart]);

  return {
    cart,
    totalAmount,
    processingState,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    processSale,
    resetSale,
  };
}

// Placeholder functions - will be replaced with actual API calls
async function processCreditPayment(saleId: string, amount: number): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> {
  // TODO: Implement actual Pelecard integration
  // For now, simulate a successful payment
  await new Promise(resolve => setTimeout(resolve, 1500));
  return {
    success: true,
    transactionId: `PLC-${Date.now()}`,
  };
}

async function generateYPayDocument(
  saleId: string, 
  amount: number, 
  paymentMethod: PaymentMethod
): Promise<{
  success: boolean;
  documentNumber?: string;
  documentUrl?: string;
  documentType?: string;
  error?: string;
}> {
  // TODO: Implement actual YPAY integration
  // For now, simulate document generation
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    success: true,
    documentNumber: `DOC-${Date.now()}`,
    documentUrl: '#',
    documentType: 'קבלה',
  };
}
