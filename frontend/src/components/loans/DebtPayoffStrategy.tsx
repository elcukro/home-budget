'use client';

import { useState, useMemo, useCallback } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { Snowflake, TrendingDown, Info, ArrowRight, Wallet, ChevronUp, ChevronDown } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  userEmail?: string | null;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
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

export default function DebtPayoffStrategy({ loans, extraPayment = 0, userEmail }: DebtPayoffStrategyProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<'snowball' | 'avalanche'>('snowball');
  const [customExtra, setCustomExtra] = useState<number>(extraPayment || 100);
  const [isAddingToBudget, setIsAddingToBudget] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

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

  const selectedResult = selectedStrategy === 'snowball' ? snowballResult : avalancheResult;

  // Baseline: no extra payment, used to show how much time/interest the extra saves
  const baseResult = useMemo(() =>
    calculatePayoff(consumerLoans, selectedResult.order, 0),
    [consumerLoans, selectedResult.order]
  );

  const timeSavedByExtra = Math.max(0, baseResult.monthsToPayoff - selectedResult.monthsToPayoff);
  const interestSavedByExtra = Math.max(0, baseResult.totalInterest - selectedResult.totalInterest);

  const handleAddToBudget = useCallback(async () => {
    if (!userEmail || customExtra <= 0) return;
    setIsAddingToBudget(true);
    try {
      // 1. Get active budget year
      const yearsRes = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/years`,
        { headers: { Accept: 'application/json' } }
      );
      if (!yearsRes.ok) throw new Error('Failed to fetch budget years');
      const years: { id: number; year: number; status: string }[] = await yearsRes.json();
      const activeYear = years.find(y => y.status === 'active') ?? years[0];
      if (!activeYear) throw new Error('No budget year found');

      // 2. Create budget entry
      const firstLoan = selectedResult.order[0];
      const currentMonth = new Date().getMonth() + 1;

      const payload = {
        entry_type: 'loan_payment',
        category: firstLoan?.loan_type || 'other',
        description: `Nadpłata - ${firstLoan?.description || 'Kredyt'}`,
        planned_amount: customExtra,
        is_recurring: true,
        month: currentMonth,
        budget_year_id: activeYear.id,
      };

      const response = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/entries`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error('Failed to create budget entry');

      toast({
        title: intl.formatMessage({ id: 'loans.strategy.addToBudgetSuccess', defaultMessage: 'Dodano nadpłatę do wydatków cyklicznych' }),
      });
    } catch {
      toast({
        title: intl.formatMessage({ id: 'loans.strategy.addToBudgetError', defaultMessage: 'Nie udało się dodać nadpłaty' }),
        variant: 'destructive',
      });
    } finally {
      setIsAddingToBudget(false);
    }
  }, [userEmail, customExtra, selectedResult, intl, toast]);

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

      {/* Extra payment input - inline */}
      <div className="flex flex-wrap items-center gap-2 bg-muted/30 rounded-xl px-4 py-3">
        <span className="text-sm font-medium text-primary">
          {intl.formatMessage({ id: 'loans.strategy.extraPayment', defaultMessage: 'Dodatkowa miesięczna nadpłata:' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCustomExtra(prev => Math.max(0, prev - 50))}
            className="p-1 rounded-md bg-muted hover:bg-muted/80 text-secondary hover:text-primary transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <CurrencyInput
            value={customExtra}
            onValueChange={(val) => setCustomExtra(Math.max(0, val))}
            className="w-24 px-2 py-1 bg-background border-none rounded-lg text-sm text-primary text-right focus:ring-1 focus:ring-primary/40"
          />
          <button
            onClick={() => setCustomExtra(prev => prev + 50)}
            className="p-1 rounded-md bg-muted hover:bg-muted/80 text-secondary hover:text-primary transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
        {customExtra > 0 && (
          <span className="text-xs text-success font-medium">
            {intl.formatMessage(
              { id: 'loans.strategy.speedsUpBy', defaultMessage: 'Speeds up payoff by {time}' },
              { time: formatMonths(timeSavedByExtra) }
            )}
            {interestSavedByExtra > 0 && (
              <> · {intl.formatMessage(
                { id: 'loans.strategy.interestSaved', defaultMessage: "You'll save {amount} in interest" },
                { amount: formatCurrency(interestSavedByExtra) }
              )}</>
            )}
          </span>
        )}
        {customExtra > 0 && userEmail && (
          <button
            onClick={() => setConfirmDialogOpen(true)}
            disabled={isAddingToBudget}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-success/15 text-success hover:bg-success/25 transition-colors disabled:opacity-50"
          >
            <Wallet className="w-3.5 h-3.5" />
            {intl.formatMessage({ id: 'loans.strategy.addToBudget', defaultMessage: 'Dodaj nadpłatę do budżetu' })}
          </button>
        )}
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
              step: <span key="step" className="font-medium text-primary"><FormattedMessage id="loans.strategy.babyStep2" defaultMessage="Baby Step 2" /></span>
            }}
          />
        </span>
      </div>
      {/* Confirm add to budget dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {intl.formatMessage({ id: 'loans.strategy.confirmDialog.title', defaultMessage: 'Dodaj nadpłatę do budżetu' })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {(() => {
                    const payoffDate = addMonths(new Date(), selectedResult.monthsToPayoff);
                    const monthName = intl.formatDate(payoffDate, { month: 'long' });
                    const year = payoffDate.getFullYear();
                    return intl.formatMessage(
                      { id: 'loans.strategy.confirmDialog.description', defaultMessage: 'Nadpłata {amount}/mies. na {loan} zostanie dopisana do budżetu wydatków od bieżącego miesiąca aż do całkowitej spłaty kredytu ({endDate}).' },
                      {
                        amount: formatCurrency(customExtra),
                        loan: selectedResult.order[0]?.description || 'Kredyt',
                        endDate: `${monthName} ${year}`,
                      }
                    );
                  })()}
                </p>
                <div className="rounded-lg bg-success/10 border border-success/20 p-3 space-y-1">
                  {timeSavedByExtra > 0 && (
                    <p className="text-success font-medium">
                      {intl.formatMessage(
                        { id: 'loans.strategy.confirmDialog.timeSaved', defaultMessage: 'Skrócisz spłatę o {time}' },
                        { time: formatMonths(timeSavedByExtra) }
                      )}
                    </p>
                  )}
                  {interestSavedByExtra > 0 && (
                    <p className="text-success font-medium">
                      {intl.formatMessage(
                        { id: 'loans.strategy.confirmDialog.interestSaved', defaultMessage: 'Zaoszczędzisz {amount} na odsetkach' },
                        { amount: formatCurrency(interestSavedByExtra) }
                      )}
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Anuluj' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isAddingToBudget}
              onClick={async (e) => {
                e.preventDefault();
                await handleAddToBudget();
                setConfirmDialogOpen(false);
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
