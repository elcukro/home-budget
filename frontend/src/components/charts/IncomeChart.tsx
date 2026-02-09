'use client';

import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { TrendingUp } from 'lucide-react';

interface Income {
  id: number | string;
  category: string;
  description: string;
  amount: number;
  date: string;
  end_date: string | null;
  is_recurring: boolean;
}

interface IncomeChartProps {
  incomes: Income[];
  selectedMonth?: string;
  onMonthSelect?: (monthKey: string) => void;
  compact?: boolean;
}

type TimeHorizon = 'currentYear' | 'lastYear' | '2years' | '5years';
type TimeState = 'past' | 'current' | 'predicted';

export default function IncomeChart({ incomes, selectedMonth, onMonthSelect, compact = false }: IncomeChartProps) {
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
        endMonth = 11; // Full year through December
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
        endMonth = 11; // Full current year
        break;
      case '5years':
        startYear = currentYear - 4;
        startMonth = 0;
        endYear = currentYear;
        endMonth = 11; // Full current year
        break;
      default:
        startYear = currentYear;
        startMonth = 0;
        endYear = currentYear;
        endMonth = 11;
    }

    // Generate array of months for the selected range
    const months: { key: string; date: Date; total: number; timeState: TimeState }[] = [];

    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const date = new Date(year, month, 1);
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      // Determine time state relative to current month
      let timeState: TimeState;
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        timeState = 'past';
      } else if (year === currentYear && month === currentMonth) {
        timeState = 'current';
      } else {
        timeState = 'predicted';
      }

      months.push({ key, date, total: 0, timeState });

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
    incomes.forEach((income) => {
      const startParsed = parseYearMonth(income.date);
      if (!startParsed) return;

      const endParsed = income.end_date ? parseYearMonth(income.end_date) : null;

      months.forEach((monthData) => {
        const chartYear = monthData.date.getFullYear();
        const chartMonth = monthData.date.getMonth();

        if (income.is_recurring) {
          // Recurring: add to all months from start to end
          const afterStart = chartYear > startParsed.year ||
            (chartYear === startParsed.year && chartMonth >= startParsed.month);
          const beforeEnd = !endParsed ||
            chartYear < endParsed.year ||
            (chartYear === endParsed.year && chartMonth <= endParsed.month);

          if (afterStart && beforeEnd) {
            monthData.total += income.amount;
          }
        } else {
          // One-off: add only to the specific month
          if (chartYear === startParsed.year && chartMonth === startParsed.month) {
            monthData.total += income.amount;
          }
        }
      });
    });

    return months;
  }, [incomes, horizon, currentYear, currentMonth]);

  const hasPredictedMonths = chartData.some(m => m.timeState === 'predicted');

  // Calculate stats (only for past + current months)
  const stats = useMemo(() => {
    const actualMonths = chartData.filter(m => m.timeState !== 'predicted');
    const totals = actualMonths.map(m => m.total);
    const sum = totals.reduce((a, b) => a + b, 0);
    const avg = totals.length > 0 ? sum / totals.length : 0;
    const max = Math.max(...totals, 0);
    const nonZeroMonths = totals.filter(t => t > 0).length;

    return { sum, avg, max, nonZeroMonths, monthCount: totals.length };
  }, [chartData]);

  // Determine bar grouping based on horizon
  const groupedData = useMemo(() => {
    let result: { key: string; label: string; total: number; date: Date; timeState: TimeState; hasChange?: boolean }[];

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
      const quarters: { key: string; label: string; total: number; date: Date; timeState: TimeState }[] = [];

      for (let i = 0; i < chartData.length; i += 3) {
        const chunk = chartData.slice(i, i + 3);
        if (chunk.length > 0) {
          const total = chunk.reduce((sum, m) => sum + m.total, 0);
          const firstMonth = chunk[0].date;
          const quarter = Math.floor(firstMonth.getMonth() / 3) + 1;
          const quarterTimeState: TimeState = chunk.every(m => m.timeState === 'predicted')
            ? 'predicted'
            : chunk.some(m => m.timeState === 'current')
              ? 'current'
              : 'past';
          quarters.push({
            key: `${firstMonth.getFullYear()}-Q${quarter}`,
            label: `Q${quarter}'${firstMonth.getFullYear().toString().slice(-2)}`,
            total,
            date: firstMonth,
            timeState: quarterTimeState,
          });
        }
      }

      result = quarters;
    }

    // Mark months where value changed from previous month
    return result.map((item, index) => ({
      ...item,
      hasChange: index > 0 && item.timeState !== 'predicted' && Math.abs(item.total - result[index - 1].total) > 0.01,
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

  const barAreaHeight = compact ? 160 : 200;
  const barContainerHeight = barAreaHeight + 28;

  return (
    <div className={`rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 via-white to-white shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-4 ${compact ? 'mb-3' : 'mb-6'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center rounded-full bg-emerald-100 ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}>
            <TrendingUp className={compact ? 'h-4 w-4 text-emerald-600' : 'h-5 w-5 text-emerald-600'} />
          </div>
          <div>
            <h3 className={`font-semibold text-emerald-900 ${compact ? 'text-sm' : ''}`}>
              {intl.formatMessage({ id: 'income.chart.title', defaultMessage: 'Przychody w czasie' })}
            </h3>
            <p className={`text-emerald-600/70 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {intl.formatMessage(
                { id: 'income.chart.subtitleWithPeriod', defaultMessage: 'Średnio {avg}/mies. ({period})' },
                { avg: formatCurrency(stats.avg), period: periodLabel }
              )}
            </p>
          </div>
        </div>

        {/* Time horizon selector */}
        <div className="flex items-center gap-1 rounded-full bg-emerald-100/50 p-1">
          {TIME_HORIZONS.map((h) => (
            <button
              key={h.value}
              onClick={() => setHorizon(h.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                horizon === h.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 hover:bg-emerald-100'
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
        <div className={`absolute left-0 top-0 w-16 flex flex-col justify-between pr-2 ${compact ? 'text-[10px]' : 'text-xs'} text-emerald-600/60`} style={{ height: `${barAreaHeight}px` }}>
          <span className="text-right">{formatCurrency(maxValue)}</span>
          <span className="text-right">{formatCurrency(scaleMin + scaleRange / 2)}</span>
          <span className="text-right">{scaleMin > 0 ? formatCurrency(scaleMin) : '0'}</span>
        </div>

        {/* Bars */}
        <div className="ml-16 min-w-0" style={{ overflowX: 'clip', overflowY: 'visible' }}>
          <div
            className="flex items-end gap-1 pt-8"
            style={{ height: `${barContainerHeight}px` }}
          >
            {groupedData.map((item, index) => {
              const barHeight = scaleRange > 0 ? ((item.total - scaleMin) / scaleRange) * barAreaHeight : 0;
              const isPredicted = item.timeState === 'predicted';
              const isSelected = selectedMonth != null && selectedMonth !== 'all' && item.key === selectedMonth;

              // Bar style based on time state
              const getBarClasses = () => {
                if (item.hasChange) {
                  return item.total > (groupedData[index - 1]?.total || 0)
                    ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 ring-2 ring-emerald-400 ring-offset-1'
                    : 'bg-gradient-to-t from-rose-500 to-rose-400 ring-2 ring-rose-400 ring-offset-1';
                }
                switch (item.timeState) {
                  case 'current':
                    return 'bg-gradient-to-t from-emerald-500 to-emerald-400';
                  case 'predicted':
                    return item.total > 0
                      ? 'bg-gradient-to-t from-emerald-200/60 to-emerald-100/60 border border-dashed border-emerald-300 group-hover:from-emerald-200 group-hover:to-emerald-100'
                      : 'bg-emerald-50 border border-dashed border-emerald-200';
                  case 'past':
                  default:
                    return item.total > 0
                      ? 'bg-gradient-to-t from-emerald-300 to-emerald-200 group-hover:from-emerald-400 group-hover:to-emerald-300'
                      : 'bg-emerald-100';
                }
              };

              return (
                <div
                  key={item.key}
                  className={`relative flex-1 min-w-0 flex flex-col items-center justify-end group h-full ${onMonthSelect ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!onMonthSelect) return;
                    if (item.key.includes('-Q')) {
                      const year = parseInt(item.key.split('-Q')[0], 10);
                      if (year === currentYear) {
                        setHorizon('currentYear');
                      } else if (year === currentYear - 1) {
                        setHorizon('lastYear');
                      } else {
                        setHorizon('2years');
                      }
                      return;
                    }
                    if (isSelected) {
                      onMonthSelect('all');
                    } else {
                      onMonthSelect(item.key);
                    }
                  }}
                >
                  {/* Tooltip */}
                  <div
                    className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-white text-xs rounded shadow-lg whitespace-nowrap z-10 ${
                      isPredicted ? 'bg-gray-600' : 'bg-emerald-800'
                    }`}
                  >
                    {formatCurrency(item.total)}
                    {isPredicted && (
                      <span className="ml-1 text-gray-300">
                        {intl.formatMessage({ id: 'income.chart.predicted', defaultMessage: 'prognoza' })}
                      </span>
                    )}
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
                          ? 'text-emerald-600'
                          : 'text-rose-500'
                      }`}>
                        {item.total > (groupedData[index - 1]?.total || 0) ? '▲' : '▼'}
                      </span>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${getBarClasses()} ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                    style={{
                      height: `${Math.max(barHeight, item.total > 0 ? 4 : 0)}px`
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* X-axis labels */}
          <div className="flex gap-1 mt-2">
            {groupedData.map((item) => {
              const isCurrent = item.timeState === 'current';
              const isPredicted = item.timeState === 'predicted';
              const isLabelSelected = selectedMonth != null && selectedMonth !== 'all' && item.key === selectedMonth;
              return (
                <div key={`label-${item.key}`} className="flex-1 min-w-0 text-center flex flex-col items-center">
                  {isLabelSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mb-0.5" />
                  )}
                  <span className={`text-[10px] ${
                    isLabelSelected
                      ? 'text-emerald-700 font-bold'
                      : isCurrent
                        ? 'text-emerald-700 font-medium'
                        : isPredicted
                          ? 'text-gray-400'
                          : 'text-emerald-500/70'
                  } ${horizon === '2years' ? 'inline-block rotate-45 origin-left' : ''}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Predicted months legend */}
      {hasPredictedMonths && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
          <div className="w-3 h-3 rounded-sm border border-dashed border-emerald-300 bg-emerald-100/60" />
          <span>
            {intl.formatMessage({
              id: 'income.chart.predictedNote',
              defaultMessage: 'Prognoza na podstawie aktywnych przychodów cyklicznych',
            })}
          </span>
        </div>
      )}

      {/* Summary stats */}
      <div className={`border-t border-emerald-100 grid grid-cols-2 gap-4 ${compact ? 'mt-3 pt-3' : 'mt-6 pt-4'}`}>
        <div className="text-center">
          <p className={`font-bold text-emerald-700 ${compact ? 'text-base' : 'text-2xl'}`}>{formatCurrency(stats.avg)}</p>
          <p className={`text-emerald-600/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {intl.formatMessage({ id: 'income.chart.average', defaultMessage: 'Średnia/mies.' })}
          </p>
        </div>
        <div className="text-center">
          <p className={`font-bold text-emerald-600 ${compact ? 'text-base' : 'text-2xl'}`}>{formatCurrency(stats.sum)}</p>
          <p className={`text-emerald-600/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {intl.formatMessage(
              { id: 'income.chart.totalWithPeriod', defaultMessage: 'Suma ({period})' },
              { period: periodLabel }
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
