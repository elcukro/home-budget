import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store module references
let getLoans: typeof import('./loans').getLoans
let getNonMortgageDebt: typeof import('./loans').getNonMortgageDebt
let getNonMortgagePrincipal: typeof import('./loans').getNonMortgagePrincipal
let getMortgageData: typeof import('./loans').getMortgageData
type Loan = import('./loans').Loan

// Mock getSession
const mockGetSession = vi.fn()

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
    vi.clearAllMocks()

    // Reset module registry to clear the cache
    vi.resetModules()

    // Set up global fetch mock
    global.fetch = mockFetch

    // Mock dependencies before importing the module
    vi.doMock('@/lib/logger', () => ({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }))

    vi.doMock('next-auth/react', () => ({
      getSession: mockGetSession,
    }))

    // Default session mock
    mockGetSession.mockResolvedValue({
      user: { email: 'test@example.com' },
      expires: '2099-01-01',
    })

    // Default fetch mock for loans
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLoans),
    })

    // Import the module fresh after mocking
    const loansModule = await import('./loans')
    getLoans = loansModule.getLoans
    getNonMortgageDebt = loansModule.getNonMortgageDebt
    getNonMortgagePrincipal = loansModule.getNonMortgagePrincipal
    getMortgageData = loansModule.getMortgageData
  })

  afterEach(() => {
    vi.doUnmock('@/lib/logger')
    vi.doUnmock('next-auth/react')
  })

  describe('getLoans', () => {
    it('returns loans from API when session exists', async () => {
      const loans = await getLoans()
      expect(loans).toEqual(mockLoans)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/loans?user_id=test%40example.com')
      )
    })

    it('returns empty array when no session', async () => {
      mockGetSession.mockResolvedValue(null)
      const loans = await getLoans()
      expect(loans).toEqual([])
    })

    it('returns empty array when session has no email', async () => {
      mockGetSession.mockResolvedValue({
        user: {},
        expires: '2099-01-01',
      })
      const loans = await getLoans()
      expect(loans).toEqual([])
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

      // Second call within cache duration (should use cache)
      await getLoans()
      // Should still be only 1 call (cached)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getNonMortgageDebt', () => {
    it('calculates total non-mortgage remaining balance', async () => {
      const debt = await getNonMortgageDebt()
      // Non-mortgage loans: car (35000) + personal (15000)
      expect(debt).toBe(50000)
    })

    it('returns 0 when only mortgages exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            mockLoans[0], // mortgage
            mockLoans[3], // Mortgage (case insensitive)
          ]),
      })
      const debt = await getNonMortgageDebt()
      expect(debt).toBe(0)
    })

    it('returns 0 when no loans exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      const debt = await getNonMortgageDebt()
      expect(debt).toBe(0)
    })

    it('returns 0 on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const debt = await getNonMortgageDebt()
      expect(debt).toBe(0)
    })

    it('handles case-insensitive mortgage filtering', async () => {
      const debt = await getNonMortgageDebt()
      // Should only include car (35000) + personal (15000), not "Mortgage" (280000)
      expect(debt).toBe(50000)
    })
  })

  describe('getNonMortgagePrincipal', () => {
    it('calculates total non-mortgage principal amount', async () => {
      const principal = await getNonMortgagePrincipal()
      // Non-mortgage loans: car (50000) + personal (20000)
      expect(principal).toBe(70000)
    })

    it('returns 0 when only mortgages exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([mockLoans[0], mockLoans[3]]), // only mortgages
      })
      const principal = await getNonMortgagePrincipal()
      expect(principal).toBe(0)
    })

    it('returns 0 when no loans exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      const principal = await getNonMortgagePrincipal()
      expect(principal).toBe(0)
    })

    it('returns 0 on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const principal = await getNonMortgagePrincipal()
      expect(principal).toBe(0)
    })
  })

  describe('getMortgageData', () => {
    it('combines all mortgages into single result', async () => {
      const data = await getMortgageData()
      expect(data).toEqual({
        // Two mortgages: 500000 + 300000
        principal_amount: 800000,
        // 450000 + 280000
        remaining_balance: 730000,
        hasMortgage: true,
      })
    })

    it('returns hasMortgage false when no mortgages', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([mockLoans[1], mockLoans[2]]), // only car and personal
      })
      const data = await getMortgageData()
      expect(data).toEqual({
        principal_amount: 0,
        remaining_balance: 0,
        hasMortgage: false,
      })
    })

    it('returns empty mortgage data on fetch error (getLoans returns [])', async () => {
      // Note: getMortgageData calls getLoans which catches errors and returns []
      // So getMortgageData gets empty loans and returns hasMortgage: false
      mockFetch.mockRejectedValue(new Error('Network error'))
      const data = await getMortgageData()
      expect(data).toEqual({
        principal_amount: 0,
        remaining_balance: 0,
        hasMortgage: false,
      })
    })

    it('handles single mortgage correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockLoans[0]]), // only one mortgage
      })
      const data = await getMortgageData()
      expect(data).toEqual({
        principal_amount: 500000,
        remaining_balance: 450000,
        hasMortgage: true,
      })
    })

    it('handles case-insensitive mortgage detection', async () => {
      // Both "mortgage" and "Mortgage" should be included
      const data = await getMortgageData()
      expect(data?.hasMortgage).toBe(true)
      // Should include both mortgages
      expect(data?.principal_amount).toBe(800000)
    })

    it('returns empty mortgage data for empty loans list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      const data = await getMortgageData()
      expect(data).toEqual({
        principal_amount: 0,
        remaining_balance: 0,
        hasMortgage: false,
      })
    })
  })

  describe('debt calculations', () => {
    it('total debt = mortgage + non-mortgage', async () => {
      const nonMortgageDebt = await getNonMortgageDebt()
      const mortgageData = await getMortgageData()

      const totalDebt = nonMortgageDebt + (mortgageData?.remaining_balance || 0)
      // Non-mortgage: 50000, Mortgage: 730000
      expect(totalDebt).toBe(780000)
    })

    it('handles scenario with no debt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const nonMortgageDebt = await getNonMortgageDebt()
      const mortgageData = await getMortgageData()

      expect(nonMortgageDebt).toBe(0)
      expect(mortgageData?.hasMortgage).toBe(false)
    })
  })
})
