import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createBackendHeaders } from '@/lib/backend-headers';

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: accountId } = await params;

    // Forward request to backend
    const backendUrl = `${BACKEND_BASE_URL}/banking/accounts/${accountId}/transactions`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: createBackendHeaders(session.user.email || ''),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching transactions: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch transactions', detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in banking/accounts/[id]/transactions route:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error.message },
      { status: 500 }
    );
  }
}
