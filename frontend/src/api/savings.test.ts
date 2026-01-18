import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SavingCategory, GoalStatus } from '@/types/financial-freedom'

// Store module references
let getSavingsSummary: typeof import('./savings').getSavingsSummary
let getEmergencyFundSavings: typeof import('./savings').getEmergencyFundSavings
let getGeneralSavings: typeof import('./savings').getGeneralSavings
let getLiquidSavingsForEmergencyFund: typeof import('./savings').getLiquidSavingsForEmergencyFund
let getMonthlyRecurringExpenses: typeof import('./savings').getMonthlyRecurringExpenses
let getRetirementLimits: typeof import('./savings').getRetirementLimits
let getSavingsGoals: typeof import('./savings').getSavingsGoals
let getSavingsGoal: typeof import('./savings').getSavingsGoal
let createSavingsGoal: typeof import('./savings').createSavingsGoal
let updateSavingsGoal: typeof import('./savings').updateSavingsGoal
let deleteSavingsGoal: typeof import('./savings').deleteSavingsGoal
let completeGoal: typeof import('./savings').completeGoal

// Mock fetch globally
const mockFetch = vi.fn()

describe('Savings API', () => {
  const mockSummary = {
    total_savings: 50000,
    category_totals: {
      [SavingCategory.EMERGENCY_FUND]: 10000,
      [SavingCategory.SIX_MONTH_FUND]: 15000,
      [SavingCategory.RETIREMENT]: 5000,
      [SavingCategory.COLLEGE]: 0,
      [SavingCategory.GENERAL]: 8000,
      [SavingCategory.INVESTMENT]: 10000,
      [SavingCategory.REAL_ESTATE]: 2000,
      [SavingCategory.OTHER]: 0,
    },
    monthly_contribution: 2000,
    recent_transactions: [],
    emergency_fund: 10000,
    emergency_fund_target: 30000,
    emergency_fund_progress: 33.33,
  }

  const mockGoal = {
    id: 1,
    user_id: 'test@example.com',
    name: 'New Car Fund',
    category: SavingCategory.GENERAL,
    target_amount: 50000,
    current_amount: 15000,
    deadline: '2027-01-01',
    icon: 'car',
    color: '#3B82F6',
    status: GoalStatus.ACTIVE,
    priority: 1,
    notes: 'For a new electric car',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: null,
    completed_at: null,
    progress_percent: 30,
    remaining_amount: 35000,
    is_on_track: true,
    monthly_needed: 1500,
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    global.fetch = mockFetch

    vi.doMock('@/lib/logger', () => ({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }))

    // Default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSummary),
    })

    // Import module fresh
    const savingsModule = await import('./savings')
    getSavingsSummary = savingsModule.getSavingsSummary
    getEmergencyFundSavings = savingsModule.getEmergencyFundSavings
    getGeneralSavings = savingsModule.getGeneralSavings
    getLiquidSavingsForEmergencyFund = savingsModule.getLiquidSavingsForEmergencyFund
    getMonthlyRecurringExpenses = savingsModule.getMonthlyRecurringExpenses
    getRetirementLimits = savingsModule.getRetirementLimits
    getSavingsGoals = savingsModule.getSavingsGoals
    getSavingsGoal = savingsModule.getSavingsGoal
    createSavingsGoal = savingsModule.createSavingsGoal
    updateSavingsGoal = savingsModule.updateSavingsGoal
    deleteSavingsGoal = savingsModule.deleteSavingsGoal
    completeGoal = savingsModule.completeGoal
  })

  afterEach(() => {
    vi.doUnmock('@/lib/logger')
  })

  describe('getSavingsSummary', () => {
    it('returns savings summary from API', async () => {
      const summary = await getSavingsSummary()
      expect(summary).toEqual(mockSummary)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/summary')
    })

    it('returns empty summary on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const summary = await getSavingsSummary()
      expect(summary.total_savings).toBe(0)
      expect(summary.category_totals[SavingCategory.EMERGENCY_FUND]).toBe(0)
    })

    it('returns empty summary on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })
      const summary = await getSavingsSummary()
      expect(summary.total_savings).toBe(0)
    })

    it('normalizes missing fields to defaults', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total_savings: 100 }), // partial data
      })
      const summary = await getSavingsSummary()
      expect(summary.total_savings).toBe(100)
      expect(summary.monthly_contribution).toBe(0)
      expect(summary.recent_transactions).toEqual([])
      expect(summary.category_totals[SavingCategory.EMERGENCY_FUND]).toBe(0)
    })

    it('uses cached data within cache duration', async () => {
      await getSavingsSummary()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      await getSavingsSummary()
      expect(mockFetch).toHaveBeenCalledTimes(1) // Still 1 (cached)
    })
  })

  describe('getEmergencyFundSavings', () => {
    it('returns emergency fund amount from summary', async () => {
      const amount = await getEmergencyFundSavings()
      expect(amount).toBe(10000)
    })

    it('returns 0 on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const amount = await getEmergencyFundSavings()
      expect(amount).toBe(0)
    })

    it('returns 0 when emergency fund is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total_savings: 1000 }),
      })
      const amount = await getEmergencyFundSavings()
      expect(amount).toBe(0)
    })
  })

  describe('getGeneralSavings', () => {
    it('returns general savings amount from summary', async () => {
      const amount = await getGeneralSavings()
      expect(amount).toBe(8000)
    })

    it('returns 0 on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const amount = await getGeneralSavings()
      expect(amount).toBe(0)
    })
  })

  describe('getLiquidSavingsForEmergencyFund', () => {
    it('calculates liquid savings (emergency + six_month + general)', async () => {
      const amount = await getLiquidSavingsForEmergencyFund()
      // 10000 (emergency) + 15000 (six_month) + 8000 (general) = 33000
      expect(amount).toBe(33000)
    })

    it('returns 0 on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const amount = await getLiquidSavingsForEmergencyFund()
      expect(amount).toBe(0)
    })

    it('excludes non-liquid categories (retirement, investment, etc)', async () => {
      const amount = await getLiquidSavingsForEmergencyFund()
      // Should not include retirement (5000), investment (10000), real_estate (2000)
      expect(amount).toBeLessThan(50000)
      expect(amount).toBe(33000)
    })
  })

  describe('getMonthlyRecurringExpenses', () => {
    it('returns monthly expenses from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total: 5000 }),
      })
      const expenses = await getMonthlyRecurringExpenses()
      expect(expenses).toBe(5000)
      expect(mockFetch).toHaveBeenCalledWith('/api/expenses/monthly')
    })

    it('returns default 3000 on 404 (endpoint not implemented)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })
      const expenses = await getMonthlyRecurringExpenses()
      expect(expenses).toBe(3000)
    })

    it('returns default 3000 on other errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
      const expenses = await getMonthlyRecurringExpenses()
      expect(expenses).toBe(3000)
    })

    it('returns default 3000 on fetch exception', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const expenses = await getMonthlyRecurringExpenses()
      expect(expenses).toBe(3000)
    })

    it('returns default 3000 when response has no total', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
      const expenses = await getMonthlyRecurringExpenses()
      expect(expenses).toBe(3000)
    })

    it('uses cached data within cache duration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ total: 4500 }),
      })

      await getMonthlyRecurringExpenses()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      await getMonthlyRecurringExpenses()
      expect(mockFetch).toHaveBeenCalledTimes(1) // Cached
    })
  })

  describe('getRetirementLimits', () => {
    const mockRetirementLimits = {
      year: 2026,
      accounts: [
        {
          account_type: 'ike',
          year: 2026,
          annual_limit: 28260,
          current_contributions: 10000,
          remaining_limit: 18260,
          percentage_used: 35.4,
          is_over_limit: false,
        },
      ],
      total_retirement_contributions: 10000,
      ike_limit: 28260,
      ikze_limit_standard: 11304,
      ikze_limit_jdg: 16956,
    }

    it('returns retirement limits from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRetirementLimits),
      })
      const limits = await getRetirementLimits()
      expect(limits).toEqual(mockRetirementLimits)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/retirement-limits')
    })

    it('includes year parameter when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRetirementLimits),
      })
      await getRetirementLimits(2025)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/retirement-limits?year=2025')
    })

    it('includes is_self_employed parameter when true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRetirementLimits),
      })
      await getRetirementLimits(undefined, true)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/retirement-limits?is_self_employed=true')
    })

    it('includes both parameters when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRetirementLimits),
      })
      await getRetirementLimits(2026, true)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/savings/retirement-limits?year=2026&is_self_employed=true'
      )
    })

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const limits = await getRetirementLimits()
      expect(limits).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
      const limits = await getRetirementLimits()
      expect(limits).toBeNull()
    })
  })

  describe('getSavingsGoals', () => {
    const mockGoals = [mockGoal]

    it('returns savings goals from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoals),
      })
      const goals = await getSavingsGoals()
      expect(goals).toEqual(mockGoals)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals')
    })

    it('filters by status when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoals),
      })
      await getSavingsGoals(GoalStatus.ACTIVE)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals?status=active')
    })

    it('filters by category when specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoals),
      })
      await getSavingsGoals(undefined, SavingCategory.EMERGENCY_FUND)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals?category=emergency_fund')
    })

    it('filters by both status and category', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoals),
      })
      await getSavingsGoals(GoalStatus.COMPLETED, SavingCategory.GENERAL)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals?status=completed&category=general')
    })

    it('returns empty array on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const goals = await getSavingsGoals()
      expect(goals).toEqual([])
    })

    it('returns empty array on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })
      const goals = await getSavingsGoals()
      expect(goals).toEqual([])
    })
  })

  describe('getSavingsGoal', () => {
    const mockGoalWithSavings = {
      ...mockGoal,
      savings: [
        {
          id: 1,
          user_id: 1,
          category: SavingCategory.GENERAL,
          amount: 500,
          date: '2024-01-15',
          is_recurring: true,
          saving_type: 'deposit',
          goal_id: 1,
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
        },
      ],
    }

    it('returns single goal with savings', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoalWithSavings),
      })
      const goal = await getSavingsGoal(1)
      expect(goal).toEqual(mockGoalWithSavings)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals/1')
    })

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const goal = await getSavingsGoal(1)
      expect(goal).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })
      const goal = await getSavingsGoal(999)
      expect(goal).toBeNull()
    })
  })

  describe('createSavingsGoal', () => {
    const newGoal = {
      name: 'Vacation Fund',
      category: SavingCategory.GENERAL,
      target_amount: 5000,
      deadline: '2025-06-01',
      priority: 2,
    }

    it('creates a new goal', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockGoal, ...newGoal, id: 2 }),
      })
      const goal = await createSavingsGoal(newGoal)
      expect(goal?.name).toBe('Vacation Fund')
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal),
      })
    })

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const goal = await createSavingsGoal(newGoal)
      expect(goal).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      })
      const goal = await createSavingsGoal(newGoal)
      expect(goal).toBeNull()
    })
  })

  describe('updateSavingsGoal', () => {
    const updates = {
      target_amount: 60000,
      notes: 'Updated target',
    }

    it('updates an existing goal', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockGoal, ...updates }),
      })
      const goal = await updateSavingsGoal(1, updates)
      expect(goal?.target_amount).toBe(60000)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    })

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const goal = await updateSavingsGoal(1, updates)
      expect(goal).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })
      const goal = await updateSavingsGoal(999, updates)
      expect(goal).toBeNull()
    })
  })

  describe('deleteSavingsGoal', () => {
    it('deletes a goal and returns true', async () => {
      mockFetch.mockResolvedValue({ ok: true })
      const result = await deleteSavingsGoal(1)
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals/1', {
        method: 'DELETE',
      })
    })

    it('returns false on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const result = await deleteSavingsGoal(1)
      expect(result).toBe(false)
    })

    it('returns false on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })
      const result = await deleteSavingsGoal(999)
      expect(result).toBe(false)
    })
  })

  describe('completeGoal', () => {
    it('marks a goal as complete', async () => {
      const completedGoal = {
        ...mockGoal,
        status: GoalStatus.COMPLETED,
        completed_at: '2026-01-18T00:00:00Z',
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(completedGoal),
      })
      const goal = await completeGoal(1)
      expect(goal?.status).toBe(GoalStatus.COMPLETED)
      expect(goal?.completed_at).toBeDefined()
      expect(mockFetch).toHaveBeenCalledWith('/api/savings/goals/1/complete', {
        method: 'POST',
      })
    })

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const goal = await completeGoal(1)
      expect(goal).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400 })
      const goal = await completeGoal(1)
      expect(goal).toBeNull()
    })
  })
})
