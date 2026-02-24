import { US_SIM_PRICING } from '@/types/rental';

/**
 * Calculates the total rental price for a US SIM based on duration and features
 *
 * Pricing formula:
 * - Base: $55 per week
 * - Additional weeks: $10 per week (weeks 2+)
 * - Israeli number: +$10 (one-time, for the entire rental period)
 *
 * @param weeks - Number of weeks for the rental
 * @param includesIsraeli - Whether to include an Israeli number
 * @returns Total price in USD
 */
export function calculateUSSimRentalPrice(weeks: number, includesIsraeli: boolean): number {
  if (weeks < 1) return 0;

  const baseCost = US_SIM_PRICING.basePerWeek * weeks;
  const additionalCost = weeks > 1 ? US_SIM_PRICING.additionalWeekCost * (weeks - 1) : 0;
  const israeliBonusCost = includesIsraeli ? US_SIM_PRICING.israeliBonusCost : 0;

  return baseCost + additionalCost + israeliBonusCost;
}

/**
 * Breaks down the pricing for display/invoice purposes
 */
export interface PricingBreakdown {
  baseCost: number;      // $55 per week
  additionalCost: number; // +$10 per additional week
  israeliBonusCost: number;
  totalPrice: number;
}

export function getPricingBreakdown(weeks: number, includesIsraeli: boolean): PricingBreakdown {
  const baseCost = US_SIM_PRICING.basePerWeek * weeks;
  const additionalCost = weeks > 1 ? US_SIM_PRICING.additionalWeekCost * (weeks - 1) : 0;
  const israeliBonusCost = includesIsraeli ? US_SIM_PRICING.israeliBonusCost : 0;

  return {
    baseCost,
    additionalCost,
    israeliBonusCost,
    totalPrice: baseCost + additionalCost + israeliBonusCost,
  };
}

/**
 * Formats pricing breakdown as human-readable text
 */
export function formatPricingBreakdown(breakdown: PricingBreakdown): string {
  const lines: string[] = [];

  lines.push(`$${breakdown.baseCost.toFixed(2)} - בסיס (${breakdown.baseCost / US_SIM_PRICING.basePerWeek} שבועות)`);

  if (breakdown.additionalCost > 0) {
    const additionalWeeks = breakdown.additionalCost / US_SIM_PRICING.additionalWeekCost;
    lines.push(`$${breakdown.additionalCost.toFixed(2)} - שבועות נוספות (${additionalWeeks})`);
  }

  if (breakdown.israeliBonusCost > 0) {
    lines.push(`$${breakdown.israeliBonusCost.toFixed(2)} - מספר ישראלי (חד-פעמי)`);
  }

  lines.push(`---`);
  lines.push(`$${breakdown.totalPrice.toFixed(2)} - סה"כ`);

  return lines.join('\n');
}
