'use client';

import { useState, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import Link from 'next/link';
import {
  ArrowRight,
  Flame,
  Target,
  Calendar,
  Wallet,
  Zap,
  TrendingUp,
  X,
} from 'lucide-react';

interface BabyStep {
  id: number;
  progress: number;   // 0-100
  isCompleted: boolean;
}

interface FireMetricsPanelProps {
  fireNumber?: number;
  currentSavings?: number;
  savingsRate?: number;
  currentBabyStep?: number;
  babySteps?: BabyStep[];
  /** Monthly net cashflow — used to compute years to FIRE */
  monthlyNetSavings?: number;
  formatCurrency: (value: number) => string;
  className?: string;
}

/* Compact SVG ring — configurable diameter */
function ProgressRing({
  value,
  max,
  color,
  size = 56,
  strokeWidth = 5,
  label,
  sublabel,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor"
          strokeWidth={strokeWidth} className="text-muted/40" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700" />
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

/* Color scale based on progress percentage */
function stepRingColor(progress: number, isCompleted: boolean): { arc: string; label: string } {
  if (isCompleted || progress >= 100) return { arc: '#22c55e', label: '#16a34a' };
  if (progress >= 90) return { arc: '#4ade80', label: '#15803d' };
  if (progress >= 75) return { arc: '#86efac', label: '#16a34a' };
  if (progress >= 50) return { arc: '#eab308', label: '#a16207' };
  if (progress >= 15) return { arc: '#f97316', label: '#c2410c' };
  if (progress > 0)   return { arc: '#ef4444', label: '#b91c1c' };
  return { arc: '', label: '#94a3b8' };
}

/* Mini step ring — 32px, shows individual baby step progress + tooltip */
function StepRing({ step, tooltip }: { step: BabyStep; tooltip: string }) {
  const size = 32;
  const strokeWidth = 3;
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const C = 2 * Math.PI * r;
  const pct = step.isCompleted ? 1 : Math.min(1, Math.max(0, step.progress / 100));
  const offset = C * (1 - pct);
  const { arc: color, label: labelColor } = stepRingColor(step.progress, step.isCompleted);

  return (
    <div className="group relative flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor"
          strokeWidth={strokeWidth} className="text-muted/30" />
        {(step.isCompleted || step.progress > 0) && (
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset}
            className="transition-all duration-700" />
        )}
      </svg>
      <span
        className="absolute text-[9px] font-bold leading-none"
        style={{ color: labelColor }}
      >
        {step.isCompleted ? '✓' : step.id}
      </span>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
                      invisible group-hover:visible opacity-0 group-hover:opacity-100
                      transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="rounded-md bg-popover border border-default shadow-md px-2.5 py-1.5 text-left">
          <p className="text-[11px] font-semibold text-primary leading-tight">{tooltip}</p>
          <p className="text-[10px] mt-0.5" style={{ color: labelColor }}>
            {step.isCompleted
              ? '✓ Ukończony'
              : step.progress > 0
                ? `${step.progress.toFixed(0)}%`
                : 'Nie rozpoczęty'}
          </p>
        </div>
        {/* Arrow */}
        <div className="mx-auto w-2 h-1 overflow-hidden">
          <div className="w-2 h-2 bg-popover border-l border-b border-default rotate-45 -translate-y-1 mx-auto" />
        </div>
      </div>
    </div>
  );
}

type InsightAccent = 'sky' | 'purple' | 'amber' | 'emerald';

const ACCENT_CLASSES: Record<InsightAccent, { wrap: string; icon: string; value: string; sub: string }> = {
  sky:     { wrap: 'border-sky-100 bg-sky-50/40',        icon: 'text-sky-600',     value: 'text-sky-900',     sub: 'text-sky-600' },
  purple:  { wrap: 'border-purple-100 bg-purple-50/40',  icon: 'text-purple-600',  value: 'text-purple-900',  sub: 'text-purple-600' },
  amber:   { wrap: 'border-amber-100 bg-amber-50/40',    icon: 'text-amber-600',   value: 'text-amber-900',   sub: 'text-amber-600' },
  emerald: { wrap: 'border-emerald-100 bg-emerald-50/40', icon: 'text-emerald-600', value: 'text-emerald-900', sub: 'text-emerald-600' },
};

function InsightTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  info,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: InsightAccent;
  info?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cls = ACCENT_CLASSES[accent];

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={`rounded-xl border px-3 py-2.5 ${cls.wrap} relative`}>
      <div className={`flex items-center gap-1.5 mb-1 ${cls.icon}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wide truncate">{label}</span>
        {info && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Wyjaśnienie"
            className="ml-auto shrink-0 w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px] font-bold opacity-50 hover:opacity-90 transition-opacity focus:outline-none"
          >
            ?
          </button>
        )}
      </div>
      <p className={`text-sm font-bold tabular-nums ${cls.value}`}>{value}</p>
      <p className={`text-[10px] leading-tight mt-0.5 ${cls.sub}`}>{sub}</p>

      {info && open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72
                        rounded-xl bg-popover border border-default shadow-xl p-3 text-left">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 text-secondary hover:text-primary transition-colors"
            aria-label="Zamknij"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {info}
          {/* Arrow pointing down */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3
                          bg-popover border-r border-b border-default rotate-45" />
        </div>
      )}
    </div>
  );
}

const ANNUAL_RETURN = 0.07;

const FireMetricsPanel: React.FC<FireMetricsPanelProps> = ({
  fireNumber,
  currentSavings,
  savingsRate,
  currentBabyStep,
  babySteps,
  monthlyNetSavings,
  formatCurrency,
  className,
}) => {
  const intl = useIntl();

  const hasFireData = fireNumber !== undefined && fireNumber > 0;
  const hasSavingsRate = savingsRate !== undefined;

  // Derive baby steps display — prefer real per-step data, fall back to currentBabyStep
  const steps: BabyStep[] = babySteps && babySteps.length === 7
    ? babySteps
    : [1, 2, 3, 4, 5, 6, 7].map((id) => ({
        id,
        progress: currentBabyStep !== undefined && id < currentBabyStep ? 100 : 0,
        isCompleted: currentBabyStep !== undefined && id < currentBabyStep,
      }));

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const hasAnyStepData = completedCount > 0 || steps.some((s) => s.progress > 0);
  const hasBabySteps = babySteps !== undefined || (currentBabyStep !== undefined && currentBabyStep > 0);

  // Current active step (first not-completed)
  const activeStep = steps.find((s) => !s.isCompleted);
  const activeStepName = activeStep
    ? intl.formatMessage({
        id: `financialFreedom.steps.step${activeStep.id}.title`,
        defaultMessage: `Krok ${activeStep.id}`,
      })
    : '';

  if (!hasFireData && !hasSavingsRate && !hasBabySteps) {
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
  const firePercent = hasFireData
    ? Math.min(100, ((currentSavings ?? 0) / fireNumber) * 100)
    : 0;
  const fireColor =
    firePercent >= 75 ? '#22c55e' :
    firePercent >= 50 ? '#eab308' :
    firePercent >= 25 ? '#f97316' : '#ef4444';

  // Savings rate
  const rateTarget = 50;
  const rateColor =
    (savingsRate ?? 0) >= rateTarget ? '#22c55e' :
    (savingsRate ?? 0) >= rateTarget * 0.5 ? '#eab308' : '#ef4444';

  // ── Derived metrics ───────────────────────────────────────────
  const monthlyRate = ANNUAL_RETURN / 12;

  let yearsToFire: number | null = null;
  if (hasFireData && monthlyNetSavings && monthlyNetSavings > 0) {
    const savings = currentSavings ?? 0;
    if (savings >= fireNumber) {
      yearsToFire = 0;
    } else {
      const numerator = fireNumber * monthlyRate + monthlyNetSavings;
      const denominator = savings * monthlyRate + monthlyNetSavings;
      if (denominator > 0 && numerator > 0) {
        const months = Math.log(numerator / denominator) / Math.log(1 + monthlyRate);
        yearsToFire = Math.max(0, months / 12);
      }
    }
  }

  const monthlyPassiveIncome = hasFireData ? (fireNumber * 0.04) / 12 : 0;
  const coastFireNumber = hasFireData ? fireNumber / Math.pow(1 + ANNUAL_RETURN, 20) : 0;
  const hasCoastFire = hasFireData && (currentSavings ?? 0) >= coastFireNumber;
  const showDerivedRow = hasFireData;

  return (
    <div className={`rounded-2xl border border-default bg-card shadow-sm px-5 py-4 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Row 1: Core metric rings + baby steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* FIRE progress ring */}
        {hasFireData && (
          <ProgressRing
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

        {/* Savings rate ring */}
        {hasSavingsRate && (
          <ProgressRing
            value={savingsRate}
            max={100}
            color={rateColor}
            label={`${savingsRate.toFixed(1)}%`}
            sublabel={intl.formatMessage({ id: 'dashboard.fireMetrics.savingsRate' })}
          />
        )}

        {/* Baby Steps — 7 mini progress rings + count */}
        {hasBabySteps && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              {steps.map((step) => (
                <StepRing
                  key={step.id}
                  step={step}
                  tooltip={intl.formatMessage({
                    id: `financialFreedom.steps.step${step.id}.title`,
                    defaultMessage: `Krok ${step.id}`,
                  })}
                />
              ))}
            </div>
            <div>
              <p className="text-sm font-bold text-primary">
                {intl.formatMessage(
                  { id: 'dashboard.fireMetrics.stepsCompleted' },
                  { count: completedCount }
                )}
              </p>
              {activeStepName && !hasAnyStepData && completedCount === 0 ? (
                <p className="text-[11px] text-secondary leading-tight">Baby Steps</p>
              ) : (
                <p className="text-[11px] text-secondary leading-tight line-clamp-2">
                  {activeStepName || 'Baby Steps'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Derived FIRE insights */}
      {showDerivedRow && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-default/60">
          <InsightTile
            icon={Calendar}
            label={intl.formatMessage({ id: 'dashboard.fireMetrics.yearsToFire' })}
            value={
              yearsToFire === null
                ? intl.formatMessage({ id: 'dashboard.fireMetrics.increasesSavings' })
                : yearsToFire === 0
                  ? intl.formatMessage({ id: 'dashboard.fireMetrics.fireReached' })
                  : intl.formatMessage(
                      { id: 'dashboard.fireMetrics.yearsValue' },
                      { years: yearsToFire.toFixed(1) }
                    )
            }
            sub={intl.formatMessage(
              { id: 'dashboard.fireMetrics.atReturn' },
              { rate: (ANNUAL_RETURN * 100).toFixed(0) }
            )}
            accent="sky"
          />

          <InsightTile
            icon={Wallet}
            label={intl.formatMessage({ id: 'dashboard.fireMetrics.passiveIncome' })}
            value={formatCurrency(monthlyPassiveIncome)}
            sub={intl.formatMessage({ id: 'dashboard.fireMetrics.passiveIncomeSub' })}
            accent="purple"
          />

          <InsightTile
            icon={hasCoastFire ? Zap : TrendingUp}
            label="Coast FIRE"
            value={
              hasCoastFire
                ? intl.formatMessage({ id: 'dashboard.fireMetrics.coastReached' })
                : formatCurrency(coastFireNumber)
            }
            sub={
              hasCoastFire
                ? intl.formatMessage({ id: 'dashboard.fireMetrics.coastReachedSub' })
                : intl.formatMessage(
                    { id: 'dashboard.fireMetrics.coastNeeded' },
                    { missing: formatCurrency(Math.max(0, coastFireNumber - (currentSavings ?? 0))) }
                  )
            }
            accent={hasCoastFire ? 'emerald' : 'amber'}
            info={
              <div className="pr-4">
                <p className="text-[12px] font-semibold text-primary mb-1.5">
                  {intl.formatMessage({ id: 'dashboard.fireMetrics.coastFireTooltip.title' })}
                </p>
                <p className="text-[11px] text-secondary leading-snug mb-2">
                  {intl.formatMessage({ id: 'dashboard.fireMetrics.coastFireTooltip.what' })}
                </p>
                <p className="text-[11px] text-secondary leading-snug mb-2">
                  {intl.formatMessage({ id: 'dashboard.fireMetrics.coastFireTooltip.means' })}
                </p>
                <p className="text-[10px] font-mono bg-muted/60 rounded px-2 py-1 text-primary mb-1.5">
                  {intl.formatMessage({ id: 'dashboard.fireMetrics.coastFireTooltip.formula' })}
                </p>
                <p className="text-[10px] text-secondary/70 italic">
                  {intl.formatMessage({ id: 'dashboard.fireMetrics.coastFireTooltip.horizon' })}
                </p>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
};

export default FireMetricsPanel;
