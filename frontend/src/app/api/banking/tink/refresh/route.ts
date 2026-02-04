import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createBackendHeaders } from '@/lib/backend-headers';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backendUrl = `${process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/banking/tink/refresh-data`;

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: createBackendHeaders(session.user.email),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error refreshing Tink data:", error);
    return NextResponse.json(
      { error: "Failed to refresh data" },
      { status: 500 }
    );
  }
}
