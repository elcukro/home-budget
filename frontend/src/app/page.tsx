'use client';

import ProtectedPage from "@/components/ProtectedPage";
import { useIntl } from "react-intl";
import { useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { DashboardSkeleton } from '@/components/LoadingSkeleton';
import { useRouter } from 'next/navigation';

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  totalLoans: number;
  balance: number;
}

interface Activity {
  id: number;
  title: string;
  amount: number;
  type: string;
  date: string;
  operation: 'create' | 'update' | 'delete';
  changes?: Array<{ field: string; oldValue?: any; newValue?: any; }>;
}

interface CardProps {
  title: string;
  amount: number;
  formatCurrency: (amount: number) => string;
}

function SummaryCard({ title, amount, formatCurrency }: CardProps) {
  return (
    <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium mb-2 text-default">
        {title}
      </h3>
      <p className="text-2xl font-bold">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function ActivityCard(props: {
  title: string;
  amount: number;
  type: string;
  date: string;
  operation: 'create' | 'update' | 'delete';
  changes?: Array<{ field: string; oldValue?: any; newValue?: any; }>;
  formatCurrency: (amount: number) => string;
}) {
  const intl = useIntl();
  const activityTypeColors = {
    income: 'bg-green-500',
    expense: 'bg-red-500',
    loan: 'bg-blue-500',
    payment: 'bg-purple-500'
  };

  const typeKey = props.type.toLowerCase() as keyof typeof activityTypeColors;
  const dotColor = activityTypeColors[typeKey] || 'bg-gray-500';

  const renderChanges = () => {
    if (!props.changes || props.changes.length === 0) return null;
    
    return (
      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        {props.changes.map((change, index) => {
          const isMonetary = ['amount', 'principal_amount', 'remaining_balance', 'monthly_payment'].includes(change.field);
          const oldValue = isMonetary ? props.formatCurrency(Number(change.oldValue) || 0) : change.oldValue;
          const newValue = isMonetary ? props.formatCurrency(Number(change.newValue) || 0) : change.newValue;
          
          return (
            <div key={index} className="flex items-center gap-2">
              <span className="font-medium">
                {intl.formatMessage({ id: `dashboard.activity.${change.field}` })}:
              </span>
              <span className="text-red-600 dark:text-red-400 line-through">{oldValue}</span>
              <span className="text-green-600 dark:text-green-400">{newValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const amount = Number(props.amount) || 0;

  return (
    <div className="relative pl-8 pb-4 last:pb-0" role="listitem">
      <div className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 ring-white dark:ring-background-primary`} aria-hidden="true"></div>
      <div className="absolute left-[4px] top-6 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-700" aria-hidden="true"></div>
      <div className="bg-white dark:bg-background-primary p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-base text-gray-900 dark:text-gray-100 mb-0.5 truncate" title={props.title}>
              {props.title}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true"></span>
              {intl.formatMessage({ id: `dashboard.activity.${props.operation}` })} {intl.formatMessage({ id: `dashboard.activity.${props.type.toLowerCase()}` })}
            </p>
            {renderChanges()}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`font-medium text-base tabular-nums ${amount >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`} 
               aria-label={`Amount: ${props.formatCurrency(amount)}`}>
              {props.formatCurrency(amount)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {props.date}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const intl = useIntl();
  const router = useRouter();
  const { formatCurrency } = useSettings();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const summaryResponse = await fetch('/api/summary');
        if (!summaryResponse.ok) {
          throw new Error(`Failed to fetch summary: ${summaryResponse.statusText}`);
        }
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);

        const activitiesResponse = await fetch('/api/activities');
        if (!activitiesResponse.ok) {
          throw new Error(`Failed to fetch activities: ${activitiesResponse.statusText}`);
        }
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-red-600 dark:text-red-400 text-center">
          <p className="text-lg font-semibold">Error loading dashboard</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-default">
          {intl.formatMessage({ id: 'dashboard.title' })}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            title={intl.formatMessage({ id: 'dashboard.summaryCards.monthlyIncome' })}
            amount={summary?.totalIncome || 0}
            formatCurrency={formatCurrency}
          />
          <SummaryCard
            title={intl.formatMessage({ id: 'dashboard.summaryCards.monthlyExpenses' })}
            amount={summary?.totalExpenses || 0}
            formatCurrency={formatCurrency}
          />
          <SummaryCard
            title={intl.formatMessage({ id: 'dashboard.summaryCards.loanPayments' })}
            amount={summary?.totalLoans || 0}
            formatCurrency={formatCurrency}
          />
          <SummaryCard
            title={intl.formatMessage({ id: 'dashboard.summaryCards.monthlyBalance' })}
            amount={summary?.balance || 0}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            className="bg-white dark:bg-background-primary p-6 rounded-lg shadow hover:shadow-md transition-all flex flex-col items-center justify-center text-center group"
            onClick={() => router.push('/income')}
          >
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-default mb-2">
              {intl.formatMessage({ id: 'income.addNew' })}
            </h3>
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'dashboard.quickActions.addIncome' })}
            </p>
          </button>

          <button
            className="bg-white dark:bg-background-primary p-6 rounded-lg shadow hover:shadow-md transition-all flex flex-col items-center justify-center text-center group"
            onClick={() => router.push('/expenses')}
          >
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-default mb-2">
              {intl.formatMessage({ id: 'expenses.addNew' })}
            </h3>
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'dashboard.quickActions.addExpense' })}
            </p>
          </button>

          <button
            className="bg-white dark:bg-background-primary p-6 rounded-lg shadow hover:shadow-md transition-all flex flex-col items-center justify-center text-center group"
            onClick={() => router.push('/loans')}
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-default mb-2">
              {intl.formatMessage({ id: 'loans.addNew' })}
            </h3>
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'dashboard.quickActions.addLoan' })}
            </p>
          </button>

          <button
            className="bg-white dark:bg-background-primary p-6 rounded-lg shadow hover:shadow-md transition-all flex flex-col items-center justify-center text-center group"
            onClick={() => router.push('/reports')}
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-default mb-2">
              {intl.formatMessage({ id: 'reports.title' })}
            </h3>
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'dashboard.quickActions.viewReports' })}
            </p>
          </button>
        </div>

        <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-6 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {intl.formatMessage({ id: 'dashboard.recentActivity' })}
          </h2>
          <div className="relative">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {intl.formatMessage({ id: 'dashboard.noActivity' })}
                </p>
              </div>
            ) : (
              <div className="space-y-4" role="list">
                {activities.map((activity) => {
                  const date = new Date(activity.date);
                  const formattedDate = intl.formatMessage(
                    { id: 'dashboard.activity.timestamp' },
                    {
                      date: intl.formatDate(date, { dateStyle: 'medium' }),
                      time: intl.formatTime(date, { timeStyle: 'short' })
                    }
                  );

                  let displayDate = formattedDate;
                  if (activity.operation === 'update') {
                    displayDate = intl.formatMessage(
                      { id: 'dashboard.activity.updated_at' },
                      {
                        date: intl.formatDate(date, { dateStyle: 'medium' }),
                        time: intl.formatTime(date, { timeStyle: 'short' })
                      }
                    );
                  }

                  return (
                    <ActivityCard
                      key={activity.id}
                      title={activity.title}
                      amount={activity.amount}
                      type={activity.type}
                      date={displayDate}
                      operation={activity.operation}
                      changes={activity.changes}
                      formatCurrency={formatCurrency}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
