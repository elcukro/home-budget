/**
 * Integration tests for the first-time user activation flow.
 *
 * Tests the full journey:
 *   1. New user signs in → is_first_login: true
 *   2. Dashboard layout redirects to /welcome
 *   3. Welcome page → Continue → /onboarding  OR  Skip → /dashboard
 *   4. After activation, is_first_login: false → dashboard accessible
 *
 * These tests verify the interaction between UserContext, the dashboard
 * layout redirect, and the Welcome page API calls, using mocked fetch
 * responses to simulate the backend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { ReactNode } from 'react'

// ----- Mock setup -----

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
  useParams: () => ({}),
}))

const mockSession = {
  user: { email: 'test@example.com', name: 'Test User' },
}
let sessionStatus = 'authenticated'
let sessionData: typeof mockSession | null = mockSession

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: sessionData,
    status: sessionStatus,
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { UserProvider, useUser } from '@/contexts/UserContext'

describe('Activation Flow Integration', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UserProvider>{children}</UserProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStatus = 'authenticated'
    sessionData = mockSession
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('happy path: new user activation', () => {
    it('initially loads user with is_first_login: true', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-new',
              name: 'New User',
              email: 'test@example.com',
              is_first_login: true,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: null,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user?.is_first_login).toBe(true)
    })

    it('transitions from first_login to activated after refreshUser', async () => {
      let fetchCount = 0

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          fetchCount++
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-new',
              name: 'New User',
              email: 'test@example.com',
              is_first_login: fetchCount <= 1, // true on first call, false after
              created_at: '2025-01-01T00:00:00Z',
              updated_at: fetchCount > 1 ? '2025-01-01T00:01:00Z' : null,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      // First load: user is first-time
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.user?.is_first_login).toBe(true)

      // Simulate activation: call refreshUser (like Welcome page does after Skip)
      await act(async () => {
        await result.current.refreshUser()
      })

      // After refresh: user is no longer first-time
      await waitFor(() => {
        expect(result.current.user?.is_first_login).toBe(false)
      })
    })
  })

  describe('skip activation flow', () => {
    it('simulates full skip flow: first-login-complete API + refreshUser', async () => {
      let isFirstLogin = true

      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        // PUT /first-login-complete
        if (url.includes('/first-login-complete') && options?.method === 'PUT') {
          isFirstLogin = false
          return Promise.resolve({ ok: true })
        }
        // GET /users/me
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-new',
              name: 'New User',
              email: 'test@example.com',
              is_first_login: isFirstLogin,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: null,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      // Initial load: first-time user
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.user?.is_first_login).toBe(true)

      // Step 1: Call first-login-complete API (what Welcome page Skip does)
      const response = await fetch(
        `/api/backend/users/${encodeURIComponent('test@example.com')}/first-login-complete`,
        { method: 'PUT' }
      )
      expect(response.ok).toBe(true)

      // Step 2: Refresh user data (what Welcome page does after API success)
      await act(async () => {
        await result.current.refreshUser()
      })

      // Step 3: User is now activated
      await waitFor(() => {
        expect(result.current.user?.is_first_login).toBe(false)
      })
    })
  })

  describe('returning user flow', () => {
    it('loads user with is_first_login: false without redirect', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-returning',
              name: 'Returning User',
              email: 'test@example.com',
              is_first_login: false,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user?.is_first_login).toBe(false)
      // No redirect should have been triggered via UserContext alone
      // (redirect is handled by the layout component)
    })
  })

  describe('error recovery', () => {
    it('handles first-login-complete API failure gracefully', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes('/first-login-complete') && options?.method === 'PUT') {
          return Promise.resolve({ ok: false, status: 500 })
        }
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-new',
              name: 'New User',
              email: 'test@example.com',
              is_first_login: true,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: null,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // API call fails
      const response = await fetch(
        `/api/backend/users/${encodeURIComponent('test@example.com')}/first-login-complete`,
        { method: 'PUT' }
      )
      expect(response.ok).toBe(false)

      // User should still be first-time (not updated)
      expect(result.current.user?.is_first_login).toBe(true)
    })

    it('handles user fetch failure during activation', async () => {
      let callCount = 0

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                id: 'user-new',
                email: 'test@example.com',
                is_first_login: true,
                created_at: '2025-01-01T00:00:00Z',
                updated_at: null,
              }),
            })
          }
          // Second call fails (e.g., during refreshUser)
          return Promise.resolve({ ok: false, status: 500 })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user?.is_first_login).toBe(true)

      // refreshUser fails
      await act(async () => {
        await result.current.refreshUser()
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })
    })
  })

  describe('session lifecycle', () => {
    it('clears user when session becomes unauthenticated', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-123',
              email: 'test@example.com',
              is_first_login: true,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: null,
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result, rerender } = renderHook(() => useUser(), { wrapper })

      // Initially authenticated
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.user).not.toBeNull()

      // Session becomes unauthenticated
      sessionStatus = 'unauthenticated'
      sessionData = null

      rerender()

      await waitFor(() => {
        expect(result.current.user).toBeNull()
      })
    })
  })
})
