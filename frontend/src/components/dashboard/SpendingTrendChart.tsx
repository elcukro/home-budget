'use client';

import { useIntl } from 'react-intl';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculateMovingAverage, type MovingAverageResult } from '@/utils/movingAverage';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  LineController,
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

type TimeHorizon = 'currentYear' | 'lastYear' | 'twoYears';

interface SpendingTrendChartProps {
  data: CashFlowData[];
  formatCurrency: (amount: number) => string;
}

interface MonthlyStats {
  totalSpending: number;
  monthlyAverage: number;
  highestMonth: { month: string; amount: number } | null;
  lowestMonth: { month: string; amount: number } | null;
}

export default function SpendingTrendChart({ data, formatCurrency }: SpendingTrendChartProps) {
  const intl = useIntl();
  const [chartKey, setChartKey] = useState(Date.now());
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('currentYear');

  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const sortedData = [...data].sort((a, b) => {
      const [yearA, monthA] = a.month.split('-').map(Number);
      const [yearB, monthB] = b.month.split('-').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });

    switch (timeHorizon) {
      case 'currentYear':
        return sortedData.filter(item => {
          const [year] = item.month.split('-').map(Number);
          return year === currentYear;
        });
      case 'lastYear':
        return sortedData.filter(item => {
          const [year] = item.month.split('-').map(Number);
          return year === currentYear - 1;
        });
      case 'twoYears': {
        const startDate = new Date(currentYear - 2, currentMonth - 1, 1);
        return sortedData.filter(item => {
          const [year, month] = item.month.split('-').map(Number);
          const itemDate = new Date(year, month - 1, 1);
          return itemDate >= startDate;
        });
      }
      default:
        return sortedData;
    }
  }, [data, timeHorizon]);

  const expenseValues = useMemo(() =>
    filteredData.map(item => item.expenses),
    [filteredData]
  );

  const movingAverageData: MovingAverageResult[] = useMemo(() => {
    if (filteredData.length < 3) return [];
    return calculateMovingAverage(expenseValues, 3);
  }, [expenseValues, filteredData.length]);

  const stats: MonthlyStats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalSpending: 0,
        monthlyAverage: 0,
        highestMonth: null,
        lowestMonth: null,
      };
    }

    const total = filteredData.reduce((sum, item) => sum + item.expenses, 0);
    const average = total / filteredData.length;

    let highest: { month: string; amount: number } | null = null;
    let lowest: { month: string; amount: number } | null = null;

    filteredData.forEach(item => {
      if (!highest || item.expenses > highest.amount) {
        highest = { month: item.month, amount: item.expenses };
      }
      if (!lowest || item.expenses < lowest.amount) {
        lowest = { month: item.month, amount: item.expenses };
      }
    });

    return {
      totalSpending: total,
      monthlyAverage: average,
      highestMonth: highest,
      lowestMonth: lowest,
    };
  }, [filteredData]);

  const formatMonthLabel = (monthStr: string): string => {
    const [year, monthPart] = monthStr.split('-');
    const monthName = intl.formatMessage({ id: `common.months.${monthPart}` });
    return `${monthName} ${year}`;
  };

  const formatMonthLabelShort = (monthStr: string): string => {
    const [, monthPart] = monthStr.split('-');
    return intl.formatMessage({ id: `common.monthsShort.${monthPart}` });
  };

  const calculatePercentChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const monthLabels = filteredData.map(item => formatMonthLabelShort(item.month));

  const chartData: ChartData<'line'> = {
    labels: monthLabels,
    datasets: [
      {
        label: intl.formatMessage({ id: 'dashboard.spendingTrend.actualExpenses' }),
        data: expenseValues,
        borderColor: '#D65A56',
        backgroundColor: '#D65A5633',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#D65A56',
        fill: true,
      },
      ...(movingAverageData.length > 0 ? [{
        label: intl.formatMessage({ id: 'dashboard.spendingTrend.movingAverage' }),
        data: movingAverageData.map(item => item.value),
        borderColor: '#6366F1',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderDash: [6, 3],
        fill: false,
      }] : []),
    ],
  };

  const axisColor = 'rgba(31, 28, 26, 0.9)';
  const gridColor = 'rgba(31, 28, 26, 0.16)';

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
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
            const index = contexts[0].dataIndex;
            const dataPoint = filteredData[index];
            if (!dataPoint) return '';
            return formatMonthLabel(dataPoint.month);
          },
          label: (context) => {
            const value = context.raw as number;
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          },
          afterLabel: (context) => {
            if (context.datasetIndex !== 0) return '';
            const index = context.dataIndex;
            const current = expenseValues[index];
            const previous = index > 0 ? expenseValues[index - 1] : null;

            const lines: string[] = [];

            if (previous !== null) {
              const percentChange = calculatePercentChange(current, previous);
              const direction = percentChange > 0 ? '↑' : percentChange < 0 ? '↓' : '→';
              const changeLabel = intl.formatMessage(
                { id: 'dashboard.spendingTrend.tooltip.change' },
                {
                  direction,
                  percent: Math.abs(percentChange).toFixed(1),
                }
              );
              lines.push(changeLabel);
            }

            if (movingAverageData.length > 0 && movingAverageData[index]?.value !== null) {
              const maLabel = intl.formatMessage(
                { id: 'dashboard.spendingTrend.tooltip.ma3' },
                { amount: formatCurrency(movingAverageData[index].value!) }
              );
              lines.push(maLabel);
            }

            return lines.join('\n');
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: axisColor },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: axisColor,
          callback: (value) => formatCurrency(value as number),
        },
        beginAtZero: true,
      },
    },
  };

  const renderTrendIndicator = (current: number, previous: number) => {
    const percentChange = calculatePercentChange(current, previous);

    if (Math.abs(percentChange) < 0.5) {
      return (
        <span className="flex items-center gap-1 text-secondary">
          <Minus className="h-4 w-4" />
          <span className="text-xs">0%</span>
        </span>
      );
    }

    if (percentChange > 0) {
      return (
        <span className="flex items-center gap-1 text-destructive">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs">+{percentChange.toFixed(1)}%</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-success">
        <TrendingDown className="h-4 w-4" />
        <span className="text-xs">{percentChange.toFixed(1)}%</span>
      </span>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-card border border-default p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-primary mb-4">
          {intl.formatMessage({ id: 'dashboard.spendingTrend.title' })}
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <TrendingUp className="h-12 w-12 opacity-30 mb-4" />
          <p className="text-center">
            {intl.formatMessage({ id: 'dashboard.spendingTrend.emptyState' })}
          </p>
        </div>
      </div>
    );
  }

  const lastMonthExpense = expenseValues[expenseValues.length - 1] || 0;
  const prevMonthExpense = expenseValues.length > 1 ? expenseValues[expenseValues.length - 2] : 0;

  return (
    <div className="bg-card border border-default p-6 rounded-xl shadow-sm h-full flex flex-col">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {intl.formatMessage({ id: 'dashboard.spendingTrend.title' })}
          </h2>
          <p className="text-sm text-secondary">
            {intl.formatMessage({ id: 'dashboard.spendingTrend.description' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['currentYear', 'lastYear', 'twoYears'] as TimeHorizon[]).map((horizon) => (
            <button
              key={horizon}
              onClick={() => setTimeHorizon(horizon)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                timeHorizon === horizon
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-secondary hover:bg-muted/80'
              }`}
            >
              {intl.formatMessage({ id: `dashboard.spendingTrend.timeHorizon.${horizon}` })}
            </button>
          ))}
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="flex-grow flex items-center justify-center py-12">
          <p className="text-secondary text-center">
            {intl.formatMessage({ id: 'dashboard.spendingTrend.noDataForPeriod' })}
          </p>
        </div>
      ) : (
        <>
          <div className="relative flex-grow h-[350px] mb-6">
            <Line key={chartKey} data={chartData} options={options} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-secondary mb-1">
                {intl.formatMessage({ id: 'dashboard.spendingTrend.statistics.total' })}
              </p>
              <p className="text-lg font-semibold text-primary">
                {formatCurrency(stats.totalSpending)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-secondary mb-1">
                {intl.formatMessage({ id: 'dashboard.spendingTrend.statistics.average' })}
              </p>
              <p className="text-lg font-semibold text-primary">
                {formatCurrency(stats.monthlyAverage)}
              </p>
              {expenseValues.length > 1 && (
                <div className="mt-1">
                  {renderTrendIndicator(lastMonthExpense, prevMonthExpense)}
                </div>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-secondary mb-1">
                {intl.formatMessage({ id: 'dashboard.spendingTrend.statistics.highest' })}
              </p>
              {stats.highestMonth ? (
                <>
                  <p className="text-lg font-semibold text-destructive">
                    {formatCurrency(stats.highestMonth.amount)}
                  </p>
                  <p className="text-xs text-secondary">
                    {formatMonthLabel(stats.highestMonth.month)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-primary">—</p>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-secondary mb-1">
                {intl.formatMessage({ id: 'dashboard.spendingTrend.statistics.lowest' })}
              </p>
              {stats.lowestMonth ? (
                <>
                  <p className="text-lg font-semibold text-success">
                    {formatCurrency(stats.lowestMonth.amount)}
                  </p>
                  <p className="text-xs text-secondary">
                    {formatMonthLabel(stats.lowestMonth.month)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-primary">—</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
