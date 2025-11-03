import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  logger.debug('DELETE request received for income ID:', params.id);
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      logger.warn('Unauthorized: No session or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.debug('User email from session:', session.user.email);

    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/income/${params.id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete income');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete income:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete income' },
      { status: 500 }
    );
  }
}
