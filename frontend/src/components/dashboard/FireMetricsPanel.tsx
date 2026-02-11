'use client';

import { useIntl } from 'react-intl';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Flame, Target } from 'lucide-react';

interface FireMetricsPanelProps {
  fireNumber?: number;
  currentSavings?: number;
  savingsRate?: number;
  currentBabyStep?: number;
  formatCurrency: (value: number) => string;
  className?: string;
}

/* Compact SVG ring — 56px diameter, no chart.js */
function MiniRing({
  value,
  max,
  color,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const r = 22;
  const stroke = 5;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex items-center gap-3">
      <svg width="56" height="56" className="shrink-0 -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/40"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-bold text-primary tabular-nums">{label}</p>
        {sublabel && (
          <p className="text-[11px] text-secondary leading-tight truncate">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

const FireMetricsPanel: React.FC<FireMetricsPanelProps> = ({
  fireNumber,
  currentSavings,
  savingsRate,
  currentBabyStep,
  formatCurrency,
  className,
}) => {
  const intl = useIntl();

  const hasFireData = fireNumber !== undefined && fireNumber > 0;
  const hasSavingsRate = savingsRate !== undefined;
  const hasBabyStep = currentBabyStep !== undefined && currentBabyStep > 0;

  // If no metrics at all, show a CTA
  if (!hasFireData && !hasSavingsRate && !hasBabyStep) {
    return (
      <div className={`rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 p-5 text-center ${className || ''}`}>
        <Flame className="h-7 w-7 text-orange-400 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-orange-700 mb-1">
          {intl.formatMessage({ id: 'dashboard.fireMetrics.noFireGoal' })}
        </h3>
        <Link
          href="/financial-freedom"
          className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Target className="h-3.5 w-3.5" />
          {intl.formatMessage({ id: 'dashboard.fireMetrics.setupFire' })}
        </Link>
      </div>
    );
  }

  // FIRE progress %
  const firePercent = hasFireData && fireNumber > 0
    ? Math.min(100, ((currentSavings ?? 0) / fireNumber) * 100)
    : 0;
  const fireColor = firePercent >= 75 ? '#22c55e' : firePercent >= 50 ? '#eab308' : firePercent >= 25 ? '#f97316' : '#ef4444';

  // Savings rate color
  const rateTarget = 50;
  const rateColor = (savingsRate ?? 0) >= rateTarget ? '#22c55e' : (savingsRate ?? 0) >= rateTarget * 0.5 ? '#eab308' : '#ef4444';

  return (
    <div className={`rounded-2xl border border-default bg-card shadow-sm px-5 py-4 ${className || ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-primary">
            {intl.formatMessage({ id: 'dashboard.fireMetrics.title' })}
          </h3>
        </div>
        <Link
          href="/financial-freedom"
          className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-primary transition-colors"
        >
          {intl.formatMessage({ id: 'dashboard.aiInsightsSection.viewFull' })}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* FIRE progress */}
        {hasFireData && (
          <MiniRing
            value={firePercent}
            max={100}
            color={fireColor}
            label={`${firePercent.toFixed(0)}% FIRE`}
            sublabel={intl.formatMessage(
              { id: 'dashboard.fireMetrics.targetSavings' },
              { amount: formatCurrency(fireNumber) }
            )}
          />
        )}

        {/* Savings rate */}
        {hasSavingsRate && (
          <MiniRing
            value={savingsRate}
            max={100}
            color={rateColor}
            label={`${savingsRate.toFixed(1)}%`}
            sublabel={intl.formatMessage({ id: 'dashboard.fireMetrics.savingsRate' })}
          />
        )}

        {/* Baby Steps — compact inline */}
        {hasBabyStep && (
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 shrink-0">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                <div
                  key={step}
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
                    step < currentBabyStep
                      ? 'bg-emerald-500 text-white'
                      : step === currentBabyStep
                        ? 'bg-primary text-primary-foreground ring-1 ring-primary/30'
                        : 'bg-muted text-secondary'
                  }`}
                >
                  {step < currentBabyStep ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    step
                  )}
                </div>
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">
                {intl.formatMessage(
                  { id: 'dashboard.fireMetrics.babyStepCurrent' },
                  { step: currentBabyStep }
                )}
              </p>
              <p className="text-[11px] text-secondary leading-tight">Baby Steps</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FireMetricsPanel;
