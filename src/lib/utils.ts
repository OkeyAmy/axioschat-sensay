import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Variant = 'A' | 'B'

// Simple A/B assignment based on userAgent + path
export function useAB(path: string): Variant {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
    let hash = 0
    const input = ua + '|' + path
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i)
      hash |= 0
    }
    return (Math.abs(hash) % 2) === 0 ? 'A' : 'B'
  } catch {
    return 'A'
  }
}
