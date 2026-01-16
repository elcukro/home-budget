import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pass query params to backend
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const isSelfEmployed = searchParams.get('is_self_employed');

    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (isSelfEmployed) params.append('is_self_employed', isSelfEmployed);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/savings/retirement-limits${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'X-User-ID': session.user.email,
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error fetching retirement limits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch retirement limits' },
      { status: 500 }
    );
  }
}
