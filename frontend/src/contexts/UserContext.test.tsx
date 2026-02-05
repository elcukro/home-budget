import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { UserProvider, useUser } from './UserContext'

// Mock next-auth
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

describe('UserContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UserProvider>{children}</UserProvider>
  )

  const mockUserData = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    is_first_login: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStatus = 'authenticated'
    sessionData = mockSession

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserData),
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
      const { result } = renderHook(() => useUser(), { wrapper })
      expect(result.current.isLoading).toBe(true)
    })

    it('has null user initially', () => {
      const { result } = renderHook(() => useUser(), { wrapper })
      expect(result.current.user).toBeNull()
    })

    it('has null error initially', () => {
      const { result } = renderHook(() => useUser(), { wrapper })
      expect(result.current.error).toBeNull()
    })
  })

  describe('first-time user', () => {
    it('fetches user with is_first_login true', async () => {
      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toEqual(mockUserData)
      expect(result.current.user?.is_first_login).toBe(true)
    })
  })

  describe('returning user', () => {
    it('fetches user with is_first_login false', async () => {
      const returningUser = { ...mockUserData, is_first_login: false }
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(returningUser),
          })
        }
        return Promise.resolve({ ok: false })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user?.is_first_login).toBe(false)
    })
  })

  describe('refreshUser', () => {
    it('refetches and updates user data', async () => {
      let fetchCount = 0
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          fetchCount++
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ...mockUserData,
              is_first_login: fetchCount === 1,
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

      await act(async () => {
        await result.current.refreshUser()
      })

      await waitFor(() => {
        expect(result.current.user?.is_first_login).toBe(false)
      })
    })
  })

  describe('unauthenticated user', () => {
    it('sets user to null when not authenticated', async () => {
      sessionStatus = 'unauthenticated'
      sessionData = null

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('does not fetch during loading session', () => {
      sessionStatus = 'loading'
      sessionData = null

      renderHook(() => useUser(), { wrapper })

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('sets error when API returns non-ok response', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
        })
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Failed to fetch user data')
      expect(result.current.user).toBeNull()
    })

    it('sets error when network error occurs', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.reject(new Error('Network error'))
      })

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Network error')
    })

    it('does not fetch when session has no email', async () => {
      sessionData = { user: { email: '', name: 'No Email' } } as typeof mockSession

      // When email is empty/falsy, fetchUser returns early
      mockFetch.mockClear()

      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // fetch should not have been called with /users/me
      const userMeCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/users/me')
      )
      expect(userMeCalls.length).toBe(0)
    })
  })

  describe('API endpoint', () => {
    it('calls /api/backend/users/me', async () => {
      const { result } = renderHook(() => useUser(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/backend/users/me')
    })
  })
})
