'use client';

import { useState, useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PiggyBank, Calendar, TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavingsGoalSimProps {
  className?: string;
}

export default function SavingsGoalSim({ className }: SavingsGoalSimProps) {
  const intl = useIntl();
  const { formatCurrency } = useSettings();

  const [goalAmount, setGoalAmount] = useState(50000);
  const [targetMonths, setTargetMonths] = useState(24);
  const [currentSaved, setCurrentSaved] = useState(0);
  const [annualReturn, setAnnualReturn] = useState(3);

  const simulation = useMemo(() => {
    if (goalAmount <= 0 || targetMonths <= 0) return null;

    const remaining = Math.max(0, goalAmount - currentSaved);
    if (remaining <= 0) {
      return {
        monthlyRequired: 0,
        totalInterest: 0,
        milestones: [],
        goalAchievable: true,
        alreadyReached: true,
      };
    }

    const monthlyRate = annualReturn / 100 / 12;
    let monthlyRequired: number;

    if (monthlyRate > 0) {
      // PMT = (FV - PV*(1+r)^n) / (((1+r)^n - 1) / r)
      const compoundFactor = Math.pow(1 + monthlyRate, targetMonths);
      const futureValueOfCurrent = currentSaved * compoundFactor;
      const amountNeeded = goalAmount - futureValueOfCurrent;

      if (amountNeeded <= 0) {
        // Current savings + compound growth already reach the goal
        return {
          monthlyRequired: 0,
          totalInterest: futureValueOfCurrent - currentSaved,
          milestones: [],
          goalAchievable: true,
          alreadyReached: false,
        };
      }

      monthlyRequired = amountNeeded / ((compoundFactor - 1) / monthlyRate);
    } else {
      monthlyRequired = remaining / targetMonths;
    }

    // Calculate total contributions and interest
    const totalContributions = monthlyRequired * targetMonths;
    const totalInterest = goalAmount - currentSaved - totalContributions;

    // Calculate milestones (25%, 50%, 75%, 100%)
    const milestones: { percent: number; month: number }[] = [];
    const milestoneTargets = [25, 50, 75, 100];

    let balance = currentSaved;
    for (let month = 1; month <= targetMonths; month++) {
      if (monthlyRate > 0) {
        balance = balance * (1 + monthlyRate) + monthlyRequired;
      } else {
        balance += monthlyRequired;
      }
      const percentComplete = (balance / goalAmount) * 100;

      for (const target of milestoneTargets) {
        if (percentComplete >= target && !milestones.find(m => m.percent === target)) {
          milestones.push({ percent: target, month });
        }
      }
    }

    return {
      monthlyRequired: Math.max(0, monthlyRequired),
      totalInterest: Math.max(0, totalInterest),
      milestones,
      goalAchievable: monthlyRequired >= 0,
      alreadyReached: false,
    };
  }, [goalAmount, targetMonths, currentSaved, annualReturn]);

  const handleGoalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGoalAmount(Number(e.target.value));
  }, []);

  const handleMonthsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetMonths(Number(e.target.value));
  }, []);

  const handleCurrentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentSaved(Number(e.target.value));
  }, []);

  const handleReturnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAnnualReturn(Number(e.target.value));
  }, []);

  return (
    <Card className={cn('rounded-2xl border border-default shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <PiggyBank className="h-5 w-5 text-emerald-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-primary">
            {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.title' })}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Goal amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.goalAmount' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(goalAmount)}
            </span>
          </div>
          <input
            type="range"
            min={5000}
            max={500000}
            step={5000}
            value={goalAmount}
            onChange={handleGoalChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.savings.goalAmount' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>{formatCurrency(5000)}</span>
            <span>{formatCurrency(500000)}</span>
          </div>
        </div>

        {/* Target months */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.targetMonths' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">
              {targetMonths} {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.monthsLabel' })}
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={120}
            step={3}
            value={targetMonths}
            onChange={handleMonthsChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.savings.targetMonths' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>3</span>
            <span>120</span>
          </div>
        </div>

        {/* Current saved */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.currentSaved' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">
              {formatCurrency(currentSaved)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(goalAmount, 10000)}
            step={1000}
            value={currentSaved}
            onChange={handleCurrentChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.savings.currentSaved' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(Math.max(goalAmount, 10000))}</span>
          </div>
        </div>

        {/* Expected return */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.annualReturn' })}
            </label>
            <span className="text-sm font-bold text-primary tabular-nums">{annualReturn}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={annualReturn}
            onChange={handleReturnChange}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
            aria-label={intl.formatMessage({ id: 'aiAnalysis.simulators.savings.annualReturn' })}
          />
          <div className="flex justify-between text-[10px] text-secondary mt-0.5">
            <span>0%</span>
            <span>10%</span>
          </div>
        </div>

        {/* Results */}
        {simulation && (
          <div className={cn(
            'rounded-xl border p-4 space-y-4',
            simulation.alreadyReached
              ? 'border-success/30 bg-success/5'
              : 'border-emerald-200 bg-emerald-50/50',
          )}>
            {simulation.alreadyReached ? (
              <div className="text-center py-2">
                <PiggyBank className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-lg font-bold text-success">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.goalReached' })}
                </p>
              </div>
            ) : (
              <>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.results' })}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <Target className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-emerald-600 tabular-nums">
                      {formatCurrency(Math.round(simulation.monthlyRequired))}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.monthlyRequired' })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold text-primary tabular-nums">
                      {formatCurrency(Math.round(simulation.totalInterest))}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.interestEarned' })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3 text-center">
                    <Calendar className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-sm font-bold text-blue-600">
                      {simulation.milestones.find(m => m.percent === 50)
                        ? `${intl.formatMessage({ id: 'aiAnalysis.simulators.savings.month' })} ${simulation.milestones.find(m => m.percent === 50)!.month}`
                        : '---'}
                    </p>
                    <p className="text-[10px] text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.halfwayMilestone' })}
                    </p>
                  </div>
                </div>

                {/* Milestones timeline */}
                {simulation.milestones.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-secondary">
                      {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.milestones' })}
                    </p>
                    <div className="flex items-center gap-1">
                      {simulation.milestones.map((m) => (
                        <div key={m.percent} className="flex-1">
                          <div className="text-center">
                            <div className={cn(
                              'h-2 rounded-full',
                              m.percent <= 25 ? 'bg-emerald-200' :
                              m.percent <= 50 ? 'bg-emerald-300' :
                              m.percent <= 75 ? 'bg-emerald-400' :
                              'bg-emerald-500',
                            )} />
                            <p className="text-[9px] text-secondary mt-0.5">
                              {m.percent}% &middot; {intl.formatMessage({ id: 'aiAnalysis.simulators.savings.month' })} {m.month}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
