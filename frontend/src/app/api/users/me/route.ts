import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user email from the session
    const userEmail = session.user.email;

    console.log('[api][users/me] Fetching user with email:', userEmail);

    // First try to create the user if they don't exist
    try {
      const createResponse = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          name: session.user.name || userEmail.split('@')[0],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (createResponse.ok) {
        const newUser = await createResponse.json();
        console.log('[api][users/me] Created new user:', newUser);
        return NextResponse.json(newUser);
      } else if (createResponse.status === 409) {
        // User already exists, continue to fetch
        console.log('[api][users/me] User already exists, fetching...');
      } else {
        const errorText = await createResponse.text();
        console.error('[api][users/me] Failed to create user:', errorText);
        throw new Error(`Failed to create user: ${errorText}`);
      }
    } catch (error) {
      console.error('[api][users/me] Error creating user:', error);
      // Continue to try fetching the user
    }

    // Now fetch the user using the email as ID
    const response = await fetch(`${API_BASE_URL}/users/me?user_id=${encodeURIComponent(userEmail)}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[api][users/me] Failed to fetch user:', errorText);
      throw new Error(`Failed to fetch user: ${errorText}`);
    }

    const user = await response.json();
    console.log('[api][users/me] Found user:', user);
    return NextResponse.json(user);
  } catch (error) {
    console.error("[api][users/me] Error:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 