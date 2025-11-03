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

const createForwardHeaders = async (request: NextRequest) => {
  const headers = new Headers()

  // Forward content-related headers from the incoming request
  for (const [key, value] of request.headers.entries()) {
    if (!hopByHopHeaders.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      headers.set(key, value)
    }
  }

  // Attach user context when available
  const session = await getServerSession(authOptions)
  if (session?.user?.email) {
    headers.set("X-User-ID", session.user.email)
  }

  return headers
}

const forwardRequest = async (request: NextRequest, params: { path?: string[] }) => {
  try {
    const pathSegments = params.path ?? []
    const targetUrl = buildBackendUrl(request, pathSegments)
    const method = request.method
    const headers = await createForwardHeaders(request)

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

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return forwardRequest(request, context.params)
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return forwardRequest(request, context.params)
}

export async function PUT(request: NextRequest, context: { params: { path?: string[] } }) {
  return forwardRequest(request, context.params)
}

export async function PATCH(request: NextRequest, context: { params: { path?: string[] } }) {
  return forwardRequest(request, context.params)
}

export async function DELETE(request: NextRequest, context: { params: { path?: string[] } }) {
  return forwardRequest(request, context.params)
}
