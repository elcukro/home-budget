'use client';

import { useIntl } from 'react-intl';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend
);

interface CashFlowData {
  month: string;
  income: number;
  expenses: number;
  loanPayments: number;
  netFlow: number;
  year?: number;
}

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface BudgetVsActualChartProps {
  cashFlowData: CashFlowData[];
  expenseDistribution: CategoryData[];
  formatCurrency: (amount: number) => string;
}

interface CategoryBudgetComparison {
  category: string;
  actual: number;
  budget: number;
  variance: number;
  variancePercent: number;
}

export default function BudgetVsActualChart({
  cashFlowData,
  expenseDistribution,
  formatCurrency,
}: BudgetVsActualChartProps) {
  const intl = useIntl();
  const [chartKey, setChartKey] = useState(Date.now());

  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  // Count how many past months with data were used for the budget average
  const historyMonthsCount = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const pastWithData = cashFlowData.filter(item => {
      const [year, month] = item.month.split('-').map(Number);
      const isPast = year < currentYear || (year === currentYear && month < currentMonth);
      return isPast && item.expenses > 0;
    });
    return Math.min(pastWithData.length, 3);
  }, [cashFlowData]);

  // Calculate budget based on historical average (last 3 months with data)
  const categoryComparisons: CategoryBudgetComparison[] = useMemo(() => {
    if (!expenseDistribution || expenseDistribution.length === 0) {
      return [];
    }

    // Get last 3 months of data for average calculation
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Filter to past months only (exclude current month from average)
    // Also exclude months with zero expenses to avoid diluting the average
    // with months where the user had no data yet.
    const pastMonths = cashFlowData.filter(item => {
      const [year, month] = item.month.split('-').map(Number);
      const isPast = year < currentYear || (year === currentYear && month < currentMonth);
      return isPast && item.expenses > 0;
    });

    // Take last 3 months with actual data
    const last3Months = pastMonths.slice(-3);

    // Calculate average total spending from historical data
    let avgMonthlySpending = 0;
    const monthsUsed = last3Months.length;
    if (monthsUsed > 0) {
      const totalHistorical = last3Months.reduce((sum, m) => sum + m.expenses, 0);
      avgMonthlySpending = totalHistorical / monthsUsed;
    }

    // Current month total actual spending
    const currentMonthActual = expenseDistribution.reduce((sum, cat) => sum + cat.amount, 0);

    // If no historical data, use current as baseline (100%)
    if (avgMonthlySpending === 0) {
      avgMonthlySpending = currentMonthActual;
    }

    // Calculate budget per category based on percentage distribution and historical average
    return expenseDistribution
      .map(cat => {
        const actual = cat.amount;
        // Budget = historical average * category's share of current spending
        // This assumes spending distribution is relatively stable
        const budget = avgMonthlySpending * (cat.percentage / 100);
        const variance = actual - budget;
        const variancePercent = budget > 0 ? (variance / budget) * 100 : 0;

        return {
          category: cat.category,
          actual,
          budget,
          variance,
          variancePercent,
        };
      })
      .sort((a, b) => b.actual - a.actual) // Sort by actual spending (highest first)
      .slice(0, 8); // Limit to top 8 categories for readability
  }, [cashFlowData, expenseDistribution]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    if (categoryComparisons.length === 0) {
      return {
        totalActual: 0,
        totalBudget: 0,
        totalVariance: 0,
        overBudgetCount: 0,
        underBudgetCount: 0,
      };
    }

    const totalActual = categoryComparisons.reduce((sum, cat) => sum + cat.actual, 0);
    const totalBudget = categoryComparisons.reduce((sum, cat) => sum + cat.budget, 0);
    const overBudgetCount = categoryComparisons.filter(cat => cat.variance > 0).length;
    const underBudgetCount = categoryComparisons.filter(cat => cat.variance < 0).length;

    return {
      totalActual,
      totalBudget,
      totalVariance: totalActual - totalBudget,
      overBudgetCount,
      underBudgetCount,
    };
  }, [categoryComparisons]);

  const categoryLabels = categoryComparisons.map(cat =>
    intl.formatMessage({ id: `expenses.categories.${cat.category}`, defaultMessage: cat.category })
  );

  const chartData: ChartData<'bar'> = {
    labels: categoryLabels,
    datasets: [
      {
        label: intl.formatMessage({ id: 'dashboard.budgetVsActual.budget', defaultMessage: 'Budget ({n}-mo avg)' }, { n: historyMonthsCount || 1 }),
        data: categoryComparisons.map(cat => cat.budget),
        backgroundColor: '#6366F1AA',
        borderColor: '#6366F1',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: intl.formatMessage({ id: 'dashboard.budgetVsActual.actual', defaultMessage: 'Actual' }),
        data: categoryComparisons.map(cat => cat.actual),
        backgroundColor: categoryComparisons.map(cat =>
          cat.variance > 0 ? '#D65A56CC' : '#4BA56ACC'
        ),
        borderColor: categoryComparisons.map(cat =>
          cat.variance > 0 ? '#D65A56' : '#4BA56A'
        ),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const axisColor = 'rgba(31, 28, 26, 0.9)';
  const gridColor = 'rgba(31, 28, 26, 0.16)';

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const, // Horizontal bars for better category label readability
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 600,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: axisColor,
          font: { size: 12 },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          title: (contexts) => {
            if (!contexts?.length) return '';
            return contexts[0].label || '';
          },
          label: (context) => {
            const value = context.raw as number;
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          },
          afterBody: (contexts) => {
            if (!contexts?.length) return '';
            const index = contexts[0].dataIndex;
            const comparison = categoryComparisons[index];
            if (!comparison) return '';

            const varianceLabel = comparison.variance >= 0
              ? intl.formatMessage({ id: 'dashboard.budgetVsActual.tooltip.overBudget', defaultMessage: 'Over budget' })
              : intl.formatMessage({ id: 'dashboard.budgetVsActual.tooltip.underBudget', defaultMessage: 'Under budget' });

            const varianceAmount = formatCurrency(Math.abs(comparison.variance));
            const variancePercent = Math.abs(comparison.variancePercent).toFixed(1);

            return `${varianceLabel}: ${varianceAmount} (${variancePercent}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: {
          color: axisColor,
          callback: (value) => formatCurrency(value as number),
        },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: {
          color: axisColor,
          font: { size: 11 },
        },
      },
    },
  };

  if (!expenseDistribution || expenseDistribution.length === 0) {
    return (
      <div className="bg-card border border-default p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-primary mb-4">
          {intl.formatMessage({ id: 'dashboard.budgetVsActual.title', defaultMessage: 'Budget vs Actual' })}
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <Target className="h-12 w-12 opacity-30 mb-4" />
          <p className="text-center">
            {intl.formatMessage({ id: 'dashboard.budgetVsActual.emptyState', defaultMessage: 'No expense data yet. Add expenses to see budget comparisons.' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-default p-6 rounded-xl shadow-sm h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-primary">
          {intl.formatMessage({ id: 'dashboard.budgetVsActual.title', defaultMessage: 'Budget vs Actual' })}
        </h2>
        <p className="text-sm text-secondary">
          {historyMonthsCount > 0
            ? intl.formatMessage(
                { id: 'dashboard.budgetVsActual.descriptionMonths', defaultMessage: 'Compare this month\'s spending against your {n}-month average.' },
                { n: historyMonthsCount }
              )
            : intl.formatMessage({ id: 'dashboard.budgetVsActual.descriptionNoHistory', defaultMessage: 'No historical data yet — add more months to see your average.' })
          }
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-secondary mb-1">
            {intl.formatMessage({ id: 'dashboard.budgetVsActual.totalBudget', defaultMessage: 'Budget' })}
          </p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summaryStats.totalBudget)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-secondary mb-1">
            {intl.formatMessage({ id: 'dashboard.budgetVsActual.totalActual', defaultMessage: 'Actual' })}
          </p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summaryStats.totalActual)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-secondary mb-1">
            {intl.formatMessage({ id: 'dashboard.budgetVsActual.variance', defaultMessage: 'Variance' })}
          </p>
          <div className="flex items-center gap-1">
            {summaryStats.totalVariance > 0 ? (
              <TrendingUp className="h-4 w-4 text-destructive" />
            ) : summaryStats.totalVariance < 0 ? (
              <TrendingDown className="h-4 w-4 text-success" />
            ) : null}
            <p className={`text-lg font-semibold ${
              summaryStats.totalVariance > 0 ? 'text-destructive' :
              summaryStats.totalVariance < 0 ? 'text-success' : 'text-primary'
            }`}>
              {summaryStats.totalVariance >= 0 ? '+' : ''}{formatCurrency(summaryStats.totalVariance)}
            </p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-secondary mb-1">
            {intl.formatMessage({ id: 'dashboard.budgetVsActual.status', defaultMessage: 'Status' })}
          </p>
          <div className="flex items-center gap-2">
            {summaryStats.overBudgetCount > 0 && (
              <span className="flex items-center gap-1 text-destructive text-sm">
                <AlertTriangle className="h-3.5 w-3.5" />
                {summaryStats.overBudgetCount}
              </span>
            )}
            {summaryStats.underBudgetCount > 0 && (
              <span className="flex items-center gap-1 text-success text-sm">
                <TrendingDown className="h-3.5 w-3.5" />
                {summaryStats.underBudgetCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-grow h-[350px]">
        <Bar key={chartKey} data={chartData} options={options} />
      </div>

      {/* Legend Note */}
      <p className="text-xs text-secondary mt-4 text-center">
        {intl.formatMessage(
          { id: 'dashboard.budgetVsActual.legendNote', defaultMessage: 'Green = under budget • Red = over budget • Budget based on {n}-month average' },
          { n: historyMonthsCount || 1 }
        )}
      </p>
    </div>
  );
}
