import { useExchangeRate, convertUsdToIls } from '@/hooks/useExchangeRate';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DualCurrencyPriceProps {
  amount: number;
  currency: 'USD' | 'ILS';
  className?: string;
  showTooltip?: boolean;
}

export function DualCurrencyPrice({
  amount,
  currency,
  className = '',
  showTooltip = true,
}: DualCurrencyPriceProps) {
  const { data: rate, isLoading } = useExchangeRate();

  // If it's ILS, just show the amount normally
  if (currency === 'ILS') {
    return <span className={className}>₪{amount.toFixed(2)}</span>;
  }

  // For USD, show both currencies
  if (isLoading || !rate) {
    return (
      <span className={className}>
        ${amount.toFixed(2)}{' '}
        <Skeleton className="inline-block h-4 w-16" />
      </span>
    );
  }

  const ilsAmount = convertUsdToIls(amount, rate);

  const priceDisplay = (
    <span className={className}>
      ${amount.toFixed(2)}{' '}
      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-medium">
        ≈₪{ilsAmount.toFixed(2)}
      </span>
    </span>
  );

  if (!showTooltip) {
    return priceDisplay;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{priceDisplay}</TooltipTrigger>
        <TooltipContent side="top" className="text-sm">
          <p>שער יציג: ₪{rate.toFixed(4)} לדולר</p>
          <p className="text-muted-foreground text-xs">מעודכן אוטומטית</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
