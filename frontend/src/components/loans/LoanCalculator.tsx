'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

interface LoanCalculatorProps {
  onApply?: (values: CalculatedValues) => void;
  initialValues?: Partial<CalculatedValues>;
  className?: string;
}

interface CalculatedValues {
  principal: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
}

type CalculationTarget = 'monthlyPayment' | 'termMonths' | 'principal';

/**
 * PMT formula: Calculate monthly payment
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * where P = principal, r = monthly rate, n = number of payments
 */
const calculateMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number
): number => {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRate === 0) return principal / termMonths;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return principal * (monthlyRate * factor) / (factor - 1);
};

/**
 * Calculate term in months from payment
 * n = -log(1 - (r * P) / M) / log(1 + r)
 */
const calculateTermMonths = (
  principal: number,
  annualRate: number,
  monthlyPayment: number
): number => {
  if (principal <= 0 || monthlyPayment <= 0) return 0;
  if (annualRate === 0) return Math.ceil(principal / monthlyPayment);

  const monthlyRate = annualRate / 100 / 12;
  const minPayment = principal * monthlyRate;

  // If payment doesn't cover interest, return infinity (can't pay off)
  if (monthlyPayment <= minPayment) return Infinity;

  const months = -Math.log(1 - (monthlyRate * principal) / monthlyPayment) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
};

/**
 * Calculate principal from payment
 * P = M * [(1+r)^n - 1] / [r(1+r)^n]
 */
const calculatePrincipal = (
  monthlyPayment: number,
  annualRate: number,
  termMonths: number
): number => {
  if (monthlyPayment <= 0 || termMonths <= 0) return 0;
  if (annualRate === 0) return monthlyPayment * termMonths;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return monthlyPayment * (factor - 1) / (monthlyRate * factor);
};

export default function LoanCalculator({
  onApply,
  initialValues,
  className,
}: LoanCalculatorProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const [open, setOpen] = useState(false);

  const [principal, setPrincipal] = useState(initialValues?.principal?.toString() ?? '');
  const [interestRate, setInterestRate] = useState(initialValues?.interestRate?.toString() ?? '');
  const [termMonths, setTermMonths] = useState(initialValues?.termMonths?.toString() ?? '');
  const [monthlyPayment, setMonthlyPayment] = useState(initialValues?.monthlyPayment?.toString() ?? '');

  const [calculateTarget, setCalculateTarget] = useState<CalculationTarget>('monthlyPayment');
  const [calculatedValue, setCalculatedValue] = useState<number | null>(null);

  const parseNum = (value: string): number => {
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculate = useCallback(() => {
    const p = parseNum(principal);
    const r = parseNum(interestRate);
    const n = parseNum(termMonths);
    const m = parseNum(monthlyPayment);

    let result: number | null = null;

    switch (calculateTarget) {
      case 'monthlyPayment':
        if (p > 0 && r >= 0 && n > 0) {
          result = calculateMonthlyPayment(p, r, n);
        }
        break;
      case 'termMonths':
        if (p > 0 && r >= 0 && m > 0) {
          result = calculateTermMonths(p, r, m);
        }
        break;
      case 'principal':
        if (m > 0 && r >= 0 && n > 0) {
          result = calculatePrincipal(m, r, n);
        }
        break;
    }

    setCalculatedValue(result !== null && isFinite(result) ? result : null);
  }, [principal, interestRate, termMonths, monthlyPayment, calculateTarget]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const handleApply = () => {
    if (calculatedValue === null) return;

    const values: CalculatedValues = {
      principal: calculateTarget === 'principal' ? calculatedValue : parseNum(principal),
      interestRate: parseNum(interestRate),
      termMonths: calculateTarget === 'termMonths' ? Math.round(calculatedValue) : parseNum(termMonths),
      monthlyPayment: calculateTarget === 'monthlyPayment' ? calculatedValue : parseNum(monthlyPayment),
    };

    onApply?.(values);
    setOpen(false);
  };

  const formatResult = (value: number | null, target: CalculationTarget): string => {
    if (value === null || !isFinite(value)) return '—';

    switch (target) {
      case 'monthlyPayment':
      case 'principal':
        return formatCurrency(value);
      case 'termMonths':
        const years = Math.floor(value / 12);
        const months = Math.round(value % 12);
        if (years > 0 && months > 0) {
          return `${years} ${intl.formatMessage({ id: 'common.years' })} ${months} ${intl.formatMessage({ id: 'common.month' })}`;
        } else if (years > 0) {
          return `${years} ${intl.formatMessage({ id: 'common.years' })}`;
        }
        return `${Math.round(value)} ${intl.formatMessage({ id: 'common.month' })}`;
    }
  };

  const totalCost = calculatedValue !== null && calculateTarget === 'monthlyPayment'
    ? calculatedValue * parseNum(termMonths)
    : calculatedValue !== null && calculateTarget === 'termMonths'
    ? parseNum(monthlyPayment) * calculatedValue
    : calculatedValue !== null && calculateTarget === 'principal'
    ? parseNum(monthlyPayment) * parseNum(termMonths)
    : null;

  const totalInterest = totalCost !== null
    ? totalCost - (calculateTarget === 'principal' && calculatedValue !== null ? calculatedValue : parseNum(principal))
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <Calculator className="h-4 w-4" />
          <FormattedMessage id="loans.calculator.button" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            <FormattedMessage id="loans.calculator.title" />
          </DialogTitle>
          <DialogDescription>
            <FormattedMessage id="loans.calculator.description" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* What to calculate */}
          <div className="space-y-2">
            <Label>
              <FormattedMessage id="loans.calculator.calculateLabel" />
            </Label>
            <Select value={calculateTarget} onValueChange={(v) => setCalculateTarget(v as CalculationTarget)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthlyPayment">
                  <FormattedMessage id="loans.calculator.target.monthlyPayment" />
                </SelectItem>
                <SelectItem value="termMonths">
                  <FormattedMessage id="loans.calculator.target.termMonths" />
                </SelectItem>
                <SelectItem value="principal">
                  <FormattedMessage id="loans.calculator.target.principal" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Input fields */}
          <div className="grid grid-cols-2 gap-4">
            {calculateTarget !== 'principal' && (
              <div className="space-y-2">
                <Label htmlFor="calc-principal">
                  <FormattedMessage id="loans.form.principalAmount" />
                </Label>
                <Input
                  id="calc-principal"
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder="100000"
                  min={0}
                  step="1000"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="calc-rate">
                <FormattedMessage id="loans.form.interestRate" />
              </Label>
              <Input
                id="calc-rate"
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="7.5"
                min={0}
                max={100}
                step="0.1"
              />
            </div>

            {calculateTarget !== 'termMonths' && (
              <div className="space-y-2">
                <Label htmlFor="calc-term">
                  <FormattedMessage id="loans.form.termMonths" />
                </Label>
                <Input
                  id="calc-term"
                  type="number"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="240"
                  min={1}
                  step="1"
                />
              </div>
            )}

            {calculateTarget !== 'monthlyPayment' && (
              <div className="space-y-2">
                <Label htmlFor="calc-payment">
                  <FormattedMessage id="loans.form.monthlyPayment" />
                </Label>
                <Input
                  id="calc-payment"
                  type="number"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  placeholder="1500"
                  min={0}
                  step="100"
                />
              </div>
            )}
          </div>

          {/* Result */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                <FormattedMessage id={`loans.calculator.result.${calculateTarget}`} />
              </span>
              <span className="text-xl font-bold text-primary">
                {formatResult(calculatedValue, calculateTarget)}
              </span>
            </div>

            {totalCost !== null && totalInterest !== null && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    <FormattedMessage id="loans.calculator.totalCost" />
                  </span>
                  <span className="font-medium">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    <FormattedMessage id="loans.calculator.totalInterest" />
                  </span>
                  <span className="font-medium text-amber-600">{formatCurrency(totalInterest)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {onApply && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button onClick={handleApply} disabled={calculatedValue === null}>
              <FormattedMessage id="loans.calculator.apply" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
