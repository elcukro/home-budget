import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getInitialLocale,
  formatLocaleCurrency,
  formatLocaleDate,
} from './i18n'

describe('i18n constants', () => {
  it('has correct supported locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'es', 'fr', 'pl'])
  })

  it('has English as default locale', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('DEFAULT_LOCALE is included in SUPPORTED_LOCALES', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE)
  })
})

describe('getInitialLocale', () => {
  let originalLanguage: string

  beforeEach(() => {
    originalLanguage = navigator.language
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    })
  })

  it('returns a supported locale', () => {
    const result = getInitialLocale()
    expect(SUPPORTED_LOCALES).toContain(result)
  })

  it('returns browser locale when supported (Polish)', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'pl-PL',
      configurable: true,
    })
    const result = getInitialLocale()
    expect(result).toBe('pl')
  })

  it('returns default locale for unsupported browser locale', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'de-DE',
      configurable: true,
    })
    const result = getInitialLocale()
    expect(result).toBe('en')
  })

  it('handles locale without region code', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'fr',
      configurable: true,
    })
    const result = getInitialLocale()
    expect(result).toBe('fr')
  })

  it('handles Spanish locale', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'es-MX',
      configurable: true,
    })
    const result = getInitialLocale()
    expect(result).toBe('es')
  })

  it('handles English locale variations', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'en-GB',
      configurable: true,
    })
    const result = getInitialLocale()
    expect(result).toBe('en')
  })

  it('extracts language code from full locale', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'pl-PL',
      configurable: true,
    })
    const result = getInitialLocale()
    // Should extract 'pl' from 'pl-PL'
    expect(result).toBe('pl')
  })
})

describe('formatLocaleCurrency', () => {
  describe('USD formatting', () => {
    it('formats positive amounts correctly', () => {
      const result = formatLocaleCurrency(1234.56, 'en', 'USD')
      expect(result).toContain('1,234.56')
      expect(result).toMatch(/\$|USD/)
    })

    it('formats zero correctly', () => {
      const result = formatLocaleCurrency(0, 'en', 'USD')
      expect(result).toContain('0.00')
    })

    it('formats negative amounts correctly', () => {
      const result = formatLocaleCurrency(-500.50, 'en', 'USD')
      expect(result).toContain('500.50')
    })

    it('rounds to 2 decimal places', () => {
      const result = formatLocaleCurrency(99.999, 'en', 'USD')
      expect(result).toContain('100.00')
    })
  })

  describe('PLN formatting', () => {
    it('formats for Polish locale', () => {
      const result = formatLocaleCurrency(1234.56, 'pl', 'PLN')
      // Polish uses space as thousand separator and comma as decimal
      expect(result).toMatch(/1[\s\u00A0]?234,56/)
      expect(result).toMatch(/zł|PLN/)
    })

    it('handles large amounts', () => {
      const result = formatLocaleCurrency(1000000, 'pl', 'PLN')
      expect(result).toMatch(/1[\s\u00A0]?000[\s\u00A0]?000/)
    })
  })

  describe('EUR formatting', () => {
    it('formats for French locale', () => {
      const result = formatLocaleCurrency(1234.56, 'fr', 'EUR')
      // French uses space as thousand separator
      expect(result).toMatch(/1[\s\u00A0]?234,56/)
      expect(result).toMatch(/€|EUR/)
    })

    it('formats for Spanish locale', () => {
      const result = formatLocaleCurrency(1234.56, 'es', 'EUR')
      expect(result).toContain('1234,56') // Spanish typically uses period for thousands
      expect(result).toMatch(/€|EUR/)
    })
  })

  describe('edge cases', () => {
    it('handles very small amounts', () => {
      const result = formatLocaleCurrency(0.01, 'en', 'USD')
      expect(result).toContain('0.01')
    })

    it('handles very large amounts', () => {
      const result = formatLocaleCurrency(9999999.99, 'en', 'USD')
      expect(result).toContain('9,999,999.99')
    })

    it('handles different currency codes', () => {
      const gbp = formatLocaleCurrency(100, 'en', 'GBP')
      expect(gbp).toMatch(/£|GBP/)

      const jpy = formatLocaleCurrency(1000, 'en', 'JPY')
      expect(jpy).toMatch(/¥|JPY|円/)
    })
  })
})

describe('formatLocaleDate', () => {
  describe('with Date objects', () => {
    it('formats date with default options', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'en')
      expect(result).toContain('2024')
      expect(result).toMatch(/Jun|June|6/)
      expect(result).toContain('15')
    })

    it('formats date for Polish locale', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'pl')
      expect(result).toContain('2024')
      expect(result).toMatch(/cze|czerw|6/)
      expect(result).toContain('15')
    })

    it('formats date for French locale', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'fr')
      expect(result).toContain('2024')
      expect(result).toMatch(/juin|6/)
      expect(result).toContain('15')
    })

    it('formats date for Spanish locale', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'es')
      expect(result).toContain('2024')
      expect(result).toMatch(/jun|6/)
      expect(result).toContain('15')
    })
  })

  describe('with string dates', () => {
    it('parses and formats ISO date strings', () => {
      const result = formatLocaleDate('2024-12-25', 'en')
      expect(result).toContain('2024')
      expect(result).toMatch(/Dec|December|12/)
      expect(result).toContain('25')
    })

    it('handles date-time strings', () => {
      const result = formatLocaleDate('2024-01-01T12:00:00Z', 'en')
      expect(result).toContain('2024')
      expect(result).toMatch(/Jan|January|1/)
    })
  })

  describe('with custom options', () => {
    it('formats with short style', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'en', { dateStyle: 'short' })
      // Short format is typically MM/DD/YY or similar
      expect(result).toMatch(/\d/)
    })

    it('formats with long style', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'en', { dateStyle: 'long' })
      expect(result).toMatch(/June|Jun/)
      expect(result).toContain('2024')
    })

    it('formats with full style', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'en', { dateStyle: 'full' })
      // Full format includes day of week
      expect(result).toMatch(/Saturday|Sat/)
    })

    it('formats with custom components', () => {
      const date = new Date('2024-06-15')
      const result = formatLocaleDate(date, 'en', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      expect(result).toMatch(/06/)
      expect(result).toMatch(/15/)
      expect(result).toMatch(/2024/)
    })
  })

  describe('edge cases', () => {
    it('handles year boundary dates', () => {
      const newYear = formatLocaleDate(new Date('2024-01-01'), 'en')
      expect(newYear).toMatch(/Jan|1/)
      expect(newYear).toContain('2024')

      const newYearsEve = formatLocaleDate(new Date('2024-12-31'), 'en')
      expect(newYearsEve).toMatch(/Dec|12/)
      expect(newYearsEve).toContain('2024')
    })

    it('handles leap year date', () => {
      const leapDay = formatLocaleDate(new Date('2024-02-29'), 'en')
      expect(leapDay).toMatch(/Feb|2/)
      expect(leapDay).toContain('29')
    })
  })
})
