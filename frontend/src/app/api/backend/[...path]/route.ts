import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"

const BACKEND_API_BASE =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
])

const buildBackendUrl = (request: NextRequest, pathSegments: string[]): string => {
  const url = new URL(request.url)
  const search = url.search
  const normalizedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join("/")
  const targetBase = BACKEND_API_BASE.replace(/\/+$/, "")
  const targetPath = normalizedPath ? `/${normalizedPath}` : ""
  return `${targetBase}${targetPath}${search}`
}

// Paths that don't require authentication (public endpoints)
const PUBLIC_PATHS = new Set([
  "health",
  "docs",
  "openapi.json",
])

const isPublicPath = (pathSegments: string[]): boolean => {
  if (pathSegments.length === 0) return true
  if (PUBLIC_PATHS.has(pathSegments[0])) return true
  // Partner invitation validation is public (no auth required)
  if (pathSegments[0] === "partner" && pathSegments[1] === "invite") return true
  return false
}

const createForwardHeaders = async (request: NextRequest): Promise<{ headers: Headers; session: any }> => {
  const headers = new Headers()

  // Forward content-related headers from the incoming request
  for (const [key, value] of request.headers.entries()) {
    if (!hopByHopHeaders.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      headers.set(key, value)
    }
  }

  // Try to get session, handle JWT errors gracefully
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch (error) {
    logger.warn("[api/backend proxy] Session error (likely invalid JWT):", error)
    // Session is invalid - will return null
  }

  if (session?.user?.email) {
    headers.set("X-User-ID", session.user.email)
    // SECURITY: Include internal service secret to prove this request
    // comes from the trusted Next.js server, not a spoofed client request
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET
    if (internalSecret) {
      headers.set("X-Internal-Secret", internalSecret)
    }
  }

  return { headers, session }
}

const forwardRequest = async (request: NextRequest, params: { path?: string[] }) => {
  try {
    const pathSegments = params.path ?? []
    const targetUrl = buildBackendUrl(request, pathSegments)
    const method = request.method
    const { headers, session } = await createForwardHeaders(request)

    // For protected endpoints, require valid session
    // This prevents forwarding unauthenticated requests that will fail with 422
    if (!isPublicPath(pathSegments) && !session?.user?.email) {
      logger.warn("[api/backend proxy] No valid session for protected endpoint:", pathSegments.join("/"))
      return NextResponse.json(
        { error: "Authentication required. Please login again." },
        { status: 401 }
      )
    }

    const hasBody = !["GET", "HEAD"].includes(method)
    const body = hasBody ? await request.arrayBuffer() : undefined

    const backendResponse = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? body : undefined,
      redirect: "manual",
    })

    const responseHeaders = new Headers()
    for (const [key, value] of backendResponse.headers.entries()) {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    }

    const responseBody = backendResponse.body
    if (!responseBody) {
      return new NextResponse(null, {
        status: backendResponse.status,
        headers: responseHeaders,
      })
    }

    return new NextResponse(responseBody, {
      status: backendResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    logger.error("[api/backend proxy] Error forwarding request:", error)
    return NextResponse.json(
      { error: "Failed to reach backend service" },
      { status: 502 }
    )
  }
}

// Next.js 16+ requires params to be awaited as a Promise
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  return forwardRequest(request, params)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  return forwardRequest(request, params)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  return forwardRequest(request, params)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  return forwardRequest(request, params)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params
  return forwardRequest(request, params)
}
