'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import { AlertTriangle, BadgePercent, Building2, Globe, Info, Landmark, Plus, TrendingUp, Wallet } from 'lucide-react';
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
  owner?: string;
}

interface RetirementLimitsCardProps {
  isSelfEmployed?: boolean;
  className?: string;
  onQuickAddSaving?: (params: QuickAddSavingParams) => void;
  onPpkUpdate?: () => void;  // Called after PPK update/withdrawal to refresh parent table
  refreshKey?: number;
  owner?: 'self' | 'partner';
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
  onPpkUpdate,
  refreshKey = 0,
  owner,
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

  // Opening balance state (for IKE/IKZE/OIPE multi-year tracking)
  const [openingBalanceDialog, setOpeningBalanceDialog] = useState<{
    accountType: AccountType;
    currentBalance: number;
  } | null>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [openingBalanceSubmitting, setOpeningBalanceSubmitting] = useState(false);

  const isPartner = owner === 'partner';
  const ppkEnrolled = isPartner ? settings?.partner_ppk_enrolled === true : settings?.ppk_enrolled === true;
  const ppkEmployeeRate = isPartner ? settings?.partner_ppk_employee_rate ?? 2 : settings?.ppk_employee_rate ?? 2;
  const ppkEmployerRate = isPartner ? settings?.partner_ppk_employer_rate ?? 1.5 : settings?.ppk_employer_rate ?? 1.5;

  // Find PPK account from limits data
  const ppkAccount = limits?.accounts.find((a) => a.account_type === AccountType.PPK);
  const currentPpkBalance = ppkAccount?.current_contributions ?? 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const data = await getRetirementLimits(undefined, isSelfEmployed, isPartner ? 'partner' : undefined);
    setLimits(data);
    setLoading(false);
  }, [isSelfEmployed, isPartner]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Fetch earliest salary for PPK estimate
  useEffect(() => {
    if (!ppkEnrolled || !userEmail) return;
    getEarliestRecurringSalary(userEmail, isPartner ? 'partner' : undefined).then(setSalaryData);
  }, [ppkEnrolled, userEmail, isPartner]);

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

  // NEW: Baseline + Auto-Growth Logic for PPK
  // If user has manually set a baseline, add contributions on top. Otherwise use full estimate.
  const hasManualBaseline = ppkAccount?.last_manual_balance !== null && ppkAccount?.last_manual_balance !== undefined;
  const isUoP = isPartner
    ? settings?.partner_employment_status === 'uop'
    : settings?.employment_type === 'uop';  // Only UoP employees get automatic PPK contributions

  let displayBalance: number;
  let growthSinceBaseline = 0;
  let monthsSinceBaseline = 0;

  if (hasManualBaseline && ppkAccount?.last_manual_update) {
    // User has manually updated PPK balance - use that as baseline
    monthsSinceBaseline = Math.max(0, monthDiff(ppkAccount.last_manual_update, new Date()));

    // Only add auto-growth if user is employed via UoP (Umowa o pracę)
    if (isUoP && ppkAccount.monthly_contribution) {
      growthSinceBaseline = monthsSinceBaseline * ppkAccount.monthly_contribution;
      displayBalance = (ppkAccount.last_manual_balance ?? 0) + growthSinceBaseline;
    } else {
      // Not UoP or no contribution data - just show the baseline
      displayBalance = ppkAccount.last_manual_balance ?? 0;
    }
  } else if (estimatedBalance > 0 && isUoP) {
    // No manual baseline yet, use full estimate (only if UoP employee)
    displayBalance = estimatedBalance;
  } else {
    // Fallback: use current balance from database
    displayBalance = currentPpkBalance;
  }

  const handlePpkUpdate = async () => {
    const newAmount = parseFloat(ppkInputAmount);
    if (isNaN(newAmount) || newAmount < 0) return;

    setPpkSubmitting(true);
    try {
      // STEP 1: Delete previous "Korekta stanu PPK" entry if exists
      // This ensures we're setting absolute balance, not adding delta
      if (userEmail) {
        const response = await fetch('/api/backend/savings', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const savings = await response.json();
          const previousCorrection = savings
            .filter((s: any) =>
              s.account_type === 'ppk' &&
              s.description === 'Korekta stanu PPK' &&
              (isPartner ? s.owner === 'partner' : (!s.owner || s.owner === 'self'))
            )
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          // Delete previous correction if exists
          if (previousCorrection) {
            await fetch(`/api/backend/savings/${previousCorrection.id}`, {
              method: 'DELETE',
            });
          }
        }
      }

      // STEP 2: Create new PPK correction entry with ABSOLUTE value
      await createSaving({
        category: 'retirement',
        saving_type: 'deposit',
        amount: newAmount,
        date: new Date().toISOString().split('T')[0],
        description: 'Korekta stanu PPK',
        account_type: 'ppk',
        entry_type: 'opening_balance',  // Mark as opening balance to not count toward limits
        owner: isPartner ? 'partner' : undefined,
      });

      invalidateSavingsCache();
      await fetchData();
      toast({
        title: intl.formatMessage({ id: 'savings.ppk.updateSuccess' }),
      });
      setPpkDialogMode(null);
      setPpkInputAmount('');

      // Notify parent to refresh transaction table
      onPpkUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update PPK balance',
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
        owner: isPartner ? 'partner' : undefined,
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

      // Notify parent to refresh transaction table
      onPpkUpdate?.();
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

  const openOpeningBalanceDialog = (accountType: AccountType) => {
    const account = limits?.accounts.find((a) => a.account_type === accountType);
    setOpeningBalanceInput(account?.opening_balance?.toString() || '');
    setOpeningBalanceDialog({
      accountType,
      currentBalance: account?.opening_balance || 0,
    });
  };

  const handleOpeningBalanceUpdate = async () => {
    if (!openingBalanceDialog) return;

    const newBalance = parseFloat(openingBalanceInput);

    // Validation: must be a valid number
    if (isNaN(newBalance)) {
      toast({
        title: intl.formatMessage({ id: 'common.error' }),
        description: intl.formatMessage({ id: 'savings.openingBalance.invalidAmount' }),
        variant: 'destructive',
      });
      return;
    }

    // Validation: cannot be negative
    if (newBalance < 0) {
      toast({
        title: intl.formatMessage({ id: 'common.error' }),
        description: intl.formatMessage({ id: 'savings.openingBalance.cannotBeNegative' }),
        variant: 'destructive',
      });
      return;
    }

    // Special case: 0 means "no opening balance" - just close dialog
    if (newBalance === 0) {
      toast({
        title: intl.formatMessage({ id: 'savings.openingBalance.zeroNotNeeded' }),
        description: intl.formatMessage({ id: 'savings.openingBalance.zeroNotNeededHint' }),
      });
      setOpeningBalanceDialog(null);
      return;
    }

    setOpeningBalanceSubmitting(true);
    try {
      const currentYear = new Date().getFullYear();
      const accountLabel = openingBalanceDialog.accountType.toUpperCase();

      await createSaving({
        category: SavingCategory.RETIREMENT,
        saving_type: 'deposit',
        amount: newBalance,
        date: `${currentYear}-01-01`,
        description: `Saldo początkowe ${accountLabel} ${currentYear}`,
        account_type: openingBalanceDialog.accountType,
        entry_type: 'opening_balance',  // CRITICAL: Mark as opening balance, not contribution!
        owner: isPartner ? 'partner' : undefined,
      });

      invalidateSavingsCache();
      await fetchData();
      onPpkUpdate?.(); // Refresh parent table
      toast({
        title: intl.formatMessage({ id: 'savings.openingBalance.updateSuccess' }),
      });
      setOpeningBalanceDialog(null);
    } catch (error: any) {
      // Better error handling for 422 validation errors
      let errorMessage = intl.formatMessage({ id: 'savings.openingBalance.updateError' });

      if (error.message) {
        // Check if it's a duplicate entry error
        if (error.message.includes('already exists')) {
          errorMessage = intl.formatMessage({ id: 'savings.openingBalance.duplicateEntry' });
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: intl.formatMessage({ id: 'common.error' }),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setOpeningBalanceSubmitting(false);
    }
  };

  const getProgressColor = (percentage: number, isOverLimit: boolean) => {
    if (isOverLimit) return 'bg-red-500';
    if (percentage >= 90) return 'bg-amber-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const renderAccountCard = (account: RetirementAccountLimit) => {
    // Skip PPK (handled separately) and accounts with no limit and no balance
    if (account.account_type === AccountType.PPK) return null;
    if (account.annual_limit === 0 && account.total_balance === 0) return null;

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
        {/* Header with account name and opening balance button */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {accountTypeIcons[account.account_type]}
            <span className="font-medium text-sm text-primary">{accountName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2 text-secondary hover:text-primary"
            onClick={() => openOpeningBalanceDialog(account.account_type)}
          >
            {intl.formatMessage({ id: 'savings.openingBalance.update' })}
          </Button>
        </div>

        <div className="space-y-1.5">
          {/* Total Balance */}
          <div className="flex justify-between text-xs">
            <span className="text-secondary">
              {intl.formatMessage({ id: 'savings.totalBalance' })}
            </span>
            <span className="font-semibold text-primary">
              {formatCurrency(account.total_balance)}
            </span>
          </div>

          {/* Opening Balance (if exists) */}
          {account.opening_balance > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{intl.formatMessage({ id: 'savings.openingBalance.label' })}</span>
              <span>{formatCurrency(account.opening_balance)}</span>
            </div>
          )}

          {/* Current Year Contributions vs Limit */}
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold">
              {intl.formatMessage({ id: 'savings.currentYearContributions' }, { year: account.year })}
            </span>
            <span>
              {formatCurrency(account.current_contributions)} / {formatCurrency(account.annual_limit)}
            </span>
          </div>

          {/* Progress bar (based on current year contributions) */}
          <Progress
            value={Math.min(account.percentage_used, 100)}
            className="h-1.5"
            indicatorClassName={getProgressColor(account.percentage_used, account.is_over_limit)}
          />

          <div className="text-xs text-secondary">
            {account.percentage_used.toFixed(0)}% {intl.formatMessage({ id: 'savings.limitUsed' })}
          </div>

          {/* Remaining limit */}
          {account.remaining_limit > 0 && !account.is_over_limit && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              {intl.formatMessage({ id: 'savings.remainingLimit' }, { amount: formatCurrency(account.remaining_limit) })}
            </div>
          )}

          {/* Over limit warning */}
          {account.is_over_limit && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {intl.formatMessage({ id: 'savings.overLimit' })}
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
                  {hasManualBaseline
                    ? intl.formatMessage({ id: 'savings.ppk.actualBalance' })
                    : intl.formatMessage({ id: 'savings.ppk.estimatedBalance' })}
                  {!hasManualBaseline && ' · '}
                  {!hasManualBaseline && intl.formatMessage({ id: 'savings.ppk.monthsAccumulated' }, { months })}
                </div>
                <div className="font-semibold text-primary">
                  {formatCurrency(displayBalance)}
                </div>
              </div>

              {/* Manual baseline indicator */}
              {hasManualBaseline && ppkAccount?.last_manual_update && (
                <div className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'savings.ppk.baselineValue' }, {
                    baseline: formatCurrency(ppkAccount.last_manual_balance ?? 0),
                    date: new Date(ppkAccount.last_manual_update).toLocaleDateString(),
                  })}
                  {isUoP && growthSinceBaseline > 0 && (
                    <>
                      {' · '}
                      {intl.formatMessage({ id: 'savings.ppk.growth' }, {
                        growth: formatCurrency(growthSinceBaseline),
                        months: monthsSinceBaseline,
                      })}
                    </>
                  )}
                </div>
              )}

              {/* Non-UoP employee warning */}
              {!isUoP && (
                <div className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <div>{intl.formatMessage({ id: 'savings.ppk.notUopWarning' })}</div>
                </div>
              )}

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
            {isPartner
              ? intl.formatMessage({ id: 'savings.retirementLimits.partnerTitle' }, { name: settings?.partner_name || 'Partner' })
              : intl.formatMessage({ id: 'savings.retirementLimits.title' })}
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
              {isPartner
                ? intl.formatMessage({ id: 'savings.retirementLimits.partnerTitle' }, { name: settings?.partner_name || 'Partner' })
                : intl.formatMessage({ id: 'savings.retirementLimits.title' })}
            </CardTitle>
            <Tooltip
              content={intl.formatMessage({ id: 'savings.retirementLimits.tooltip' })}
            >
              <Info className="h-4 w-4 text-secondary cursor-help" />
            </Tooltip>
          </div>
          <p className="text-sm text-secondary">
            {isPartner
              ? intl.formatMessage({ id: 'savings.retirementLimits.partnerSubtitle' }, { name: settings?.partner_name || 'Partner', year: limits.year })
              : intl.formatMessage({ id: 'savings.retirementLimits.subtitle' }, { year: limits.year })}
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
                          owner: isPartner ? 'partner' : undefined,
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
                          owner: isPartner ? 'partner' : undefined,
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

      {/* Opening Balance Dialog (IKE/IKZE/OIPE) */}
      <Dialog open={!!openingBalanceDialog} onOpenChange={(open) => !open && setOpeningBalanceDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openingBalanceDialog &&
                intl.formatMessage(
                  { id: 'savings.openingBalance.title' },
                  { account: openingBalanceDialog.accountType.toUpperCase() }
                )}
            </DialogTitle>
            <DialogDescription>
              {intl.formatMessage({ id: 'savings.openingBalance.description' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="opening-balance">
                {intl.formatMessage({ id: 'savings.openingBalance.label' })}
              </Label>
              <Input
                id="opening-balance"
                type="number"
                min="0"
                step="0.01"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-secondary">
                {intl.formatMessage({ id: 'savings.openingBalance.hint' })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpeningBalanceDialog(null)}>
              {intl.formatMessage({ id: 'common.cancel' })}
            </Button>
            <Button
              onClick={handleOpeningBalanceUpdate}
              disabled={
                openingBalanceSubmitting ||
                openingBalanceInput === '' ||
                isNaN(parseFloat(openingBalanceInput)) ||
                parseFloat(openingBalanceInput) <= 0
              }
            >
              {intl.formatMessage({ id: 'common.save' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
