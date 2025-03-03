'use client';

import { useEffect, useState } from 'react';

interface Summary {
  total_monthly_income: number;
  total_monthly_expenses: number;
  total_monthly_loan_payments: number;
  total_loan_balance: number;
  monthly_balance: number;
}

function SummaryCard({ 
  title, 
  amount, 
  type 
}: { 
  title: string; 
  amount: number; 
  type: 'income' | 'expense' | 'loan' | 'balance';
}) {
  const colors = {
    income: 'bg-green-100 text-green-800',
    expense: 'bg-red-100 text-red-800',
    loan: 'bg-blue-100 text-blue-800',
    balance: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className={`p-6 rounded-lg shadow ${colors[type]}`}>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-2 text-2xl font-semibold">
        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('http://localhost:8000/users/1/summary');
        if (!response.ok) {
          throw new Error('Failed to fetch summary data');
        }
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Financial Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Monthly Income"
          amount={summary?.total_monthly_income ?? 0}
          type="income"
        />
        <SummaryCard
          title="Monthly Expenses"
          amount={summary?.total_monthly_expenses ?? 0}
          type="expense"
        />
        <SummaryCard
          title="Loan Payments"
          amount={summary?.total_monthly_loan_payments ?? 0}
          type="loan"
        />
        <SummaryCard
          title="Monthly Balance"
          amount={summary?.monthly_balance ?? 0}
          type="balance"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium mb-4">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 text-center text-gray-500">
            Coming soon: Activity feed and transaction history
          </div>
        </div>
      </div>
    </div>
  );
}
