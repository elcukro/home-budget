import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  // Constants
  IKE_LIMIT_2026,
  IKZE_LIMIT_2026_STANDARD,
  IKZE_LIMIT_2026_JDG,
  OIPE_LIMIT_2026,
  PPK_EMPLOYEE_MIN,
  PPK_EMPLOYEE_DEFAULT,
  PPK_EMPLOYEE_MAX,
  PPK_EMPLOYER_MIN,
  PPK_EMPLOYER_MAX,
  PPK_STATE_ANNUAL,
  PPK_STATE_WELCOME,
  TAX_FREE_AMOUNT,
  TAX_THRESHOLD,
  TAX_RELIEF_AMOUNT,
  TAX_RATE_12,
  TAX_RATE_32,
  LINEAR_TAX_RATE,
  CAPITAL_GAINS_TAX,
  ZUS_PENSION,
  ZUS_DISABILITY,
  ZUS_SICKNESS,
  ZUS_HEALTH_SCALE,
  ZUS_HEALTH_LINEAR,
  ZUS_JDG_FULL_2026,
  CHILD_RELIEF_1ST,
  CHILD_RELIEF_2ND,
  CHILD_RELIEF_3RD,
  CHILD_RELIEF_4TH_PLUS,
  YOUNG_RELIEF_AGE_LIMIT,
  YOUNG_RELIEF_INCOME_LIMIT,
  KUP_STANDARD,
  KUP_AUTHOR,
  CHILD_BENEFIT_800_PLUS,
  CHILD_BENEFIT_INCOME_THRESHOLD,
  MINIMUM_WAGE_2026,
  PPK_REDUCED_CONTRIBUTION_THRESHOLD,
  // Functions
  calculateChildTaxRelief,
  getIKZELimit,
  calculateHealthContribution,
  isEligibleForYouthRelief,
  calculatePPKEmployerContribution,
} from './tax-2026'

describe('Tax 2026 Constants', () => {
  describe('III Filar (Retirement Savings) limits', () => {
    it('has correct IKE limit', () => {
      expect(IKE_LIMIT_2026).toBe(28260)
    })

    it('has correct IKZE standard limit', () => {
      expect(IKZE_LIMIT_2026_STANDARD).toBe(11304)
    })

    it('has correct IKZE JDG limit', () => {
      expect(IKZE_LIMIT_2026_JDG).toBe(16956)
    })

    it('has correct OIPE limit', () => {
      expect(OIPE_LIMIT_2026).toBe(28260)
    })
  })

  describe('PPK rates', () => {
    it('has correct employee rates', () => {
      expect(PPK_EMPLOYEE_MIN).toBe(0.005)
      expect(PPK_EMPLOYEE_DEFAULT).toBe(0.02)
      expect(PPK_EMPLOYEE_MAX).toBe(0.04)
    })

    it('has correct employer rates', () => {
      expect(PPK_EMPLOYER_MIN).toBe(0.015)
      expect(PPK_EMPLOYER_MAX).toBe(0.04)
    })

    it('has correct state contributions', () => {
      expect(PPK_STATE_ANNUAL).toBe(240)
      expect(PPK_STATE_WELCOME).toBe(250)
    })
  })

  describe('Tax rates', () => {
    it('has correct tax-free amount', () => {
      expect(TAX_FREE_AMOUNT).toBe(30000)
    })

    it('has correct tax threshold', () => {
      expect(TAX_THRESHOLD).toBe(120000)
    })

    it('has correct tax relief amount', () => {
      expect(TAX_RELIEF_AMOUNT).toBe(3600)
    })

    it('has correct PIT rates', () => {
      expect(TAX_RATE_12).toBe(0.12)
      expect(TAX_RATE_32).toBe(0.32)
    })

    it('has correct linear and capital gains rates', () => {
      expect(LINEAR_TAX_RATE).toBe(0.19)
      expect(CAPITAL_GAINS_TAX).toBe(0.19)
    })
  })

  describe('ZUS contributions (employee)', () => {
    it('has correct pension rate', () => {
      expect(ZUS_PENSION).toBe(0.0976)
    })

    it('has correct disability rate', () => {
      expect(ZUS_DISABILITY).toBe(0.015)
    })

    it('has correct sickness rate', () => {
      expect(ZUS_SICKNESS).toBe(0.0245)
    })

    it('has correct health insurance rates', () => {
      expect(ZUS_HEALTH_SCALE).toBe(0.09)
      expect(ZUS_HEALTH_LINEAR).toBe(0.049)
    })
  })

  describe('ZUS for JDG (self-employed)', () => {
    it('has correct full ZUS amounts', () => {
      expect(ZUS_JDG_FULL_2026.pension).toBe(1209.98)
      expect(ZUS_JDG_FULL_2026.disability).toBe(496.54)
      expect(ZUS_JDG_FULL_2026.sickness).toBe(152.26)
      expect(ZUS_JDG_FULL_2026.accident).toBe(20.37)
      expect(ZUS_JDG_FULL_2026.labor_fund).toBe(152.26)
      expect(ZUS_JDG_FULL_2026.total_without_health).toBe(2031.41)
    })
  })

  describe('Child tax relief amounts', () => {
    it('has correct relief amounts', () => {
      expect(CHILD_RELIEF_1ST).toBe(1112.04)
      expect(CHILD_RELIEF_2ND).toBe(1112.04)
      expect(CHILD_RELIEF_3RD).toBe(2000.04)
      expect(CHILD_RELIEF_4TH_PLUS).toBe(2700.00)
    })
  })

  describe('Youth relief constants', () => {
    it('has correct age limit', () => {
      expect(YOUNG_RELIEF_AGE_LIMIT).toBe(26)
    })

    it('has correct income limit', () => {
      expect(YOUNG_RELIEF_INCOME_LIMIT).toBe(85528)
    })
  })

  describe('KUP (tax deductible costs)', () => {
    it('has correct standard KUP', () => {
      expect(KUP_STANDARD).toBe(0.20)
    })

    it('has correct author KUP', () => {
      expect(KUP_AUTHOR).toBe(0.50)
    })
  })

  describe('Family benefits', () => {
    it('has correct 800+ benefit', () => {
      expect(CHILD_BENEFIT_800_PLUS).toBe(800)
    })

    it('has correct income threshold', () => {
      expect(CHILD_BENEFIT_INCOME_THRESHOLD).toBe(1922)
    })
  })

  describe('Minimum wage', () => {
    it('has correct minimum wage', () => {
      expect(MINIMUM_WAGE_2026).toBe(4806)
    })

    it('has correct PPK reduced contribution threshold', () => {
      expect(PPK_REDUCED_CONTRIBUTION_THRESHOLD).toBe(5767.20)
    })
  })
})

describe('calculateChildTaxRelief', () => {
  it('returns 0 for no children', () => {
    expect(calculateChildTaxRelief(0)).toBe(0)
  })

  it('returns 0 for negative children count', () => {
    expect(calculateChildTaxRelief(-1)).toBe(0)
  })

  it('returns correct amount for 1 child', () => {
    expect(calculateChildTaxRelief(1)).toBe(1112.04)
  })

  it('returns correct amount for 2 children', () => {
    expect(calculateChildTaxRelief(2)).toBe(2224.08) // 1112.04 + 1112.04
  })

  it('returns correct amount for 3 children', () => {
    expect(calculateChildTaxRelief(3)).toBe(4224.12) // 1112.04 + 1112.04 + 2000.04
  })

  it('returns correct amount for 4 children', () => {
    expect(calculateChildTaxRelief(4)).toBe(6924.12) // 1112.04 + 1112.04 + 2000.04 + 2700.00
  })

  it('returns correct amount for 5 children', () => {
    expect(calculateChildTaxRelief(5)).toBeCloseTo(9624.12, 2) // 1112.04 + 1112.04 + 2000.04 + 2*2700.00
  })

  it('handles large number of children', () => {
    // 10 children: 1st + 2nd + 3rd + 7*4th+
    const expected = 1112.04 + 1112.04 + 2000.04 + 7 * 2700.00
    expect(calculateChildTaxRelief(10)).toBeCloseTo(expected, 2)
  })
})

describe('getIKZELimit', () => {
  it('returns JDG limit for business employment', () => {
    expect(getIKZELimit('business')).toBe(16956)
  })

  it('returns JDG limit for b2b employment', () => {
    expect(getIKZELimit('b2b')).toBe(16956)
  })

  it('returns standard limit for employment', () => {
    expect(getIKZELimit('employment')).toBe(11304)
  })

  it('returns standard limit for employee', () => {
    expect(getIKZELimit('employee')).toBe(11304)
  })

  it('returns standard limit for umowa-o-prace', () => {
    expect(getIKZELimit('umowa-o-prace')).toBe(11304)
  })

  it('returns standard limit for unknown types', () => {
    expect(getIKZELimit('unknown')).toBe(11304)
  })

  it('returns standard limit for empty string', () => {
    expect(getIKZELimit('')).toBe(11304)
  })
})

describe('calculateHealthContribution', () => {
  describe('scale tax form', () => {
    it('calculates 9% for scale tax', () => {
      expect(calculateHealthContribution('scale', 10000)).toBe(900)
    })

    it('handles zero income', () => {
      expect(calculateHealthContribution('scale', 0)).toBe(0)
    })

    it('handles typical monthly income', () => {
      expect(calculateHealthContribution('scale', 8000)).toBe(720)
    })
  })

  describe('linear tax form', () => {
    it('calculates 4.9% for linear tax', () => {
      expect(calculateHealthContribution('linear', 10000)).toBe(490)
    })

    it('handles zero income', () => {
      expect(calculateHealthContribution('linear', 0)).toBe(0)
    })

    it('handles typical monthly income', () => {
      expect(calculateHealthContribution('linear', 20000)).toBe(980)
    })
  })

  describe('lumpsum tax form', () => {
    it('returns 0 for lumpsum (fixed amounts in reality)', () => {
      expect(calculateHealthContribution('lumpsum', 10000)).toBe(0)
    })

    it('returns 0 regardless of income', () => {
      expect(calculateHealthContribution('lumpsum', 100000)).toBe(0)
    })
  })
})

describe('isEligibleForYouthRelief', () => {
  beforeEach(() => {
    // Mock current date to 2026-01-18
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-18'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for person under 26', () => {
    const birthDate = new Date('2001-01-19') // 24 years old
    expect(isEligibleForYouthRelief(birthDate)).toBe(true)
  })

  it('returns true for person exactly 25', () => {
    const birthDate = new Date('2000-06-15') // 25 years old
    expect(isEligibleForYouthRelief(birthDate)).toBe(true)
  })

  it('returns false for person exactly 26', () => {
    const birthDate = new Date('2000-01-18') // exactly 26 today
    expect(isEligibleForYouthRelief(birthDate)).toBe(false)
  })

  it('returns false for person over 26', () => {
    const birthDate = new Date('1999-01-01') // 27 years old
    expect(isEligibleForYouthRelief(birthDate)).toBe(false)
  })

  it('handles birthday not yet occurred this year', () => {
    const birthDate = new Date('2000-12-31') // will turn 26 later this year
    expect(isEligibleForYouthRelief(birthDate)).toBe(true)
  })

  it('handles birthday already occurred this year', () => {
    const birthDate = new Date('2000-01-01') // already turned 26
    expect(isEligibleForYouthRelief(birthDate)).toBe(false)
  })

  it('returns true for very young person', () => {
    const birthDate = new Date('2010-05-15') // 15 years old
    expect(isEligibleForYouthRelief(birthDate)).toBe(true)
  })
})

describe('calculatePPKEmployerContribution', () => {
  it('calculates with default employer rate (1.5%)', () => {
    const result = calculatePPKEmployerContribution(100000)
    expect(result).toBe(1500 + 240) // 1.5% + state annual
  })

  it('calculates with custom employer rate', () => {
    const result = calculatePPKEmployerContribution(100000, 0.025)
    expect(result).toBe(2500 + 240) // 2.5% + state annual
  })

  it('calculates with maximum employer rate (4%)', () => {
    const result = calculatePPKEmployerContribution(100000, 0.04)
    expect(result).toBe(4000 + 240) // 4% + state annual
  })

  it('handles zero salary', () => {
    const result = calculatePPKEmployerContribution(0)
    expect(result).toBe(240) // Only state annual contribution
  })

  it('handles typical annual salary', () => {
    const result = calculatePPKEmployerContribution(120000, 0.015)
    expect(result).toBe(1800 + 240) // 1.5% of 120000 + 240
  })

  it('handles minimum wage annual salary', () => {
    const annualMinWage = MINIMUM_WAGE_2026 * 12 // 57672
    const result = calculatePPKEmployerContribution(annualMinWage)
    expect(result).toBe(annualMinWage * 0.015 + 240)
  })
})
