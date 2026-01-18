import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { SettingsProvider, useSettings } from './SettingsContext'

// Mock next-auth
const mockSession = {
  user: { email: 'test@example.com' },
}

let sessionData: typeof mockSession | null = mockSession

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: sessionData,
  }),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock convertCurrency
const mockConvertCurrency = vi.fn()
vi.mock('@/api/exchangeRates', () => ({
  convertCurrency: (amount: number, from: string, to: string) => mockConvertCurrency(amount, from, to),
}))

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
  }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SettingsContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  )

  const defaultSettings = {
    language: 'en',
    currency: 'USD',
    ai: { apiKey: undefined },
    emergency_fund_target: 3000,
    emergency_fund_months: 3,
    base_currency: 'USD',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    sessionData = mockSession
    mockConvertCurrency.mockResolvedValue(1000) // Default conversion result

    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            language: 'en',
            currency: 'USD',
            emergency_fund_target: 3000,
            emergency_fund_months: 3,
            base_currency: 'USD',
          }),
        })
      }
      return Promise.resolve({ ok: false })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts with loading true', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.isLoading).toBe(true)
    })

    it('has default settings initially', () => {
      const { result } = renderHook(() => useSettings(), { wrapper })
      expect(result.current.settings).toBeDefined()
      expect(result.current.settings?.currency).toBe('USD')
    })
  })

  describe('fetching settings', () => {
    it('fetches and sets settings for logged in user', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              language: 'pl',
              currency: 'PLN',
              emergency_fund_target: 5000,
              emergency_fund_months: 6,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.settings?.language).toBe('pl')
      expect(result.current.settings?.currency).toBe('PLN')
      expect(result.current.settings?.emergency_fund_target).toBe(5000)
    })

    it('stores language in localStorage when fetched', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              language: 'fr',
              currency: 'EUR',
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('firedup_language', 'fr')
    })

    it('uses stored language for logged out users', async () => {
      sessionData = null
      localStorageMock.getItem.mockReturnValue('es')

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.settings?.language).toBe('es')
    })

    it('uses default locale when no stored language', async () => {
      sessionData = null
      localStorageMock.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.settings?.language).toBe('en')
    })

    it('handles fetch error gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).not.toBeNull()
      // Should fall back to default settings
      expect(result.current.settings?.currency).toBe('USD')
    })
  })

  describe('updateSettings', () => {
    it('updates settings via API', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/settings') && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(defaultSettings),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateSettings({
          language: 'pl',
          currency: 'PLN',
        })
      })

      expect(result.current.settings?.language).toBe('pl')
      expect(result.current.settings?.currency).toBe('PLN')
    })

    it('stores language preference when updated', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(defaultSettings),
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateSettings({
          language: 'fr',
          currency: 'EUR',
        })
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('firedup_language', 'fr')
    })

    it('throws error when not logged in', async () => {
      sessionData = null

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(async () => {
        await result.current.updateSettings({
          language: 'pl',
          currency: 'PLN',
        })
      }).rejects.toThrow('You must be logged in to update settings')
    })

    it('throws error when API fails', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(defaultSettings),
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(async () => {
        await result.current.updateSettings({
          language: 'invalid',
          currency: 'INVALID',
        })
      }).rejects.toThrow('Failed to update settings')
    })
  })

  describe('currency conversion on settings change', () => {
    it('converts emergency fund target when currency changes', async () => {
      mockConvertCurrency.mockResolvedValue(20000) // 5000 USD -> 20000 PLN

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ...defaultSettings,
            emergency_fund_target: 5000,
            base_currency: 'USD',
          }),
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateSettings({
          language: 'pl',
          currency: 'PLN',
          emergency_fund_target: 5000,
        })
      })

      expect(mockConvertCurrency).toHaveBeenCalledWith(5000, 'USD', 'PLN')
      expect(result.current.settings?.emergency_fund_target).toBe(20000)
      expect(result.current.settings?.base_currency).toBe('PLN')
    })

    it('rounds converted amount to nearest whole number', async () => {
      mockConvertCurrency.mockResolvedValue(19999.7) // Returns decimal

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ...defaultSettings,
            emergency_fund_target: 5000,
          }),
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateSettings({
          language: 'en',
          currency: 'EUR',
          emergency_fund_target: 5000,
        })
      })

      expect(result.current.settings?.emergency_fund_target).toBe(20000) // Rounded
    })

    it('handles conversion failure gracefully', async () => {
      mockConvertCurrency.mockRejectedValue(new Error('Conversion failed'))

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ...defaultSettings,
            emergency_fund_target: 5000,
          }),
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not throw, just log warning and keep original amount
      await act(async () => {
        await result.current.updateSettings({
          language: 'en',
          currency: 'EUR',
          emergency_fund_target: 5000,
        })
      })

      // Original amount kept, but base_currency updated
      expect(result.current.settings?.emergency_fund_target).toBe(5000)
      expect(result.current.settings?.base_currency).toBe('EUR')
    })

    it('does not convert when currency stays the same', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(defaultSettings),
        })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.updateSettings({
          language: 'pl',
          currency: 'USD', // Same currency
          emergency_fund_target: 5000,
        })
      })

      expect(mockConvertCurrency).not.toHaveBeenCalled()
    })
  })

  describe('formatCurrency', () => {
    it('formats currency using settings', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              language: 'en',
              currency: 'USD',
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const formatted = result.current.formatCurrency(1234.56)
      expect(formatted).toContain('1,234.56')
      expect(formatted).toMatch(/\$|USD/)
    })

    it('formats PLN currency correctly', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              language: 'pl',
              currency: 'PLN',
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const formatted = result.current.formatCurrency(1234.56)
      expect(formatted).toMatch(/zł|PLN/)
    })

    it('returns string representation when no settings', async () => {
      // Force settings to be null by testing before fetch completes
      sessionData = null
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useSettings(), { wrapper })

      // Before settings load, should have default settings
      const formatted = result.current.formatCurrency(1234)
      expect(typeof formatted).toBe('string')
    })
  })

  describe('tax-related settings', () => {
    it('handles Polish tax settings', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              language: 'pl',
              currency: 'PLN',
              employment_status: 'b2b',
              tax_form: 'linear',
              birth_year: 1995,
              use_authors_costs: true,
              ppk_enrolled: true,
              ppk_employee_rate: 0.02,
              ppk_employer_rate: 0.015,
              children_count: 2,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.settings?.employment_status).toBe('b2b')
      expect(result.current.settings?.tax_form).toBe('linear')
      expect(result.current.settings?.birth_year).toBe(1995)
      expect(result.current.settings?.use_authors_costs).toBe(true)
      expect(result.current.settings?.ppk_enrolled).toBe(true)
      expect(result.current.settings?.ppk_employee_rate).toBe(0.02)
      expect(result.current.settings?.children_count).toBe(2)
    })
  })

  describe('onboarding status', () => {
    it('tracks onboarding completion status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              language: 'pl',
              currency: 'PLN',
              onboarding_completed: true,
              onboarding_completed_at: '2024-01-15T10:30:00Z',
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.settings?.onboarding_completed).toBe(true)
      expect(result.current.settings?.onboarding_completed_at).toBe('2024-01-15T10:30:00Z')
    })
  })
})
