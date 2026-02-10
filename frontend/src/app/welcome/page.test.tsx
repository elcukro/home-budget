import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/welcome',
}))

// Mock next-auth/react
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

// Mock react-intl
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (msg: { id: string; defaultMessage?: string }) => {
      const messages: Record<string, string> = {
        'welcome.title': 'Welcome to FiredUp!',
        'welcome.subtitle': 'Start your financial journey',
        'welcome.expired.title': 'Trial Expired',
        'welcome.expired.subtitle': 'Upgrade to continue',
        'welcome.lifetime.title': 'Welcome, Lifetime Member!',
        'welcome.lifetime.subtitle': 'You have full access forever',
        'welcome.continue': 'Continue',
        'welcome.skip': 'Skip',
        'welcome.skip.error': 'Activation failed. Try again.',
        'welcome.features.heading': 'Premium Features',
        'welcome.features.unlimited.title': 'Unlimited Tracking',
        'welcome.features.unlimited.desc': 'No limits on expenses',
        'welcome.features.bank.title': 'Bank Integration',
        'welcome.features.bank.desc': 'Connect your bank',
        'welcome.features.ai.title': 'AI Insights',
        'welcome.features.ai.desc': 'Smart analysis',
        'welcome.features.reports.title': 'Reports',
        'welcome.features.reports.desc': 'Export your data',
        'welcome.features.all.title': 'All Features',
        'welcome.features.all.desc': 'Full access',
        'welcome.comparison.heading': 'Plan Comparison',
        'welcome.trial.endsLabel': 'Trial ends',
        'welcome.trial.reminder': 'No charge until trial ends',
        'welcome.finePrint': 'You can upgrade anytime',
        'pricing.comparison.feature': 'Feature',
        'pricing.comparison.free': 'Free',
        'pricing.comparison.premium': 'Premium',
        'pricing.comparison.expenses': 'Expenses',
        'pricing.comparison.incomes': 'Incomes',
        'pricing.comparison.loans': 'Loans',
        'pricing.comparison.savings': 'Savings',
        'pricing.comparison.bank': 'Bank',
        'pricing.comparison.ai': 'AI',
        'pricing.comparison.export': 'Export',
        'pricing.comparison.reports': 'Reports',
      }
      return messages[msg.id] || msg.defaultMessage || msg.id
    },
    locale: 'en',
  }),
}))

// Mock SubscriptionContext
const mockSubscriptionValues = {
  subscription: null as Record<string, unknown> | null,
  isLoading: false,
  isTrial: false,
  isPremium: false,
  trialDaysLeft: null as number | null,
  usage: null,
  error: null,
  refreshSubscription: vi.fn(),
  refreshUsage: vi.fn(),
  createCheckout: vi.fn(),
  openPortal: vi.fn(),
}

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockSubscriptionValues,
}))

// Mock UserContext
const mockRefreshUser = vi.fn().mockResolvedValue(undefined)
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { id: 'user-123', email: 'test@example.com', is_first_login: true },
    isLoading: false,
    error: null,
    refreshUser: mockRefreshUser,
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

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon: _icon, className }: { icon: unknown; className?: string }) => (
    <span data-testid="fa-icon" className={className} />
  ),
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader" className={className} />
  ),
  Flame: ({ className }: { className?: string }) => (
    <span data-testid="flame-icon" className={className} />
  ),
  Sparkles: ({ className }: { className?: string }) => (
    <span data-testid="sparkles-icon" className={className} />
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="arrow-right-icon" className={className} />
  ),
  Building2: ({ className }: { className?: string }) => (
    <span data-testid="building2-icon" className={className} />
  ),
  Brain: ({ className }: { className?: string }) => (
    <span data-testid="brain-icon" className={className} />
  ),
  FileSpreadsheet: ({ className }: { className?: string }) => (
    <span data-testid="file-spreadsheet-icon" className={className} />
  ),
  Infinity: ({ className }: { className?: string }) => (
    <span data-testid="infinity-icon" className={className} />
  ),
  Crown: ({ className }: { className?: string }) => (
    <span data-testid="crown-icon" className={className} />
  ),
}))

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: string
    size?: string
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={props.variant} data-size={props.size}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock alert
const mockAlert = vi.fn()
global.alert = mockAlert

// Import the component under test AFTER all mocks
import WelcomePage from './page'

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionData = mockSession
    mockSubscriptionValues.subscription = null
    mockSubscriptionValues.isLoading = false
    mockSubscriptionValues.isTrial = false
    mockSubscriptionValues.isPremium = false
    mockSubscriptionValues.trialDaysLeft = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loader when subscription is loading', () => {
      mockSubscriptionValues.isLoading = true
      render(<WelcomePage />)
      expect(screen.getByTestId('loader')).toBeDefined()
    })
  })

  describe('lifetime user view', () => {
    beforeEach(() => {
      mockSubscriptionValues.subscription = {
        status: 'active',
        is_lifetime: true,
        is_trial: false,
      }
    })

    it('renders simplified view for lifetime users', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Welcome, Lifetime Member!')).toBeDefined()
      expect(screen.getByText('You have full access forever')).toBeDefined()
    })

    it('shows Continue button for lifetime users', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Continue')).toBeDefined()
    })

    it('does not show Skip button for lifetime users', () => {
      render(<WelcomePage />)
      expect(screen.queryByText('Skip')).toBeNull()
    })

    it('navigates to onboarding when Continue is clicked', () => {
      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Continue'))
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  describe('trial user view', () => {
    beforeEach(() => {
      mockSubscriptionValues.subscription = {
        status: 'trialing',
        is_lifetime: false,
        is_trial: true,
        trial_ends_at: '2025-02-15T00:00:00Z',
        trial_days_left: 7,
      }
      mockSubscriptionValues.isTrial = true
    })

    it('renders welcome title', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Welcome to FiredUp!')).toBeDefined()
    })

    it('shows trial end date', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Trial ends')).toBeDefined()
      // The formatted date will be present
      expect(screen.getByText('No charge until trial ends')).toBeDefined()
    })

    it('shows premium features list', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Premium Features')).toBeDefined()
      expect(screen.getByText('Unlimited Tracking')).toBeDefined()
      expect(screen.getByText('Bank Integration')).toBeDefined()
      expect(screen.getByText('AI Insights')).toBeDefined()
    })

    it('shows plan comparison table', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Plan Comparison')).toBeDefined()
      expect(screen.getByText('Feature')).toBeDefined()
      expect(screen.getByText('Free')).toBeDefined()
      expect(screen.getByText('Premium')).toBeDefined()
    })

    it('shows comparison rows with correct values', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Expenses')).toBeDefined()
      expect(screen.getByText('50/mies.')).toBeDefined()
      expect(screen.getByText('Loans')).toBeDefined()
      // '3' appears for both loans and savings free values
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('trial expired view', () => {
    beforeEach(() => {
      mockSubscriptionValues.subscription = {
        status: 'expired',
        is_lifetime: false,
        is_trial: false,
        trial_ends_at: null,
      }
      mockSubscriptionValues.isTrial = false
      mockSubscriptionValues.isPremium = false
    })

    it('shows expired title', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Trial Expired')).toBeDefined()
    })
  })

  describe('Continue button', () => {
    beforeEach(() => {
      mockSubscriptionValues.subscription = {
        status: 'trialing',
        is_lifetime: false,
        is_trial: true,
        trial_ends_at: '2025-02-15T00:00:00Z',
      }
      mockSubscriptionValues.isTrial = true
    })

    it('navigates to /onboarding when clicked', () => {
      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Continue'))
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })
  })

  describe('Skip button', () => {
    beforeEach(() => {
      mockSubscriptionValues.subscription = {
        status: 'trialing',
        is_lifetime: false,
        is_trial: true,
        trial_ends_at: '2025-02-15T00:00:00Z',
      }
      mockSubscriptionValues.isTrial = true
    })

    it('calls first-login-complete API and redirects on success', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Skip'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/backend/users/test%40example.com/first-login-complete',
          { method: 'PUT' }
        )
      })

      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('shows error alert when API fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Skip'))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Activation failed. Try again.')
      })

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalledWith('/dashboard')
    })

    it('shows error alert when network fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Skip'))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalled()
      })
    })

    it('redirects to dashboard without API call when no session email', async () => {
      sessionData = null

      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Skip'))

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('fine print', () => {
    beforeEach(() => {
      mockSubscriptionValues.subscription = {
        status: 'trialing',
        is_lifetime: false,
        is_trial: true,
        trial_ends_at: '2025-02-15T00:00:00Z',
      }
      mockSubscriptionValues.isTrial = true
    })

    it('shows fine print text', () => {
      render(<WelcomePage />)
      expect(screen.getByText('You can upgrade anytime')).toBeDefined()
    })
  })
})
