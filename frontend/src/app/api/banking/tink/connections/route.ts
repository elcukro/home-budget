import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/banking/tink/connections`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'X-User-ID': session.user.email || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching Tink connections: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch bank connections', detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in banking/tink/connections route:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error.message },
      { status: 500 }
    );
  }
}
