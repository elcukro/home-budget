import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createBackendHeaders } from '@/lib/backend-headers';

const API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/income/`, {
      headers: createBackendHeaders(session.user.email),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch incomes');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error fetching incomes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incomes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/income/`, {
      method: 'POST',
      headers: createBackendHeaders(session.user.email),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusCode = response.status;
      logger.error(`Error creating income (${statusCode}):`, errorData.detail || response.statusText);
      return NextResponse.json(
        { error: errorData.detail || response.statusText },
        { status: statusCode }  // Preserve original status code (403, 422, etc.)
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error creating income:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create income' },
      { status: 500 }
    );
  }
} 
