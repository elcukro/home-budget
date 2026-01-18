import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatCurrency } from './formatters'

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('formatCurrency', () => {
  describe('valid currency codes', () => {
    it('formats USD correctly', () => {
      const result = formatCurrency(1234.56, 'USD')
      expect(result).toBe('$1,234.56')
    })

    it('formats EUR correctly', () => {
      const result = formatCurrency(1234.56, 'EUR')
      // EUR formatting with en-US locale
      expect(result).toContain('1,234.56')
      expect(result).toContain('€')
    })

    it('formats PLN correctly', () => {
      const result = formatCurrency(1234.56, 'PLN')
      expect(result).toContain('1,234.56')
    })

    it('formats GBP correctly', () => {
      const result = formatCurrency(1234.56, 'GBP')
      expect(result).toContain('1,234.56')
      expect(result).toContain('£')
    })
  })

  describe('edge cases', () => {
    it('handles zero', () => {
      const result = formatCurrency(0, 'USD')
      expect(result).toBe('$0.00')
    })

    it('handles negative numbers', () => {
      const result = formatCurrency(-1234.56, 'USD')
      expect(result).toContain('1,234.56')
      expect(result).toMatch(/-/)
    })

    it('handles very large numbers', () => {
      const result = formatCurrency(1234567890.12, 'USD')
      expect(result).toContain('1,234,567,890.12')
    })

    it('handles very small decimals', () => {
      const result = formatCurrency(0.01, 'USD')
      expect(result).toBe('$0.01')
    })

    it('rounds to 2 decimal places', () => {
      const result = formatCurrency(1234.567, 'USD')
      expect(result).toBe('$1,234.57')
    })

    it('handles single digit amounts', () => {
      const result = formatCurrency(5, 'USD')
      expect(result).toBe('$5.00')
    })
  })

  describe('invalid currency codes', () => {
    it('uses fallback formatting for invalid currency code', () => {
      const result = formatCurrency(1234.56, 'INVALID')
      // Fallback format: "CURRENCY AMOUNT"
      expect(result).toBe('INVALID 1234.56')
    })

    it('uses fallback formatting for empty currency code', () => {
      const result = formatCurrency(1234.56, '')
      expect(result).toContain('1234.56')
    })
  })
})
