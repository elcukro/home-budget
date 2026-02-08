'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Home, Car, CreditCard, Wallet, GraduationCap, HandCoins, ShoppingCart, FileText, Landmark, CircleEllipsis, Calculator, TrendingDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoanData {
  id: number;
  loan_type: string;
  description: string;
  principal_amount: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  term_months: number;
}

interface SimulationResult {
  originalMonths: number;
  newMonths: number;
  monthsSaved: number;
  originalTotalInterest: number;
  newTotalInterest: number;
  interestSaved: number;
  originalPayoffDate: Date;
  newPayoffDate: Date;
}

const LOAN_TYPE_ICONS: Record<string, React.ElementType> = {
  mortgage: Home,
  car: Car,
  credit_card: CreditCard,
  personal: Wallet,
  student: GraduationCap,
  cash_loan: HandCoins,
  installment: ShoppingCart,
  leasing: FileText,
  overdraft: Landmark,
  other: CircleEllipsis,
};

function calculateAmortization(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  extraMonthly: number,
  oneTimePayment: number,
): { months: number; totalInterest: number } {
  if (balance <= 0 || monthlyPayment <= 0) return { months: 0, totalInterest: 0 };

  const monthlyRate = annualRate / 100 / 12;
  let remaining = Math.max(0, balance - oneTimePayment);
  let months = 0;
  let totalInterest = 0;
  const totalPayment = monthlyPayment + extraMonthly;
  const maxMonths = 600; // 50 years safety cap

  while (remaining > 0.01 && months < maxMonths) {
    const interest = remaining * monthlyRate;
    totalInterest += interest;
    const principal = Math.min(remaining, totalPayment - interest);

    if (principal <= 0) {
      // Payment doesn't cover interest - would never pay off
      return { months: maxMonths, totalInterest };
    }

    remaining -= principal;
    months++;
  }

  return { months, totalInterest };
}

interface LoanOverpaymentSimProps {
  preselectedLoanId?: number;
  preselectedAmount?: number;
  className?: string;
}

export default function LoanOverpaymentSim({
  preselectedLoanId,
  preselectedAmount,
  className,
}: LoanOverpaymentSimProps) {
  const intl = useIntl();
  const { data: session } = useSession();
  const { formatCurrency } = useSettings();

  const [loans, setLoans] = useState<LoanData[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [extraMonthly, setExtraMonthly] = useState(preselectedAmount ?? 500);
  const [oneTimePayment, setOneTimePayment] = useState(0);

  // Fetch loans
  useEffect(() => {
    if (!session?.user?.email) return;

    const fetchLoans = async () => {
      try {
        setIsLoadingLoans(true);
        const response = await fetch('/api/backend/loans');
        if (response.ok) {
          const data = await response.json();
          const activeLoans = data.filter((l: LoanData & { is_archived?: boolean }) => !l.is_archived && l.remaining_balance > 0);
          setLoans(activeLoans);
          // Pre-select loan if specified or pick first
          if (preselectedLoanId && activeLoans.some((l: LoanData) => l.id === preselectedLoanId)) {
            setSelectedLoanId(String(preselectedLoanId));
          } else if (activeLoans.length > 0) {
            setSelectedLoanId(String(activeLoans[0].id));
          }
        }
      } catch {
        // silently handle
      } finally {
        setIsLoadingLoans(false);
      }
    };

    fetchLoans();
  }, [session?.user?.email, preselectedLoanId]);

  const selectedLoan = useMemo(
    () => loans.find((l) => String(l.id) === selectedLoanId),
    [loans, selectedLoanId],
  );

  // Clamp extra monthly if it exceeds remaining balance
  const clampedExtraMonthly = useMemo(() => {
    if (!selectedLoan) return extraMonthly;
    return Math.min(extraMonthly, selectedLoan.remaining_balance);
  }, [extraMonthly, selectedLoan]);

  const clampedOneTime = useMemo(() => {
    if (!selectedLoan) return oneTimePayment;
    return Math.min(oneTimePayment, selectedLoan.remaining_balance);
  }, [oneTimePayment, selectedLoan]);

  const simulation = useMemo<SimulationResult | null>(() => {
    if (!selectedLoan) return null;

    const original = calculateAmortization(
      selectedLoan.remaining_balance,
      selectedLoan.interest_rate,
      selectedLoan.monthly_payment,
      0,
      0,
    );

    const withOverpayment = calculateAmortization(
      selectedLoan.remaining_balance,
      selectedLoan.interest_rate,
      selectedLoan.monthly_payment,
      clampedExtraMonthly,
      clampedOneTime,
    );

    const now = new Date();
    const originalPayoff = new Date(now);
    originalPayoff.setMonth(originalPayoff.getMonth() + original.months);
    const newPayoff = new Date(now);
    newPayoff.setMonth(newPayoff.getMonth() + withOverpayment.months);

    return {
      originalMonths: original.months,
      newMonths: withOverpayment.months,
      monthsSaved: original.months - withOverpayment.months,
      originalTotalInterest: original.totalInterest,
      newTotalInterest: withOverpayment.totalInterest,
      interestSaved: original.totalInterest - withOverpayment.totalInterest,
      originalPayoffDate: originalPayoff,
      newPayoffDate: newPayoff,
    };
  }, [selectedLoan, clampedExtraMonthly, clampedOneTime]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExtraMonthly(Number(e.target.value));
  }, []);

  const handleOneTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOneTimePayment(Number(e.target.value));
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(intl.locale, { year: 'numeric', month: 'long' });
  };

  const formatMonths = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return intl.formatMessage({ id: 'aiAnalysis.simulators.months' }, { count: remainingMonths });
    if (remainingMonths === 0) return intl.formatMessage({ id: 'aiAnalysis.simulators.years' }, { count: years });
    return `${intl.formatMessage({ id: 'aiAnalysis.simulators.years' }, { count: years })} ${intl.formatMessage({ id: 'aiAnalysis.simulators.months' }, { count: remainingMonths })}`;
  };

  const maxSlider = selectedLoan ? Math.min(5000, selectedLoan.remaining_balance) : 5000;
  const maxOneTime = selectedLoan ? Math.min(100000, selectedLoan.remaining_balance) : 100000;

  // Empty state: no loans
  if (!isLoadingLoans && loans.length === 0) {
    return (
      <Card className={cn('rounded-2xl border border-default shadow-sm', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg font-semibold text-primary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.title' })}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-secondary">
            {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.noLoans' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingLoans) {
    return (
      <Card className={cn('rounded-2xl border border-default shadow-sm animate-pulse', className)}>
        <CardContent className="py-8">
          <div className="h-6 w-48 bg-muted rounded mb-4" />
          <div className="h-10 w-full bg-muted rounded mb-4" />
          <div className="h-32 w-full bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const LoanIcon = selectedLoan ? (LOAN_TYPE_ICONS[selectedLoan.loan_type] || CircleEllipsis) : Calculator;

  return (
    <Card className={cn('rounded-2xl border border-default shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
            <LoanIcon className="h-5 w-5 text-blue-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-primary">
            {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.title' })}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Loan selector */}
        <div>
          <label className="text-xs font-medium text-secondary mb-1.5 block">
            {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.selectLoan' })}
          </label>
          <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loans.map((loan) => {
                const Icon = LOAN_TYPE_ICONS[loan.loan_type] || CircleEllipsis;
                return (
                  <SelectItem key={loan.id} value={String(loan.id)}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-secondary" />
                      <span>{loan.description}</span>
                      <span className="text-secondary text-xs">({formatCurrency(loan.remaining_balance)})</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedLoan && (
          <>
            {/* Extra monthly payment slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-secondary">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.extraMonthly' })}
                </label>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {formatCurrency(clampedExtraMonthly)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={maxSlider}
                step={50}
                value={extraMonthly}
                onChange={handleSliderChange}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.extraMonthly' })}
              />
              <div className="flex justify-between text-[10px] text-secondary mt-0.5">
                <span>{formatCurrency(0)}</span>
                <span>{formatCurrency(maxSlider)}</span>
              </div>
            </div>

            {/* One-time payment slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-secondary">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.oneTime' })}
                </label>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {formatCurrency(clampedOneTime)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={maxOneTime}
                step={500}
                value={oneTimePayment}
                onChange={handleOneTimeChange}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.oneTime' })}
              />
              <div className="flex justify-between text-[10px] text-secondary mt-0.5">
                <span>{formatCurrency(0)}</span>
                <span>{formatCurrency(maxOneTime)}</span>
              </div>
            </div>

            {/* Results */}
            {simulation && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-success">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.results' })}
                </h4>

                {/* Key metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <TrendingDown className="h-5 w-5 text-success mx-auto mb-1" />
                    <p className="text-xl font-bold text-success tabular-nums">
                      {formatCurrency(simulation.interestSaved)}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.interestSaved' })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {simulation.monthsSaved}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.monthsSaved' })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <Calendar className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-bold text-blue-600">
                      {formatDate(simulation.newPayoffDate)}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.newPayoffDate' })}
                    </p>
                  </div>
                </div>

                {/* Comparison bar */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-secondary">
                        {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.originalPlan' })}
                      </span>
                      <span className="text-secondary tabular-nums">{formatMonths(simulation.originalMonths)}</span>
                    </div>
                    <Progress value={100} className="h-2" indicatorClassName="bg-muted-foreground/30" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-success">
                        {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.withOverpayment' })}
                      </span>
                      <span className="font-medium text-success tabular-nums">{formatMonths(simulation.newMonths)}</span>
                    </div>
                    <Progress
                      value={simulation.originalMonths > 0 ? (simulation.newMonths / simulation.originalMonths) * 100 : 0}
                      className="h-2"
                      indicatorClassName="bg-success"
                    />
                  </div>
                </div>

                {/* Overpayment exceeds balance warning */}
                {(clampedExtraMonthly + clampedOneTime) >= (selectedLoan?.remaining_balance ?? 0) && (
                  <p className="text-xs text-warning font-medium">
                    {intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.paysOffEntirely' })}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
