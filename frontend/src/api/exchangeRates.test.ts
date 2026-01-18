import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store module references
let getExchangeRates: typeof import('./exchangeRates').getExchangeRates
let convertCurrency: typeof import('./exchangeRates').convertCurrency

// Mock fetchWithAuth
const mockFetchWithAuth = vi.fn()

describe('Exchange Rates API', () => {
  const mockUsdRates = {
    rates: {
      EUR: 0.92,
      PLN: 4.05,
      GBP: 0.79,
    },
  }

  const mockPlnRates = {
    rates: {
      USD: 0.247,
      EUR: 0.227,
      GBP: 0.195,
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    vi.doMock('@/lib/logger', () => ({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }))

    vi.doMock('./fetchWithAuth', () => ({
      fetchWithAuth: mockFetchWithAuth,
    }))

    // Default mock for USD rates
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUsdRates),
      text: () => Promise.resolve(''),
    })

    // Import module fresh
    const exchangeModule = await import('./exchangeRates')
    getExchangeRates = exchangeModule.getExchangeRates
    convertCurrency = exchangeModule.convertCurrency
  })

  afterEach(() => {
    vi.doUnmock('@/lib/logger')
    vi.doUnmock('./fetchWithAuth')
  })

  describe('getExchangeRates', () => {
    it('returns exchange rates for a currency', async () => {
      const rates = await getExchangeRates('USD')
      expect(rates).toEqual(mockUsdRates.rates)
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/exchange-rates/USD')
      )
    })

    it('uses cached rates within 24 hours', async () => {
      // First call
      await getExchangeRates('USD')
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await getExchangeRates('USD')
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(1) // Still 1
    })

    it('caches different currencies separately', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsdRates),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPlnRates),
        })

      await getExchangeRates('USD')
      await getExchangeRates('PLN')

      expect(mockFetchWithAuth).toHaveBeenCalledTimes(2)
    })

    it('throws error on fetch failure', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      await expect(getExchangeRates('INVALID')).rejects.toThrow(
        'Failed to fetch exchange rates'
      )
    })

    it('throws error on network failure', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Network error'))

      await expect(getExchangeRates('USD')).rejects.toThrow('Network error')
    })
  })

  describe('convertCurrency', () => {
    it('returns same amount for same currency', async () => {
      const result = await convertCurrency(100, 'USD', 'USD')
      expect(result).toBe(100)
      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it('uses direct conversion endpoint when available', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ converted: 92.5 }),
      })

      const result = await convertCurrency(100, 'USD', 'EUR')
      expect(result).toBe(92.5)
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining('/exchange-rates/convert/USD/EUR/100')
      )
    })

    it('falls back to rate lookup when endpoint fails', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUsdRates),
        })

      const result = await convertCurrency(100, 'USD', 'EUR')
      // 100 * 0.92 (EUR rate)
      expect(result).toBe(92)
    })

    it('uses inverse rate when direct rate not available', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: false, // Direct convert fails
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: { GBP: 0.79 } }), // USD rates (no PLN)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: { USD: 0.247 } }), // PLN rates
        })

      // Converting USD to PLN: PLN has USD rate of 0.247
      // 100 USD / 0.247 = 404.86
      const result = await convertCurrency(100, 'USD', 'PLN')
      expect(result).toBeCloseTo(404.86, 1)
    })

    it('throws error when no conversion path found', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: false }) // Direct convert fails
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: {} }), // No rates for source
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: {} }), // No rates for target
        })

      await expect(convertCurrency(100, 'XXX', 'YYY')).rejects.toThrow(
        'Could not find exchange rate'
      )
    })

    it('handles large amounts correctly', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ converted: 4050000 }),
      })

      const result = await convertCurrency(1000000, 'USD', 'PLN')
      expect(result).toBe(4050000)
    })

    it('handles decimal amounts correctly', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ converted: 46.23 }),
      })

      const result = await convertCurrency(50.25, 'USD', 'EUR')
      expect(result).toBe(46.23)
    })

    it('handles zero amount', async () => {
      const result = await convertCurrency(0, 'USD', 'USD')
      expect(result).toBe(0)
    })

    it('throws on network error', async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Network error'))

      await expect(convertCurrency(100, 'USD', 'EUR')).rejects.toThrow(
        'Network error'
      )
    })
  })
})
