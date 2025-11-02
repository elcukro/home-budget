import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch income
    const incomeResponse = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/income`);
    if (!incomeResponse.ok) {
      throw new Error('Failed to fetch income');
    }
    const incomeData = await incomeResponse.json();
    const totalIncome = incomeData.reduce((sum: number, item: any) => sum + item.amount, 0);

    // Fetch expenses
    const expensesResponse = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses`);
    if (!expensesResponse.ok) {
      throw new Error('Failed to fetch expenses');
    }
    const expensesData = await expensesResponse.json();
    const totalExpenses = expensesData.reduce((sum: number, item: any) => sum + item.amount, 0);

    // Fetch loans
    const loansResponse = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/loans`);
    if (!loansResponse.ok) {
      throw new Error('Failed to fetch loans');
    }
    const loansData = await loansResponse.json();
    const totalLoans = loansData.reduce((sum: number, item: any) => sum + item.remaining_balance, 0);

    // Calculate balance
    const balance = totalIncome - totalExpenses - totalLoans;

    return NextResponse.json({
      totalIncome,
      totalExpenses,
      totalLoans,
      balance,
    });
  } catch (error) {
    logger.error('[api][summary] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 
