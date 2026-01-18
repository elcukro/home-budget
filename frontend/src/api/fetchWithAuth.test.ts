import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store module reference
let fetchWithAuth: typeof import('./fetchWithAuth').fetchWithAuth

// Mock getSession
const mockGetSession = vi.fn()

// Mock fetch globally
const mockFetch = vi.fn()

describe('fetchWithAuth', () => {
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

    vi.doMock('next-auth/react', () => ({
      getSession: mockGetSession,
    }))

    // Default session mock
    mockGetSession.mockResolvedValue({
      user: { email: 'test@example.com' },
      expires: '2099-01-01',
    })

    // Default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    })

    // Import module fresh
    const module = await import('./fetchWithAuth')
    fetchWithAuth = module.fetchWithAuth
  })

  afterEach(() => {
    vi.doUnmock('@/lib/logger')
    vi.doUnmock('next-auth/react')
  })

  describe('authentication', () => {
    it('adds X-User-ID header with user email', async () => {
      await fetchWithAuth('https://api.example.com/data')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-ID': 'test@example.com',
          }),
        })
      )
    })

    it('throws error when no session exists', async () => {
      mockGetSession.mockResolvedValue(null)

      await expect(fetchWithAuth('https://api.example.com/data')).rejects.toThrow(
        'No active session found'
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('throws error when session has no user', async () => {
      mockGetSession.mockResolvedValue({
        expires: '2099-01-01',
      })

      await expect(fetchWithAuth('https://api.example.com/data')).rejects.toThrow(
        'No active session found'
      )
    })

    it('throws error when user has no email', async () => {
      mockGetSession.mockResolvedValue({
        user: { name: 'Test User' },
        expires: '2099-01-01',
      })

      await expect(fetchWithAuth('https://api.example.com/data')).rejects.toThrow(
        'No active session found'
      )
    })
  })

  describe('request handling', () => {
    it('passes through URL correctly', async () => {
      await fetchWithAuth('https://api.example.com/users/123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.any(Object)
      )
    })

    it('preserves existing headers from options', async () => {
      await fetchWithAuth('https://api.example.com/data', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-User-ID': 'test@example.com',
          }),
        })
      )
    })

    it('passes through method option', async () => {
      await fetchWithAuth('https://api.example.com/data', {
        method: 'POST',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('passes through body option', async () => {
      const body = JSON.stringify({ name: 'test' })
      await fetchWithAuth('https://api.example.com/data', {
        method: 'POST',
        body,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          body,
        })
      )
    })

    it('passes through all fetch options', async () => {
      await fetchWithAuth('https://api.example.com/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{"key": "value"}',
        credentials: 'include',
        mode: 'cors',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'PUT',
          body: '{"key": "value"}',
          credentials: 'include',
          mode: 'cors',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-User-ID': 'test@example.com',
          }),
        })
      )
    })
  })

  describe('response handling', () => {
    it('returns fetch response directly', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'test' }),
      }
      mockFetch.mockResolvedValue(mockResponse)

      const response = await fetchWithAuth('https://api.example.com/data')

      expect(response).toBe(mockResponse)
    })

    it('returns error response without throwing', async () => {
      const errorResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }
      mockFetch.mockResolvedValue(errorResponse)

      const response = await fetchWithAuth('https://api.example.com/data')

      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })

    it('propagates fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(fetchWithAuth('https://api.example.com/data')).rejects.toThrow(
        'Network error'
      )
    })
  })

  describe('edge cases', () => {
    it('handles empty options object', async () => {
      await fetchWithAuth('https://api.example.com/data', {})

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-ID': 'test@example.com',
          }),
        })
      )
    })

    it('handles undefined options', async () => {
      await fetchWithAuth('https://api.example.com/data')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-ID': 'test@example.com',
          }),
        })
      )
    })

    it('handles special characters in email', async () => {
      mockGetSession.mockResolvedValue({
        user: { email: 'user+tag@example.com' },
        expires: '2099-01-01',
      })

      await fetchWithAuth('https://api.example.com/data')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-ID': 'user+tag@example.com',
          }),
        })
      )
    })
  })
})
