'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Summary {
  total_monthly_income: number;
  total_monthly_expenses: number;
  total_monthly_loan_payments: number;
  total_loan_balance: number;
  monthly_balance: number;
}

interface ChartData {
  name: string;
  value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await fetch('http://localhost:8000/users/1/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch summary data');
      }
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyFlowData = () => {
    if (!summary) return [];
    return [
      { name: 'Income', amount: summary.total_monthly_income },
      { name: 'Expenses', amount: summary.total_monthly_expenses },
      { name: 'Loan Payments', amount: summary.total_monthly_loan_payments },
    ];
  };

  const getDistributionData = () => {
    if (!summary) return [];
    const total = summary.total_monthly_expenses + summary.total_monthly_loan_payments;
    return [
      { name: 'Expenses', value: (summary.total_monthly_expenses / total) * 100 },
      { name: 'Loan Payments', value: (summary.total_monthly_loan_payments / total) * 100 },
    ];
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Financial Reports</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Monthly Balance</h3>
          <p className={`mt-2 text-3xl font-semibold ${summary?.monthly_balance ?? 0 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${(summary?.monthly_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Savings Rate</h3>
          <p className="mt-2 text-3xl font-semibold text-blue-600">
            {summary?.total_monthly_income
              ? ((summary.monthly_balance / summary.total_monthly_income) * 100).toFixed(1)
              : 0}%
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Total Loan Balance</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            ${(summary?.total_loan_balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Monthly Cash Flow Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Monthly Cash Flow</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={getMonthlyFlowData()}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              />
              <Legend />
              <Bar dataKey="amount" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expense Distribution Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Expense Distribution</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={getDistributionData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {getDistributionData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Health Indicators */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">Financial Health Indicators</h2>
        <div className="space-y-4">
          {summary && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Debt-to-Income Ratio</h3>
                <div className="mt-1">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (summary.total_monthly_loan_payments / summary.total_monthly_income) * 100 <= 30
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (summary.total_monthly_loan_payments / summary.total_monthly_income) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="ml-2 text-sm text-gray-500">
                      {((summary.total_monthly_loan_payments / summary.total_monthly_income) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Expense Ratio</h3>
                <div className="mt-1">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (summary.total_monthly_expenses / summary.total_monthly_income) * 100 <= 50
                              ? 'bg-green-500'
                              : 'bg-yellow-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              (summary.total_monthly_expenses / summary.total_monthly_income) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="ml-2 text-sm text-gray-500">
                      {((summary.total_monthly_expenses / summary.total_monthly_income) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 