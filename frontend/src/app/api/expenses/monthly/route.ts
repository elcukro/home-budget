import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const API_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build headers with authentication
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-ID': session.user.email,
    };

    // Add internal service secret for secure server-to-server auth
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    if (internalSecret) {
      headers['X-Internal-Secret'] = internalSecret;
    }

    // Fetch monthly expenses from the backend (which handles end_date filtering)
    const response = await fetch(
      `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses/monthly`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch monthly expenses');
    }

    const data = await response.json();

    logger.debug(`Monthly expenses for ${session.user.email}: total=${data.total}, recurring=${data.recurring}`);

    // Return the monthly expenses (backend already handles end_date filtering)
    return NextResponse.json({
      total: data.total,
      non_recurring: data.non_recurring,
      recurring: data.recurring,
      month: data.month,
      calculation_method: 'backend with end_date filtering',
    });
  } catch (error) {
    logger.error('Error calculating monthly expenses:', error);
    return NextResponse.json(
      { error: 'Failed to calculate monthly expenses' },
      { status: 500 }
    );
  }
} 
