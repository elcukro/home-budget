'use client';

import React from 'react';
import { useIntl } from 'react-intl';
import {
  Banknote,
  Car,
  CreditCard,
  Home,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoanTemplate {
  loan_type: string;
  description: string;
  principal_amount: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  term_months: number;
}

interface QuickAddLoanTilesProps {
  onQuickAdd: (template: Partial<LoanTemplate>) => void;
  className?: string;
}

interface LoanTemplateConfig {
  type: string;
  labelId: string;
  descriptionId: string;
  Icon: LucideIcon;
  defaults: Partial<LoanTemplate>;
}

// Quick-add templates with typical Polish market defaults
const loanTemplates: LoanTemplateConfig[] = [
  {
    type: 'mortgage',
    labelId: 'loans.types.mortgage',
    descriptionId: 'loans.quickAdd.mortgage.description',
    Icon: Home,
    defaults: {
      loan_type: 'mortgage',
      interest_rate: 7.5, // Typical Polish mortgage rate 2024-2025
      term_months: 300, // 25 years
    },
  },
  {
    type: 'car',
    labelId: 'loans.types.car',
    descriptionId: 'loans.quickAdd.car.description',
    Icon: Car,
    defaults: {
      loan_type: 'car',
      interest_rate: 9.5, // Typical car loan rate
      term_months: 60, // 5 years
    },
  },
  {
    type: 'credit_card',
    labelId: 'loans.types.credit_card',
    descriptionId: 'loans.quickAdd.credit_card.description',
    Icon: CreditCard,
    defaults: {
      loan_type: 'credit_card',
      interest_rate: 21.0, // Typical credit card rate in Poland
      term_months: 12, // Revolving - show as 12 months for planning
    },
  },
  {
    type: 'cash_loan',
    labelId: 'loans.types.cash_loan',
    descriptionId: 'loans.quickAdd.cash_loan.description',
    Icon: Banknote,
    defaults: {
      loan_type: 'cash_loan',
      interest_rate: 12.0, // Typical cash loan rate
      term_months: 36, // 3 years
    },
  },
  {
    type: 'installment',
    labelId: 'loans.types.installment',
    descriptionId: 'loans.quickAdd.installment.description',
    Icon: ShoppingCart,
    defaults: {
      loan_type: 'installment',
      interest_rate: 0, // Often 0% promotional
      term_months: 24, // 2 years typical
    },
  },
  {
    type: 'leasing',
    labelId: 'loans.types.leasing',
    descriptionId: 'loans.quickAdd.leasing.description',
    Icon: Truck,
    defaults: {
      loan_type: 'leasing',
      interest_rate: 0, // Leasing - interest is built into monthly payment
      term_months: 48, // 4 years typical
      // Note: principal_amount will be calculated from monthly_payment * term_months
    },
  },
  {
    type: 'overdraft',
    labelId: 'loans.types.overdraft',
    descriptionId: 'loans.quickAdd.overdraft.description',
    Icon: Wallet,
    defaults: {
      loan_type: 'overdraft',
      interest_rate: 15.0, // Typical overdraft rate
      term_months: 12, // Revolving - shown as 12 months
    },
  },
];

export default function QuickAddLoanTiles({
  onQuickAdd,
  className,
}: QuickAddLoanTilesProps) {
  const intl = useIntl();

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs text-muted-foreground">
        {intl.formatMessage({ id: 'loans.quickAdd.title' })}
      </p>
      <div className="flex flex-wrap gap-2">
      {loanTemplates.map((template) => (
        <button
          key={template.type}
          onClick={() => onQuickAdd(template.defaults)}
          className="inline-flex items-center gap-1.5 rounded-full border border-muted bg-card px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <template.Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {intl.formatMessage({ id: template.labelId })}
          <Plus className="h-3 w-3 text-muted-foreground/60" />
        </button>
      ))}
      </div>
    </div>
  );
}
