'use client';

import { useIntl } from 'react-intl';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface HeroCardsProps {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  deltas: {
    income: number;
    expenses: number;
    netCashflow: number;
  };
  formatCurrency: (amount: number) => string;
}

function DeltaBadge({ delta, formatter, trend }: {
  delta: number;
  formatter: (v: number) => string;
  trend: 'positive' | 'negative';
}) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium text-gray-500">
        <Minus className="h-3 w-3" />
        {formatter(0)}
      </span>
    );
  }

  const isPositive = delta > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const visualIsGood = trend === 'positive' ? isPositive : !isPositive;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      visualIsGood
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700'
    }`}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{formatter(delta)}
    </span>
  );
}

const HeroCards: React.FC<HeroCardsProps> = ({
  totalIncome,
  totalExpenses,
  netCashflow,
  deltas,
  formatCurrency,
}) => {
  const intl = useIntl();

  const cards = [
    {
      key: 'expenses',
      label: intl.formatMessage({ id: 'dashboard.hero.expenses' }),
      value: totalExpenses,
      delta: deltas.expenses,
      trend: 'negative' as const,
      gradient: 'from-orange-50 to-orange-100/50',
      border: 'border-orange-200',
      valueColor: 'text-orange-700',
      labelColor: 'text-orange-600',
    },
    {
      key: 'income',
      label: intl.formatMessage({ id: 'dashboard.hero.netIncome' }),
      value: totalIncome,
      delta: deltas.income,
      trend: 'positive' as const,
      gradient: 'from-emerald-50 to-emerald-100/50',
      border: 'border-emerald-200',
      valueColor: 'text-emerald-700',
      labelColor: 'text-emerald-600',
    },
    {
      key: 'balance',
      label: intl.formatMessage({ id: 'dashboard.hero.balance' }),
      value: netCashflow,
      delta: deltas.netCashflow,
      trend: 'positive' as const,
      gradient: netCashflow >= 0
        ? 'from-sky-50 to-sky-100/50'
        : 'from-red-50 to-red-100/50',
      border: netCashflow >= 0 ? 'border-sky-200' : 'border-red-200',
      valueColor: netCashflow >= 0 ? 'text-sky-700' : 'text-red-700',
      labelColor: netCashflow >= 0 ? 'text-sky-600' : 'text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`relative overflow-hidden rounded-2xl border ${card.border} bg-gradient-to-br ${card.gradient} p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className={`text-xs font-medium uppercase tracking-wide ${card.labelColor}`}>
                {card.label}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${card.valueColor}`}>
                {formatCurrency(card.value)}
              </p>
            </div>
            <DeltaBadge
              delta={card.delta}
              formatter={formatCurrency}
              trend={card.trend}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default HeroCards;
