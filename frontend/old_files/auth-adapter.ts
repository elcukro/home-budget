import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from '@auth/core/adapters'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function FastAPIAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          image: user.image
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create user')
      }

      const data = await response.json()
      return {
        ...data,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null
      }
    },

    async getUser(id: string) {
      const response = await fetch(`${API_BASE_URL}/auth/users/${id}`)
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to get user')
      }

      const data = await response.json()
      return {
        ...data,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null
      }
    },

    async getUserByEmail(email: string) {
      const response = await fetch(`${API_BASE_URL}/auth/users/${email}`)
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to get user by email')
      }

      const data = await response.json()
      return {
        ...data,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null
      }
    },

    async createSession(session: { sessionToken: string; userId: string; expires: Date }) {
      const response = await fetch(`${API_BASE_URL}/auth/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: session.sessionToken,
          user_id: session.userId,
          expires: session.expires.toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data = await response.json()
      return {
        sessionToken: data.session_token,
        userId: data.user_id,
        expires: new Date(data.expires)
      }
    },

    async getSessionAndUser(sessionToken: string) {
      const response = await fetch(`${API_BASE_URL}/auth/sessions/${sessionToken}`)
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to get session')
      }

      const session = await response.json()
      
      // Get user data
      const userResponse = await fetch(`${API_BASE_URL}/auth/users/${session.user_id}`)
      if (!userResponse.ok) {
        throw new Error('Failed to get user for session')
      }

      const user = await userResponse.json()
      
      return {
        session: {
          sessionToken: session.session_token,
          userId: session.user_id,
          expires: new Date(session.expires)
        },
        user: {
          ...user,
          emailVerified: user.email_verified ? new Date(user.email_verified) : null
        }
      }
    },

    async updateSession(session: { sessionToken: string; userId: string; expires: Date }) {
      const response = await fetch(`${API_BASE_URL}/auth/sessions/${session.sessionToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: session.sessionToken,
          user_id: session.userId,
          expires: session.expires.toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update session')
      }

      const data = await response.json()
      return {
        sessionToken: data.session_token,
        userId: data.user_id,
        expires: new Date(data.expires)
      }
    },

    async deleteSession(sessionToken: string) {
      const response = await fetch(`${API_BASE_URL}/auth/sessions/${sessionToken}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete session')
      }
    },

    async createVerificationToken(token: VerificationToken) {
      const response = await fetch(`${API_BASE_URL}/auth/verification-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: token.identifier,
          token: token.token,
          expires: token.expires.toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create verification token')
      }

      const data = await response.json()
      return {
        identifier: data.identifier,
        token: data.token,
        expires: new Date(data.expires)
      }
    },

    async useVerificationToken(params: { identifier: string; token: string }) {
      const response = await fetch(`${API_BASE_URL}/auth/verification-tokens/${params.token}`)
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to use verification token')
      }

      const data = await response.json()
      if (data.identifier !== params.identifier) return null

      // Delete the token after use
      await fetch(`${API_BASE_URL}/auth/verification-tokens/${params.token}`, {
        method: 'DELETE'
      })

      return {
        identifier: data.identifier,
        token: data.token,
        expires: new Date(data.expires)
      }
    },

    async linkAccount(account: AdapterAccount) {
      const response = await fetch(`${API_BASE_URL}/auth/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: account.userId,
          type: account.type,
          provider: account.provider,
          provider_account_id: account.providerAccountId,
          refresh_token: account.refresh_token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state
        })
      })

      if (!response.ok) {
        throw new Error('Failed to link account')
      }

      return account
    },

    async unlinkAccount(params: { provider: string; providerAccountId: string }) {
      const response = await fetch(
        `${API_BASE_URL}/auth/accounts/${params.provider}/${params.providerAccountId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to unlink account')
      }
    },

    async getUserByAccount(params: { provider: string; providerAccountId: string }) {
      const response = await fetch(
        `${API_BASE_URL}/auth/accounts/${params.provider}/${params.providerAccountId}/user`
      )
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to get user by account')
      }

      const data = await response.json()
      return {
        ...data,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null
      }
    }
  }
} 