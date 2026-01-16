'use client';

import React from 'react';
import { useIntl, FormattedMessage, FormattedDate } from 'react-intl';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Car,
  CreditCard,
  GraduationCap,
  Home,
  Landmark,
  Pencil,
  PiggyBank,
  ShoppingCart,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Tooltip from '@/components/Tooltip';

interface Loan {
  id: number | string;
  loan_type: string;
  description: string;
  principal_amount: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  term_months: number;
  created_at: string;
  updated_at?: string | null;
}

interface LoanMetrics {
  principalAmount: number;
  remainingBalance: number;
  amountPaid: number;
  monthlyPayment: number;
  interestRate: number;
  termMonths: number;
  monthsRemaining: number;
  progress: number;
  nextPaymentDate: Date | null;
  paymentCoversInterest: boolean;
}

interface CompactLoanCardProps {
  loan: Loan;
  metrics: LoanMetrics;
  formatCurrency: (amount: number) => string;
  onEdit: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
  onViewSchedule: (loan: Loan) => void;
}

const LOAN_TYPE_META: Record<
  string,
  {
    Icon: LucideIcon;
    toneClass: string;
    accentClass: string;
    borderClass: string;
  }
> = {
  mortgage: {
    Icon: Home,
    toneClass: 'bg-emerald-50 text-emerald-700',
    accentClass: 'text-emerald-600',
    borderClass: 'border-emerald-200',
  },
  car: {
    Icon: Car,
    toneClass: 'bg-sky-50 text-sky-700',
    accentClass: 'text-sky-600',
    borderClass: 'border-sky-200',
  },
  personal: {
    Icon: PiggyBank,
    toneClass: 'bg-amber-50 text-amber-700',
    accentClass: 'text-amber-600',
    borderClass: 'border-amber-200',
  },
  student: {
    Icon: GraduationCap,
    toneClass: 'bg-purple-50 text-purple-700',
    accentClass: 'text-purple-600',
    borderClass: 'border-purple-200',
  },
  credit_card: {
    Icon: CreditCard,
    toneClass: 'bg-rose-50 text-rose-700',
    accentClass: 'text-rose-600',
    borderClass: 'border-rose-200',
  },
  cash_loan: {
    Icon: Banknote,
    toneClass: 'bg-orange-50 text-orange-700',
    accentClass: 'text-orange-600',
    borderClass: 'border-orange-200',
  },
  installment: {
    Icon: ShoppingCart,
    toneClass: 'bg-indigo-50 text-indigo-700',
    accentClass: 'text-indigo-600',
    borderClass: 'border-indigo-200',
  },
  leasing: {
    Icon: Truck,
    toneClass: 'bg-teal-50 text-teal-700',
    accentClass: 'text-teal-600',
    borderClass: 'border-teal-200',
  },
  overdraft: {
    Icon: Wallet,
    toneClass: 'bg-red-50 text-red-700',
    accentClass: 'text-red-600',
    borderClass: 'border-red-200',
  },
  other: {
    Icon: Landmark,
    toneClass: 'bg-slate-50 text-slate-700',
    accentClass: 'text-slate-600',
    borderClass: 'border-slate-200',
  },
};

const DEFAULT_LOAN_META = {
  Icon: CreditCard,
  toneClass: 'bg-slate-50 text-slate-700',
  accentClass: 'text-slate-600',
  borderClass: 'border-slate-200',
};

export default function CompactLoanCard({
  loan,
  metrics,
  formatCurrency,
  onEdit,
  onDelete,
  onViewSchedule,
}: CompactLoanCardProps) {
  const intl = useIntl();
  const meta = LOAN_TYPE_META[loan.loan_type] ?? DEFAULT_LOAN_META;
  const Icon = meta.Icon;
  const progressPercent = Math.round(metrics.progress * 100);

  const interestRateFormatted = intl.formatNumber(
    (loan.interest_rate ?? 0) / 100,
    {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }
  );

  // Credit cards and overdrafts are revolving credit - show utilization instead of payoff progress
  const isRevolvingCredit = loan.loan_type === 'credit_card' || loan.loan_type === 'overdraft';
  const utilizationPercent = isRevolvingCredit && metrics.principalAmount > 0
    ? Math.round((metrics.remainingBalance / metrics.principalAmount) * 100)
    : 0;

  return (
    <div
      className={cn(
        'group rounded-xl border-2 p-4 transition-all hover:shadow-md',
        meta.borderClass,
        meta.toneClass
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
              meta.toneClass
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-primary truncate">
              {loan.description}
            </h3>
            <p className="text-xs text-muted-foreground">
              <FormattedMessage id={`loans.types.${loan.loan_type}`} />
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content={intl.formatMessage({ id: 'common.edit' })}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(loan)}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'common.delete' })}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(loan)}
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Main stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-amber-700">
            {formatCurrency(metrics.remainingBalance)}
          </p>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage id={isRevolvingCredit ? "loans.creditCard.currentDebt" : "loans.summary.remaining"} />
          </p>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-700">
            {formatCurrency(metrics.monthlyPayment)}
          </p>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage id={isRevolvingCredit ? "loans.creditCard.plannedPayment" : "loans.summary.monthlyPayment"} />
          </p>
        </div>
        <div>
          <p className={cn('text-lg font-bold', meta.accentClass)}>
            {interestRateFormatted}
          </p>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage id="loans.summary.interestRate" />
          </p>
        </div>
      </div>

      {/* Progress bar - different display for revolving credit */}
      <div className="mt-3">
        {isRevolvingCredit ? (
          <>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                <FormattedMessage id="loans.creditCard.utilization" />
              </span>
              <span className={cn(
                'font-medium',
                utilizationPercent > 80 ? 'text-destructive' : utilizationPercent > 50 ? 'text-amber-600' : 'text-emerald-600'
              )}>
                {utilizationPercent}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/50">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  utilizationPercent > 80 ? 'bg-destructive' : utilizationPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <FormattedMessage id="loans.creditCard.limit" values={{ limit: formatCurrency(metrics.principalAmount) }} />
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                {progressPercent}% <FormattedMessage id="loans.summary.progressLabel" values={{ percentage: '' }} />
              </span>
              <span className="text-muted-foreground">
                {metrics.monthsRemaining > 0
                  ? intl.formatMessage(
                      { id: 'loans.summary.monthsRemaining' },
                      { months: metrics.monthsRemaining }
                    )
                  : null}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/50">
              <div
                className={cn('h-2 rounded-full transition-all', meta.accentClass.replace('text-', 'bg-'))}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Warning for payment not covering interest */}
      {!metrics.paymentCoversInterest && metrics.interestRate > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-2 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span><FormattedMessage id="loans.warning.paymentTooLow.title" /></span>
        </div>
      )}

      {/* Footer with next payment */}
      {metrics.nextPaymentDate && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <FormattedMessage
            id="loans.summary.nextPayment"
            values={{
              date: intl.formatDate(metrics.nextPaymentDate, { dateStyle: 'medium' }),
            }}
          />
        </div>
      )}
    </div>
  );
}
