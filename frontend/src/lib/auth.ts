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
      }
      return session
    },
    async jwt({ token, user }) {
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
      return token
    },
  },
}
