import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(
  request: Request,
  { params }: { params: { email: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== params.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/users/${encodeURIComponent(params.email)}/settings`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch settings');
    }

    const settings = await response.json();
    return NextResponse.json(settings);
  } catch (error) {
    logger.error('[Settings API] Error fetching settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { email: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== params.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const response = await fetch(
      `${API_BASE_URL}/users/${encodeURIComponent(params.email)}/settings`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update settings');
    }

    const settings = await response.json();
    return NextResponse.json(settings);
  } catch (error) {
    logger.error('[Settings API] Error updating settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
} 
