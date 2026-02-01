import { ItemCategory } from '@/types/rental';
import { differenceInDays, eachDayOfInterval, getDay, parseISO, format, getYear } from 'date-fns';

// Israeli holidays (fixed dates in Hebrew calendar, approximate Gregorian dates)
// Note: These are approximate - for production, use Hebcal API for exact dates
const FIXED_HOLIDAYS_2024_2025 = [
  // 2024
  '2024-04-23', '2024-04-24', // Pesach start
  '2024-04-29', '2024-04-30', // Pesach end
  '2024-05-14', // Yom Ha'atzmaut
  '2024-06-12', // Shavuot
  '2024-10-03', '2024-10-04', // Rosh Hashanah
  '2024-10-12', // Yom Kippur
  '2024-10-17', '2024-10-18', // Sukkot start
  '2024-10-24', '2024-10-25', // Simchat Torah
  // 2025
  '2025-04-13', '2025-04-14', // Pesach start
  '2025-04-19', '2025-04-20', // Pesach end
  '2025-05-01', // Yom Ha'atzmaut
  '2025-06-02', // Shavuot
  '2025-09-23', '2025-09-24', // Rosh Hashanah
  '2025-10-02', // Yom Kippur
  '2025-10-07', '2025-10-08', // Sukkot start
  '2025-10-14', '2025-10-15', // Simchat Torah
  // 2026
  '2026-04-02', '2026-04-03', // Pesach start
  '2026-04-08', '2026-04-09', // Pesach end
  '2026-04-21', // Yom Ha'atzmaut
  '2026-05-22', // Shavuot
  '2026-09-12', '2026-09-13', // Rosh Hashanah
  '2026-09-21', // Yom Kippur
  '2026-09-26', '2026-09-27', // Sukkot start
  '2026-10-03', '2026-10-04', // Simchat Torah
];

// Check if a date is a holiday
function isHoliday(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return FIXED_HOLIDAYS_2024_2025.includes(dateStr);
}

// Check if a date is Saturday (Shabbat)
function isSaturday(date: Date): boolean {
  return getDay(date) === 6; // 6 = Saturday
}

// Count weekdays excluding Saturdays only (original logic)
function countWeekdays(startDate: Date, endDate: Date): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => !isSaturday(day)).length;
}

// Count business days excluding Saturdays AND holidays
export function countBusinessDays(startDate: Date, endDate: Date): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => !isSaturday(day) && !isHoliday(day)).length;
}

// Get breakdown of excluded days for transparency
export function getExcludedDaysBreakdown(startDate: Date, endDate: Date): { 
  totalDays: number;
  businessDays: number; 
  saturdays: number; 
  holidays: number;
  excludedDates: string[];
} {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const saturdays = days.filter(day => isSaturday(day));
  const holidays = days.filter(day => isHoliday(day) && !isSaturday(day)); // Don't double-count
  const businessDays = days.filter(day => !isSaturday(day) && !isHoliday(day)).length;
  
  const excludedDates = [
    ...saturdays.map(d => format(d, 'dd/MM/yyyy') + ' (שבת)'),
    ...holidays.map(d => format(d, 'dd/MM/yyyy') + ' (חג)')
  ];

  return {
    totalDays: days.length,
    businessDays,
    saturdays: saturdays.length,
    holidays: holidays.length,
    excludedDates,
  };
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

// Calculate price for devices based on business days (excluding Saturdays AND holidays)
// European bundle device rate - 5 ILS per business day when bundled with European SIM
export const EUROPEAN_BUNDLE_DEVICE_RATE = 5;

export function calculateDevicePriceWithHolidays(
  category: ItemCategory,
  startDate: Date,
  endDate: Date
): { price: number; businessDays: number; breakdown: ReturnType<typeof getExcludedDaysBreakdown> } {
  const breakdown = getExcludedDaysBreakdown(startDate, endDate);
  const businessDays = breakdown.businessDays;
  
  // Daily rates for devices
  const dailyRates: Record<string, number> = {
    device_simple: 10, // מכשיר פשוט - 10 ש"ח ליום
    device_smartphone: 25,
    modem: 20,
    netstick: 15,
  };
  
  const rate = dailyRates[category] || 0;
  return { 
    price: businessDays * rate, 
    businessDays,
    breakdown
  };
}

// Calculate price for devices (excluding Saturdays AND holidays for business days)
export function calculateDevicePrice(
  category: ItemCategory,
  startDate: Date,
  endDate: Date
): number {
  // Use business days (excluding Saturdays AND holidays) for device pricing
  const businessDays = countBusinessDays(startDate, endDate);
  
  // Daily rates for devices
  const dailyRates: Record<string, number> = {
    device_simple: 10,         // מכשיר פשוט - 10 ש"ח ליום
    device_smartphone: 25,
    modem: 20,
    netstick: 15,
  };
  
  const rate = dailyRates[category] || 0;
  return businessDays * rate;
}

// Get detailed pricing info for transparency
export function calculateDevicePriceDetailed(
  category: ItemCategory,
  startDate: Date,
  endDate: Date
): { price: number; businessDays: number; dailyRate: number; breakdown: ReturnType<typeof getExcludedDaysBreakdown> } {
  const breakdown = getExcludedDaysBreakdown(startDate, endDate);
  
  const dailyRates: Record<string, number> = {
    device_simple: 10,
    device_smartphone: 25,
    modem: 20,
    netstick: 15,
  };
  
  const rate = dailyRates[category] || 0;
  return {
    price: breakdown.businessDays * rate,
    businessDays: breakdown.businessDays,
    dailyRate: rate,
    breakdown,
  };
}

// Calculate total rental price
export function calculateRentalPrice(
  items: Array<{ category: ItemCategory; hasIsraeliNumber?: boolean; includeEuropeanDevice?: boolean }>,
  startDate: string,
  endDate: string
): { 
  total: number; 
  currency: 'ILS' | 'USD'; 
  breakdown: Array<{ item: string; price: number; currency: string; details?: string }>; 
  usdTotal?: number; 
  ilsTotal?: number;
  businessDaysInfo?: ReturnType<typeof getExcludedDaysBreakdown>;
} {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = differenceInDays(end, start) + 1;
  const businessDaysInfo = getExcludedDaysBreakdown(start, end);
  
  let ilsTotal = 0;
  let usdTotal = 0;
  const breakdown: Array<{ item: string; price: number; currency: string; details?: string }> = [];
  
  items.forEach(item => {
    switch (item.category) {
      case 'sim_european':
        const euroSimPrice = calculateEuropeanSimPrice(totalDays);
        ilsTotal += euroSimPrice;
        breakdown.push({ item: 'סים אירופאי', price: euroSimPrice, currency: '₪' });
        
        // Check if european bundle device should be added
        if (item.includeEuropeanDevice) {
          const devicePrice = businessDaysInfo.businessDays * EUROPEAN_BUNDLE_DEVICE_RATE;
          ilsTotal += devicePrice;
          breakdown.push({ 
            item: 'מכשיר פשוט (באנדל אירופאי)', 
            price: devicePrice, 
            currency: '₪',
            details: `${businessDaysInfo.businessDays} ימי עסקים × ₪${EUROPEAN_BUNDLE_DEVICE_RATE}`
          });
        }
        break;
        
      case 'sim_american':
        const usSimPrice = calculateAmericanSimPrice(totalDays, item.hasIsraeliNumber);
        usdTotal += usSimPrice;
        breakdown.push({ item: 'סים אמריקאי', price: usSimPrice, currency: '$' });
        break;
        
      case 'device_simple':
        const simpleDeviceInfo = calculateDevicePriceDetailed(item.category, start, end);
        ilsTotal += simpleDeviceInfo.price;
        breakdown.push({ 
          item: 'מכשיר פשוט', 
          price: simpleDeviceInfo.price, 
          currency: '₪',
          details: `${simpleDeviceInfo.businessDays} ימי עסקים × ₪${simpleDeviceInfo.dailyRate}`
        });
        break;
        
      case 'device_smartphone':
        const smartphoneInfo = calculateDevicePriceDetailed(item.category, start, end);
        ilsTotal += smartphoneInfo.price;
        breakdown.push({ 
          item: 'סמארטפון', 
          price: smartphoneInfo.price, 
          currency: '₪',
          details: `${smartphoneInfo.businessDays} ימי עסקים × ₪${smartphoneInfo.dailyRate}`
        });
        break;
        
      case 'modem':
        const modemInfo = calculateDevicePriceDetailed(item.category, start, end);
        ilsTotal += modemInfo.price;
        breakdown.push({ 
          item: 'מודם', 
          price: modemInfo.price, 
          currency: '₪',
          details: `${modemInfo.businessDays} ימי עסקים × ₪${modemInfo.dailyRate}`
        });
        break;
        
      case 'netstick':
        const netstickInfo = calculateDevicePriceDetailed(item.category, start, end);
        ilsTotal += netstickInfo.price;
        breakdown.push({ 
          item: 'נטסטיק', 
          price: netstickInfo.price, 
          currency: '₪',
          details: `${netstickInfo.businessDays} ימי עסקים × ₪${netstickInfo.dailyRate}`
        });
        break;
    }
  });
  
  // If there are USD items, return USD total; otherwise ILS
  if (usdTotal > 0 && ilsTotal === 0) {
    return { total: usdTotal, currency: 'USD', breakdown, usdTotal, ilsTotal: 0, businessDaysInfo };
  }
  
  // Mixed currencies - keep them separate, don't convert here
  // Frontend will handle conversion display with live exchange rate
  return { total: ilsTotal, currency: 'ILS', breakdown, usdTotal, ilsTotal, businessDaysInfo };
}

// Format price with currency symbol
export function formatPrice(amount: number, currency: 'ILS' | 'USD'): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return `₪${amount.toFixed(2)}`;
}
