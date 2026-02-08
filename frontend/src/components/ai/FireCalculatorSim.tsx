'use client';

import { useState, useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, TrendingUp, Clock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FireCalculatorSimProps {
  prefillAnnualExpenses?: number;
  prefillCurrentSavings?: number;
  prefillMonthlySavings?: number;
  className?: string;
}

export default function FireCalculatorSim({
  prefillAnnualExpenses,
  prefillCurrentSavings,
  prefillMonthlySavings,
  className,
}: FireCalculatorSimProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();

  const [annualExpenses, setAnnualExpenses] = useState(prefillAnnualExpenses ?? 60000);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [currentSavings, setCurrentSavings] = useState(prefillCurrentSavings ?? 0);
  const [monthlySavings, setMonthlySavings] = useState(prefillMonthlySavings ?? 2000);
  const [expectedReturn, setExpectedReturn] = useState(7);

  const simulation = useMemo(() => {
    if (withdrawalRate <= 0 || annualExpenses <= 0) return null;

    const fireNumber = annualExpenses / (withdrawalRate / 100);
    const progressPercent = fireNumber > 0 ? Math.min(100, (currentSavings / fireNumber) * 100) : 0;

    // Calculate years to FIRE using compound growth formula
    let yearsToFire: number | null = null;
    if (monthlySavings > 0 && fireNumber > currentSavings) {
      const monthlyReturn = expectedReturn / 100 / 12;
      if (monthlyReturn > 0) {
        // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
        // We need to find n where FV >= fireNumber
        // Solve iteratively
        let balance = currentSavings;
        let months = 0;
        const maxMonths = 1200; // 100 years
        while (balance < fireNumber && months < maxMonths) {
          balance = balance * (1 + monthlyReturn) + monthlySavings;
          months++;
        }
        yearsToFire = months < maxMonths ? months / 12 : null;
      } else {
        // No return: simple accumulation
        const remaining = fireNumber - currentSavings;
        yearsToFire = remaining / (monthlySavings * 12);
      }
    } else if (currentSavings >= fireNumber) {
      yearsToFire = 0;
    }

    return {
      fireNumber,
      progressPercent,
      yearsToFire,
      alreadyFire: currentSavings >= fireNumber,
    };
  }, [annualExpenses, withdrawalRate, currentSavings, monthlySavings, expectedReturn]);

  const handleExpensesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAnnualExpenses(Number(e.target.value));
  }, []);

  const handleWithdrawalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWithdrawalRate(Number(e.target.value));
  }, []);

  const handleSavingsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentSavings(Number(e.target.value));
  }, []);

  const handleMonthlySavingsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMonthlySavings(Number(e.target.value));
  }, []);

  const handleReturnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExpectedReturn(Number(e.target.value));
  }, []);

  return (
    <Card className={cn('rounded-2xl border border-default shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
            <Flame className="h-5 w-5 text-orange-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-primary">
            {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.title' })}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Annual Expenses */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.annualExpenses' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(annualExpenses)}
            </span>
          </div>
          <input
            type="range"
            min={12000}
            max={300000}
            step={6000}
            value={annualExpenses}
            onChange={handleExpensesChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.fire.annualExpenses' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>{formatCurrency(12000)}</span>
            <span>{formatCurrency(300000)}</span>
          </div>
        </div>

        {/* Withdrawal Rate */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.withdrawalRate' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">{withdrawalRate}%</span>
          </div>
          <input
            type="range"
            min={2}
            max={6}
            step={0.5}
            value={withdrawalRate}
            onChange={handleWithdrawalChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.fire.withdrawalRate' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>2%</span>
            <span>6%</span>
          </div>
        </div>

        {/* Current Savings */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.currentSavings' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(currentSavings)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2000000}
            step={10000}
            value={currentSavings}
            onChange={handleSavingsChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.fire.currentSavings' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(2000000)}</span>
          </div>
        </div>

        {/* Monthly Savings */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.monthlySavings' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(monthlySavings)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={15000}
            step={250}
            value={monthlySavings}
            onChange={handleMonthlySavingsChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.fire.monthlySavings' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(15000)}</span>
          </div>
        </div>

        {/* Expected Annual Return */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.expectedReturn' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">{expectedReturn}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={expectedReturn}
            onChange={handleReturnChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.fire.expectedReturn' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>0%</span>
            <span>12%</span>
          </div>
        </div>

        {/* Results */}
        {simulation && (
          <div className={cn(
            'rounded-xl border p-4 space-y-4',
            simulation.alreadyFire
              ? 'border-success/30 bg-success/5'
              : 'border-orange-200 bg-orange-50/50',
          )}>
            {simulation.alreadyFire ? (
              <div className="text-center py-2">
                <Flame className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-lg font-bold text-success">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.congratulations' })}
                </p>
                <p className="text-sm text-secondary">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.reachedFire' })}
                </p>
              </div>
            ) : (
              <>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.results' })}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <Target className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-orange-600 tabular-nums">
                      {simulation.fireNumber >= 1000000
                        ? `${(simulation.fireNumber / 1000000).toFixed(1)}M`
                        : formatCurrency(simulation.fireNumber)}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.fireNumberLabel' })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold text-primary tabular-nums">
                      {simulation.progressPercent.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.progress' })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-blue-600 tabular-nums">
                      {simulation.yearsToFire !== null
                        ? simulation.yearsToFire < 1
                          ? `< 1`
                          : simulation.yearsToFire.toFixed(1)
                        : '---'}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.yearsToFire' })}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.fire.progress' })}
                    </span>
                    <span className="font-medium text-orange-600 tabular-nums">
                      {formatCurrency(currentSavings)} / {formatCurrency(simulation.fireNumber)}
                    </span>
                  </div>
                  <Progress
                    value={simulation.progressPercent}
                    className="h-3"
                    indicatorClassName="bg-gradient-to-r from-orange-400 to-orange-600"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
