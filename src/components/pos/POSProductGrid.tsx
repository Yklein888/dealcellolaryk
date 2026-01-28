import { POSProduct } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POSProductGridProps {
  products: POSProduct[];
  selectedCategory: string | null;
  onProductClick: (product: POSProduct) => void;
  isLoading?: boolean;
}

export function POSProductGrid({ 
  products, 
  selectedCategory, 
  onProductClick,
  isLoading 
}: POSProductGridProps) {
  const filteredProducts = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[...Array(10)].map((_, i) => (
          <Card key={i} className="h-28 animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mb-3" />
        <p>אין מוצרים להצגה</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {filteredProducts.map((product) => (
        <Button
          key={product.id}
          variant="outline"
          className={cn(
            "h-28 flex flex-col items-center justify-center gap-2 p-3",
            "hover:bg-primary hover:text-primary-foreground",
            "transition-all duration-200 text-wrap"
          )}
          onClick={() => onProductClick(product)}
        >
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="h-10 w-10 object-cover rounded"
            />
          ) : (
            <Package className="h-8 w-8 opacity-60" />
          )}
          <span className="text-sm font-medium text-center line-clamp-2">
            {product.name}
          </span>
          <span className="text-xs font-bold">
            ₪{product.price.toFixed(2)}
          </span>
        </Button>
      ))}
    </div>
  );
}
