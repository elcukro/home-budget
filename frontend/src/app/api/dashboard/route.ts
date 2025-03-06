import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const email = encodeURIComponent(session.user.email);
    const endpoints = [
      `${API_BASE_URL}/users/${email}/income/`,
      `${API_BASE_URL}/users/${email}/expenses/`,
      `${API_BASE_URL}/users/${email}/loans/`,
      `${API_BASE_URL}/users/${email}/activities/`,
    ];

    const responses = await Promise.all(
      endpoints.map(endpoint => 
        fetch(endpoint)
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      )
    );

    const [income, expenses, loans, activities] = responses;

    // Calculate monthly totals
    const totalIncome = income.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
    const totalExpenses = expenses.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);
    const totalLoanPayments = loans.reduce((sum: number, item: any) => sum + parseFloat(item.monthly_payment), 0);
    const netCashflow = totalIncome - totalExpenses - totalLoanPayments;

    // Calculate savings rate (net cashflow / total income)
    const savingsRate = totalIncome > 0 ? netCashflow / totalIncome : 0;

    // Calculate debt-to-income ratio (total monthly debt payments / monthly income)
    const debtToIncome = totalIncome > 0 ? totalLoanPayments / totalIncome : 0;

    // Calculate income distribution
    const incomeByCategory = income.reduce((acc: any, item: any) => {
      acc[item.category] = (acc[item.category] || 0) + parseFloat(item.amount);
      return acc;
    }, {});

    const incomeDistribution = Object.entries(incomeByCategory).map(([category, amount]) => ({
      category,
      amount: Number(amount),
      percentage: totalIncome > 0 ? Number(amount) / totalIncome : 0,
    }));

    // Calculate expense distribution
    const expensesByCategory = expenses.reduce((acc: any, item: any) => {
      acc[item.category] = (acc[item.category] || 0) + parseFloat(item.amount);
      return acc;
    }, {});

    const expenseDistribution = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount: Number(amount),
      percentage: totalExpenses > 0 ? Number(amount) / totalExpenses : 0,
    }));

    // Get last 6 months for cash flow
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return date.toISOString().slice(0, 7); // YYYY-MM format
    }).reverse();

    const cashFlow = months.map(month => {
      const monthIncome = income
        .filter((item: any) => item.date.startsWith(month))
        .reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);

      const monthExpenses = expenses
        .filter((item: any) => item.date.startsWith(month))
        .reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);

      return {
        month,
        income: monthIncome,
        expenses: monthExpenses,
        loanPayments: totalLoanPayments, // Assuming fixed monthly payments
        netFlow: monthIncome - monthExpenses - totalLoanPayments,
      };
    });

    // Format loan data
    const formattedLoans = loans.map((loan: any) => {
      const totalAmount = parseFloat(loan.amount);
      const balance = parseFloat(loan.remaining_balance);
      return {
        id: loan.id,
        description: loan.description,
        balance: balance,
        monthlyPayment: parseFloat(loan.monthly_payment),
        interestRate: parseFloat(loan.interest_rate),
        progress: (totalAmount - balance) / totalAmount,
        totalAmount: totalAmount,
      };
    });

    return NextResponse.json({
      summary: {
        totalIncome,
        totalExpenses,
        totalLoanPayments,
        netCashflow,
        savingsRate,
        debtToIncome,
      },
      incomeDistribution,
      expenseDistribution,
      cashFlow,
      loans: formattedLoans,
      activities: activities.slice(0, 10), // Only return last 10 activities
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 