import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeRateResponse {
  success: boolean;
  rate: number;
  currency: string;
  source: string;
  timestamp: string;
}

export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async (): Promise<number> => {
      try {
        const response = await fetch('/api/exchange-rate', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch exchange rate');
        }

        const data = (await response.json()) as ExchangeRateResponse;
        return data?.rate ?? 3.65;
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        // Fallback rate if API fails
        return 3.65;
      }
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Helper function to convert USD to ILS
export function convertUsdToIls(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate * 100) / 100;
}

// Format price with both currencies
export function formatDualCurrency(
  usdAmount: number,
  rate: number,
  showBoth: boolean = true
): string {
  const ilsAmount = convertUsdToIls(usdAmount, rate);
  if (showBoth) {
    return `$${usdAmount.toFixed(2)} (≈₪${ilsAmount.toFixed(2)})`;
  }
  return `$${usdAmount.toFixed(2)}`;
}
