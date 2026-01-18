import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePremiumGate } from './usePremiumGate'

// Mock dependencies
const mockPush = vi.fn()
const mockToast = vi.fn()
const mockFormatMessage = vi.fn((msg: { id: string }, values?: Record<string, unknown>) => {
  return values ? `${msg.id}: ${JSON.stringify(values)}` : msg.id
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: mockFormatMessage,
  }),
}))

// Mock subscription context with configurable values
const mockSubscriptionValues = {
  isPremium: false,
  isTrial: false,
  usage: null as {
    is_premium: boolean;
    expenses: { used: number; limit: number | null; unlimited: boolean };
    incomes: { used: number; limit: number | null; unlimited: boolean };
    loans: { used: number; limit: number | null; unlimited: boolean };
    savings_goals: { used: number; limit: number | null; unlimited: boolean };
  } | null,
  subscription: null,
}

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockSubscriptionValues,
}))

describe('usePremiumGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to free tier defaults
    mockSubscriptionValues.isPremium = false
    mockSubscriptionValues.isTrial = false
    mockSubscriptionValues.usage = null
    mockSubscriptionValues.subscription = null
  })

  describe('hasPremiumAccess', () => {
    it('returns false for free tier', () => {
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.hasPremiumAccess).toBe(false)
    })

    it('returns true for premium users', () => {
      mockSubscriptionValues.isPremium = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.hasPremiumAccess).toBe(true)
    })

    it('returns true for trial users', () => {
      mockSubscriptionValues.isTrial = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.hasPremiumAccess).toBe(true)
    })

    it('returns true when both premium and trial', () => {
      mockSubscriptionValues.isPremium = true
      mockSubscriptionValues.isTrial = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.hasPremiumAccess).toBe(true)
    })
  })

  describe('canUseBankIntegration', () => {
    it('returns false for free tier', () => {
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.canUseBankIntegration()).toBe(false)
    })

    it('returns true for premium users', () => {
      mockSubscriptionValues.isPremium = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.canUseBankIntegration()).toBe(true)
    })

    it('returns true for trial users', () => {
      mockSubscriptionValues.isTrial = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.canUseBankIntegration()).toBe(true)
    })
  })

  describe('canUseAIInsights', () => {
    it('returns false for free tier', () => {
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.canUseAIInsights()).toBe(false)
    })

    it('returns true for premium users', () => {
      mockSubscriptionValues.isPremium = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.canUseAIInsights()).toBe(true)
    })
  })

  describe('canExportFormat', () => {
    describe('free tier', () => {
      it('allows JSON export', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canExportFormat('json')).toBe(true)
        expect(result.current.canExportFormat('JSON')).toBe(true)
      })

      it('blocks CSV export', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canExportFormat('csv')).toBe(false)
        expect(result.current.canExportFormat('CSV')).toBe(false)
      })

      it('blocks Excel export', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canExportFormat('xlsx')).toBe(false)
        expect(result.current.canExportFormat('excel')).toBe(false)
      })

      it('blocks PDF export', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canExportFormat('pdf')).toBe(false)
      })
    })

    describe('premium tier', () => {
      beforeEach(() => {
        mockSubscriptionValues.isPremium = true
      })

      it('allows all formats', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canExportFormat('json')).toBe(true)
        expect(result.current.canExportFormat('csv')).toBe(true)
        expect(result.current.canExportFormat('xlsx')).toBe(true)
        expect(result.current.canExportFormat('pdf')).toBe(true)
      })
    })
  })

  describe('canAdd', () => {
    describe('premium tier', () => {
      it('always allows adding resources', () => {
        mockSubscriptionValues.isPremium = true
        const { result } = renderHook(() => usePremiumGate())

        expect(result.current.canAdd('expenses')).toEqual({ allowed: true, message: '' })
        expect(result.current.canAdd('incomes')).toEqual({ allowed: true, message: '' })
        expect(result.current.canAdd('loans')).toEqual({ allowed: true, message: '' })
        expect(result.current.canAdd('savings_goals')).toEqual({ allowed: true, message: '' })
      })
    })

    describe('free tier without usage data', () => {
      it('allows adding when usage data not loaded', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canAdd('expenses')).toEqual({ allowed: true, message: '' })
      })
    })

    describe('free tier with usage data', () => {
      beforeEach(() => {
        mockSubscriptionValues.usage = {
          is_premium: false,
          expenses: { used: 5, limit: 10, unlimited: false },
          incomes: { used: 3, limit: 5, unlimited: false },
          loans: { used: 2, limit: 2, unlimited: false },
          savings_goals: { used: 0, limit: 3, unlimited: false },
        }
      })

      it('allows adding when under limit', () => {
        const { result } = renderHook(() => usePremiumGate())
        const expenseResult = result.current.canAdd('expenses')
        expect(expenseResult.allowed).toBe(true)
        expect(expenseResult.message).toBe('')
      })

      it('blocks adding when at limit', () => {
        const { result } = renderHook(() => usePremiumGate())
        const loanResult = result.current.canAdd('loans')
        expect(loanResult.allowed).toBe(false)
        expect(loanResult.message).toContain('premium.limit.loans')
      })

      it('allows adding when unlimited', () => {
        mockSubscriptionValues.usage!.expenses.unlimited = true
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canAdd('expenses')).toEqual({ allowed: true, message: '' })
      })

      it('allows adding when limit is null', () => {
        mockSubscriptionValues.usage!.incomes.limit = null
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canAdd('incomes')).toEqual({ allowed: true, message: '' })
      })

      it('allows adding when used is 0', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.canAdd('savings_goals')).toEqual({ allowed: true, message: '' })
      })
    })
  })

  describe('getRemainingCount', () => {
    describe('premium tier', () => {
      it('returns null (unlimited) for premium users', () => {
        mockSubscriptionValues.isPremium = true
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('expenses')).toBeNull()
        expect(result.current.getRemainingCount('loans')).toBeNull()
      })
    })

    describe('free tier without usage data', () => {
      it('returns null when usage not loaded', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('expenses')).toBeNull()
      })
    })

    describe('free tier with usage data', () => {
      beforeEach(() => {
        mockSubscriptionValues.usage = {
          is_premium: false,
          expenses: { used: 7, limit: 10, unlimited: false },
          incomes: { used: 5, limit: 5, unlimited: false },
          loans: { used: 3, limit: 2, unlimited: false },
          savings_goals: { used: 0, limit: 3, unlimited: true },
        }
      })

      it('calculates remaining correctly', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('expenses')).toBe(3) // 10 - 7
      })

      it('returns 0 when at limit', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('incomes')).toBe(0) // 5 - 5
      })

      it('returns 0 when over limit (not negative)', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('loans')).toBe(0) // max(0, 2 - 3)
      })

      it('returns null for unlimited resources', () => {
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('savings_goals')).toBeNull()
      })

      it('returns null when limit is null', () => {
        mockSubscriptionValues.usage!.expenses.limit = null
        const { result } = renderHook(() => usePremiumGate())
        expect(result.current.getRemainingCount('expenses')).toBeNull()
      })
    })
  })

  describe('checkAccess', () => {
    describe('with premium access', () => {
      it('returns true without showing toast or redirecting', () => {
        mockSubscriptionValues.isPremium = true
        const { result } = renderHook(() => usePremiumGate())

        const hasAccess = result.current.checkAccess({ feature: 'Bank Integration' })

        expect(hasAccess).toBe(true)
        expect(mockToast).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
      })
    })

    describe('without premium access', () => {
      it('returns false and shows toast by default', () => {
        const { result } = renderHook(() => usePremiumGate())

        const hasAccess = result.current.checkAccess({ feature: 'AI Insights' })

        expect(hasAccess).toBe(false)
        expect(mockToast).toHaveBeenCalledWith({
          title: expect.stringContaining('premium.required.title'),
          description: 'premium.required.description',
          variant: 'destructive',
        })
        expect(mockPush).not.toHaveBeenCalled()
      })

      it('redirects to pricing when requested', () => {
        const { result } = renderHook(() => usePremiumGate())

        result.current.checkAccess({ feature: 'Export', redirectToPricing: true })

        expect(mockPush).toHaveBeenCalledWith('/pricing')
      })

      it('suppresses toast when showToast is false', () => {
        const { result } = renderHook(() => usePremiumGate())

        result.current.checkAccess({ feature: 'Bank', showToast: false })

        expect(mockToast).not.toHaveBeenCalled()
      })

      it('can redirect without showing toast', () => {
        const { result } = renderHook(() => usePremiumGate())

        result.current.checkAccess({
          feature: 'Premium Feature',
          redirectToPricing: true,
          showToast: false,
        })

        expect(mockToast).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/pricing')
      })
    })
  })

  describe('returned subscription data', () => {
    it('exposes isPremium from context', () => {
      mockSubscriptionValues.isPremium = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.isPremium).toBe(true)
    })

    it('exposes isTrial from context', () => {
      mockSubscriptionValues.isTrial = true
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.isTrial).toBe(true)
    })

    it('exposes usage from context', () => {
      const mockUsage = {
        is_premium: false,
        expenses: { used: 1, limit: 10, unlimited: false },
        incomes: { used: 2, limit: 5, unlimited: false },
        loans: { used: 0, limit: 2, unlimited: false },
        savings_goals: { used: 0, limit: 3, unlimited: false },
      }
      mockSubscriptionValues.usage = mockUsage
      const { result } = renderHook(() => usePremiumGate())
      expect(result.current.usage).toEqual(mockUsage)
    })
  })
})
