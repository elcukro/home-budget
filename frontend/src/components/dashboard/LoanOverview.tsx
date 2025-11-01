'use client';

import { useIntl } from 'react-intl';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface LoanData {
  id: string;
  description: string;
  balance: number;
  monthlyPayment: number;
  interestRate: number;
  progress: number;
  totalAmount: number;
  interestPaidYtd?: number;
  nextPaymentDate?: string;
}

interface LoanOverviewProps {
  loans: LoanData[];
  formatCurrency: (amount: number) => string;
}

const clampProgress = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
};

export default function LoanOverview({ loans, formatCurrency }: LoanOverviewProps) {
  const intl = useIntl();
  const [expandedLoans, setExpandedLoans] = useState<Set<string>>(new Set());

  const totalBalance = loans.reduce((sum, loan) => sum + loan.balance, 0);
  const totalMonthlyPayments = loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
  const totalInterestYtd = loans.reduce((sum, loan) => sum + (loan.interestPaidYtd ?? 0), 0);

  const summaryCards = useMemo(() => {
    const items = [
      {
        id: 'balance',
        label: intl.formatMessage({ id: 'dashboard.loans.totalBalance' }),
        value: formatCurrency(totalBalance),
      },
      {
        id: 'monthly',
        label: intl.formatMessage({ id: 'dashboard.loans.totalMonthlyPayments' }),
        value: formatCurrency(totalMonthlyPayments),
      },
    ];

    if (totalInterestYtd > 0) {
      items.push({
        id: 'interest',
        label: intl.formatMessage({ id: 'dashboard.loans.interestPaidYtd' }),
        value: formatCurrency(totalInterestYtd),
      });
    }

    return items;
  }, [formatCurrency, intl.locale, totalBalance, totalInterestYtd, totalMonthlyPayments]);

  const toggleLoan = (id: string) => {
    setExpandedLoans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="bg-card border border-default p-6 rounded-xl shadow-sm h-full flex flex-col">
      <p className="mb-4 text-sm text-secondary">
        {intl.formatMessage({ id: 'dashboard.loans.subtitle' })}
      </p>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-default bg-muted/60 px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wide text-secondary">
              {card.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 flex-grow">
        {loans.length === 0 ? (
          <p className="text-secondary text-center py-4">
            {intl.formatMessage({ id: 'dashboard.loans.noLoans' })}
          </p>
        ) : (
          <>
            {loans.map((loan) => {
              const progress = clampProgress(loan.progress);
              const progressPercent = Math.round(progress * 100);
              const circumference = 2 * Math.PI * 16;
              const offset = circumference * (1 - progress);
              const isExpanded = expandedLoans.has(loan.id);
              const paidAmount = Math.max(loan.totalAmount - loan.balance, 0);
              const nextPaymentLabel =
                loan.nextPaymentDate && !Number.isNaN(Date.parse(loan.nextPaymentDate))
                  ? intl.formatDate(new Date(loan.nextPaymentDate), { dateStyle: 'medium' })
                  : null;

              return (
                <div
                  key={loan.id}
                  className="rounded-2xl border border-default bg-muted/60 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative h-16 w-16">
                      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          strokeWidth="3"
                          fill="transparent"
                          stroke="currentColor"
                          className="text-secondary/20"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="16"
                          strokeWidth="3"
                          fill="transparent"
                          strokeLinecap="round"
                          strokeDasharray={`${circumference} ${circumference}`}
                          strokeDashoffset={offset}
                          stroke="currentColor"
                          className="text-primary"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-primary">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-primary">
                            {loan.description}
                          </h3>
                          <p className="text-xs text-secondary uppercase tracking-wide">
                            {intl.formatMessage(
                              { id: 'dashboard.loans.interestRate' },
                              { rate: loan.interestRate.toFixed(2) },
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleLoan(loan.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-default bg-card text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? intl.formatMessage({ id: 'dashboard.loans.collapseDetails' })
                              : intl.formatMessage({ id: 'dashboard.loans.expandDetails' })
                          }
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-xs font-medium text-secondary">
                          {intl.formatMessage(
                            { id: 'dashboard.loans.monthlyPayment' },
                            { amount: formatCurrency(loan.monthlyPayment) },
                          )}
                        </span>
                        <span className="text-primary font-semibold">
                          {formatCurrency(loan.balance)}
                        </span>
                        <span className="text-xs text-secondary">
                          {intl.formatMessage(
                            { id: 'dashboard.loans.totalOriginal' },
                            { amount: formatCurrency(loan.totalAmount) },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-secondary mb-1">
                      <span>
                        {intl.formatMessage(
                          { id: 'dashboard.loans.progress' },
                          { percentage: progressPercent },
                        )}
                      </span>
                      <span>
                        {intl.formatMessage(
                          { id: 'dashboard.loans.remainingBalance' },
                          { amount: formatCurrency(loan.balance) },
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-card">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-default pt-3 text-sm text-secondary">
                      <div className="flex items-center justify-between">
                        <span>{intl.formatMessage({ id: 'dashboard.loans.paidSoFar' })}</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(paidAmount)}
                        </span>
                      </div>
                      {loan.interestPaidYtd !== undefined && (
                        <div className="flex items-center justify-between">
                          <span>{intl.formatMessage({ id: 'dashboard.loans.interestPaidYtd' })}</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(loan.interestPaidYtd)}
                          </span>
                        </div>
                      )}
                      {nextPaymentLabel && (
                        <div className="flex items-center justify-between">
                          <span>{intl.formatMessage({ id: 'dashboard.loans.nextPayment' })}</span>
                          <span className="font-semibold text-primary">{nextPaymentLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-4 rounded-2xl border border-dashed border-default px-4 py-3 text-xs text-secondary">
              {intl.formatMessage({ id: 'dashboard.loans.hint' })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
