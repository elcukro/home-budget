import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/welcome',
}))

// Mock next-auth/react
const mockSession = {
  user: { email: 'test@example.com', name: 'Test User' },
}

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: mockSession,
    status: 'authenticated',
  }),
}))

// Mock react-intl
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (msg: { id: string; defaultMessage?: string }, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'welcome.greeting': 'Witaj, {name}!',
        'welcome.title': 'Welcome to FiredUp!',
        'welcome.subtitle': 'Start your financial journey',
        'welcome.trial.active': '7 dni Premium gratis',
        'welcome.features.heading': 'Premium Features',
        'welcome.features.unlimited.title': 'Unlimited Tracking',
        'welcome.features.unlimited.desc': 'No limits on expenses',
        'welcome.features.bank.title': 'Bank Integration',
        'welcome.features.bank.desc': 'Connect your bank',
        'welcome.features.ai.title': 'AI Insights',
        'welcome.features.ai.desc': 'Smart analysis',
        'welcome.features.reports.title': 'Reports',
        'welcome.features.reports.desc': 'Export your data',
        'welcome.start': 'Zaczynajmy!',
        'welcome.finePrint': 'You can upgrade anytime',
        'welcome.pricing.nudge': 'Plany Premium od 19,99 PLN/mies.',
        'welcome.pricing.link': 'Zobacz plany',
        'auth.loading': 'auth.loading',
      }
      let result = messages[msg.id] || msg.defaultMessage || msg.id

      // Replace placeholders
      if (values) {
        Object.entries(values).forEach(([key, value]) => {
          result = result.replace(`{${key}}`, String(value))
        })
      }

      return result
    },
    locale: 'pl',
  }),
}))

// Mock SubscriptionContext
const mockSubscriptionValues = {
  subscription: { is_trial: true, trial_ends_at: '2025-02-15T00:00:00Z' },
  isLoading: false,
  isTrial: true,
}

vi.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => mockSubscriptionValues,
}))

// Mock UserContext
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    isLoading: false,
  }),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Flame: () => <span data-testid="flame-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  ArrowRight: () => <span data-testid="arrow-right-icon" />,
  Building2: () => <span data-testid="building2-icon" />,
  Brain: () => <span data-testid="brain-icon" />,
  FileSpreadsheet: () => <span data-testid="file-icon" />,
  Infinity: () => <span data-testid="infinity-icon" />,
  Crown: () => <span data-testid="crown-icon" />,
}))

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

// Import component after mocks
import WelcomePage from './page'

describe('WelcomePage (Simplified New Design)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscriptionValues.isLoading = false
    mockSubscriptionValues.isTrial = true
    mockSubscriptionValues.subscription = { is_trial: true, trial_ends_at: '2025-02-15T00:00:00Z' }
  })

  describe('loading state', () => {
    it('shows loading text when subscription is loading', () => {
      mockSubscriptionValues.isLoading = true
      render(<WelcomePage />)
      expect(screen.getByText('auth.loading')).toBeDefined()
    })
  })

  describe('main view', () => {
    it('renders greeting with first name', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Witaj, Test!')).toBeDefined()
    })

    it('renders subtitle', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Start your financial journey')).toBeDefined()
    })

    it('shows trial badge when user is on trial', () => {
      render(<WelcomePage />)
      expect(screen.getByText('7 dni Premium gratis')).toBeDefined()
    })

    it('shows premium features section', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Premium Features')).toBeDefined()
      expect(screen.getByText('Unlimited Tracking')).toBeDefined()
      expect(screen.getByText('Bank Integration')).toBeDefined()
      expect(screen.getByText('AI Insights')).toBeDefined()
      expect(screen.getByText('Reports')).toBeDefined()
    })

    it('shows start button', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Zaczynajmy!')).toBeDefined()
    })

    it('navigates to /onboarding when start button is clicked', () => {
      render(<WelcomePage />)
      fireEvent.click(screen.getByText('Zaczynajmy!'))
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })

    it('shows pricing nudge at bottom', () => {
      render(<WelcomePage />)
      expect(screen.getByText('Plany Premium od 19,99 PLN/mies.')).toBeDefined()
      expect(screen.getByText('Zobacz plany')).toBeDefined()
    })
  })
})
