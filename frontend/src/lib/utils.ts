import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility helper to compose Tailwind class names without duplications.
 * Mirrors the canonical shadcn/ui implementation so existing components work unchanged.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
