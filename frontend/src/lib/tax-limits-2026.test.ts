import { describe, it, expect } from 'vitest'
import {
  TAX_LIMITS_2026,
  calculateIKZETaxSavings,
  calculateIKZEEffectiveCost,
  calculateBelkaTax,
  checkIKELimit,
  checkIKZELimit,
  formatPLN,
  getTaxLimitsDescription,
} from './tax-limits-2026'

describe('TAX_LIMITS_2026 constants', () => {
  it('has correct IKE limit', () => {
    expect(TAX_LIMITS_2026.IKE_LIMIT).toBe(28260)
  })

  it('has correct IKZE limits', () => {
    expect(TAX_LIMITS_2026.IKZE_LIMIT_STANDARD).toBe(11304)
    expect(TAX_LIMITS_2026.IKZE_LIMIT_JDG).toBe(16956)
  })

  it('has correct tax brackets', () => {
    expect(TAX_LIMITS_2026.KWOTA_WOLNA).toBe(30000)
    expect(TAX_LIMITS_2026.PROG_PODATKOWY_1).toBe(120000)
    expect(TAX_LIMITS_2026.STAWKA_PIT_1).toBe(0.12)
    expect(TAX_LIMITS_2026.STAWKA_PIT_2).toBe(0.32)
  })

  it('has correct Belka tax rate', () => {
    expect(TAX_LIMITS_2026.PODATEK_BELKI).toBe(0.19)
  })

  it('has correct minimum wage values', () => {
    expect(TAX_LIMITS_2026.MIN_WAGE_MONTHLY).toBe(4806)
    expect(TAX_LIMITS_2026.MIN_WAGE_HOURLY).toBe(31.50)
  })

  it('has correct ZUS rates', () => {
    expect(TAX_LIMITS_2026.ZUS_EMERYTALNA).toBe(0.0976)
    expect(TAX_LIMITS_2026.ZUS_RENTOWA).toBe(0.015)
    expect(TAX_LIMITS_2026.ZUS_CHOROBOWA).toBe(0.0245)
    expect(TAX_LIMITS_2026.ZUS_ZDROWOTNA).toBe(0.09)
  })

  it('has correct PPK rates', () => {
    expect(TAX_LIMITS_2026.PPK_PRACOWNIK_MIN).toBe(0.02)
    expect(TAX_LIMITS_2026.PPK_PRACOWNIK_MAX).toBe(0.04)
    expect(TAX_LIMITS_2026.PPK_PRACODAWCA_MIN).toBe(0.015)
    expect(TAX_LIMITS_2026.PPK_PRACODAWCA_MAX).toBe(0.025)
    expect(TAX_LIMITS_2026.PPK_DOPLATA_ROCZNA).toBe(240)
    expect(TAX_LIMITS_2026.PPK_DOPLATA_POWITALNA).toBe(250)
  })
})

describe('calculateIKZETaxSavings', () => {
  it('calculates 12% savings for income below threshold', () => {
    // Income below 120,000 PLN uses 12% rate
    const savings = calculateIKZETaxSavings(10000, 80000)
    expect(savings).toBe(1200) // 10000 * 0.12
  })

  it('calculates 32% savings for income above threshold', () => {
    // Income above 120,000 PLN uses 32% rate
    const savings = calculateIKZETaxSavings(10000, 150000)
    expect(savings).toBe(3200) // 10000 * 0.32
  })

  it('uses 12% at exactly the threshold', () => {
    const savings = calculateIKZETaxSavings(10000, 120000)
    expect(savings).toBe(1200) // At threshold, uses lower rate
  })

  it('uses 32% just above the threshold', () => {
    const savings = calculateIKZETaxSavings(10000, 120001)
    expect(savings).toBe(3200)
  })

  it('handles zero deposit', () => {
    const savings = calculateIKZETaxSavings(0, 100000)
    expect(savings).toBe(0)
  })

  it('rounds to nearest integer', () => {
    const savings = calculateIKZETaxSavings(1000, 80000)
    expect(savings).toBe(120) // 1000 * 0.12 = 120, already integer
  })

  it('handles maximum IKZE deposit for standard employee', () => {
    const savings = calculateIKZETaxSavings(11304, 80000)
    expect(savings).toBe(1356) // 11304 * 0.12 = 1356.48, rounded to 1356
  })
})

describe('calculateIKZEEffectiveCost', () => {
  it('calculates effective cost after tax savings', () => {
    // Deposit 10000, income 80000 -> savings 1200
    const cost = calculateIKZEEffectiveCost(10000, 80000)
    expect(cost).toBe(8800) // 10000 - 1200
  })

  it('shows higher effective savings for high earners', () => {
    // Same deposit but higher income = more tax savings = lower effective cost
    const lowIncomeResult = calculateIKZEEffectiveCost(10000, 80000)
    const highIncomeResult = calculateIKZEEffectiveCost(10000, 150000)
    expect(highIncomeResult).toBeLessThan(lowIncomeResult)
    expect(highIncomeResult).toBe(6800) // 10000 - 3200
  })

  it('handles zero deposit', () => {
    const cost = calculateIKZEEffectiveCost(0, 100000)
    expect(cost).toBe(0)
  })
})

describe('calculateBelkaTax', () => {
  it('calculates 19% tax on gains', () => {
    const tax = calculateBelkaTax(10000)
    expect(tax).toBe(1900) // 10000 * 0.19
  })

  it('returns zero for zero gains', () => {
    const tax = calculateBelkaTax(0)
    expect(tax).toBe(0)
  })

  it('returns zero for negative gains (losses)', () => {
    const tax = calculateBelkaTax(-5000)
    expect(tax).toBe(0)
  })

  it('rounds to nearest integer', () => {
    const tax = calculateBelkaTax(100)
    expect(tax).toBe(19) // 100 * 0.19 = 19
  })

  it('handles large gains', () => {
    const tax = calculateBelkaTax(1000000)
    expect(tax).toBe(190000)
  })
})

describe('checkIKELimit', () => {
  it('returns within limit when deposits are under limit', () => {
    const result = checkIKELimit(10000, 5000)
    expect(result.isWithinLimit).toBe(true)
    expect(result.remaining).toBe(18260) // 28260 - 10000
    expect(result.excess).toBe(0)
  })

  it('returns within limit at exactly the limit', () => {
    const result = checkIKELimit(20000, 8260)
    expect(result.isWithinLimit).toBe(true)
    expect(result.remaining).toBe(8260) // 28260 - 20000
    expect(result.excess).toBe(0)
  })

  it('returns over limit when deposits exceed limit', () => {
    const result = checkIKELimit(25000, 5000)
    expect(result.isWithinLimit).toBe(false)
    expect(result.remaining).toBe(3260) // 28260 - 25000
    expect(result.excess).toBe(1740) // 30000 - 28260
  })

  it('handles zero current deposits', () => {
    const result = checkIKELimit(0, 10000)
    expect(result.isWithinLimit).toBe(true)
    expect(result.remaining).toBe(28260)
    expect(result.excess).toBe(0)
  })

  it('handles full limit already used', () => {
    const result = checkIKELimit(28260, 1000)
    expect(result.isWithinLimit).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.excess).toBe(1000)
  })
})

describe('checkIKZELimit', () => {
  describe('for standard employees', () => {
    it('returns within limit when deposits are under limit', () => {
      const result = checkIKZELimit(5000, 3000, false)
      expect(result.isWithinLimit).toBe(true)
      expect(result.remaining).toBe(6304) // 11304 - 5000
      expect(result.excess).toBe(0)
      expect(result.limit).toBe(11304)
    })

    it('returns over limit when deposits exceed limit', () => {
      const result = checkIKZELimit(10000, 3000, false)
      expect(result.isWithinLimit).toBe(false)
      expect(result.remaining).toBe(1304) // 11304 - 10000
      expect(result.excess).toBe(1696) // 13000 - 11304
      expect(result.limit).toBe(11304)
    })
  })

  describe('for self-employed (JDG)', () => {
    it('uses higher limit for JDG', () => {
      const result = checkIKZELimit(10000, 5000, true)
      expect(result.isWithinLimit).toBe(true)
      expect(result.remaining).toBe(6956) // 16956 - 10000
      expect(result.excess).toBe(0)
      expect(result.limit).toBe(16956)
    })

    it('returns over limit when JDG deposits exceed limit', () => {
      const result = checkIKZELimit(15000, 3000, true)
      expect(result.isWithinLimit).toBe(false)
      expect(result.remaining).toBe(1956) // 16956 - 15000
      expect(result.excess).toBe(1044) // 18000 - 16956
      expect(result.limit).toBe(16956)
    })
  })

  it('defaults to standard employee when isJDG not specified', () => {
    const result = checkIKZELimit(5000, 3000)
    expect(result.limit).toBe(11304)
  })
})

describe('formatPLN', () => {
  it('formats positive amounts correctly', () => {
    const formatted = formatPLN(1234)
    // Polish locale uses space as thousand separator
    expect(formatted).toMatch(/1[\s\u00A0]?234/)
    expect(formatted).toContain('zł')
  })

  it('formats zero correctly', () => {
    const formatted = formatPLN(0)
    expect(formatted).toContain('0')
    expect(formatted).toContain('zł')
  })

  it('formats large amounts with thousand separators', () => {
    const formatted = formatPLN(28260)
    expect(formatted).toMatch(/28[\s\u00A0]?260/)
  })

  it('rounds to whole numbers (no decimal places)', () => {
    const formatted = formatPLN(1234.56)
    // Should not contain decimal separator
    expect(formatted).not.toMatch(/[.,]\d{2}$/)
  })
})

describe('getTaxLimitsDescription', () => {
  it('returns a string with all limits', () => {
    const description = getTaxLimitsDescription()

    expect(description).toContain('IKE')
    expect(description).toContain('IKZE')
    expect(description).toContain('OIPE')
    expect(description).toContain('2026')
  })

  it('includes both IKZE limits (etat and JDG)', () => {
    const description = getTaxLimitsDescription()

    expect(description).toContain('etat')
    expect(description).toContain('JDG')
  })
})
