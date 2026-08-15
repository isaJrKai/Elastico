import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safe toFixed — never crashes on undefined/null/NaN.
 * Usage: sf(value, 2) instead of value.toFixed(2)
 */
export function sf(val: unknown, decimals = 0): string {
  const n = Number(val)
  if (val == null || typeof val === 'undefined' || isNaN(n)) return '0'
  return n.toFixed(decimals)
}
