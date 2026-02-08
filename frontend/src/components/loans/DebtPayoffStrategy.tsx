'use client';

import { useState, useMemo } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { Snowflake, TrendingDown, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { CurrencyInput } from '@/components/ui/currency-input';

interface Loan {
  id: number | string;
  loan_type: string;
  description: string;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
}

interface DebtPayoffStrategyProps {
  loans: Loan[];
  extraPayment?: number;
}

interface PayoffResult {
  order: Loan[];
  totalInterest: number;
  monthsToPayoff: number;
  payoffSchedule: {
    loan: Loan;
    payoffMonth: number;
    interestPaid: number;
  }[];
}

/**
 * Oblicza plan spłaty dla danej strategii
 */
function calculatePayoff(
  loans: Loan[],
  orderedLoans: Loan[],
  extraPayment: number
): PayoffResult {
  // Clone loans to track balances
  const balances = new Map<string | number, number>();
  orderedLoans.forEach(loan => balances.set(loan.id, loan.remaining_balance));

  let totalInterest = 0;
  let month = 0;
  const payoffSchedule: PayoffResult['payoffSchedule'] = [];
  const maxMonths = 360; // 30 years max

  // Total minimum payments
  const _totalMinPayment = loans.reduce((sum, loan) => sum + loan.monthly_payment, 0);

  // Available extra each month starts with provided extra
  let availableExtra = extraPayment;

  while (orderedLoans.some(loan => (balances.get(loan.id) || 0) > 0) && month < maxMonths) {
    month++;
    let extraThisMonth = availableExtra;

    for (const loan of orderedLoans) {
      const balance = balances.get(loan.id) || 0;
      if (balance <= 0) continue;

      // Calculate interest for this month
      const monthlyInterestRate = loan.interest_rate / 100 / 12;
      const interestThisMonth = balance * monthlyInterestRate;
      totalInterest += interestThisMonth;

      // Calculate payment (minimum + any extra for first unpaid loan)
      let payment = loan.monthly_payment;

      // First loan in order gets extra payment
      const isFirstUnpaid = orderedLoans.find(l => (balances.get(l.id) || 0) > 0)?.id === loan.id;
      if (isFirstUnpaid) {
        payment += extraThisMonth;
        extraThisMonth = 0;
      }

      // Apply payment
      const newBalance = Math.max(0, balance + interestThisMonth - payment);
      balances.set(loan.id, newBalance);

      // Check if loan is paid off
      if (newBalance <= 0 && balance > 0) {
        payoffSchedule.push({
          loan,
          payoffMonth: month,
          interestPaid: totalInterest,
        });
        // Add this loan's minimum payment to extra for next loans
        availableExtra += loan.monthly_payment;
      }
    }
  }

  return {
    order: orderedLoans,
    totalInterest: Math.round(totalInterest),
    monthsToPayoff: month,
    payoffSchedule,
  };
}

export default function DebtPayoffStrategy({ loans, extraPayment = 0 }: DebtPayoffStrategyProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const [selectedStrategy, setSelectedStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [customExtra, setCustomExtra] = useState<number>(extraPayment);

  // Filter out mortgages - focus on consumer debt
  const consumerLoans = useMemo(() =>
    loans.filter(loan => loan.loan_type !== 'mortgage' && loan.remaining_balance > 0),
    [loans]
  );

  // Snowball: sorted by balance (smallest first)
  const snowballOrder = useMemo(() =>
    [...consumerLoans].sort((a, b) => a.remaining_balance - b.remaining_balance),
    [consumerLoans]
  );

  // Avalanche: sorted by interest rate (highest first)
  const avalancheOrder = useMemo(() =>
    [...consumerLoans].sort((a, b) => b.interest_rate - a.interest_rate),
    [consumerLoans]
  );

  // Calculate results for both strategies
  const snowballResult = useMemo(() =>
    calculatePayoff(consumerLoans, snowballOrder, customExtra),
    [consumerLoans, snowballOrder, customExtra]
  );

  const avalancheResult = useMemo(() =>
    calculatePayoff(consumerLoans, avalancheOrder, customExtra),
    [consumerLoans, avalancheOrder, customExtra]
  );

  // Calculate savings
  const interestSavings = snowballResult.totalInterest - avalancheResult.totalInterest;
  const _timeSavings = snowballResult.monthsToPayoff - avalancheResult.monthsToPayoff;

  if (consumerLoans.length === 0) {
    return null;
  }

  const formatMonths = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) {
      return intl.formatMessage(
        { id: 'loans.strategy.time.months', defaultMessage: '{count} mo.' },
        { count: remainingMonths }
      );
    }
    if (remainingMonths === 0) {
      return intl.formatMessage(
        { id: 'loans.strategy.time.years', defaultMessage: '{count} {count, plural, one {year} other {years}}' },
        { count: years }
      );
    }
    return intl.formatMessage(
      { id: 'loans.strategy.time.yearsAndMonths', defaultMessage: '{years} {years, plural, one {year} other {years}} {months} mo.' },
      { years, months: remainingMonths }
    );
  };

  const selectedResult = selectedStrategy === 'snowball' ? snowballResult : avalancheResult;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            {intl.formatMessage({ id: 'loans.strategy.title', defaultMessage: 'Strategia spłaty długów' })}
          </h3>
          <p className="text-sm text-secondary mt-1">
            {intl.formatMessage({
              id: 'loans.strategy.subtitle',
              defaultMessage: 'Wybierz metodę i zobacz, ile możesz zaoszczędzić'
            })}
          </p>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Snowball Card */}
        <button
          onClick={() => setSelectedStrategy('snowball')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            selectedStrategy === 'snowball'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStrategy === 'snowball' ? 'bg-primary/20' : 'bg-muted'
            }`}>
              <Snowflake className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-primary">
                {intl.formatMessage({ id: 'loans.strategy.snowball.title', defaultMessage: 'Kula Śnieżna' })}
              </h4>
              <p className="text-xs text-secondary">
                {intl.formatMessage({ id: 'loans.strategy.snowball.desc', defaultMessage: 'Najmniejszy dług najpierw' })}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">
                {intl.formatMessage({ id: 'loans.strategy.totalInterest', defaultMessage: 'Total interest:' })}
              </span>
              <span className="font-medium text-primary">{formatCurrency(snowballResult.totalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">
                {intl.formatMessage({ id: 'loans.strategy.payoffTime', defaultMessage: 'Payoff time:' })}
              </span>
              <span className="font-medium text-primary">{formatMonths(snowballResult.monthsToPayoff)}</span>
            </div>
          </div>
          {selectedStrategy === 'snowball' && (
            <div className="mt-3 flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="w-4 h-4" />
              {intl.formatMessage({ id: 'loans.strategy.selected', defaultMessage: 'Selected strategy' })}
            </div>
          )}
        </button>

        {/* Avalanche Card */}
        <button
          onClick={() => setSelectedStrategy('avalanche')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            selectedStrategy === 'avalanche'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selectedStrategy === 'avalanche' ? 'bg-primary/20' : 'bg-muted'
            }`}>
              <TrendingDown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-primary">
                {intl.formatMessage({ id: 'loans.strategy.avalanche.title', defaultMessage: 'Lawina' })}
              </h4>
              <p className="text-xs text-secondary">
                {intl.formatMessage({ id: 'loans.strategy.avalanche.desc', defaultMessage: 'Najwyższe oprocentowanie najpierw' })}
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">
                {intl.formatMessage({ id: 'loans.strategy.totalInterest', defaultMessage: 'Total interest:' })}
              </span>
              <span className="font-medium text-primary">{formatCurrency(avalancheResult.totalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">
                {intl.formatMessage({ id: 'loans.strategy.payoffTime', defaultMessage: 'Payoff time:' })}
              </span>
              <span className="font-medium text-primary">{formatMonths(avalancheResult.monthsToPayoff)}</span>
            </div>
          </div>
          {selectedStrategy === 'avalanche' && (
            <div className="mt-3 flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="w-4 h-4" />
              {intl.formatMessage({ id: 'loans.strategy.selected', defaultMessage: 'Selected strategy' })}
            </div>
          )}
        </button>
      </div>

      {/* Savings comparison */}
      {interestSavings !== 0 && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-success">
                {interestSavings > 0
                  ? intl.formatMessage(
                      { id: 'loans.strategy.avalancheSavings', defaultMessage: 'Avalanche method will save you {amount} in interest!' },
                      { amount: formatCurrency(interestSavings) }
                    )
                  : intl.formatMessage(
                      { id: 'loans.strategy.snowballSavings', defaultMessage: 'Snowball method will save you {amount} in interest!' },
                      { amount: formatCurrency(Math.abs(interestSavings)) }
                    )
                }
              </p>
              <p className="text-secondary mt-1">
                {intl.formatMessage({
                  id: 'loans.strategy.comparisonNote',
                  defaultMessage: 'Avalanche is mathematically optimal, but Snowball provides quicker "small wins" - choose what motivates you more.'
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Extra payment input */}
      <div className="bg-muted/30 rounded-xl p-4">
        <label className="block text-sm font-medium text-primary mb-2">
          {intl.formatMessage({ id: 'loans.strategy.extraPayment', defaultMessage: 'Dodatkowa miesięczna nadpłata:' })}
        </label>
        <div className="flex items-center gap-3">
          <CurrencyInput
            value={customExtra}
            onValueChange={(val) => setCustomExtra(Math.max(0, val))}
            className="w-32 px-3 py-2 bg-background border border-border rounded-lg text-primary text-right"
          />
          {customExtra > 0 && (
            <span className="text-xs text-success">
              {intl.formatMessage(
                { id: 'loans.strategy.speedsUpBy', defaultMessage: 'Speeds up payoff by {time}' },
                { time: formatMonths(Math.max(0,
                  (customExtra === 0 ? snowballResult.monthsToPayoff : calculatePayoff(consumerLoans, selectedResult.order, 0).monthsToPayoff) -
                  selectedResult.monthsToPayoff
                ))}
              )}
            </span>
          )}
        </div>
      </div>

      {/* Payoff Order */}
      <div>
        <h4 className="text-sm font-medium text-primary mb-3">
          {intl.formatMessage({ id: 'loans.strategy.order', defaultMessage: 'Kolejność spłaty:' })}
        </h4>
        <div className="space-y-2">
          {selectedResult.order.map((loan, index) => (
            <div
              key={loan.id}
              className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg"
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-primary">{loan.description}</p>
                <p className="text-xs text-secondary">
                  {formatCurrency(loan.remaining_balance)} • {intl.formatMessage(
                    { id: 'loans.strategy.annualRate', defaultMessage: '{rate}% annually' },
                    { rate: loan.interest_rate }
                  )}
                </p>
              </div>
              {selectedResult.payoffSchedule.find(s => s.loan.id === loan.id) && (
                <div className="text-xs text-success">
                  {intl.formatMessage(
                    { id: 'loans.strategy.paidOffIn', defaultMessage: 'Paid off in {time}' },
                    { time: formatMonths(
                      selectedResult.payoffSchedule.find(s => s.loan.id === loan.id)!.payoffMonth
                    )}
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Link to Baby Step 2 */}
      <div className="flex items-center gap-2 text-sm text-secondary pt-2 border-t border-border">
        <ArrowRight className="w-4 h-4" />
        <span>
          <FormattedMessage
            id="loans.strategy.babyStepsLink"
            defaultMessage="This strategy is part of {step} - pay off all debts (except mortgage)"
            values={{
              step: <span className="font-medium text-primary"><FormattedMessage id="loans.strategy.babyStep2" defaultMessage="Baby Step 2" /></span>
            }}
          />
        </span>
      </div>
    </div>
  );
}
