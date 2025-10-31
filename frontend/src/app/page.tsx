'use client';

import ProtectedPage from "@/components/ProtectedPage";
import { useIntl } from "react-intl";
import { useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { DashboardSkeleton } from '@/components/LoadingSkeleton';
import MonthlySummary from '@/components/dashboard/MonthlySummary';
import DistributionChart from '@/components/dashboard/DistributionChart';
import CashFlowChart from '@/components/dashboard/CashFlowChart';
import LoanOverview from '@/components/dashboard/LoanOverview';
import { useSession } from 'next-auth/react';

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
    <div className="bg-card border border-default p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium mb-2 text-primary">
        {title}
      </h3>
      <p className="text-2xl font-bold text-primary">
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
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const intl = useIntl();
  const activityTypeColors = {
    income: 'bg-success',
    expense: 'bg-destructive',
    loan: 'bg-primary',
    saving: 'bg-emerald-500',
    payment: 'bg-lilac',
    settings: 'bg-sand'
  };

  const type = props.type || 'settings';
  const typeKey = type.toLowerCase() as keyof typeof activityTypeColors;
  const dotColor = activityTypeColors[typeKey] || 'bg-secondary';

  const renderChanges = () => {
    if (!props.changes || props.changes.length === 0) return null;
    
    return (
      <div className={`mt-2 text-xs text-secondary space-y-1 transition-all duration-200 ${props.isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        {props.changes.map((change, index) => {
          const isMonetary = ['amount', 'principal_amount', 'remaining_balance', 'monthly_payment'].includes(change.field);
          const oldValue = isMonetary ? props.formatCurrency(Number(change.oldValue) || 0) : change.oldValue;
          const newValue = isMonetary ? props.formatCurrency(Number(change.newValue) || 0) : change.newValue;
          
          return (
            <div key={index} className="flex items-center gap-2">
              <span className="font-medium">
                {intl.formatMessage({ id: `dashboard.activity.${change.field}` })}:
              </span>
              <span className="text-destructive line-through">{oldValue}</span>
              <span className="text-success">{newValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const amount = Number(props.amount) || 0;

  return (
    <div className="relative pl-8 pb-4 last:pb-0" role="listitem">
      <div
        className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 ring-white`}
        aria-hidden="true"
      ></div>
      <div className="absolute left-[4px] top-6 bottom-0 w-[2px] bg-border" aria-hidden="true"></div>
      <div 
        className="bg-card p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-default cursor-pointer"
        onClick={props.onToggle}
      >
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-base text-primary mb-0.5 truncate" title={props.title}>
                {props.title}
              </h4>
              {props.changes && props.changes.length > 0 && (
                <svg 
                  className={`w-4 h-4 text-secondary transition-transform duration-200 ${props.isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
            <p className="text-xs text-secondary flex items-center gap-2">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true"></span>
              {intl.formatMessage({ id: `dashboard.activity.${props.operation}` })} {intl.formatMessage({ id: `dashboard.activity.${type.toLowerCase()}` })}
            </p>
            {renderChanges()}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`font-medium text-base tabular-nums ${amount >= 0 ? 'text-success' : 'text-destructive'}`} 
               aria-label={`Amount: ${props.formatCurrency(amount)}`}>
              {props.formatCurrency(amount)}
            </p>
            <p className="text-xs text-secondary mt-0.5">
              {props.date}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalLoanPayments: number;
    netCashflow: number;
    savingsRate: number;
    debtToIncome: number;
  };
  incomeDistribution: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  expenseDistribution: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  cashFlow: Array<{
    month: string;
    income: number;
    expenses: number;
    loanPayments: number;
    netFlow: number;
  }>;
  loans: Array<{
    id: string;
    description: string;
    balance: number;
    monthlyPayment: number;
    interestRate: number;
    progress: number;
    totalAmount: number;
  }>;
  activities: Activity[];
}

export default function Home() {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        setErrorMessageId(null);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_URL}/users/${encodeURIComponent(session.user.email)}/summary`);
        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Map the API response fields to the expected format
        const mappedData: DashboardData = {
          summary: {
            totalIncome: data.total_monthly_income || 0,
            totalExpenses: data.total_monthly_expenses || 0,
            totalLoanPayments: data.total_monthly_loan_payments || 0,
            netCashflow: data.monthly_balance || 0,
            savingsRate: data.savings_rate !== undefined ? data.savings_rate : 
              (data.total_monthly_income > 0 ? 
                (data.total_monthly_income - data.total_monthly_expenses - data.total_monthly_loan_payments) / data.total_monthly_income : 0),
            debtToIncome: data.debt_to_income !== undefined ? data.debt_to_income :
              (data.total_monthly_income > 0 ? 
                data.total_monthly_loan_payments / data.total_monthly_income : 0)
          },
          incomeDistribution: data.income_distribution || [],
          expenseDistribution: data.expense_distribution || [],
          cashFlow: data.cash_flow || [],
          loans: data.loans || [],
          activities: data.activities || []
        };
        
        setDashboardData(mappedData);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Dashboard] Error:', error instanceof Error ? error.message : 'Failed to load dashboard data');
        }
        setErrorMessageId('dashboard.loadError');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const toggleActivity = (id: number) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleShowAllActivities = () => {
    setShowAllActivities(prev => !prev);
  };

  const displayedActivities = showAllActivities
    ? dashboardData?.activities || []
    : (dashboardData?.activities || []).slice(0, 2);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (errorMessageId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded">
          {intl.formatMessage({ id: errorMessageId })}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-secondary">
          {intl.formatMessage({ id: 'dashboard.noData' })}
        </div>
      </div>
    );
  }

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-primary">
          {intl.formatMessage({ id: 'dashboard.title' })}
        </h1>

        <div className="grid grid-cols-1 gap-6 mb-6">
          <MonthlySummary
            data={dashboardData?.summary || {
              totalIncome: 0,
              totalExpenses: 0,
              totalLoanPayments: 0,
              netCashflow: 0,
              savingsRate: 0,
              debtToIncome: 0
            }}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 min-h-[400px]">
          <DistributionChart
            title={intl.formatMessage({ id: 'dashboard.incomeDistribution' })}
            data={dashboardData?.incomeDistribution || []}
            formatCurrency={formatCurrency}
            type="income"
          />
          <DistributionChart
            title={intl.formatMessage({ id: 'dashboard.expenseDistribution' })}
            data={dashboardData?.expenseDistribution || []}
            formatCurrency={formatCurrency}
            type="expense"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6 min-h-[550px]">
          <CashFlowChart
            data={dashboardData?.cashFlow || []}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6 min-h-[400px]">
          <LoanOverview
            loans={dashboardData?.loans || []}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="bg-card border border-default rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-primary">
            {intl.formatMessage({ id: 'dashboard.recentActivity' })}
          </h2>
          <div className="space-y-4" role="list">
            {displayedActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                title={activity.title}
                amount={activity.amount}
                type={activity.type}
                date={activity.date}
                operation={activity.operation}
                changes={activity.changes}
                formatCurrency={formatCurrency}
                isExpanded={expandedActivities.has(activity.id)}
                onToggle={() => toggleActivity(activity.id)}
              />
            ))}
            {dashboardData?.activities && dashboardData.activities.length > 2 && (
              <div className="pt-4 border-t border-default">
                <button
                  className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-2"
                  onClick={toggleShowAllActivities}
                >
                  {intl.formatMessage({ 
                    id: showAllActivities ? 'dashboard.showLessActivity' : 'dashboard.viewAllActivity' 
                  })}
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${showAllActivities ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
