'use client';

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';

const BABY_STEPS = [
  { step: 1, label: '$1,000 Emergency Fund' },
  { step: 2, label: 'Pay Off Debt' },
  { step: 3, label: '3-6 Month Emergency Fund' },
  { step: 4, label: 'Invest 15%' },
  { step: 5, label: 'College Fund' },
  { step: 6, label: 'Pay Off Home' },
  { step: 7, label: 'Build Wealth & Give' },
];

interface BabyStepsStepperProps {
  currentStep: number;
}

const BabyStepsStepper: React.FC<BabyStepsStepperProps> = ({ currentStep }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1">
        {BABY_STEPS.map(({ step }) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isFuture = step > currentStep;

          return (
            <div key={step} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all',
                  isCompleted && 'bg-success text-white',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2',
                  isFuture && 'bg-muted text-secondary'
                )}
              >
                {isCompleted ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  step
                )}
              </div>
              {/* Connector line */}
              {step < 7 && (
                <div className="hidden" />
              )}
            </div>
          );
        })}
      </div>
      {/* Connector bar */}
      <div className="relative mt-[-16px] mx-4 mb-2 -z-10">
        <div className="h-1 bg-muted rounded-full" />
        <div
          className="absolute top-0 left-0 h-1 bg-success rounded-full transition-all"
          style={{ width: `${Math.max(0, ((currentStep - 1) / 6) * 100)}%` }}
        />
      </div>
      <p className="text-center text-xs text-secondary mt-1">
        Baby Step {currentStep} of 7
      </p>
    </div>
  );
};

export default BabyStepsStepper;
