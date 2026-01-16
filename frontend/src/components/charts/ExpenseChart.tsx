'use client';

import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { TrendingDown } from 'lucide-react';

interface Expense {
  id: number | string;
  category: string;
  description: string;
  amount: number;
  date: string;
  end_date: string | null;
  is_recurring: boolean;
}

interface ExpenseChartProps {
  expenses: Expense[];
}

type TimeHorizon = 'currentYear' | 'lastYear' | '2years' | '5years';

export default function ExpenseChart({ expenses }: ExpenseChartProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const [horizon, setHorizon] = useState<TimeHorizon>('currentYear');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Generate time horizon options dynamically based on current year
  const TIME_HORIZONS: { value: TimeHorizon; label: string }[] = [
    { value: 'currentYear', label: String(currentYear) },
    { value: 'lastYear', label: String(currentYear - 1) },
    { value: '2years', label: intl.formatMessage({ id: 'charts.horizon.last2years', defaultMessage: 'Ostatnie 2 lata' }) },
    { value: '5years', label: intl.formatMessage({ id: 'charts.horizon.last5years', defaultMessage: 'Ostatnie 5 lat' }) },
  ];

  // Generate monthly data based on the selected horizon
  const chartData = useMemo(() => {
    let startYear: number;
    let startMonth: number;
    let endYear: number;
    let endMonth: number;

    switch (horizon) {
      case 'currentYear':
        startYear = currentYear;
        startMonth = 0; // January
        endYear = currentYear;
        endMonth = currentMonth;
        break;
      case 'lastYear':
        startYear = currentYear - 1;
        startMonth = 0;
        endYear = currentYear - 1;
        endMonth = 11; // December
        break;
      case '2years':
        startYear = currentYear - 1;
        startMonth = 0;
        endYear = currentYear;
        endMonth = currentMonth;
        break;
      case '5years':
        startYear = currentYear - 4;
        startMonth = 0;
        endYear = currentYear;
        endMonth = currentMonth;
        break;
      default:
        startYear = currentYear;
        startMonth = 0;
        endYear = currentYear;
        endMonth = currentMonth;
    }

    // Generate array of months for the selected range
    const months: { key: string; date: Date; total: number }[] = [];

    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const date = new Date(year, month, 1);
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      months.push({ key, date, total: 0 });

      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    // Helper function to parse date string safely (avoids timezone issues)
    const parseYearMonth = (dateStr: string): { year: number; month: number } | null => {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length < 2) return null;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      if (Number.isNaN(year) || Number.isNaN(month)) return null;
      return { year, month };
    };

    // Calculate totals for each month, considering recurring items
    expenses.forEach((expense) => {
      const startParsed = parseYearMonth(expense.date);
      if (!startParsed) return;

      const endParsed = expense.end_date ? parseYearMonth(expense.end_date) : null;

      months.forEach((monthData) => {
        const chartYear = monthData.date.getFullYear();
        const chartMonth = monthData.date.getMonth();

        if (expense.is_recurring) {
          // Recurring: add to all months from start to end
          const afterStart = chartYear > startParsed.year ||
            (chartYear === startParsed.year && chartMonth >= startParsed.month);
          const beforeEnd = !endParsed ||
            chartYear < endParsed.year ||
            (chartYear === endParsed.year && chartMonth <= endParsed.month);

          if (afterStart && beforeEnd) {
            monthData.total += expense.amount;
          }
        } else {
          // One-off: add only to the specific month
          if (chartYear === startParsed.year && chartMonth === startParsed.month) {
            monthData.total += expense.amount;
          }
        }
      });
    });

    return months;
  }, [expenses, horizon, currentYear, currentMonth]);

  // Calculate stats
  const stats = useMemo(() => {
    const totals = chartData.map(m => m.total);
    const sum = totals.reduce((a, b) => a + b, 0);
    const avg = totals.length > 0 ? sum / totals.length : 0;
    const max = Math.max(...totals, 0);
    const nonZeroMonths = totals.filter(t => t > 0).length;

    return { sum, avg, max, nonZeroMonths, monthCount: totals.length };
  }, [chartData]);

  // Determine bar grouping based on horizon
  const groupedData = useMemo(() => {
    let result: { key: string; label: string; total: number; date: Date; hasChange?: boolean }[];

    if (horizon === 'currentYear' || horizon === 'lastYear') {
      // Show all months individually
      result = chartData.map(m => ({
        ...m,
        label: intl.formatDate(m.date, { month: 'short' }),
      }));
    } else if (horizon === '2years') {
      // Show all months with year indicator
      result = chartData.map(m => ({
        ...m,
        label: intl.formatDate(m.date, { month: 'short', year: '2-digit' }),
      }));
    } else {
      // Group by quarters for 5+ years
      const quarters: { key: string; label: string; total: number; date: Date }[] = [];

      for (let i = 0; i < chartData.length; i += 3) {
        const chunk = chartData.slice(i, i + 3);
        if (chunk.length > 0) {
          const total = chunk.reduce((sum, m) => sum + m.total, 0);
          const firstMonth = chunk[0].date;
          const quarter = Math.floor(firstMonth.getMonth() / 3) + 1;
          quarters.push({
            key: `${firstMonth.getFullYear()}-Q${quarter}`,
            label: `Q${quarter}'${firstMonth.getFullYear().toString().slice(-2)}`,
            total,
            date: firstMonth,
          });
        }
      }

      result = quarters;
    }

    // Mark months where value changed from previous month
    return result.map((item, index) => ({
      ...item,
      hasChange: index > 0 && Math.abs(item.total - result[index - 1].total) > 0.01,
    }));
  }, [chartData, horizon, intl]);

  // Use dynamic scale - start from 80% of min value for better visibility of changes
  const totals = groupedData.map(d => d.total);
  const minValue = Math.min(...totals.filter(t => t > 0), 0);
  const maxValue = Math.max(...totals, 1);
  const hasSignificantVariation = maxValue > 0 && minValue > 0 && (maxValue - minValue) / maxValue < 0.3;
  const scaleMin = hasSignificantVariation ? Math.floor(minValue * 0.8) : 0;
  const scaleRange = maxValue - scaleMin;

  // Period label for stats
  const periodLabel = useMemo(() => {
    switch (horizon) {
      case 'currentYear':
        return `${currentYear}`;
      case 'lastYear':
        return `${currentYear - 1}`;
      case '2years':
        return intl.formatMessage({ id: 'charts.period.last2years', defaultMessage: '2 lata' });
      case '5years':
        return intl.formatMessage({ id: 'charts.period.last5years', defaultMessage: '5 lat' });
      default:
        return '';
    }
  }, [horizon, currentYear, intl]);

  return (
    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 via-white to-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
            <TrendingDown className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-semibold text-rose-900">
              {intl.formatMessage({ id: 'expenses.chart.title', defaultMessage: 'Wydatki w czasie' })}
            </h3>
            <p className="text-xs text-rose-600/70">
              {intl.formatMessage(
                { id: 'expenses.chart.subtitleWithPeriod', defaultMessage: 'Średnio {avg}/mies. ({period})' },
                { avg: formatCurrency(stats.avg), period: periodLabel }
              )}
            </p>
          </div>
        </div>

        {/* Time horizon selector */}
        <div className="flex items-center gap-1 rounded-full bg-rose-100/50 p-1">
          {TIME_HORIZONS.map((h) => (
            <button
              key={h.value}
              onClick={() => setHorizon(h.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                horizon === h.value
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 hover:bg-rose-100'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 w-16 flex flex-col justify-between text-xs text-rose-600/60 pr-2" style={{ height: '200px' }}>
          <span className="text-right">{formatCurrency(maxValue)}</span>
          <span className="text-right">{formatCurrency(scaleMin + scaleRange / 2)}</span>
          <span className="text-right">{scaleMin > 0 ? formatCurrency(scaleMin) : '0'}</span>
        </div>

        {/* Bars */}
        <div className="ml-16 overflow-x-auto">
          <div
            className="flex items-end gap-1"
            style={{ height: '200px', minWidth: horizon === '2years' ? '600px' : 'auto' }}
          >
            {groupedData.map((item, index) => {
              const barHeight = scaleRange > 0 ? ((item.total - scaleMin) / scaleRange) * 200 : 0;
              const isCurrentPeriod = index === groupedData.length - 1;

              return (
                <div
                  key={item.key}
                  className="flex-1 min-w-[24px] max-w-[60px] flex flex-col items-center justify-end group h-full"
                >
                  {/* Tooltip - shift right for first bars to avoid Y-axis overlap */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 transition-opacity mb-1 px-2 py-1 bg-rose-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-10 ${
                      index < 2 ? 'translate-x-2' : ''
                    }`}
                  >
                    {formatCurrency(item.total)}
                    {item.hasChange && (
                      <span className="ml-1 text-amber-300">
                        {item.total > (groupedData[index - 1]?.total || 0) ? '↑' : '↓'}
                      </span>
                    )}
                  </div>

                  {/* Change indicator */}
                  {item.hasChange && (
                    <div className="mb-1 flex items-center justify-center">
                      <span className={`text-xs font-bold ${
                        item.total > (groupedData[index - 1]?.total || 0)
                          ? 'text-rose-600'
                          : 'text-emerald-500'
                      }`}>
                        {item.total > (groupedData[index - 1]?.total || 0) ? '▲' : '▼'}
                      </span>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      item.hasChange
                        ? item.total > (groupedData[index - 1]?.total || 0)
                          ? 'bg-gradient-to-t from-rose-600 to-rose-400 ring-2 ring-rose-400 ring-offset-1'
                          : 'bg-gradient-to-t from-emerald-500 to-emerald-400 ring-2 ring-emerald-400 ring-offset-1'
                        : isCurrentPeriod
                          ? 'bg-gradient-to-t from-rose-500 to-rose-400'
                          : item.total > 0
                            ? 'bg-gradient-to-t from-rose-300 to-rose-200 group-hover:from-rose-400 group-hover:to-rose-300'
                            : 'bg-rose-100'
                    }`}
                    style={{
                      height: `${Math.max(barHeight, item.total > 0 ? 4 : 0)}px`
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* X-axis labels */}
          <div className="flex gap-1 mt-2" style={{ minWidth: horizon === '2years' ? '600px' : 'auto' }}>
            {groupedData.map((item, index) => {
              const isCurrentPeriod = index === groupedData.length - 1;
              return (
                <div key={`label-${item.key}`} className="flex-1 min-w-[24px] max-w-[60px] text-center">
                  <span className={`text-[10px] ${
                    isCurrentPeriod ? 'text-rose-700 font-medium' : 'text-rose-500/70'
                  } ${horizon === '2years' ? 'inline-block rotate-45 origin-left' : ''}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-rose-100 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-rose-700">{formatCurrency(stats.sum)}</p>
          <p className="text-xs text-rose-600/60">
            {intl.formatMessage(
              { id: 'expenses.chart.totalWithPeriod', defaultMessage: 'Suma ({period})' },
              { period: periodLabel }
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(stats.avg)}</p>
          <p className="text-xs text-rose-600/60">
            {intl.formatMessage({ id: 'expenses.chart.average', defaultMessage: 'Średnia/mies.' })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-rose-500">{stats.monthCount}</p>
          <p className="text-xs text-rose-600/60">
            {intl.formatMessage({ id: 'expenses.chart.monthsInPeriod', defaultMessage: 'Miesięcy' })}
          </p>
        </div>
      </div>
    </div>
  );
}
