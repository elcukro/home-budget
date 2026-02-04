'use client';

import { useEffect, useState, useMemo } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import ProtectedPage from '@/components/ProtectedPage';
import { useSession } from 'next-auth/react';
import PeriodSelector from '@/components/PeriodSelector';
import ErrorBoundary from '@/components/ErrorBoundary';
import { logger } from '@/lib/logger';
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  PiggyBank,
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SavingEntry {
  id: number;
  title: string;
  amount: number;
  category: string;
  saving_type: string;
  date: string;
}

interface MonthlyData {
  incomes: Array<{
    id: number;
    title: string;
    amount: number;
    category: string;
    date: string;
  }>;
  expenses: Array<{
    id: number;
    title: string;
    amount: number;
    category: string;
    date: string;
  }>;
  loanPayments: Array<{
    id: number;
    loan_type: string;
    description: string;
    principal_amount: number;
    remaining_balance: number;
    interest_rate: number;
    monthly_payment: number;
    start_date: string;
    term_months: number;
  }>;
  savings: SavingEntry[];
  totals: {
    income: number;
    expenses: number;
    loanPayments: number;
    savings: number;
    deposits: number;
    withdrawals: number;
    balance: number;
  };
}

interface YearlyBudget {
  [key: string]: MonthlyData;
}

interface PeriodSelection {
  startDate: Date;
  endDate: Date;
}

// KPI Card Component
const KPICard = ({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  colorClass,
  bgClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  colorClass: string;
  bgClass: string;
}) => (
  <div className={cn("rounded-2xl border border-white/40 p-5 shadow-sm", bgClass)}>
    <div className="flex items-center gap-3">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colorClass)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-semibold text-primary">{value}</p>
          {trend && trend !== 'neutral' && (
            <span className={cn("flex items-center text-xs", trend === 'up' ? 'text-success' : 'text-destructive')}>
              {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            </span>
          )}
        </div>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </div>
    </div>
  </div>
);

// Month Card Component
const MonthCard = ({ monthName, data }: { monthName: string; data: MonthlyData }) => {
  const { formatCurrency } = useSettings();
  const intl = useIntl();

  // Extract month and year from monthName (e.g., "December 2024")
  const [month, year] = monthName.split(' ');
  const monthNumber = new Date(Date.parse(`${month} 1, 2000`)).getMonth() + 1;

  // Get localized month name
  const localizedMonth = intl.formatMessage({ id: `reports.months.${monthNumber}` });
  const displayName = `${localizedMonth} ${year}`;

  const savingsRate = data.totals.income > 0
    ? ((data.totals.savings / data.totals.income) * 100).toFixed(1)
    : '0';

  return (
    <div className="group rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-md hover:border-emerald-200">
      <div className="border-b border-emerald-100 pb-3 mb-3">
        <h3 className="text-sm font-semibold text-emerald-900">{displayName}</h3>
        <div className={cn(
          "text-lg font-bold",
          data.totals.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
        )}>
          {formatCurrency(data.totals.balance)}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {/* Income */}
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <FormattedMessage id="reports.income" />
          </span>
          <span className="font-medium text-emerald-600">{formatCurrency(data.totals.income)}</span>
        </div>

        {/* Expenses */}
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="h-3 w-3 text-rose-500" />
            <FormattedMessage id="reports.expenses" />
          </span>
          <span className="font-medium text-rose-600">{formatCurrency(data.totals.expenses)}</span>
        </div>

        {/* Loan Payments */}
        {data.totals.loanPayments > 0 && (
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Landmark className="h-3 w-3 text-amber-500" />
              <FormattedMessage id="reports.loanPayments" />
            </span>
            <span className="font-medium text-amber-600">{formatCurrency(data.totals.loanPayments)}</span>
          </div>
        )}

        {/* Savings */}
        {data.totals.savings !== 0 && (
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <PiggyBank className="h-3 w-3 text-sky-500" />
              <FormattedMessage id="reports.savings" defaultMessage="Savings" />
            </span>
            <span className={cn("font-medium", data.totals.savings >= 0 ? 'text-sky-600' : 'text-rose-600')}>
              {formatCurrency(data.totals.savings)}
            </span>
          </div>
        )}

        {/* Savings Rate */}
        {data.totals.income > 0 && (
          <div className="pt-2 border-t border-emerald-50">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                <FormattedMessage id="reports.savingsRate" />
              </span>
              <span className={cn(
                "font-medium",
                parseFloat(savingsRate) >= 15 ? 'text-emerald-600' :
                parseFloat(savingsRate) >= 10 ? 'text-amber-600' : 'text-rose-600'
              )}>
                {savingsRate}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Financial Trend Chart Component
const FinancialChart = ({ data }: { data: YearlyBudget }) => {
  const intl = useIntl();
  const { formatCurrency } = useSettings();

  const chartData = useMemo(() => {
    const monthEntries = Object.entries(data);

    // Transform month names to localized versions
    const localizedLabels = monthEntries.map(([monthName]) => {
      const [month, year] = monthName.split(' ');
      const monthNumber = new Date(Date.parse(`${month} 1, 2000`)).getMonth() + 1;
      const localizedMonth = intl.formatMessage({ id: `common.monthsShort.${monthNumber}` });
      return `${localizedMonth} ${year.slice(-2)}`;
    });

    // Get the data values
    const totalIncome = monthEntries.map(([_, data]) => data.totals.income);
    const totalExpenses = monthEntries.map(([_, data]) => data.totals.expenses);
    const totalSavings = monthEntries.map(([_, data]) => data.totals.savings);
    const availableCash = monthEntries.map(([_, data]) =>
      data.totals.income - (data.totals.expenses + data.totals.loanPayments)
    );

    return {
      labels: localizedLabels,
      datasets: [
        {
          label: intl.formatMessage({ id: 'reports.income' }),
          data: totalIncome,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: intl.formatMessage({ id: 'reports.expenses' }),
          data: totalExpenses,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: intl.formatMessage({ id: 'reports.savings', defaultMessage: 'Savings' }),
          data: totalSavings,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: intl.formatMessage({ id: 'reports.availableCash' }),
          data: availableCash,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data, intl]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 12, weight: 500 as const },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f1c1a',
        bodyColor: '#1f1c1a',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          font: { size: 11 },
          callback: function(value: any) {
            return formatCurrency(value);
          }
        },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      }
    }
  };

  return (
    <Card className="rounded-3xl border-emerald-100/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          <FormattedMessage id="reports.chart.title" defaultMessage="Financial Trends" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <Line options={options} data={chartData} />
        </div>
      </CardContent>
    </Card>
  );
};

// Category Breakdown Chart Component
const CategoryBreakdownChart = ({
  data,
  type
}: {
  data: YearlyBudget;
  type: 'expenses' | 'income';
}) => {
  const intl = useIntl();
  const { formatCurrency } = useSettings();

  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    Object.values(data).forEach((monthData) => {
      const items = type === 'expenses' ? monthData.expenses : monthData.incomes;
      items.forEach((item) => {
        categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
      });
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6); // Top 6 categories

    const colors = type === 'expenses'
      ? ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#059669']
      : ['#059669', '#0d9488', '#0891b2', '#0284c7', '#2563eb', '#7c3aed'];

    return {
      labels: sortedCategories.map(([category]) =>
        intl.formatMessage({ id: `${type}.categories.${category}`, defaultMessage: category })
      ),
      datasets: [{
        data: sortedCategories.map(([, value]) => value),
        backgroundColor: colors,
        borderWidth: 0,
      }],
      totalAmount: Object.values(categoryTotals).reduce((a, b) => a + b, 0),
    };
  }, [data, type, intl]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f1c1a',
        bodyColor: '#1f1c1a',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            const percent = ((value / categoryData.totalAmount) * 100).toFixed(1);
            return `${formatCurrency(value)} (${percent}%)`;
          }
        }
      }
    },
    cutout: '60%',
  };

  if (categoryData.labels.length === 0) {
    return null;
  }

  return (
    <Card className="rounded-3xl border-emerald-100/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-emerald-900">
          <FormattedMessage
            id={type === 'expenses' ? 'reports.expenseDistribution' : 'reports.incomeDistribution'}
            defaultMessage={type === 'expenses' ? 'Expense Distribution' : 'Income Distribution'}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <Doughnut options={options} data={categoryData} />
        </div>
      </CardContent>
    </Card>
  );
};

// Period preset type
type PeriodPreset = 'currentYear' | 'previousYear' | 'last2Years' | 'last5Years' | 'custom';

// Main Budget Report Component
const BudgetReport = () => {
  const [yearlyData, setYearlyData] = useState<YearlyBudget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const { formatCurrency } = useSettings();
  const intl = useIntl();

  // Period preset selection
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('currentYear');

  // Set default period to current year
  const [period, setPeriod] = useState<PeriodSelection>(() => {
    const currentYear = new Date().getFullYear();
    return {
      startDate: new Date(currentYear, 0, 1),
      endDate: new Date(currentYear, 11, 31),
    };
  });

  // Handle preset selection
  const handlePresetChange = (preset: PeriodPreset) => {
    setSelectedPreset(preset);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    switch (preset) {
      case 'currentYear':
        setPeriod({
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 11, 31),
        });
        break;
      case 'previousYear':
        setPeriod({
          startDate: new Date(currentYear - 1, 0, 1),
          endDate: new Date(currentYear - 1, 11, 31),
        });
        break;
      case 'last2Years':
        setPeriod({
          startDate: new Date(currentYear - 1, currentMonth, 1),
          endDate: new Date(currentYear, currentMonth, 31),
        });
        break;
      case 'last5Years':
        setPeriod({
          startDate: new Date(currentYear - 4, currentMonth, 1),
          endDate: new Date(currentYear, currentMonth, 31),
        });
        break;
      // 'custom' doesn't change the period - user will select manually
    }
  };

  const fetchYearlyBudget = async () => {
    if (!session?.user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const startMonth = period.startDate.toISOString().slice(0, 7);
      const endMonth = period.endDate.toISOString().slice(0, 7);

      // Use Next.js API proxy to add authentication headers
      const response = await fetch(
        `/api/backend/api/reports/yearly-budget?start_date=${startMonth}&end_date=${endMonth}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setYearlyData(data);
    } catch (err) {
      logger.error('[Reports] Failed to fetch yearly budget', err);
      setError(intl.formatMessage({ id: 'reports.messages.fetchError' }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      fetchYearlyBudget();
    }
  }, [session?.user?.email, period]);

  // Filter and sort the yearly data
  const filteredYearlyData = useMemo(() => {
    if (!yearlyData) return null;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return Object.entries(yearlyData)
      .filter(([monthName]) => {
        const [month, yearStr] = monthName.split(' ');
        const year = parseInt(yearStr);
        const monthIndex = monthNames.indexOf(month);
        const monthDate = new Date(year, monthIndex, 1);
        return monthDate >= period.startDate && monthDate <= period.endDate;
      })
      .sort(([aMonthName], [bMonthName]) => {
        const [aMonth, aYearStr] = aMonthName.split(' ');
        const [bMonth, bYearStr] = bMonthName.split(' ');
        const aYear = parseInt(aYearStr);
        const bYear = parseInt(bYearStr);
        const aMonthIndex = monthNames.indexOf(aMonth);
        const bMonthIndex = monthNames.indexOf(bMonth);
        if (aYear !== bYear) return aYear - bYear;
        return aMonthIndex - bMonthIndex;
      })
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as YearlyBudget);
  }, [yearlyData, period.startDate, period.endDate]);

  // Calculate period totals for KPIs
  const periodTotals = useMemo(() => {
    if (!filteredYearlyData) return null;

    const totals = {
      income: 0,
      expenses: 0,
      loanPayments: 0,
      savings: 0,
      balance: 0,
    };

    Object.values(filteredYearlyData).forEach((monthData) => {
      totals.income += monthData.totals.income;
      totals.expenses += monthData.totals.expenses;
      totals.loanPayments += monthData.totals.loanPayments;
      totals.savings += monthData.totals.savings;
      totals.balance += monthData.totals.balance;
    });

    return totals;
  }, [filteredYearlyData]);

  // Convert period to format expected by PeriodSelector
  const periodValue = useMemo(() => ({
    startYear: period.startDate.getFullYear(),
    startMonth: period.startDate.getMonth() + 1,
    endYear: period.endDate.getFullYear(),
    endMonth: period.endDate.getMonth() + 1,
  }), [period]);

  const handlePeriodChange = (newValue: any) => {
    setPeriod({
      startDate: new Date(newValue.startYear, newValue.startMonth - 1, 1),
      endDate: new Date(newValue.endYear, newValue.endMonth - 1, 31),
    });
  };

  const savingsRate = periodTotals && periodTotals.income > 0
    ? ((periodTotals.savings / periodTotals.income) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold text-emerald-900">
            <FormattedMessage id="reports.title" />
          </h1>
          <p className="text-sm text-emerald-700/80">
            <FormattedMessage id="reports.subtitle" defaultMessage="Monitor your financial progress over time" />
          </p>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="rounded-3xl border-emerald-100/60 shadow-sm">
        <CardContent className="py-4">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => handlePresetChange('currentYear')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                selectedPreset === 'currentYear'
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              <FormattedMessage id="reports.period.currentYear" defaultMessage="Current Year" />
            </button>
            <button
              onClick={() => handlePresetChange('previousYear')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                selectedPreset === 'previousYear'
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              <FormattedMessage id="reports.period.previousYear" defaultMessage="Previous Year" />
            </button>
            <button
              onClick={() => handlePresetChange('last2Years')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                selectedPreset === 'last2Years'
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              <FormattedMessage id="reports.period.last2Years" defaultMessage="Last 2 Years" />
            </button>
            <button
              onClick={() => handlePresetChange('last5Years')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                selectedPreset === 'last5Years'
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              <FormattedMessage id="reports.period.last5Years" defaultMessage="Last 5 Years" />
            </button>
            <button
              onClick={() => handlePresetChange('custom')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                selectedPreset === 'custom'
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              <FormattedMessage id="reports.period.custom" defaultMessage="Custom Dates" />
            </button>
          </div>

          {/* Custom date selector - only shown when custom is selected */}
          {selectedPreset === 'custom' && (
            <PeriodSelector
              value={periodValue}
              onChange={handlePeriodChange}
              minYear={new Date().getFullYear() - 5}
              maxYear={new Date().getFullYear()}
            />
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {filteredYearlyData && periodTotals && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              icon={TrendingUp}
              label={intl.formatMessage({ id: 'reports.totalIncome', defaultMessage: 'Total Income' })}
              value={formatCurrency(periodTotals.income)}
              colorClass="bg-emerald-500"
              bgClass="bg-emerald-50/80"
            />
            <KPICard
              icon={TrendingDown}
              label={intl.formatMessage({ id: 'reports.totalExpenses', defaultMessage: 'Total Expenses' })}
              value={formatCurrency(periodTotals.expenses)}
              colorClass="bg-rose-500"
              bgClass="bg-rose-50/80"
            />
            <KPICard
              icon={Landmark}
              label={intl.formatMessage({ id: 'reports.totalLoans', defaultMessage: 'Loan Payments' })}
              value={formatCurrency(periodTotals.loanPayments)}
              colorClass="bg-amber-500"
              bgClass="bg-amber-50/80"
            />
            <KPICard
              icon={PiggyBank}
              label={intl.formatMessage({ id: 'reports.totalSavings', defaultMessage: 'Net Savings' })}
              value={formatCurrency(periodTotals.savings)}
              subValue={`${savingsRate}% ${intl.formatMessage({ id: 'reports.ofIncome', defaultMessage: 'of income' })}`}
              trend={periodTotals.savings > 0 ? 'up' : periodTotals.savings < 0 ? 'down' : 'neutral'}
              colorClass="bg-sky-500"
              bgClass="bg-sky-50/80"
            />
            <KPICard
              icon={Wallet}
              label={intl.formatMessage({ id: 'reports.netBalance', defaultMessage: 'Net Balance' })}
              value={formatCurrency(periodTotals.balance)}
              trend={periodTotals.balance > 0 ? 'up' : periodTotals.balance < 0 ? 'down' : 'neutral'}
              colorClass="bg-violet-500"
              bgClass="bg-violet-50/80"
            />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <FinancialChart data={filteredYearlyData} />
            <div className="grid gap-6">
              <CategoryBreakdownChart data={filteredYearlyData} type="expenses" />
              <CategoryBreakdownChart data={filteredYearlyData} type="income" />
            </div>
          </div>

          {/* Monthly Cards */}
          <Card className="rounded-3xl border-emerald-100/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-emerald-900">
                <FormattedMessage id="reports.monthlyBreakdown" defaultMessage="Monthly Breakdown" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {Object.entries(filteredYearlyData).map(([monthName, monthData]) => (
                  <MonthCard
                    key={monthName}
                    monthName={monthName}
                    data={monthData}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default function ReportsPage() {
  return (
    <ProtectedPage>
      <ErrorBoundary>
        <BudgetReport />
      </ErrorBoundary>
    </ProtectedPage>
  );
}
