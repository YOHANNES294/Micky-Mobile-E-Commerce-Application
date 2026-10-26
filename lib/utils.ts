import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// Parses a price string (e.g., "20000", "20000-25000") into a number for calculations
// For ranges, returns the average.
export function parsePrice(priceIdx: string | number): number {
  if (typeof priceIdx === "number") return priceIdx;
  if (!priceIdx) return 0;

  // Remove commas and other non-numeric chars except hyphen
  const cleanPrice = priceIdx.replace(/[^\d\.-]/g, "");

  // Check for range
  if (cleanPrice.includes("-")) {
    const parts = cleanPrice.split("-").map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return (parts[0] + parts[1]) / 2;
    }
  }

  const parsed = parseFloat(cleanPrice);
  return isNaN(parsed) ? 0 : parsed;
}
