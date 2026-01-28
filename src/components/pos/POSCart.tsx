import { CartItem } from '@/types/pos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, ShoppingCart, Trash2, CreditCard } from 'lucide-react';

interface POSCartProps {
  items: CartItem[];
  totalAmount: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isProcessing?: boolean;
}

export function POSCart({
  items,
  totalAmount,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  isProcessing,
}: POSCartProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            עגלת קניות
          </CardTitle>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCart}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
            <p>העגלה ריקה</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-3">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ₪{item.product.price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <p className="font-bold text-sm w-16 text-left">
                    ₪{(item.product.price * item.quantity).toFixed(2)}
                  </p>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onRemoveItem(item.product.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-3 pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <span className="text-muted-foreground">סה"כ פריטים:</span>
          <span className="font-medium">
            {items.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between w-full">
          <span className="text-lg font-bold">סה"כ לתשלום:</span>
          <span className="text-2xl font-bold text-primary">
            ₪{totalAmount.toFixed(2)}
          </span>
        </div>
        <Button
          className="w-full h-12 text-lg"
          size="lg"
          onClick={onCheckout}
          disabled={items.length === 0 || isProcessing}
        >
          <CreditCard className="h-5 w-5 ml-2" />
          לתשלום
        </Button>
      </CardFooter>
    </Card>
  );
}
