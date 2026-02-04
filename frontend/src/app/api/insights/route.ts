import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createBackendHeaders } from "@/lib/backend-headers";

const API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("forceRefresh") === "true";
    
    const response = await fetch(`${API_BASE_URL}/users/${session.user.email}/insights${forceRefresh ? "?refresh=true" : ""}`, {
      method: "GET",
      headers: createBackendHeaders(session.user.email),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.detail || "Failed to fetch insights" }, { status: response.status });
    }

    const insights = await response.json();
    return NextResponse.json(insights);
  } catch (error) {
    logger.error("Error in GET /api/insights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/users/${session.user.email}/insights/refresh`, {
      method: "POST",
      headers: createBackendHeaders(session.user.email),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.detail || "Failed to refresh insights" }, { status: response.status });
    }

    const insights = await response.json();
    return NextResponse.json(insights);
  } catch (error) {
    logger.error("Error in POST /api/insights:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
