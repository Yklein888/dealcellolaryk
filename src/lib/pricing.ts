import { ItemCategory } from '@/types/rental';
import { differenceInDays, eachDayOfInterval, getDay, parseISO } from 'date-fns';

// Count weekdays (Sunday=0 to Friday=5, excluding Saturday=6)
function countWeekdays(startDate: Date, endDate: Date): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => getDay(day) !== 6).length; // 6 = Saturday
}

// Calculate price for European SIM
export function calculateEuropeanSimPrice(days: number): number {
  if (days <= 5) {
    return 200;
  }
  return 200 + (days - 5) * 15;
}

// Calculate price for American SIM
export function calculateAmericanSimPrice(
  days: number, 
  hasIsraeliNumber: boolean = false
): number {
  const weeks = Math.ceil(days / 7);
  let price = 55; // First week
  if (weeks > 1) {
    price += (weeks - 1) * 10;
  }
  if (hasIsraeliNumber) {
    price += 10; // One-time fee for Israeli number
  }
  return price;
}

// Calculate price for devices (excluding Saturdays)
export function calculateDevicePrice(
  category: ItemCategory,
  startDate: Date,
  endDate: Date
): number {
  const weekdays = countWeekdays(startDate, endDate);
  
  const dailyRates: Record<string, number> = {
    device_simple: 5,
    device_smartphone: 25,
    modem: 20,
    netstick: 15,
  };
  
  const rate = dailyRates[category] || 0;
  return weekdays * rate;
}

// Calculate total rental price
export function calculateRentalPrice(
  items: Array<{ category: ItemCategory; hasIsraeliNumber?: boolean }>,
  startDate: string,
  endDate: string
): { total: number; currency: 'ILS' | 'USD'; breakdown: Array<{ item: string; price: number; currency: string }>; usdTotal?: number; ilsTotal?: number } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = differenceInDays(end, start) + 1;
  
  let ilsTotal = 0;
  let usdTotal = 0;
  const breakdown: Array<{ item: string; price: number; currency: string }> = [];
  
  items.forEach(item => {
    switch (item.category) {
      case 'sim_european':
        const euroSimPrice = calculateEuropeanSimPrice(totalDays);
        ilsTotal += euroSimPrice;
        breakdown.push({ item: 'סים אירופאי', price: euroSimPrice, currency: '₪' });
        break;
        
      case 'sim_american':
        const usSimPrice = calculateAmericanSimPrice(totalDays, item.hasIsraeliNumber);
        usdTotal += usSimPrice;
        breakdown.push({ item: 'סים אמריקאי', price: usSimPrice, currency: '$' });
        break;
        
      case 'device_simple':
        const simpleDevicePrice = calculateDevicePrice(item.category, start, end);
        ilsTotal += simpleDevicePrice;
        breakdown.push({ item: 'מכשיר פשוט', price: simpleDevicePrice, currency: '₪' });
        break;
        
      case 'device_smartphone':
        const smartphonePrice = calculateDevicePrice(item.category, start, end);
        ilsTotal += smartphonePrice;
        breakdown.push({ item: 'סמארטפון', price: smartphonePrice, currency: '₪' });
        break;
        
      case 'modem':
        const modemPrice = calculateDevicePrice(item.category, start, end);
        ilsTotal += modemPrice;
        breakdown.push({ item: 'מודם', price: modemPrice, currency: '₪' });
        break;
        
      case 'netstick':
        const netstickPrice = calculateDevicePrice(item.category, start, end);
        ilsTotal += netstickPrice;
        breakdown.push({ item: 'נטסטיק', price: netstickPrice, currency: '₪' });
        break;
    }
  });
  
  // If there are USD items, return USD total; otherwise ILS
  if (usdTotal > 0 && ilsTotal === 0) {
    return { total: usdTotal, currency: 'USD', breakdown, usdTotal, ilsTotal: 0 };
  }
  
  // Mixed currencies - keep them separate, don't convert here
  // Frontend will handle conversion display with live exchange rate
  return { total: ilsTotal, currency: 'ILS', breakdown, usdTotal, ilsTotal };
}

// Format price with currency symbol
export function formatPrice(amount: number, currency: 'ILS' | 'USD'): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `₪${amount.toFixed(2)}`;
}
