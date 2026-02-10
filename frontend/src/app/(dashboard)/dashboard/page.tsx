'use client';

import ProtectedPage from "@/components/ProtectedPage";
import { useIntl } from "react-intl";
import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { DashboardSkeleton } from '@/components/LoadingSkeleton';
import MonthlySummary from '@/components/dashboard/MonthlySummary';
import HeroCards from '@/components/dashboard/HeroCards';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import FireMetricsPanel from '@/components/dashboard/FireMetricsPanel';
import DistributionChart from '@/components/dashboard/DistributionChart';
import CashFlowChart from '@/components/dashboard/CashFlowChart';
import SpendingTrendChart from '@/components/dashboard/SpendingTrendChart';
import CategoryBreakdownChart from '@/components/dashboard/CategoryBreakdownChart';
import BudgetVsActualChart from '@/components/dashboard/BudgetVsActualChart';
import SavingsGoalProgressChart from '@/components/dashboard/SavingsGoalProgressChart';
import LoanOverview from '@/components/dashboard/LoanOverview';
import SectionHeader from '@/components/dashboard/SectionHeader';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { getSavingsGoals } from '@/api/savings';
import { SavingsGoal } from '@/types/financial-freedom';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  PiggyBank,
  BarChart2,
  Activity as ActivityIcon,
  Wallet,
  ShoppingBag,
  Plus,
  Target,
  Landmark,
  LineChart,
} from 'lucide-react';
import Link from 'next/link';

interface _Summary {
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

type ActivityFilter = 'all' | 'income' | 'expense' | 'loan' | 'saving' | 'payment';

const getRelativeTimeLabel = (dateIso: string, locale: string) => {
  try {
    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (Math.abs(diffMs) < hour) {
      const minutes = Math.round(diffMs / minute);
      return rtf.format(minutes, 'minute');
    }
    if (Math.abs(diffMs) < day) {
      const hours = Math.round(diffMs / hour);
      return rtf.format(hours, 'hour');
    }
    if (Math.abs(diffMs) < month) {
      const days = Math.round(diffMs / day);
      return rtf.format(days, 'day');
    }
    const months = Math.round(diffMs / month);
    return rtf.format(months, 'month');
  } catch (_error) {
    return '';
  }
};

interface CardProps {
  title: string;
  amount: number;
  formatCurrency: (amount: number) => string;
}

function _SummaryCard({ title, amount, formatCurrency }: CardProps) {
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
  const activityTypeIcons = {
    income: <Wallet className="h-5 w-5" />,
    expense: <ShoppingBag className="h-5 w-5" />,
    loan: <TrendingDown className="h-5 w-5" />,
    saving: <PiggyBank className="h-5 w-5" />,
    payment: <BarChart2 className="h-5 w-5" />,
    settings: <ActivityIcon className="h-5 w-5" />,
  };

  const type = props.type || 'settings';
  const typeKey = type.toLowerCase() as keyof typeof activityTypeColors;
  const dotColor = activityTypeColors[typeKey] || 'bg-secondary';
  const typeIcon = activityTypeIcons[typeKey] || <ActivityIcon className="h-5 w-5" />;
  const relativeLabel = getRelativeTimeLabel(props.date, intl.locale);

  const renderChanges = () => {
    if (!props.changes || props.changes.length === 0) return null;
    
    return (
      <div className={`mt-2 text-xs text-secondary space-y-1 transition-all duration-200 ${props.isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        {props.changes.map((change, index) => {
          const isMonetary = ['amount', 'principal_amount', 'remaining_balance', 'monthly_payment', 'target_amount'].includes(change.field);
          const oldValue = isMonetary ? props.formatCurrency(Number(change.oldValue) || 0) : String(change.oldValue ?? '—');
          const newValue = isMonetary ? props.formatCurrency(Number(change.newValue) || 0) : String(change.newValue ?? '—');
          // Humanize field name as fallback (loan_type → Loan type)
          const fallbackLabel = change.field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

          return (
            <div key={index} className="flex items-center gap-2">
              <span className="font-medium">
                {intl.formatMessage({ id: `dashboard.activity.${change.field}`, defaultMessage: fallbackLabel })}:
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
              <span className="text-secondary">{typeIcon}</span>
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
            <p className="text-xs text-secondary mt-0.5" title={new Date(props.date).toLocaleString()}>
              {relativeLabel || intl.formatDate(new Date(props.date), { dateStyle: 'medium' })}
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
    interestPaidYtd?: number;
    nextPaymentDate?: string;
  }>;
  activities: Activity[];
  savings: {
    totalBalance: number;
    monthlySavings: number;
    goals: Array<{
      category: string;
      currentAmount: number;
      targetAmount: number;
      progress: number;
    }>;
  };
}

export default function Home() {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);
  const [insightsMetrics, setInsightsMetrics] = useState<{
    fireNumber?: number;
    savingsRate?: number;
    currentBabyStep?: number;
  }>({});
  const { data: session } = useSession();

  const summaryComparisons = useMemo(() => {
    if (!dashboardData) {
      return {
        deltas: {
          income: 0,
          expenses: 0,
          loanPayments: 0,
          netCashflow: 0,
          savingsRate: 0,
          debtToIncome: 0,
        },
        referenceLabel: '',
      };
    }

    const entries = (dashboardData.cashFlow || [])
      .map((item) => {
        const [year, month] = item.month.split('-').map(Number);
        const entryDate = new Date(year, (month || 1) - 1, 1);
        return { ...item, entryDate };
      })
      .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());

    if (entries.length === 0) {
      return {
        deltas: {
          income: 0,
          expenses: 0,
          loanPayments: 0,
          netCashflow: 0,
          savingsRate: 0,
          debtToIncome: 0,
        },
        referenceLabel: '',
      };
    }

    const today = new Date();
    const currentEntry = [...entries]
      .reverse()
      .find((entry) => entry.entryDate <= today) || entries[entries.length - 1];
    const currentIndex = entries.findIndex((entry) => entry === currentEntry);
    const previousEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;

    const deltas = {
      income: previousEntry ? currentEntry.income - previousEntry.income : 0,
      expenses: previousEntry ? currentEntry.expenses - previousEntry.expenses : 0,
      loanPayments: previousEntry ? currentEntry.loanPayments - previousEntry.loanPayments : 0,
      netCashflow: previousEntry ? currentEntry.netFlow - previousEntry.netFlow : 0,
      savingsRate: 0,
      debtToIncome: 0,
    };

    if (previousEntry) {
      const currentSavingsRate = currentEntry.income
        ? (currentEntry.income - currentEntry.expenses - currentEntry.loanPayments) / currentEntry.income
        : 0;
      const previousSavingsRate = previousEntry.income
        ? (previousEntry.income - previousEntry.expenses - previousEntry.loanPayments) / previousEntry.income
        : 0;
      deltas.savingsRate = currentSavingsRate - previousSavingsRate;

      const currentDTI = currentEntry.income ? currentEntry.loanPayments / currentEntry.income : 0;
      const previousDTI = previousEntry.income ? previousEntry.loanPayments / previousEntry.income : 0;
      deltas.debtToIncome = currentDTI - previousDTI;
    }

    const referenceFormatter = new Intl.DateTimeFormat(intl.locale, { month: 'long' });
    const referenceLabel = previousEntry ? referenceFormatter.format(previousEntry.entryDate) : '';

    return {
      deltas,
      referenceLabel,
    };
  }, [dashboardData, intl.locale]);

  const activityFilterOptions = useMemo(
    () =>
      ([
        { value: 'all', label: intl.formatMessage({ id: 'dashboard.activity.filters.all' }) },
        { value: 'income', label: intl.formatMessage({ id: 'dashboard.activity.filters.income' }) },
        { value: 'expense', label: intl.formatMessage({ id: 'dashboard.activity.filters.expense' }) },
        { value: 'loan', label: intl.formatMessage({ id: 'dashboard.activity.filters.loan' }) },
        { value: 'saving', label: intl.formatMessage({ id: 'dashboard.activity.filters.saving' }) },
        { value: 'payment', label: intl.formatMessage({ id: 'dashboard.activity.filters.payment' }) },
      ] as Array<{ value: ActivityFilter; label: string }>),
    [intl.locale],
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      try {
        setErrorMessageId(null);
        // Fetch dashboard summary and savings goals in parallel
        const [summaryResponse, goalsData] = await Promise.all([
          fetch(`/api/backend/users/${encodeURIComponent(session.user.email)}/summary`),
          getSavingsGoals(),
        ]);

        if (!summaryResponse.ok) {
          throw new Error(`Failed to fetch dashboard data: ${summaryResponse.statusText}`);
        }
        const data = await summaryResponse.json();

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
          loans: (data.loans || []).map((loan: any) => {
            const totalAmount = loan.total_amount ?? loan.totalAmount ?? 0;
            const balance = loan.balance ?? 0;
            const amountPaid = Math.max(totalAmount - balance, 0);
            const calculatedProgress = totalAmount > 0
              ? Math.min(Math.max(amountPaid / totalAmount, 0), 1)
              : 0;

            return {
              id: loan.id,
              description: loan.description,
              balance,
              monthlyPayment: loan.monthly_payment ?? loan.monthlyPayment ?? 0,
              interestRate: loan.interest_rate ?? loan.interestRate ?? 0,
              progress: calculatedProgress,
              totalAmount,
              interestPaidYtd: loan.interest_paid_ytd ?? loan.interestPaidYtd,
              nextPaymentDate: loan.next_payment_date ?? loan.nextPaymentDate,
            };
          }),
          activities: data.activities || [],
          savings: {
            totalBalance: data.total_savings_balance || 0,
            monthlySavings: data.monthly_savings || 0,
            goals: (data.savings_goals || []).map((goal: any) => ({
              category: goal.category,
              currentAmount: goal.currentAmount || 0,
              targetAmount: goal.targetAmount || 0,
              progress: goal.progress || 0,
            })),
          }
        };

        setDashboardData(mappedData);
        setSavingsGoals(goalsData);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logger.error('[Dashboard] Error:', error instanceof Error ? error.message : 'Failed to load dashboard data');
        }
        setErrorMessageId('dashboard.loadError');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  useEffect(() => {
    setShowAllActivities(false);
  }, [activityFilter]);

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

  const filteredActivities = useMemo(() => {
    if (!dashboardData) return [];
    const allActivities = dashboardData.activities || [];
    if (activityFilter === 'all') {
      return allActivities;
    }
    return allActivities.filter(
      (activity) => (activity.type || '').toLowerCase() === activityFilter,
    );
  }, [activityFilter, dashboardData]);

  const previewCount = 3;
  const displayedActivities = showAllActivities
    ? filteredActivities
    : filteredActivities.slice(0, previewCount);
  const canToggleActivities = filteredActivities.length > previewCount;

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

  const userName = session?.user?.name?.split(' ')[0] || '';

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section: Greeting + Hero Cards */}
        <section className="space-y-5">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-primary">
              {userName
                ? intl.formatMessage({ id: 'dashboard.hero.greeting' }, { name: userName })
                : intl.formatMessage({ id: 'dashboard.hero.greetingDefault' })}
            </h1>
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'dashboard.hero.situationGood' })}
            </p>
          </header>

          <HeroCards
            totalIncome={dashboardData.summary.totalIncome}
            totalExpenses={dashboardData.summary.totalExpenses}
            netCashflow={dashboardData.summary.netCashflow}
            deltas={{
              income: summaryComparisons.deltas.income,
              expenses: summaryComparisons.deltas.expenses,
              netCashflow: summaryComparisons.deltas.netCashflow,
            }}
            formatCurrency={formatCurrency}
          />
        </section>

        {/* AI Insights Panel */}
        <AIInsightsPanel
          onInsightsLoaded={(data) => {
            setInsightsMetrics({
              fireNumber: data.fireNumber,
              savingsRate: data.savingsRate,
              currentBabyStep: data.currentBabyStep,
            });
          }}
        />

        {/* FIRE Metrics Widgets */}
        <FireMetricsPanel
          fireNumber={insightsMetrics.fireNumber}
          currentSavings={dashboardData.savings.totalBalance}
          savingsRate={insightsMetrics.savingsRate ?? (dashboardData.summary.savingsRate * 100)}
          currentBabyStep={insightsMetrics.currentBabyStep}
          formatCurrency={formatCurrency}
        />

        {/* Full Monthly Summary (detailed metrics) */}
        <section className="space-y-4">
          <SectionHeader
            icon={<TrendingUp className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.summary.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.summary.description' })}
          />
          <MonthlySummary
            data={dashboardData.summary}
            deltas={summaryComparisons.deltas}
            referenceLabel={summaryComparisons.referenceLabel}
            formatCurrency={formatCurrency}
          />
        </section>

        {/* Distribution Charts */}
        <section className="space-y-4">
          <SectionHeader
            icon={<PieChart className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.distribution.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.distribution.description' })}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DistributionChart
              title={intl.formatMessage({ id: 'dashboard.incomeDistribution' })}
              data={dashboardData.incomeDistribution}
              formatCurrency={formatCurrency}
              type="income"
            />
            <DistributionChart
              title={intl.formatMessage({ id: 'dashboard.expenseDistribution' })}
              data={dashboardData.expenseDistribution}
              formatCurrency={formatCurrency}
              type="expense"
            />
          </div>
        </section>

        {/* Spending Trend */}
        <section className="space-y-4">
          <SectionHeader
            icon={<LineChart className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.spendingTrend.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.spendingTrend.description' })}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SpendingTrendChart
              data={dashboardData.cashFlow}
              formatCurrency={formatCurrency}
            />
            <CategoryBreakdownChart
              data={dashboardData.expenseDistribution}
              formatCurrency={formatCurrency}
            />
          </div>
        </section>

        {/* Budget vs Actual */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Target className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.budgetVsActual.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.budgetVsActual.description' })}
          />
          <BudgetVsActualChart
            cashFlowData={dashboardData.cashFlow}
            expenseDistribution={dashboardData.expenseDistribution}
            formatCurrency={formatCurrency}
          />
        </section>

        {/* Cash Flow */}
        <section className="space-y-4">
          <SectionHeader
            icon={<BarChart2 className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.cashFlow.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.cashFlow.description' })}
          />
          <CashFlowChart
            title={intl.formatMessage({ id: 'dashboard.cashFlow.title' })}
            data={dashboardData.cashFlow}
            formatCurrency={formatCurrency}
          />
        </section>

        {/* Loans */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Landmark className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.loans.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.loans.description' })}
          />
          <LoanOverview loans={dashboardData.loans} formatCurrency={formatCurrency} />
        </section>

        {/* Savings */}
        <section className="space-y-4">
          <SectionHeader
            icon={<PiggyBank className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.sections.savings.title' })}
            description={intl.formatMessage({ id: 'dashboard.sections.savings.description' })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">
                  {intl.formatMessage({ id: 'dashboard.savings.totalBalance' })}
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-800">
                {formatCurrency(dashboardData.savings.totalBalance)}
              </p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                <span className="text-sm text-sky-700">
                  {intl.formatMessage({ id: 'dashboard.savings.monthlySavings' })}
                </span>
              </div>
              <p className={`text-2xl font-bold ${dashboardData.savings.monthlySavings >= 0 ? 'text-sky-800' : 'text-rose-600'}`}>
                {dashboardData.savings.monthlySavings >= 0 ? '+' : ''}{formatCurrency(dashboardData.savings.monthlySavings)}
              </p>
            </div>
          </div>
          <SavingsGoalProgressChart
            goals={savingsGoals}
            formatCurrency={formatCurrency}
          />
        </section>

        {/* Activity Feed */}
        <section className="space-y-4">
          <SectionHeader
            icon={<ActivityIcon className="h-5 w-5" />}
            title={intl.formatMessage({ id: 'dashboard.activity.title' })}
            description={intl.formatMessage({ id: 'dashboard.activity.sectionDescription' })}
            action={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  {activityFilterOptions.map((option) => {
                    const isActive = activityFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setActivityFilter(option.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-default bg-card text-secondary hover:border-primary hover:text-primary'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  {canToggleActivities && (
                    <Button variant="outline" size="sm" onClick={toggleShowAllActivities}>
                      {showAllActivities
                        ? intl.formatMessage({ id: 'dashboard.activity.showLess' })
                        : intl.formatMessage({ id: 'dashboard.activity.showAll' })}
                    </Button>
                  )}
                  <Button variant="default" size="sm" asChild>
                    <Link href="/expenses">
                      <Plus className="mr-2 h-4 w-4" />
                      {intl.formatMessage({ id: 'dashboard.activity.quickAdd' })}
                    </Link>
                  </Button>
                </div>
              </div>
            }
          />
          <div className="bg-card border border-default rounded-xl shadow-sm p-6" role="list">
            {displayedActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {activityFilter === 'all'
                  ? intl.formatMessage({ id: 'dashboard.activity.emptyState' })
                  : intl.formatMessage({ id: 'dashboard.activity.emptyStateFiltered' })}
              </p>
            ) : (
              displayedActivities.map((activity) => (
                <ActivityCard
                  key={`${activity.id}-${activity.date}`}
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
              ))
            )}
          </div>
        </section>
      </div>
    </ProtectedPage>
  );
}
