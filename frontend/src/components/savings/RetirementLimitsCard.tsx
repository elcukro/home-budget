'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import { AlertTriangle, BadgePercent, Building2, CheckCircle, Globe, Info, Landmark, Plus, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getRetirementLimits, RetirementLimitsResponse, RetirementAccountLimit, createSaving, invalidateSavingsCache, getEarliestRecurringSalary, SalaryForPpk } from '@/api/savings';
import { AccountType, SavingCategory } from '@/types/financial-freedom';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Tooltip from '@/components/Tooltip';

export interface QuickAddSavingParams {
  accountType: AccountType;
  category: SavingCategory;
}

interface RetirementLimitsCardProps {
  isSelfEmployed?: boolean;
  className?: string;
  onQuickAddSaving?: (params: QuickAddSavingParams) => void;
  refreshKey?: number;
}

const accountTypeIcons: Record<AccountType, React.ReactNode> = {
  [AccountType.STANDARD]: <Wallet className="h-4 w-4" />,
  [AccountType.IKE]: <Landmark className="h-4 w-4" />,
  [AccountType.IKZE]: <BadgePercent className="h-4 w-4" />,
  [AccountType.PPK]: <Building2 className="h-4 w-4" />,
  [AccountType.OIPE]: <Globe className="h-4 w-4" />,
};

const quickAddAccounts = [
  {
    accountType: AccountType.IKE,
    label: 'IKE',
    icon: <Landmark className="h-5 w-5" />,
    color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  },
  {
    accountType: AccountType.IKZE,
    label: 'IKZE',
    icon: <BadgePercent className="h-5 w-5" />,
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
  },
  {
    accountType: AccountType.OIPE,
    label: 'OIPE',
    icon: <Globe className="h-5 w-5" />,
    color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200',
  },
];

function monthDiff(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

export default function RetirementLimitsCard({
  isSelfEmployed = false,
  className,
  onQuickAddSaving,
  refreshKey = 0,
}: RetirementLimitsCardProps) {
  const intl = useIntl();
  const { settings, formatCurrency } = useSettings();
  const session = useSession();
  const { toast } = useToast();
  const userEmail = session.data?.user?.email ?? null;

  const [limits, setLimits] = useState<RetirementLimitsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // PPK state
  const [salaryData, setSalaryData] = useState<SalaryForPpk | null>(null);
  const [ppkDialogMode, setPpkDialogMode] = useState<'update' | 'withdraw' | null>(null);
  const [ppkInputAmount, setPpkInputAmount] = useState('');
  const [ppkWithdrawConfirmed, setPpkWithdrawConfirmed] = useState(false);
  const [ppkSubmitting, setPpkSubmitting] = useState(false);

  const ppkEnrolled = settings?.ppk_enrolled === true;
  const ppkEmployeeRate = settings?.ppk_employee_rate ?? 2;
  const ppkEmployerRate = settings?.ppk_employer_rate ?? 1.5;

  // Find PPK account from limits data
  const ppkAccount = limits?.accounts.find((a) => a.account_type === AccountType.PPK);
  const currentPpkBalance = ppkAccount?.current_contributions ?? 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const data = await getRetirementLimits(undefined, isSelfEmployed);
    setLimits(data);
    setLoading(false);
  }, [isSelfEmployed]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Fetch earliest salary for PPK estimate
  useEffect(() => {
    if (!ppkEnrolled || !userEmail) return;
    getEarliestRecurringSalary(userEmail).then(setSalaryData);
  }, [ppkEnrolled, userEmail]);

  // PPK calculations
  const monthlyPpk = salaryData
    ? salaryData.grossAmount * (ppkEmployeeRate + ppkEmployerRate) / 100
    : 0;
  const monthlyEmployee = salaryData ? salaryData.grossAmount * ppkEmployeeRate / 100 : 0;
  const monthlyEmployer = salaryData ? salaryData.grossAmount * ppkEmployerRate / 100 : 0;
  const months = salaryData ? Math.max(0, monthDiff(salaryData.date, new Date())) : 0;
  const fullYears = Math.floor(months / 12);
  // PPK = employee + employer contributions + state welcome bonus (250 zł) + annual bonus (240 zł/year)
  const PPK_WELCOME_BONUS = 250;
  const PPK_ANNUAL_BONUS = 240;
  const stateContributions = months > 0 ? PPK_WELCOME_BONUS + (fullYears * PPK_ANNUAL_BONUS) : 0;
  const estimatedBalance = monthlyPpk * months + stateContributions;

  // Always use estimate as primary. Actual balance (from "Wprowadź aktualny stan")
  // only overrides when it's clearly a manual correction (user entered via dialog).
  // PPK contributions are automatic from payroll — the estimate is the real source of truth.
  const displayBalance = estimatedBalance > 0 ? estimatedBalance : currentPpkBalance;

  const handlePpkUpdate = async () => {
    const newAmount = parseFloat(ppkInputAmount);
    if (isNaN(newAmount) || newAmount < 0) return;

    const delta = newAmount - currentPpkBalance;
    if (delta === 0) {
      setPpkDialogMode(null);
      return;
    }

    setPpkSubmitting(true);
    try {
      await createSaving({
        category: 'retirement',
        saving_type: delta > 0 ? 'deposit' : 'withdrawal',
        amount: Math.abs(delta),
        date: new Date().toISOString().split('T')[0],
        description: 'Korekta stanu PPK',
        account_type: 'ppk',
      });
      invalidateSavingsCache();
      await fetchData();
      toast({
        title: intl.formatMessage({ id: 'savings.ppk.updateSuccess' }),
      });
      setPpkDialogMode(null);
      setPpkInputAmount('');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update PPK balance',
        variant: 'destructive',
      });
    } finally {
      setPpkSubmitting(false);
    }
  };

  const handlePpkWithdraw = async () => {
    const amount = parseFloat(ppkInputAmount);
    if (isNaN(amount) || amount <= 0 || amount > displayBalance) return;

    setPpkSubmitting(true);
    try {
      // 1. Create savings withdrawal
      await createSaving({
        category: 'retirement',
        saving_type: 'withdrawal',
        amount,
        date: new Date().toISOString().split('T')[0],
        description: 'Wypłata z PPK',
        account_type: 'ppk',
      });

      // 2. Create income entry (~70% net after deductions)
      if (userEmail) {
        const netAmount = Math.round(amount * 0.7 * 100) / 100;
        await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/income`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'other',
              description: 'Wypłata z PPK (po potrąceniach)',
              amount: netAmount,
              date: new Date().toISOString().split('T')[0],
              is_recurring: false,
            }),
          }
        );
      }

      invalidateSavingsCache();
      await fetchData();
      toast({
        title: intl.formatMessage({ id: 'savings.ppk.withdrawSuccess' }),
      });
      setPpkDialogMode(null);
      setPpkInputAmount('');
      setPpkWithdrawConfirmed(false);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to process PPK withdrawal',
        variant: 'destructive',
      });
    } finally {
      setPpkSubmitting(false);
    }
  };

  const openUpdateDialog = () => {
    setPpkInputAmount(currentPpkBalance > 0 ? currentPpkBalance.toString() : '');
    setPpkDialogMode('update');
  };

  const openWithdrawDialog = () => {
    setPpkInputAmount('');
    setPpkWithdrawConfirmed(false);
    setPpkDialogMode('withdraw');
  };

  const getProgressColor = (percentage: number, isOverLimit: boolean) => {
    if (isOverLimit) return 'bg-red-500';
    if (percentage >= 90) return 'bg-amber-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const getStatusIcon = (account: RetirementAccountLimit) => {
    if (account.is_over_limit) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (account.percentage_used >= 100) {
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    }
    if (account.percentage_used >= 90) {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    return <TrendingUp className="h-4 w-4 text-blue-500" />;
  };

  const renderAccountCard = (account: RetirementAccountLimit) => {
    // Skip PPK (handled separately) and accounts with no limit and no contributions
    if (account.account_type === AccountType.PPK) return null;
    if (account.annual_limit === 0 && account.current_contributions === 0) return null;

    const accountName = intl.formatMessage({
      id: `savings.retirementLimits.accounts.${account.account_type}`,
      defaultMessage: account.account_type.toUpperCase(),
    });

    return (
      <div
        key={account.account_type}
        className={cn(
          'p-3 rounded-lg border',
          account.is_over_limit
            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
            : 'border-border bg-card'
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {accountTypeIcons[account.account_type]}
            <span className="font-medium text-sm text-primary">{accountName}</span>
          </div>
          {getStatusIcon(account)}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className={cn('font-semibold', account.is_over_limit ? 'text-red-600' : 'text-primary')}>
              {formatCurrency(account.current_contributions)}
            </span>
            <span className="text-secondary">
              / {formatCurrency(account.annual_limit)}
            </span>
          </div>

          <Progress
            value={Math.min(account.percentage_used, 100)}
            className="h-1.5"
            indicatorClassName={getProgressColor(account.percentage_used, account.is_over_limit)}
          />

          <div className="text-xs text-secondary">
            {account.percentage_used.toFixed(0)}% wykorzystane
          </div>

          {account.remaining_limit > 0 && !account.is_over_limit && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              Pozostało: {formatCurrency(account.remaining_limit)}
            </div>
          )}

          {account.is_over_limit && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Przekroczono o {formatCurrency(account.current_contributions - account.annual_limit)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPpkSection = () => {
    if (!ppkEnrolled) return null;

    const userName = session.data?.user?.name?.split(' ')[0] || 'User';
    const salaryDateFormatted = salaryData
      ? new Date(salaryData.date).toLocaleDateString('pl-PL', { month: '2-digit', year: 'numeric' })
      : '';

    return (
      <div className="p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-purple-500" />
            <span className="font-medium text-sm text-primary">
              {intl.formatMessage({ id: 'savings.ppk.ownerLabel' }, { name: userName })}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={openUpdateDialog}
            >
              {intl.formatMessage({ id: 'savings.ppk.updateActual' })}
            </Button>
            {displayBalance > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                onClick={openWithdrawDialog}
              >
                {intl.formatMessage({ id: 'savings.ppk.withdraw' })}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          {salaryData ? (
            <>
              <Progress
                value={100}
                className="h-1.5"
                indicatorClassName="bg-purple-500"
              />

              <div className="flex items-baseline justify-between">
                <div className="text-xs text-secondary">
                  {intl.formatMessage({ id: 'savings.ppk.estimatedBalance' })}
                  {' · '}
                  {intl.formatMessage({ id: 'savings.ppk.monthsAccumulated' }, { months })}
                </div>
                <div className="font-semibold text-primary">
                  {formatCurrency(displayBalance)}
                </div>
              </div>

              <div className="text-xs text-secondary">
                {intl.formatMessage({ id: 'savings.ppk.monthlyContribution' })}:{' '}
                <span className="font-medium">{formatCurrency(monthlyPpk)}</span>
                {' — '}
                {intl.formatMessage(
                  { id: 'savings.ppk.breakdown' },
                  {
                    employee: formatCurrency(monthlyEmployee),
                    employeeRate: ppkEmployeeRate,
                    employer: formatCurrency(monthlyEmployer),
                    employerRate: ppkEmployerRate,
                  }
                )}
              </div>

              <div className="flex items-start gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <div>
                  <div>
                    {salaryData.description && `${salaryData.description}, `}
                    {intl.formatMessage({ id: 'savings.ppk.grossBasis' }, { amount: formatCurrency(salaryData.grossAmount) })}
                    {`, od ${salaryDateFormatted}`}
                  </div>
                  {stateContributions > 0 && (
                    <div>
                      {intl.formatMessage({ id: 'savings.ppk.stateBonus' }, {
                        annual: fullYears * PPK_ANNUAL_BONUS,
                        years: fullYears,
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-secondary py-2">
              <Info className="h-3 w-3 inline mr-1" />
              {intl.formatMessage({ id: 'savings.ppk.noSalaryData' })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {intl.formatMessage({ id: 'savings.retirementLimits.title' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded-lg" />
            <div className="h-24 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!limits) {
    return null;
  }

  // Filter to only show accounts with contributions or with limits (excluding PPK)
  const relevantAccounts = limits.accounts.filter(
    (a) => a.account_type !== AccountType.PPK && (a.annual_limit > 0 || a.current_contributions > 0)
  );

  const hasContributions = relevantAccounts.some((a) => a.current_contributions > 0);

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {intl.formatMessage({ id: 'savings.retirementLimits.title' })}
            </CardTitle>
            <Tooltip
              content={intl.formatMessage({ id: 'savings.retirementLimits.tooltip' })}
            >
              <Info className="h-4 w-4 text-secondary cursor-help" />
            </Tooltip>
          </div>
          <p className="text-sm text-secondary">
            {intl.formatMessage({ id: 'savings.retirementLimits.subtitle' }, { year: limits.year })}
          </p>
        </CardHeader>
        <CardContent>
          {!hasContributions && !ppkEnrolled ? (
            <div className="space-y-4">
              <div className="text-center py-4 text-secondary">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm">
                  {intl.formatMessage({ id: 'savings.retirementLimits.noContributions' })}
                </p>
              </div>

              {onQuickAddSaving && (
                <div className="flex flex-row gap-3 justify-center">
                  {quickAddAccounts.map((account) => (
                    <button
                      key={account.accountType}
                      onClick={() =>
                        onQuickAddSaving({
                          accountType: account.accountType,
                          category: SavingCategory.RETIREMENT,
                        })
                      }
                      className={cn(
                        'flex flex-row items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200',
                        'hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50',
                        account.color
                      )}
                    >
                      {account.icon}
                      <span className="font-semibold text-sm">{account.label}</span>
                      <Plus className="h-4 w-4 opacity-75" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* IKE/IKZE/OIPE account cards */}
              {hasContributions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {relevantAccounts.map(renderAccountCard)}
                </div>
              )}

              {/* PPK section */}
              {renderPpkSection()}

              {/* Summary */}
              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-secondary">
                    {intl.formatMessage({ id: 'savings.retirementLimits.totalContributions' })}
                  </span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(
                      limits.total_retirement_contributions - currentPpkBalance + (ppkEnrolled ? displayBalance : 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Info about limits */}
              <div className="text-xs text-secondary bg-muted px-3 py-2 rounded-lg">
                <span className="font-medium">
                  {intl.formatMessage({ id: 'savings.retirementLimits.limitsInfo' }, { year: limits.year })}:
                </span>
                {' '}IKE: {formatCurrency(limits.ike_limit)}{' '}
                {intl.formatMessage({ id: 'savings.retirementLimits.noCapitalGainsTax' })}
                {' · '}IKZE: {formatCurrency(isSelfEmployed ? limits.ikze_limit_jdg : limits.ikze_limit_standard)}{' '}
                {intl.formatMessage({ id: 'savings.retirementLimits.taxDeductible' })}
                {isSelfEmployed && ` (${intl.formatMessage({ id: 'savings.retirementLimits.jdgLimit' })})`}
              </div>

              {/* Quick-add tiles when no contributions yet but PPK is showing */}
              {!hasContributions && onQuickAddSaving && (
                <div className="flex flex-row gap-3 justify-center">
                  {quickAddAccounts.map((account) => (
                    <button
                      key={account.accountType}
                      onClick={() =>
                        onQuickAddSaving({
                          accountType: account.accountType,
                          category: SavingCategory.RETIREMENT,
                        })
                      }
                      className={cn(
                        'flex flex-row items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-200',
                        'hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50',
                        account.color
                      )}
                    >
                      {account.icon}
                      <span className="font-semibold text-sm">{account.label}</span>
                      <Plus className="h-4 w-4 opacity-75" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PPK Update Dialog */}
      <Dialog open={ppkDialogMode === 'update'} onOpenChange={(open) => !open && setPpkDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{intl.formatMessage({ id: 'savings.ppk.updateTitle' })}</DialogTitle>
            <DialogDescription>
              {intl.formatMessage({ id: 'savings.ppk.updateDescription' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ppk-actual-balance">
                {intl.formatMessage({ id: 'savings.ppk.actualBalance' })}
              </Label>
              <Input
                id="ppk-actual-balance"
                type="number"
                min="0"
                step="0.01"
                value={ppkInputAmount}
                onChange={(e) => setPpkInputAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPpkDialogMode(null)}>
              {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Anuluj' })}
            </Button>
            <Button
              onClick={handlePpkUpdate}
              disabled={ppkSubmitting || ppkInputAmount === '' || isNaN(parseFloat(ppkInputAmount))}
            >
              {intl.formatMessage({ id: 'common.save', defaultMessage: 'Zapisz' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PPK Withdraw Dialog */}
      <Dialog open={ppkDialogMode === 'withdraw'} onOpenChange={(open) => !open && setPpkDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{intl.formatMessage({ id: 'savings.ppk.withdrawTitle' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Warning banner */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                    {intl.formatMessage({ id: 'savings.ppk.withdrawWarning' })}
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
                    <li>• {intl.formatMessage({ id: 'savings.ppk.withdrawPenalties.zus' })}</li>
                    <li>• {intl.formatMessage({ id: 'savings.ppk.withdrawPenalties.welcome' })}</li>
                    <li>• {intl.formatMessage({ id: 'savings.ppk.withdrawPenalties.annual' })}</li>
                    <li>• {intl.formatMessage({ id: 'savings.ppk.withdrawPenalties.tax' })}</li>
                  </ul>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                    {intl.formatMessage({ id: 'savings.ppk.withdrawNetNote' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="ppk-withdraw-amount">
                {intl.formatMessage({ id: 'savings.ppk.withdrawAmount' })}
              </Label>
              <Input
                id="ppk-withdraw-amount"
                type="number"
                min="0"
                max={displayBalance}
                step="0.01"
                value={ppkInputAmount}
                onChange={(e) => setPpkInputAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-secondary">
                {intl.formatMessage({ id: 'savings.ppk.maxAmount' }, { amount: formatCurrency(displayBalance) })}
              </p>
            </div>

            {/* Confirmation checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ppk-withdraw-confirm"
                checked={ppkWithdrawConfirmed}
                onCheckedChange={(checked) => setPpkWithdrawConfirmed(checked === true)}
              />
              <Label htmlFor="ppk-withdraw-confirm" className="text-sm cursor-pointer">
                {intl.formatMessage({ id: 'savings.ppk.withdrawConfirm' })}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPpkDialogMode(null)}>
              {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Anuluj' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handlePpkWithdraw}
              disabled={
                ppkSubmitting ||
                !ppkWithdrawConfirmed ||
                ppkInputAmount === '' ||
                isNaN(parseFloat(ppkInputAmount)) ||
                parseFloat(ppkInputAmount) <= 0 ||
                parseFloat(ppkInputAmount) > displayBalance
              }
            >
              {intl.formatMessage({ id: 'savings.ppk.withdraw' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
