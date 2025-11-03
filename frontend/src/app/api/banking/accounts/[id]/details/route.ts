import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/auth';

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Get the account ID from the route parameters
    const accountId = params.id;
    
    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }
    
    // Make API call to backend to get account details
    const response = await fetch(`${BACKEND_BASE_URL}/banking/accounts/${accountId}/details`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": session.user.email || '',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch account details" },
        { status: response.status }
      );
    }
    
    // Return the account details
    const accountDetails = await response.json();
    return NextResponse.json(accountDetails);
    
  } catch (error) {
    console.error("Error in GET /api/banking/accounts/[id]/details:", error);
    return NextResponse.json(
      { error: "Failed to fetch account details" },
      { status: 500 }
    );
  }
}
