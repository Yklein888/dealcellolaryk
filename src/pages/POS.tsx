import { useState, useMemo } from 'react';
import { usePOSProducts } from '@/hooks/usePOSProducts';
import { usePOSSale } from '@/hooks/usePOSSale';
import { POSProductGrid } from '@/components/pos/POSProductGrid';
import { POSCart } from '@/components/pos/POSCart';
import { POSProductSearch } from '@/components/pos/POSProductSearch';
import { POSPaymentDialog } from '@/components/pos/POSPaymentDialog';
import { POSProcessingOverlay } from '@/components/pos/POSProcessingOverlay';
import { POSConfirmationDialog } from '@/components/pos/POSConfirmationDialog';
import { PaymentMethod } from '@/types/pos';
import { ProtectedByPermission } from '@/components/ProtectedByPermission';

function POSContent() {
  const { products, isLoading, categories } = usePOSProducts();
  const {
    cart,
    totalAmount,
    processingState,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    processSale,
    resetSale,
  } = usePOSSale();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = products;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    return result;
  }, [products, searchQuery, selectedCategory]);

  const handleCheckout = () => {
    setPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async (method: PaymentMethod, cashReceived?: number) => {
    setPaymentDialogOpen(false);
    await processSale(method, cashReceived);
    setConfirmationDialogOpen(true);
  };

  const handleNewSale = () => {
    setConfirmationDialogOpen(false);
    resetSale();
  };

  const isProcessing = processingState.step !== 'idle' && 
                       processingState.step !== 'completed' && 
                       processingState.step !== 'failed';

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4 p-4" dir="rtl">
      {/* Main Content - Products */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <POSProductSearch
          value={searchQuery}
          onChange={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        
        <div className="flex-1 overflow-auto">
          <POSProductGrid
            products={filteredProducts}
            selectedCategory={selectedCategory}
            onProductClick={addToCart}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Sidebar - Cart */}
      <div className="w-96 flex-shrink-0">
        <POSCart
          items={cart}
          totalAmount={totalAmount}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          onCheckout={handleCheckout}
          isProcessing={isProcessing}
        />
      </div>

      {/* Payment Dialog */}
      <POSPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        totalAmount={totalAmount}
        onConfirmPayment={handleConfirmPayment}
        isProcessing={isProcessing}
      />

      {/* Processing Overlay */}
      <POSProcessingOverlay state={processingState} />

      {/* Confirmation Dialog */}
      <POSConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        state={processingState}
        onNewSale={handleNewSale}
      />
    </div>
  );
}

export default function POS() {
  return (
    <ProtectedByPermission permission="view_pos">
      <POSContent />
    </ProtectedByPermission>
  );
}
