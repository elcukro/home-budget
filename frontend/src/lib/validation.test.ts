import { describe, it, expect } from 'vitest'
import {
  parseNumber,
  validateAmountPositive,
  validateAmountNonNegative,
  validateInterestRate,
  validateRemainingBalance,
  validateMonthlyPayment,
  validateDateString,
} from './validation'

describe('parseNumber', () => {
  describe('handles numeric inputs', () => {
    it('returns finite numbers as-is', () => {
      expect(parseNumber(42)).toBe(42)
      expect(parseNumber(3.14)).toBe(3.14)
      expect(parseNumber(-100)).toBe(-100)
      expect(parseNumber(0)).toBe(0)
    })

    it('returns null for Infinity', () => {
      expect(parseNumber(Infinity)).toBe(null)
      expect(parseNumber(-Infinity)).toBe(null)
    })

    it('returns null for NaN', () => {
      expect(parseNumber(NaN)).toBe(null)
    })
  })

  describe('handles string inputs', () => {
    it('parses simple integers', () => {
      expect(parseNumber('42')).toBe(42)
      expect(parseNumber('-100')).toBe(-100)
      expect(parseNumber('0')).toBe(0)
    })

    it('parses decimals with dots', () => {
      expect(parseNumber('3.14')).toBe(3.14)
      expect(parseNumber('0.5')).toBe(0.5)
    })

    it('parses decimals with commas (European format)', () => {
      expect(parseNumber('3,14')).toBe(3.14)
      expect(parseNumber('1000,50')).toBe(1000.50)
    })

    it('treats single dot as decimal separator', () => {
      // With single dot/comma, it's treated as decimal
      expect(parseNumber('1.000')).toBe(1)
      expect(parseNumber('1,000')).toBe(1)
    })

    it('parseFloat limitation: multiple dots parsed as decimal', () => {
      // Due to parseFloat behavior, multiple dots result in partial parse
      // 1.000.000 → parseFloat stops at second dot → 1
      expect(parseNumber('1.000.000')).toBe(1)
    })

    it('parseFloat limitation: multiple commas parsed as decimal', () => {
      // Similarly for commas when no dots present
      expect(parseNumber('1,000,000')).toBe(1)
    })

    it('handles mixed formats (European: 1.234,56)', () => {
      expect(parseNumber('1.234,56')).toBe(1234.56)
      expect(parseNumber('12.345,67')).toBe(12345.67)
    })

    it('handles mixed formats (US: 1,234.56)', () => {
      expect(parseNumber('1,234.56')).toBe(1234.56)
      expect(parseNumber('12,345.67')).toBe(12345.67)
    })

    it('trims whitespace', () => {
      expect(parseNumber('  42  ')).toBe(42)
      expect(parseNumber('  3.14  ')).toBe(3.14)
    })

    it('handles spaces in numbers', () => {
      expect(parseNumber('1 000')).toBe(1000)
      expect(parseNumber('1 000 000')).toBe(1000000)
    })

    it('returns null for empty strings', () => {
      expect(parseNumber('')).toBe(null)
      expect(parseNumber('   ')).toBe(null)
    })

    it('returns null for non-numeric strings', () => {
      expect(parseNumber('abc')).toBe(null)
    })

    it('strips currency symbols and parses number', () => {
      // The function removes non-numeric chars and parses
      expect(parseNumber('$100')).toBe(100)
      expect(parseNumber('100zł')).toBe(100)
    })

    it('returns null for just punctuation', () => {
      expect(parseNumber('-')).toBe(null)
      expect(parseNumber('.')).toBe(null)
      expect(parseNumber('-.')).toBe(null)
    })
  })

  describe('handles other types', () => {
    it('returns null for null', () => {
      expect(parseNumber(null)).toBe(null)
    })

    it('returns null for undefined', () => {
      expect(parseNumber(undefined)).toBe(null)
    })

    it('returns null for objects', () => {
      expect(parseNumber({})).toBe(null)
      expect(parseNumber([])).toBe(null)
    })

    it('returns null for booleans', () => {
      expect(parseNumber(true)).toBe(null)
      expect(parseNumber(false)).toBe(null)
    })
  })
})

describe('validateAmountPositive', () => {
  it('returns null for valid positive amounts', () => {
    expect(validateAmountPositive(100)).toBe(null)
    expect(validateAmountPositive('100')).toBe(null)
    expect(validateAmountPositive('1,000.50')).toBe(null)
    expect(validateAmountPositive(0.01)).toBe(null)
  })

  it('returns error for zero', () => {
    const result = validateAmountPositive(0)
    expect(result).toEqual({ messageId: 'validation.amount.nonPositive' })
  })

  it('returns error for negative amounts', () => {
    const result = validateAmountPositive(-100)
    expect(result).toEqual({ messageId: 'validation.amount.nonPositive' })
  })

  it('returns error for invalid input', () => {
    const result = validateAmountPositive('abc')
    expect(result).toEqual({ messageId: 'validation.required' })
  })

  it('returns error for empty input', () => {
    expect(validateAmountPositive('')).toEqual({ messageId: 'validation.required' })
    expect(validateAmountPositive(null)).toEqual({ messageId: 'validation.required' })
  })

  it('returns error for amounts exceeding safe limit', () => {
    const result = validateAmountPositive(2_000_000_000)
    expect(result).toEqual({ messageId: 'validation.amount.tooLarge' })
  })
})

describe('validateAmountNonNegative', () => {
  it('returns null for valid non-negative amounts', () => {
    expect(validateAmountNonNegative(100)).toBe(null)
    expect(validateAmountNonNegative(0)).toBe(null)
    expect(validateAmountNonNegative('0')).toBe(null)
    expect(validateAmountNonNegative('1,000.50')).toBe(null)
  })

  it('returns error for negative amounts', () => {
    const result = validateAmountNonNegative(-100)
    expect(result).toEqual({ messageId: 'validation.amount.nonNegative' })
  })

  it('returns error for invalid input', () => {
    const result = validateAmountNonNegative('abc')
    expect(result).toEqual({ messageId: 'validation.required' })
  })

  it('returns error for amounts exceeding safe limit', () => {
    const result = validateAmountNonNegative(2_000_000_000)
    expect(result).toEqual({ messageId: 'validation.amount.tooLarge' })
  })
})

describe('validateInterestRate', () => {
  it('returns null for valid interest rates', () => {
    expect(validateInterestRate(5)).toBe(null)
    expect(validateInterestRate(0)).toBe(null)
    expect(validateInterestRate(100)).toBe(null)
    expect(validateInterestRate(7.5)).toBe(null)
  })

  it('returns error for negative rates', () => {
    const result = validateInterestRate(-1)
    expect(result).toEqual({ messageId: 'validation.interestRate.negative' })
  })

  it('returns error for rates above 100%', () => {
    const result = validateInterestRate(101)
    expect(result).toEqual({ messageId: 'validation.interestRate.max' })
  })

  it('returns error for non-finite values', () => {
    expect(validateInterestRate(NaN)).toEqual({ messageId: 'validation.required' })
    expect(validateInterestRate(Infinity)).toEqual({ messageId: 'validation.required' })
  })
})

describe('validateRemainingBalance', () => {
  it('returns null for valid balance', () => {
    expect(validateRemainingBalance(50000, 100000)).toBe(null)
    expect(validateRemainingBalance(0, 100000)).toBe(null)
    expect(validateRemainingBalance(100000, 100000)).toBe(null)
  })

  it('returns error for negative balance', () => {
    const result = validateRemainingBalance(-1000, 100000)
    expect(result).toEqual({ messageId: 'validation.remainingBalance.negative' })
  })

  it('returns error when balance exceeds principal', () => {
    const result = validateRemainingBalance(150000, 100000)
    expect(result).toEqual({ messageId: 'validation.remainingBalance.exceedsAmount' })
  })

  it('returns error for non-finite balance', () => {
    expect(validateRemainingBalance(NaN, 100000)).toEqual({ messageId: 'validation.required' })
    expect(validateRemainingBalance(Infinity, 100000)).toEqual({ messageId: 'validation.required' })
  })

  it('handles non-finite principal gracefully', () => {
    // Should not error even with non-finite principal
    expect(validateRemainingBalance(50000, NaN)).toBe(null)
    expect(validateRemainingBalance(50000, -100)).toBe(null)
  })
})

describe('validateMonthlyPayment', () => {
  it('returns null for valid payment', () => {
    expect(validateMonthlyPayment(1000, 100000)).toBe(null)
    expect(validateMonthlyPayment(0, 100000)).toBe(null)
  })

  it('returns error for negative payment', () => {
    const result = validateMonthlyPayment(-100, 100000)
    expect(result).toEqual({ messageId: 'validation.monthlyPayment.negative' })
  })

  it('returns error when payment exceeds principal', () => {
    const result = validateMonthlyPayment(150000, 100000)
    expect(result).toEqual({ messageId: 'validation.monthlyPayment.exceedsAmount' })
  })

  it('allows payment equal to principal', () => {
    expect(validateMonthlyPayment(100000, 100000)).toBe(null)
  })

  it('returns error for non-finite payment', () => {
    expect(validateMonthlyPayment(NaN, 100000)).toEqual({ messageId: 'validation.required' })
    expect(validateMonthlyPayment(Infinity, 100000)).toEqual({ messageId: 'validation.required' })
  })

  it('handles non-finite principal gracefully', () => {
    expect(validateMonthlyPayment(1000, NaN)).toBe(null)
    expect(validateMonthlyPayment(1000, 0)).toBe(null)
  })
})

describe('validateDateString', () => {
  describe('basic validation', () => {
    it('returns null for valid ISO date strings', () => {
      expect(validateDateString('2024-01-15')).toBe(null)
      expect(validateDateString('2020-12-31')).toBe(null)
      expect(validateDateString('2000-01-01')).toBe(null)
    })

    it('returns error for empty strings', () => {
      expect(validateDateString('')).toEqual({ messageId: 'validation.required' })
      expect(validateDateString('   ')).toEqual({ messageId: 'validation.required' })
    })

    it('returns error for invalid format', () => {
      expect(validateDateString('01-15-2024')).toEqual({ messageId: 'validation.required' })
      expect(validateDateString('15/01/2024')).toEqual({ messageId: 'validation.required' })
      expect(validateDateString('2024/01/15')).toEqual({ messageId: 'validation.required' })
      expect(validateDateString('not-a-date')).toEqual({ messageId: 'validation.required' })
    })

    it('returns error for invalid month', () => {
      expect(validateDateString('2024-13-01')).toEqual({ messageId: 'validation.required' })
      expect(validateDateString('2024-00-01')).toEqual({ messageId: 'validation.required' })
    })

    it('returns error for invalid day', () => {
      expect(validateDateString('2024-01-32')).toEqual({ messageId: 'validation.required' })
      expect(validateDateString('2024-01-00')).toEqual({ messageId: 'validation.required' })
    })
  })

  describe('future date handling', () => {
    it('rejects future dates by default', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const futureStr = futureDate.toISOString().split('T')[0]

      const result = validateDateString(futureStr)
      expect(result).toEqual({ messageId: 'validation.date.future' })
    })

    it('allows future dates when allowFuture is true', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const futureStr = futureDate.toISOString().split('T')[0]

      const result = validateDateString(futureStr, { allowFuture: true })
      expect(result).toBe(null)
    })

    it('rejects dates too far in the future', () => {
      const farFuture = new Date()
      farFuture.setFullYear(farFuture.getFullYear() + 10)
      const futureStr = farFuture.toISOString().split('T')[0]

      const result = validateDateString(futureStr, { allowFuture: true })
      expect(result).toEqual({ messageId: 'validation.date.tooFarFuture' })
    })

    it('respects custom maxFutureYears', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 8)
      const futureStr = futureDate.toISOString().split('T')[0]

      // Should fail with default (5 years)
      expect(validateDateString(futureStr, { allowFuture: true }))
        .toEqual({ messageId: 'validation.date.tooFarFuture' })

      // Should pass with 10 years
      expect(validateDateString(futureStr, { allowFuture: true, maxFutureYears: 10 }))
        .toBe(null)
    })
  })

  describe('historical date handling', () => {
    it('rejects dates before year 2000', () => {
      const result = validateDateString('1999-12-31')
      expect(result).toEqual({ messageId: 'validation.date.tooEarly' })
    })

    it('accepts dates from year 2000 onwards', () => {
      expect(validateDateString('2000-01-01')).toBe(null)
      expect(validateDateString('2000-06-15')).toBe(null)
    })
  })
})
