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
  return String(value).replace(/[-\s]/g, '').toLowerCase();
}
