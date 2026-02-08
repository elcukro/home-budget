'use client';

import { useIntl } from 'react-intl';
import Link from 'next/link';
import { Flame, Target } from 'lucide-react';
import FireGauge from '@/components/ai/FireGauge';
import SavingsRateDial from '@/components/ai/SavingsRateDial';
import BabyStepsStepper from '@/components/ai/BabyStepsStepper';

interface FireMetricsPanelProps {
  fireNumber?: number;
  currentSavings?: number;
  savingsRate?: number;
  currentBabyStep?: number;
  formatCurrency: (value: number) => string;
  className?: string;
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
      <div className={`rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 p-6 text-center ${className || ''}`}>
        <Flame className="h-8 w-8 text-orange-400 mx-auto mb-3" />
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

  return (
    <div className={`rounded-2xl border border-default bg-card shadow-sm p-5 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <Flame className="h-5 w-5 text-orange-500" />
        <h3 className="text-base font-semibold text-primary">
          {intl.formatMessage({ id: 'dashboard.fireMetrics.title' })}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* FIRE Gauge */}
        {hasFireData && (
          <div className="flex flex-col items-center">
            <FireGauge
              currentSavings={currentSavings ?? 0}
              fireNumber={fireNumber}
              formatCurrency={formatCurrency}
            />
            <p className="mt-2 text-xs text-secondary text-center">
              {intl.formatMessage({ id: 'dashboard.fireMetrics.fireGauge' })}
            </p>
            <p className="text-[10px] text-secondary">
              {intl.formatMessage(
                { id: 'dashboard.fireMetrics.targetSavings' },
                { amount: formatCurrency(fireNumber) }
              )}
            </p>
          </div>
        )}

        {/* Savings Rate Dial */}
        {hasSavingsRate && (
          <div className="flex flex-col items-center">
            <SavingsRateDial
              savingsRate={savingsRate}
              target={50}
            />
            <p className="mt-2 text-xs text-secondary text-center">
              {intl.formatMessage({ id: 'dashboard.fireMetrics.savingsRate' })}
            </p>
          </div>
        )}

        {/* Baby Steps Stepper */}
        {hasBabyStep && (
          <div className="flex flex-col items-center justify-center">
            <BabyStepsStepper currentStep={currentBabyStep} />
          </div>
        )}
      </div>

      {/* Link to full FIRE page */}
      <div className="mt-4 text-center">
        <Link
          href="/financial-freedom"
          className="text-xs font-medium text-primary hover:underline"
        >
          {intl.formatMessage({ id: 'dashboard.aiInsightsSection.viewFull' })} →
        </Link>
      </div>
    </div>
  );
};

export default FireMetricsPanel;
