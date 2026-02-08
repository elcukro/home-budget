'use client';

import { useState, useMemo } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Flame, TrendingUp, Calendar, PiggyBank } from 'lucide-react';

interface FIRECalculatorProps {
  monthlyExpenses?: number;
  currentSavings?: number;
  monthlyInvestment?: number;
}

export default function FIRECalculator({
  monthlyExpenses: initialExpenses = 8000,
  currentSavings: initialSavings = 0,
  monthlyInvestment: initialInvestment = 2000,
}: FIRECalculatorProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();

  const [monthlyExpenses, setMonthlyExpenses] = useState(initialExpenses);
  const [currentSavings, setCurrentSavings] = useState(initialSavings);
  const [monthlyInvestment, setMonthlyInvestment] = useState(initialInvestment);
  const [annualReturn, setAnnualReturn] = useState(7); // Default 7% annual return

  const calculations = useMemo(() => {
    // FIRE Number = Annual Expenses × 25 (based on 4% safe withdrawal rate)
    const annualExpenses = monthlyExpenses * 12;
    const fireNumber = annualExpenses * 25;

    // Progress percentage
    const progress = Math.min((currentSavings / fireNumber) * 100, 100);

    // Years to FIRE with compound interest
    // Formula: n = log((FV * r + PMT) / (PV * r + PMT)) / log(1 + r)
    const monthlyRate = annualReturn / 100 / 12;
    let yearsToFire: number | null = null;

    if (monthlyInvestment > 0 && monthlyRate > 0) {
      if (currentSavings >= fireNumber) {
        yearsToFire = 0;
      } else {
        const numerator = fireNumber * monthlyRate + monthlyInvestment;
        const denominator = currentSavings * monthlyRate + monthlyInvestment;

        if (denominator > 0 && numerator > 0) {
          const monthsToFire = Math.log(numerator / denominator) / Math.log(1 + monthlyRate);
          yearsToFire = Math.max(0, monthsToFire / 12);
        }
      }
    }

    // Calculate projected savings in 5, 10, 20, 30 years
    const projectSavings = (years: number): number => {
      const months = years * 12;
      if (monthlyRate > 0) {
        const compoundFactor = Math.pow(1 + monthlyRate, months);
        return currentSavings * compoundFactor +
          monthlyInvestment * ((compoundFactor - 1) / monthlyRate);
      }
      return currentSavings + monthlyInvestment * months;
    };

    // Monthly passive income when FIRE is reached (4% rule)
    const monthlyPassiveIncome = (fireNumber * 0.04) / 12;

    // Coast FIRE Number - amount needed today to reach FIRE without additional contributions
    // Assumes reaching FIRE in 20 years with compound growth
    const yearsToCoast = 20;
    const coastFireNumber = fireNumber / Math.pow(1 + annualReturn / 100, yearsToCoast);

    return {
      fireNumber,
      annualExpenses,
      progress,
      yearsToFire,
      projections: {
        in5Years: projectSavings(5),
        in10Years: projectSavings(10),
        in20Years: projectSavings(20),
        in30Years: projectSavings(30),
      },
      monthlyPassiveIncome,
      coastFireNumber,
    };
  }, [monthlyExpenses, currentSavings, monthlyInvestment, annualReturn]);

  return (
    <Card className="rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <Flame className="h-6 w-6 text-orange-500" />
          <FormattedMessage id="fireCalculator.title" defaultMessage="FIRE Calculator" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          <FormattedMessage
            id="fireCalculator.subtitle"
            defaultMessage="Calculate your Financial Independence, Retire Early (FIRE) number"
          />
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="monthly-expenses" className="text-sm font-medium">
              <FormattedMessage id="fireCalculator.monthlyExpenses" defaultMessage="Monthly Expenses" />
            </Label>
            <CurrencyInput
              id="monthly-expenses"
              value={monthlyExpenses}
              onValueChange={setMonthlyExpenses}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-savings" className="text-sm font-medium">
              <FormattedMessage id="fireCalculator.currentSavings" defaultMessage="Current Savings" />
            </Label>
            <CurrencyInput
              id="current-savings"
              value={currentSavings}
              onValueChange={setCurrentSavings}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthly-investment" className="text-sm font-medium">
              <FormattedMessage id="fireCalculator.monthlyInvestment" defaultMessage="Monthly Investment" />
            </Label>
            <CurrencyInput
              id="monthly-investment"
              value={monthlyInvestment}
              onValueChange={setMonthlyInvestment}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annual-return" className="text-sm font-medium">
              <FormattedMessage id="fireCalculator.annualReturn" defaultMessage="Expected Annual Return (%)" />
            </Label>
            <Input
              id="annual-return"
              type="number"
              value={annualReturn}
              onChange={(e) => setAnnualReturn(Number(e.target.value))}
              className="rounded-xl"
              min={0}
              max={30}
              step={0.5}
            />
          </div>
        </div>

        {/* Results Section */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* FIRE Number */}
          <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <Flame className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">
                <FormattedMessage id="fireCalculator.fireNumber" defaultMessage="Your FIRE Number" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-orange-900">
              {formatCurrency(calculations.fireNumber)}
            </p>
            <p className="text-xs text-orange-600">
              <FormattedMessage id="fireCalculator.fireFormula" defaultMessage="= Annual expenses × 25" />
            </p>
          </div>

          {/* Years to FIRE */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <Calendar className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">
                <FormattedMessage id="fireCalculator.yearsToFire" defaultMessage="Years to FIRE" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-900">
              {calculations.yearsToFire !== null ? (
                calculations.yearsToFire === 0 ? (
                  <FormattedMessage id="fireCalculator.fireReached" defaultMessage="Already reached!" />
                ) : (
                  `${calculations.yearsToFire.toFixed(1)} ${intl.formatMessage({ id: 'common.years', defaultMessage: 'years' })}`
                )
              ) : (
                <FormattedMessage id="fireCalculator.notCalculable" defaultMessage="N/A" />
              )}
            </p>
            <p className="text-xs text-emerald-600">
              <FormattedMessage id="fireCalculator.withCompoundInterest" defaultMessage="With compound interest" />
            </p>
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <div className="flex items-center gap-2 text-sky-700">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">
                <FormattedMessage id="fireCalculator.progress" defaultMessage="Progress" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-sky-900">
              {calculations.progress.toFixed(1)}%
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-sky-200">
              <div
                className="h-2 rounded-full bg-sky-500 transition-all duration-500"
                style={{ width: `${calculations.progress}%` }}
              />
            </div>
          </div>

          {/* Monthly Passive Income */}
          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
            <div className="flex items-center gap-2 text-purple-700">
              <PiggyBank className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide font-medium">
                <FormattedMessage id="fireCalculator.monthlyPassiveIncome" defaultMessage="Monthly Passive Income" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-purple-900">
              {formatCurrency(calculations.monthlyPassiveIncome)}
            </p>
            <p className="text-xs text-purple-600">
              <FormattedMessage id="fireCalculator.whenFireReached" defaultMessage="When FIRE is reached (4% rule)" />
            </p>
          </div>
        </div>

        {/* Projections Section */}
        <div className="rounded-2xl border border-muted/50 bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            <FormattedMessage id="fireCalculator.projections" defaultMessage="Projected Portfolio Value" />
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-2 rounded-xl bg-white/50">
              <p className="text-xs text-muted-foreground">
                <FormattedMessage id="fireCalculator.in5Years" defaultMessage="In 5 years" />
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(calculations.projections.in5Years)}
              </p>
            </div>
            <div className="text-center p-2 rounded-xl bg-white/50">
              <p className="text-xs text-muted-foreground">
                <FormattedMessage id="fireCalculator.in10Years" defaultMessage="In 10 years" />
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(calculations.projections.in10Years)}
              </p>
            </div>
            <div className="text-center p-2 rounded-xl bg-white/50">
              <p className="text-xs text-muted-foreground">
                <FormattedMessage id="fireCalculator.in20Years" defaultMessage="In 20 years" />
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(calculations.projections.in20Years)}
              </p>
            </div>
            <div className="text-center p-2 rounded-xl bg-white/50">
              <p className="text-xs text-muted-foreground">
                <FormattedMessage id="fireCalculator.in30Years" defaultMessage="In 30 years" />
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(calculations.projections.in30Years)}
              </p>
            </div>
          </div>
        </div>

        {/* Coast FIRE Info */}
        <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">
            <FormattedMessage id="fireCalculator.coastFireTitle" defaultMessage="Coast FIRE Number" />
          </h4>
          <p className="text-2xl font-bold text-amber-800">
            {formatCurrency(calculations.coastFireNumber)}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            <FormattedMessage
              id="fireCalculator.coastFireDescription"
              defaultMessage="If you have this amount today, you can stop contributing and still reach FIRE in 20 years with {rate}% annual returns."
              values={{ rate: annualReturn }}
            />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
