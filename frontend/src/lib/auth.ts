import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { logger } from "./logger"

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const providers: NextAuthOptions["providers"] = []

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  )
} else {
  if (process.env.NODE_ENV !== "production") {
    logger.warn(
      "[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured. " +
        "Enable ENABLE_DEV_AUTH or add credentials to use Google sign-in."
    )
  }
}

const devAuthEnabled =
  process.env.ENABLE_DEV_AUTH === "true" ||
  (!googleClientId && !googleClientSecret && process.env.NODE_ENV !== "production")

if (devAuthEnabled) {
  const allowedEmails = (process.env.DEV_AUTH_ALLOWED_EMAILS ?? "test@example.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  providers.push(
    CredentialsProvider({
      name: "Developer",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        if (!email) {
          return null
        }

        if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
          return null
        }

        return {
          id: email,
          email,
          name: credentials?.name || "Local User",
        }
      },
    })
  )
}

if (providers.length === 0) {
  throw new Error(
    "No NextAuth providers configured. Set Google credentials or ENABLE_DEV_AUTH=true."
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? session.user.email ?? ""
        session.user.email = (token.email as string | undefined) ?? session.user.email
        session.user.name = (token.name as string | undefined) ?? session.user.name
        session.user.isFirstLogin = token.isFirstLogin

        console.log('[auth][session] Session callback:', {
          tokenIsFirstLogin: token.isFirstLogin,
          sessionIsFirstLogin: session.user.isFirstLogin
        })
      }
      return session
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (user.id) {
          token.sub = user.id
        }
        if (user.email) {
          token.email = user.email
        }
        if (user.name) {
          token.name = user.name
        }
      }

      // Fetch is_first_login from backend on first sign-in (when account is present)
      if (account && token.email) {
        try {
          // Server-side: use Docker service name for inter-container communication
          // Client-side would use NEXT_PUBLIC_API_URL, but this runs server-side
          const API_URL = process.env.INTERNAL_API_URL || 'http://backend:8000'
          const secret = process.env.INTERNAL_SERVICE_SECRET

          console.log('[auth][DEBUG] Fetching user from backend:', {
            url: `${API_URL}/users/me`,
            email: token.email,
            hasSecret: !!secret,
            secretLength: secret?.length
          })

          const response = await fetch(`${API_URL}/users/me`, {
            headers: {
              'X-User-ID': token.email as string,
              'X-Internal-Secret': secret || '',
            },
          })

          console.log('[auth][DEBUG] Backend response:', {
            status: response.status,
            ok: response.ok
          })

          if (response.ok) {
            const userData = await response.json()
            token.isFirstLogin = userData.is_first_login ?? true
            console.log('[auth][DEBUG] User data received:', {
              email: userData.email,
              isFirstLogin: token.isFirstLogin
            })
            logger.debug(`[auth] Fetched/created user ${token.email}, is_first_login: ${token.isFirstLogin}`)
          } else {
            const errorText = await response.text()
            console.error('[auth][ERROR] Backend error:', errorText)
            // Default to true if fetch fails
            token.isFirstLogin = true
            logger.error(`[auth] Failed to fetch user (${response.status}), setting is_first_login=true`)
          }
        } catch (error) {
          console.error('[auth][ERROR] Exception:', error)
          logger.error('[auth] Failed to fetch user data:', error)
          // Default to true on error to be safe (show onboarding)
          token.isFirstLogin = true
        }
      } else {
        // Persist isFirstLogin from previous token (token refresh calls)
        // If not set yet, default to true
        if (token.isFirstLogin === undefined) {
          token.isFirstLogin = true
          console.log('[auth][DEBUG] isFirstLogin not set, defaulting to true')
        } else {
          console.log('[auth][DEBUG] Persisting isFirstLogin from token:', token.isFirstLogin)
        }
      }

      return token
    },
  },
}
