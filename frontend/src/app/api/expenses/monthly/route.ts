import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';

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
    
    // Fetch the user's expenses
    const response = await fetch(
      `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/expenses`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch expenses');
    }
    
    const expenses = await response.json();
    
    // Filter only recurring expenses
    const recurringExpenses = expenses.filter((expense: any) => expense.is_recurring === true);
    
    // Calculate the total recurring monthly expenses
    const totalMonthlyExpenses = recurringExpenses.reduce(
      (sum: number, expense: any) => sum + parseFloat(expense.amount),
      0
    );
    
    console.log(`Total monthly expenses for ${session.user.email}: ${totalMonthlyExpenses}`);
    
    // Return the monthly expenses
    return NextResponse.json({
      total: totalMonthlyExpenses,
      monthly_recurring: totalMonthlyExpenses,
      recurring_count: recurringExpenses.length,
      calculation_method: 'sum of recurring expenses',
    });
  } catch (error) {
    console.error('Error calculating monthly expenses:', error);
    return NextResponse.json(
      { error: 'Failed to calculate monthly expenses' },
      { status: 500 }
    );
  }
} 