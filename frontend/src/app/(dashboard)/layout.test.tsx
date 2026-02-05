import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// Mock next/navigation
const mockReplace = vi.fn()
let currentPathname = '/dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => currentPathname,
  useParams: () => ({}),
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

// Mock Sidebar
vi.mock('@/components/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}))

// Mock Footer
vi.mock('@/components/Footer', () => ({
  default: () => <div data-testid="footer">Footer</div>,
}))

// Mock Toaster
vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { email: 'test@example.com' } },
    status: 'authenticated',
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

import DashboardLayout from './layout'

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentPathname = '/dashboard'
    mockUserValues.user = null
    mockUserValues.isLoading = false
    mockUserValues.error = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('first-time user redirect', () => {
    it('redirects to /welcome when user.is_first_login is true', async () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: true,
      }

      render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      )

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/welcome')
      })
    })

    it('does not redirect when user.is_first_login is false', async () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: false,
      }

      render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      )

      // Allow effects to run
      await waitFor(() => {
        expect(mockUserValues.user).not.toBeNull()
      })

      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('does not redirect when on /onboarding page', async () => {
      currentPathname = '/onboarding'
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: true,
      }

      render(
        <DashboardLayout>
          <div>Onboarding Content</div>
        </DashboardLayout>
      )

      // Allow effects to run
      await waitFor(() => {
        expect(mockUserValues.user).not.toBeNull()
      })

      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('does not redirect while user is loading', async () => {
      mockUserValues.isLoading = true
      mockUserValues.user = null

      render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      )

      // Allow effects to run
      await waitFor(() => {
        expect(mockUserValues.isLoading).toBe(true)
      })

      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('does not redirect when user is null (not loaded yet)', async () => {
      mockUserValues.isLoading = false
      mockUserValues.user = null

      render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      )

      // Allow effects to run
      await waitFor(() => {
        expect(mockUserValues.user).toBeNull()
      })

      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe('layout rendering', () => {
    it('renders children content', () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: false,
      }

      const { getByText } = render(
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      )

      expect(getByText('Dashboard Content')).toBeDefined()
    })

    it('renders sidebar', () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: false,
      }

      const { getByTestId } = render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      )

      expect(getByTestId('sidebar')).toBeDefined()
    })

    it('renders footer', () => {
      mockUserValues.user = {
        id: 'user-123',
        email: 'test@example.com',
        is_first_login: false,
      }

      const { getByTestId } = render(
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      )

      expect(getByTestId('footer')).toBeDefined()
    })
  })

  describe('redirect for different dashboard routes', () => {
    const dashboardRoutes = ['/dashboard', '/expenses', '/loans', '/financial-freedom', '/settings']

    dashboardRoutes.forEach((route) => {
      it(`redirects from ${route} when is_first_login is true`, async () => {
        currentPathname = route
        mockUserValues.user = {
          id: 'user-123',
          email: 'test@example.com',
          is_first_login: true,
        }

        render(
          <DashboardLayout>
            <div>Content</div>
          </DashboardLayout>
        )

        await waitFor(() => {
          expect(mockReplace).toHaveBeenCalledWith('/welcome')
        })
      })
    })
  })
})
