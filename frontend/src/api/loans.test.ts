import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store module references
let getLoans: typeof import('./loans').getLoans
let getNonMortgageDebt: typeof import('./loans').getNonMortgageDebt
let getNonMortgagePrincipal: typeof import('./loans').getNonMortgagePrincipal
let getMortgageData: typeof import('./loans').getMortgageData
type Loan = import('./loans').Loan

// Mock fetch globally
const mockFetch = vi.fn()

describe('Loans API', () => {
  const mockLoans: Loan[] = [
    {
      id: 1,
      loan_type: 'mortgage',
      description: 'House mortgage',
      principal_amount: 500000,
      remaining_balance: 450000,
      interest_rate: 6.5,
      monthly_payment: 3200,
      start_date: '2020-01-15',
      term_months: 360,
      created_at: '2020-01-15T10:00:00Z',
      updated_at: null,
    },
    {
      id: 2,
      loan_type: 'car',
      description: 'Car loan',
      principal_amount: 50000,
      remaining_balance: 35000,
      interest_rate: 4.5,
      monthly_payment: 900,
      start_date: '2022-06-01',
      term_months: 60,
      created_at: '2022-06-01T10:00:00Z',
      updated_at: null,
    },
    {
      id: 3,
      loan_type: 'personal',
      description: 'Personal loan',
      principal_amount: 20000,
      remaining_balance: 15000,
      interest_rate: 8.0,
      monthly_payment: 500,
      start_date: '2023-01-01',
      term_months: 48,
      created_at: '2023-01-01T10:00:00Z',
      updated_at: null,
    },
    {
      id: 4,
      loan_type: 'Mortgage', // Test case sensitivity
      description: 'Investment property mortgage',
      principal_amount: 300000,
      remaining_balance: 280000,
      interest_rate: 7.0,
      monthly_payment: 2100,
      start_date: '2021-03-01',
      term_months: 300,
      created_at: '2021-03-01T10:00:00Z',
      updated_at: null,
    },
  ]

  beforeEach(async () => {
    // Reset all mocks
    vi.resetAllMocks()
    vi.resetModules()

    // Setup fetch mock with successful response by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLoans),
    })
    vi.stubGlobal('fetch', mockFetch)

    // Mock logger
    vi.doMock('@/lib/logger', () => ({
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    }))

    // Re-import module with mocks
    const loansModule = await import('./loans')
    getLoans = loansModule.getLoans
    getNonMortgageDebt = loansModule.getNonMortgageDebt
    getNonMortgagePrincipal = loansModule.getNonMortgagePrincipal
    getMortgageData = loansModule.getMortgageData
  })

  afterEach(() => {
    vi.doUnmock('@/lib/logger')
    vi.unstubAllGlobals()
  })

  describe('getLoans', () => {
    it('returns loans from API', async () => {
      const loans = await getLoans()
      expect(loans).toEqual(mockLoans)
      expect(mockFetch).toHaveBeenCalledWith('/api/backend/loans')
    })

    it('returns empty array on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const loans = await getLoans()
      expect(loans).toEqual([])
    })

    it('returns empty array on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      })
      const loans = await getLoans()
      expect(loans).toEqual([])
    })

    it('uses cached data within cache duration', async () => {
      // First call
      await getLoans()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await getLoans()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getNonMortgageDebt', () => {
    it('returns sum of non-mortgage remaining balances', async () => {
      const debt = await getNonMortgageDebt()
      // Personal (15000) + Car (35000) = 50000
      expect(debt).toBe(50000)
    })
  })

  describe('getNonMortgagePrincipal', () => {
    it('returns sum of non-mortgage principal amounts', async () => {
      const principal = await getNonMortgagePrincipal()
      // Personal (20000) + Car (50000) = 70000
      expect(principal).toBe(70000)
    })
  })

  describe('getMortgageData', () => {
    it('returns combined mortgage data', async () => {
      const data = await getMortgageData()

      expect(data).not.toBeNull()
      expect(data?.principal_amount).toBe(800000) // 500k + 300k
      expect(data?.remaining_balance).toBe(730000) // 450k + 280k
      expect(data?.hasMortgage).toBe(true)
    })

    it('handles case-insensitive mortgage type', async () => {
      // mockLoans[3] has loan_type: 'Mortgage' (capital M)
      const data = await getMortgageData()
      expect(data?.principal_amount).toBe(800000) // Both mortgages included
      expect(data?.hasMortgage).toBe(true)
    })
  })
})
