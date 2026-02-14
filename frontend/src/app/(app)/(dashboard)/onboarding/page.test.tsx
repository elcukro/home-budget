import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock next/navigation
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/onboarding',
  useParams: () => ({}),
}))

// Mock next-auth
const mockSession = {
  user: { email: 'test@example.com', name: 'Test User' },
}
let sessionData: typeof mockSession | null = mockSession

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: sessionData,
    status: sessionData ? 'authenticated' : 'unauthenticated',
  }),
}))

// Mock SettingsContext
const mockSettings = {
  settings: null as { onboarding_completed?: boolean } | null,
  isLoading: false,
  error: null,
  updateSettings: vi.fn(),
  refetchSettings: vi.fn(),
  formatCurrency: vi.fn(),
}

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => mockSettings,
}))

// Mock UserContext
const mockUserValues = {
  user: null as { id: string; email: string; is_first_login: boolean } | null,
  isLoading: false,
  error: null,
  refreshUser: vi.fn(),
}

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => mockUserValues,
}))

// Mock OnboardingWizard
const mockOnboardingWizard = vi.fn()
vi.mock('@/components/onboarding/OnboardingWizard', () => ({
  default: (props: { fromPayment: boolean; mode: string }) => {
    mockOnboardingWizard(props)
    return <div data-testid="onboarding-wizard" data-from-payment={props.fromPayment} data-mode={props.mode}>OnboardingWizard</div>
  },
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader" className={className} />
  ),
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

import OnboardingPage from './page'

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionData = mockSession
    mockSearchParams = new URLSearchParams()
    mockSettings.settings = null
    mockSettings.isLoading = false
    mockUserValues.user = null
    mockUserValues.isLoading = false
    mockOnboardingWizard.mockClear()

    // Default: no existing data
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/income')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      if (url.includes('/expenses')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      return Promise.resolve({ ok: false })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loader while settings are loading', () => {
      mockSettings.isLoading = true
      render(<OnboardingPage />)
      expect(screen.getByTestId('loader')).toBeDefined()
    })

    it('shows loader while checking for existing data', () => {
      // By default, isChecking starts as true
      render(<OnboardingPage />)
      // The loader should be visible during the check
      expect(screen.getByTestId('loader')).toBeDefined()
    })
  })

  describe('first-time user flow', () => {
    it('shows wizard when user.is_first_login is true', async () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: true,
      }

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })
    })

    it('does not redirect when user.is_first_login is true', async () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: true,
      }

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe('forced onboarding', () => {
    it('shows wizard when force=true param is set', async () => {
      mockSearchParams = new URLSearchParams('force=true')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })
    })

    it('does not check for existing data when forced', async () => {
      mockSearchParams = new URLSearchParams('force=true')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      // Should not have checked for income/expenses
      const incomeCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/api/income')
      )
      expect(incomeCalls.length).toBe(0)
    })
  })

  describe('already completed onboarding', () => {
    it('redirects to settings when onboarding_completed is true', async () => {
      mockSettings.settings = { onboarding_completed: true }

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/settings?tab=general&onboarding=redirect')
      })
    })
  })

  describe('existing data detection', () => {
    it('redirects to settings when user has existing income', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/income')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: '1', amount: 5000 }]),
          })
        }
        if (url.includes('/expenses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          })
        }
        return Promise.resolve({ ok: false })
      })

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/settings?tab=general&onboarding=redirect')
      })
    })

    it('redirects to settings when user has existing expenses', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/income')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          })
        }
        if (url.includes('/expenses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: '1', amount: 100 }]),
          })
        }
        return Promise.resolve({ ok: false })
      })

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/settings?tab=general&onboarding=redirect')
      })
    })

    it('shows wizard when user has no existing data', async () => {
      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })
    })
  })

  describe('wizard mode parameter', () => {
    it('passes mode=fresh from URL params', async () => {
      mockSearchParams = new URLSearchParams('force=true&mode=fresh')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      expect(screen.getByTestId('onboarding-wizard').getAttribute('data-mode')).toBe('fresh')
    })

    it('passes mode=merge from URL params', async () => {
      mockSearchParams = new URLSearchParams('force=true&mode=merge')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      expect(screen.getByTestId('onboarding-wizard').getAttribute('data-mode')).toBe('merge')
    })

    it('defaults to mode=default for invalid mode', async () => {
      mockSearchParams = new URLSearchParams('force=true&mode=invalid')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      expect(screen.getByTestId('onboarding-wizard').getAttribute('data-mode')).toBe('default')
    })
  })

  describe('from payment parameter', () => {
    it('passes fromPayment=true when from=payment', async () => {
      mockSearchParams = new URLSearchParams('force=true&from=payment')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      expect(screen.getByTestId('onboarding-wizard').getAttribute('data-from-payment')).toBe('true')
    })

    it('passes fromPayment=false by default', async () => {
      mockSearchParams = new URLSearchParams('force=true')

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      expect(screen.getByTestId('onboarding-wizard').getAttribute('data-from-payment')).toBe('false')
    })
  })

  describe('no session', () => {
    it('shows wizard without checking data when no session', async () => {
      sessionData = null

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })

      // Should not check for income/expenses without session
      const incomeCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/api/income')
      )
      expect(incomeCalls.length).toBe(0)
    })
  })

  describe('API error handling', () => {
    it('shows wizard when data check fails', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.reject(new Error('Network error'))
      })

      render(<OnboardingPage />)

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-wizard')).toBeDefined()
      })
    })
  })
})
