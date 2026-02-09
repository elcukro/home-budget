import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the JSON data from the request
    const { data, clearExisting = false } = await request.json();

    // Send the data to the backend with auth headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': session.user.email,
    };
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (internalSecret) {
      headers['X-Internal-Secret'] = internalSecret;
    }

    const response = await fetch(
      `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/import`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data,
          clear_existing: Boolean(clearExisting),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    logger.error('[Import API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import data' },
      { status: 500 }
    );
  }
} 
