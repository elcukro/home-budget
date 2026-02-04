import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createBackendHeaders } from '@/lib/backend-headers';

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: connectionId } = await params;

    // Forward request to backend
    const backendUrl = `${BACKEND_BASE_URL}/banking/connections/${connectionId}`;

    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: createBackendHeaders(session.user.email || ''),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error deleting banking connection: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to delete banking connection', detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in banking/connections/[id] route:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
