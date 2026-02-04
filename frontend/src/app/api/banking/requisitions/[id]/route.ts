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

    const { id } = await params;
    let requisitionId = id;

    // Log the requisition ID and its type for debugging
    console.log('Received requisition ID:', requisitionId);
    console.log('Requisition ID type:', typeof requisitionId);

    // Try to force to string if needed
    if (requisitionId && typeof requisitionId !== 'string') {
      try {
        const stringId = String(requisitionId);
        console.log('Converted requisition ID to string:', stringId);
        requisitionId = stringId;
      } catch (e) {
        console.error('Failed to convert requisition ID to string:', e);
      }
    }

    // Ensure we have a valid requisition ID before proceeding
    if (!requisitionId) {
      console.error('Missing requisition ID');
      return NextResponse.json(
        { error: 'Missing requisition ID', detail: 'No requisition ID was provided.' },
        { status: 400 }
      );
    }

    // Forward request to backend
    const backendUrl = `${BACKEND_BASE_URL}/banking/requisitions/${requisitionId}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: createBackendHeaders(session.user.email || ''),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching requisition: ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch requisition', detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in banking/requisitions/[id] route:', error);
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
