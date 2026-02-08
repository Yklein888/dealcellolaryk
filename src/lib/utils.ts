import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes a string for search by removing dashes, spaces, and converting to lowercase.
 * Useful for phone number and ID searches where format may vary (with/without dashes).
 * 
 * Example: "07-225-870-82" → "0722587082"
 */
export function normalizeForSearch(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value).replace(/[-\s]/g, '').toLowerCase();
  
  // Normalize Israeli numbers - remove leading zero for consistent matching
  // 0722587082 -> 722587082, 722587082 -> 722587082
  if (str.startsWith('0722') || str.startsWith('0752')) {
    str = str.substring(1); // Remove leading 0
  }
  
  // Normalize UK numbers - remove 44 prefix for matching
  // 447429xxx -> 7429xxx
  if (str.startsWith('44') && str.length > 10) {
    str = str.substring(2);
  }
  
  return str;
}
