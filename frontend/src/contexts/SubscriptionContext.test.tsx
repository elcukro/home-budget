import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { SubscriptionProvider, useSubscription } from './SubscriptionContext'

// Mock next-auth
const mockSession = {
  user: { email: 'test@example.com' },
}

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: mockSession,
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

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SubscriptionContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SubscriptionProvider>{children}</SubscriptionProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/billing/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'free',
            plan_type: 'free',
            is_premium: false,
            is_trial: false,
            trial_ends_at: null,
            trial_days_left: null,
            current_period_end: null,
            cancel_at_period_end: false,
            is_lifetime: false,
          }),
        })
      }
      if (url.includes('/billing/usage')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            is_premium: false,
            expenses: { used: 5, limit: 10, unlimited: false },
            incomes: { used: 3, limit: 5, unlimited: false },
            loans: { used: 1, limit: 3, unlimited: false },
            savings_goals: { used: 0, limit: 2, unlimited: false },
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
      const { result } = renderHook(() => useSubscription(), { wrapper })
      expect(result.current.isLoading).toBe(true)
    })

    it('has null subscription initially', () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })
      // Initially null before fetch completes
      expect(result.current.subscription).toBeNull()
    })
  })

  describe('free tier', () => {
    it('fetches and sets subscription status', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.subscription).toEqual({
        status: 'free',
        plan_type: 'free',
        is_premium: false,
        is_trial: false,
        trial_ends_at: null,
        trial_days_left: null,
        current_period_end: null,
        cancel_at_period_end: false,
        is_lifetime: false,
      })
    })

    it('derives isPremium correctly', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isPremium).toBe(false)
    })

    it('derives isTrial correctly', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isTrial).toBe(false)
    })

    it('fetches and sets usage data', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.usage).not.toBeNull()
      })

      expect(result.current.usage).toEqual({
        is_premium: false,
        expenses: { used: 5, limit: 10, unlimited: false },
        incomes: { used: 3, limit: 5, unlimited: false },
        loans: { used: 1, limit: 3, unlimited: false },
        savings_goals: { used: 0, limit: 2, unlimited: false },
      })
    })
  })

  describe('premium tier', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/billing/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'active',
              plan_type: 'premium',
              is_premium: true,
              is_trial: false,
              trial_ends_at: null,
              trial_days_left: null,
              current_period_end: '2025-12-31',
              cancel_at_period_end: false,
              is_lifetime: false,
            }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              is_premium: true,
              expenses: { used: 100, limit: null, unlimited: true },
              incomes: { used: 50, limit: null, unlimited: true },
              loans: { used: 10, limit: null, unlimited: true },
              savings_goals: { used: 5, limit: null, unlimited: true },
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })
    })

    it('sets isPremium to true', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isPremium).toBe(true)
    })

    it('has unlimited usage', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.usage).not.toBeNull()
      })

      expect(result.current.usage?.expenses.unlimited).toBe(true)
      expect(result.current.usage?.expenses.limit).toBeNull()
    })
  })

  describe('trial tier', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/billing/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'trialing',
              plan_type: 'trial',
              is_premium: false,
              is_trial: true,
              trial_ends_at: '2025-02-01',
              trial_days_left: 7,
              current_period_end: null,
              cancel_at_period_end: false,
              is_lifetime: false,
            }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              is_premium: false,
              expenses: { used: 5, limit: null, unlimited: true },
              incomes: { used: 3, limit: null, unlimited: true },
              loans: { used: 1, limit: null, unlimited: true },
              savings_goals: { used: 0, limit: null, unlimited: true },
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })
    })

    it('sets isTrial to true', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isTrial).toBe(true)
    })

    it('sets trialDaysLeft correctly', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.trialDaysLeft).toBe(7)
    })
  })

  describe('lifetime tier', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/billing/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'active',
              plan_type: 'lifetime',
              is_premium: true,
              is_trial: false,
              trial_ends_at: null,
              trial_days_left: null,
              current_period_end: null,
              cancel_at_period_end: false,
              is_lifetime: true,
            }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              is_premium: true,
              expenses: { used: 200, limit: null, unlimited: true },
              incomes: { used: 100, limit: null, unlimited: true },
              loans: { used: 20, limit: null, unlimited: true },
              savings_goals: { used: 10, limit: null, unlimited: true },
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })
    })

    it('sets isPremium to true for lifetime', async () => {
      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isPremium).toBe(true)
      expect(result.current.subscription?.is_lifetime).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles fetch failure gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
        })
      })

      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).not.toBeNull()
      // Should fall back to default status
      expect(result.current.subscription?.status).toBe('free')
    })

    it('handles network error gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.reject(new Error('Network error'))
      })

      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Network error')
    })
  })

  describe('createCheckout', () => {
    it('creates checkout session and returns URL', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/billing/checkout') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              checkout_url: 'https://checkout.stripe.com/session123',
            }),
          })
        }
        // Return default responses for status/usage
        if (url.includes('/billing/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'free', is_premium: false, is_trial: false }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ is_premium: false }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let checkoutUrl: string = ''
      await act(async () => {
        checkoutUrl = await result.current.createCheckout('premium')
      })

      expect(checkoutUrl).toBe('https://checkout.stripe.com/session123')
    })

    it('throws error on checkout failure', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/billing/checkout') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ detail: 'Payment failed' }),
          })
        }
        if (url.includes('/billing/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'free', is_premium: false, is_trial: false }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ is_premium: false }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(async () => {
        await result.current.createCheckout('premium')
      }).rejects.toThrow('Payment failed')
    })
  })

  describe('openPortal', () => {
    it('creates portal session and returns URL', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/billing/portal') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              portal_url: 'https://billing.stripe.com/portal123',
            }),
          })
        }
        if (url.includes('/billing/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'active', is_premium: true, is_trial: false }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ is_premium: true }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let portalUrl: string = ''
      await act(async () => {
        portalUrl = await result.current.openPortal()
      })

      expect(portalUrl).toBe('https://billing.stripe.com/portal123')
    })
  })

  describe('refreshSubscription', () => {
    it('refetches subscription data', async () => {
      let fetchCount = 0
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/billing/status')) {
          fetchCount++
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: fetchCount === 1 ? 'free' : 'active',
              is_premium: fetchCount > 1,
              is_trial: false,
            }),
          })
        }
        if (url.includes('/billing/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ is_premium: false }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isPremium).toBe(false)

      await act(async () => {
        await result.current.refreshSubscription()
      })

      await waitFor(() => {
        expect(result.current.isPremium).toBe(true)
      })
    })
  })
})
