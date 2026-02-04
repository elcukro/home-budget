'use client';

import { useIntl } from 'react-intl';
import { useMemo } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus, AlertTriangle } from 'lucide-react';
import { TAX_LIMITS_2026 } from '@/lib/tax-limits-2026';

interface MonthlySummaryProps {
  data: {
    totalIncome: number;
    totalExpenses: number;
    totalLoanPayments: number;
    netCashflow: number;
    savingsRate: number;
    debtToIncome: number;
  };
  deltas: {
    income: number;
    expenses: number;
    loanPayments: number;
    netCashflow: number;
    savingsRate: number;
    debtToIncome: number;
  };
  referenceLabel?: string;
  formatCurrency: (amount: number) => string;
}

const MonthlySummary: React.FC<MonthlySummaryProps> = ({ data, deltas, referenceLabel, formatCurrency }) => {
  const intl = useIntl();
  const safeDeltas = deltas || {
    income: 0,
    expenses: 0,
    loanPayments: 0,
    netCashflow: 0,
    savingsRate: 0,
    debtToIncome: 0,
  };
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(intl.locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [intl.locale],
  );

  const renderDelta = (
    delta: number,
    formatter: (value: number) => string,
    trend: 'positive' | 'negative' | 'neutral',
    tooltip?: string,
  ) => {
    const neutralBadge = (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/40 bg-muted px-2 py-1 text-[11px] font-medium text-secondary"
        title={tooltip}
      >
        <Minus className="h-3 w-3" aria-hidden="true" />
        {formatter(0)}
      </span>
    );

    if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6) {
      return neutralBadge;
    }

    const isPositive = delta > 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const visualIsPositive = trend === 'positive' ? isPositive : trend === 'negative' ? !isPositive : false;

    const badgeClasses = visualIsPositive
      ? 'border-success/40 bg-success/15 text-success'
      : 'border-destructive/40 bg-destructive/10 text-destructive';

    const absoluteValue = formatter(Math.abs(delta));

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${badgeClasses}`}
        title={tooltip}
        aria-label={tooltip}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {absoluteValue}
      </span>
    );
  };

  const periodDisplay =
    referenceLabel ?? intl.formatMessage({ id: 'dashboard.summary.previousPeriodFallback' });

  const insightFor = (
    key: string,
    delta: number,
    formatter: (value: number) => string,
  ) => {
    if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6) {
      return intl.formatMessage({ id: `dashboard.summary.insights.${key}.steady` }, { period: periodDisplay });
    }

    const directionId = delta > 0 ? 'up' : 'down';
    return intl.formatMessage(
      { id: `dashboard.summary.insights.${key}.${directionId}` },
      {
        amount: formatter(Math.abs(delta)),
        period: periodDisplay,
      },
    );
  };

  const metrics = [
    {
      key: 'income',
      label: intl.formatMessage({ id: 'dashboard.summary.totalIncome' }),
      value: formatCurrency(data?.totalIncome ?? 0),
      delta: safeDeltas.income,
      formatter: formatCurrency,
      trend: 'positive' as const,
      color: 'text-success',
      bgColor: 'bg-success/10 hover:bg-success/20 transition-colors',
      subLabel: intl.formatMessage(
        { id: 'dashboard.summary.labels.incomeSub' },
        { period: periodDisplay },
      ),
      tooltip: [
        intl.formatMessage({ id: 'dashboard.summary.tooltips.income' }),
        insightFor('income', safeDeltas.income, formatCurrency),
      ].join(' • '),
    },
    {
      key: 'expenses',
      label: intl.formatMessage({ id: 'dashboard.summary.totalExpenses' }),
      value: formatCurrency(data?.totalExpenses ?? 0),
      delta: safeDeltas.expenses,
      formatter: formatCurrency,
      trend: 'negative' as const,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10 hover:bg-destructive/15 transition-colors',
      subLabel: intl.formatMessage(
        { id: 'dashboard.summary.labels.expensesSub' },
        { period: periodDisplay },
      ),
      tooltip: [
        intl.formatMessage({ id: 'dashboard.summary.tooltips.expenses' }),
        insightFor('expenses', safeDeltas.expenses, formatCurrency),
      ].join(' • '),
    },
    {
      key: 'loanPayments',
      label: intl.formatMessage({ id: 'dashboard.summary.loanPayments' }),
      value: formatCurrency(data?.totalLoanPayments ?? 0),
      delta: safeDeltas.loanPayments,
      formatter: formatCurrency,
      trend: 'negative' as const,
      color: 'text-primary',
      bgColor: 'bg-primary/10 hover:bg-primary/15 transition-colors',
      subLabel: intl.formatMessage(
        { id: 'dashboard.summary.labels.loanSub' },
        { period: periodDisplay },
      ),
      tooltip: [
        intl.formatMessage({ id: 'dashboard.summary.tooltips.loanPayments' }),
        insightFor('loanPayments', safeDeltas.loanPayments, formatCurrency),
      ].join(' • '),
    },
    {
      key: 'netCashflow',
      label: intl.formatMessage({ id: 'dashboard.summary.netCashflow' }),
      value: formatCurrency(data?.netCashflow ?? 0),
      delta: safeDeltas.netCashflow,
      formatter: formatCurrency,
      trend: 'positive' as const,
      color: (data?.netCashflow ?? 0) >= 0 ? 'text-success' : 'text-destructive',
      bgColor: (data?.netCashflow ?? 0) >= 0 ? 'bg-success/10 hover:bg-success/20 transition-colors' : 'bg-destructive/10 hover:bg-destructive/15 transition-colors',
      subLabel: intl.formatMessage(
        { id: 'dashboard.summary.labels.netCashflowSub' },
        { period: periodDisplay },
      ),
      tooltip: [
        intl.formatMessage({ id: 'dashboard.summary.tooltips.netCashflow' }),
        insightFor('netCashflow', safeDeltas.netCashflow, formatCurrency),
      ].join(' • '),
    },
    {
      key: 'savingsRate',
      label: intl.formatMessage({ id: 'dashboard.summary.savingsRate' }),
      value: percentFormatter.format(data?.savingsRate ?? 0),
      delta: safeDeltas.savingsRate,
      formatter: (value: number) => percentFormatter.format(value),
      trend: 'positive' as const,
      color: 'text-mint',
      bgColor: 'bg-mint/20 hover:bg-mint/30 transition-colors',
      subLabel: intl.formatMessage({ id: 'dashboard.summary.targets.savingsRate' }),
      tooltip: [
        intl.formatMessage({ id: 'dashboard.summary.tooltips.savingsRate' }),
        insightFor('savingsRate', safeDeltas.savingsRate, (value: number) => percentFormatter.format(value)),
      ].join(' • '),
    },
    {
      key: 'debtToIncome',
      label: intl.formatMessage({ id: 'dashboard.summary.debtToIncome' }),
      value: percentFormatter.format(data?.debtToIncome ?? 0),
      delta: safeDeltas.debtToIncome,
      formatter: (value: number) => percentFormatter.format(value),
      trend: 'negative' as const,
      color: (data?.debtToIncome ?? 0) > TAX_LIMITS_2026.RECOMMENDED_DTI_WARNING ? 'text-destructive' : 'text-warning',
      bgColor: (data?.debtToIncome ?? 0) > TAX_LIMITS_2026.RECOMMENDED_DTI_WARNING
        ? 'bg-destructive/15 hover:bg-destructive/20 transition-colors'
        : 'bg-warning/20 hover:bg-warning/30 transition-colors',
      subLabel: (data?.debtToIncome ?? 0) > TAX_LIMITS_2026.RECOMMENDED_DTI_WARNING
        ? intl.formatMessage({ id: 'dashboard.summary.dtiWarning' })
        : intl.formatMessage({ id: 'dashboard.summary.targets.debtToIncome' }),
      tooltip: [
        intl.formatMessage({ id: 'dashboard.summary.tooltips.debtToIncome' }),
        insightFor('debtToIncome', safeDeltas.debtToIncome, (value: number) => percentFormatter.format(value)),
      ].join(' • '),
      warning: (data?.debtToIncome ?? 0) > TAX_LIMITS_2026.RECOMMENDED_DTI_WARNING,
    },
  ];

  return (
    <div className="bg-card/90 backdrop-blur border border-default/80 rounded-2xl shadow-lg p-6 transition-shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-primary">
          {intl.formatMessage({ id: 'dashboard.summary.title' })}
        </h2>
        <Link
          href="/ai-analysis"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors duration-200"
        >
          <SparklesIcon className="h-4 w-4" />
          {intl.formatMessage({ id: 'dashboard.summary.aiInsights.button' })}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className={`rounded-xl border border-default bg-card shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 p-4 ${metric.bgColor} ${'warning' in metric && metric.warning ? 'border-destructive/50' : ''}`}
            title={metric.tooltip}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-secondary flex items-center gap-1">
                  {metric.label}
                  {'warning' in metric && metric.warning && (
                    <AlertTriangle className="w-3 h-3 text-destructive" />
                  )}
                </p>
                <p className={`text-xl font-semibold tabular-nums ${metric.color}`}>
                  {metric.value}
                </p>
                <p className={`text-xs ${'warning' in metric && metric.warning ? 'text-destructive font-medium' : 'text-secondary'}`}>
                  {metric.subLabel}
                </p>
              </div>
              {renderDelta(metric.delta, metric.formatter, metric.trend, metric.tooltip)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlySummary; 
