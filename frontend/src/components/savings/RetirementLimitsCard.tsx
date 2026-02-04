'use client';

import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { AlertTriangle, CheckCircle, Info, Plus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button as _Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getRetirementLimits, RetirementLimitsResponse, RetirementAccountLimit } from '@/api/savings';
import { AccountType, SavingCategory } from '@/types/financial-freedom';
import { useSettings } from '@/contexts/SettingsContext';
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
  refreshKey?: number; // Changes trigger re-fetch of retirement limits
}

const accountTypeIcons: Record<AccountType, string> = {
  [AccountType.STANDARD]: '💰',
  [AccountType.IKE]: '🏦',
  [AccountType.IKZE]: '📊',
  [AccountType.PPK]: '🏢',
  [AccountType.OIPE]: '🇪🇺',
};

const _accountTypeColors: Record<AccountType, string> = {
  [AccountType.STANDARD]: 'bg-gray-500',
  [AccountType.IKE]: 'bg-emerald-500',
  [AccountType.IKZE]: 'bg-blue-500',
  [AccountType.PPK]: 'bg-purple-500',
  [AccountType.OIPE]: 'bg-amber-500',
};

// Quick-add tile configurations for III Pillar accounts
const quickAddAccounts = [
  {
    accountType: AccountType.IKE,
    label: 'IKE',
    icon: '🏦',
    color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  },
  {
    accountType: AccountType.IKZE,
    label: 'IKZE',
    icon: '📊',
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
  },
  {
    accountType: AccountType.OIPE,
    label: 'OIPE',
    icon: '🇪🇺',
    color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200',
  },
];

export default function RetirementLimitsCard({
  isSelfEmployed = false,
  className,
  onQuickAddSaving,
  refreshKey = 0,
}: RetirementLimitsCardProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const [limits, setLimits] = useState<RetirementLimitsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLimits = async () => {
      setLoading(true);
      const data = await getRetirementLimits(undefined, isSelfEmployed);
      setLimits(data);
      setLoading(false);
    };

    fetchLimits();
  }, [isSelfEmployed, refreshKey]);

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
    // Skip accounts with no limit (like PPK) or no contributions
    if (account.annual_limit === 0) {
      return null;
    }

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
            <span className="text-base">{accountTypeIcons[account.account_type]}</span>
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

  // Filter to only show accounts with contributions or with limits
  const relevantAccounts = limits.accounts.filter(
    (a) => a.annual_limit > 0 || a.current_contributions > 0
  );

  // Check if any accounts have contributions
  const hasContributions = relevantAccounts.some((a) => a.current_contributions > 0);

  return (
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
        {!hasContributions ? (
          <div className="space-y-4">
            <div className="text-center py-4 text-secondary">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">
                {intl.formatMessage({ id: 'savings.retirementLimits.noContributions' })}
              </p>
            </div>

            {/* Quick-add tiles - horizontal row */}
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
                    <span className="text-xl">{account.icon}</span>
                    <span className="font-semibold text-sm">{account.label}</span>
                    <Plus className="h-4 w-4 opacity-75" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account cards in horizontal row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {relevantAccounts.map(renderAccountCard)}
            </div>

            {/* Summary */}
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">
                  {intl.formatMessage({ id: 'savings.retirementLimits.totalContributions' })}
                </span>
                <span className="font-semibold text-primary">
                  {formatCurrency(limits.total_retirement_contributions)}
                </span>
              </div>
            </div>

            {/* Info about limits */}
            <div className="text-xs text-secondary bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">
                {intl.formatMessage({ id: 'savings.retirementLimits.limitsInfo' }, { year: limits.year })}
              </p>
              <ul className="space-y-1">
                <li>
                  • IKE: {formatCurrency(limits.ike_limit)}{' '}
                  {intl.formatMessage({ id: 'savings.retirementLimits.noCapitalGainsTax' })}
                </li>
                <li>
                  • IKZE: {formatCurrency(isSelfEmployed ? limits.ikze_limit_jdg : limits.ikze_limit_standard)}{' '}
                  {intl.formatMessage({ id: 'savings.retirementLimits.taxDeductible' })}
                  {isSelfEmployed && ` (${intl.formatMessage({ id: 'savings.retirementLimits.jdgLimit' })})`}
                </li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
