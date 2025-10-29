'use client';

import { useIntl } from 'react-intl';
import { BabyStep } from '@/types/financial-freedom';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface BabyStepsProgressProps {
  steps: BabyStep[];
  activeStepId: number;
}

export default function BabyStepsProgress({ steps, activeStepId }: BabyStepsProgressProps) {
  const intl = useIntl();

  return (
    <div className="w-full bg-card border border-default rounded-lg shadow-sm p-6">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-primary mb-2 sm:mb-0">
          {intl.formatMessage({ id: 'financialFreedom.progressTracker' })}
        </h2>
      </div>
      
      <div className="relative">
        {/* Progress Bar */}
        <div className="h-2 bg-muted rounded-full mb-8">
          <div 
            className="h-2 bg-primary rounded-full"
            style={{ 
              width: `${Math.max(
                (steps.filter(step => step.isCompleted).length / steps.length) * 100,
                (steps.find(step => step.id === activeStepId)?.progress || 0) / steps.length
              )}%` 
            }}
          ></div>
        </div>
        
        {/* Step Markers */}
        <div className="flex justify-between w-full absolute -top-1">
          {steps.map((step) => {
            const isActive = step.id === activeStepId;
            const isCompleted = step.isCompleted;
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div 
                  className={`w-6 h-6 rounded-full flex items-center justify-center z-10 
                    ${isCompleted 
                      ? 'bg-success' 
                      : isActive 
                        ? 'bg-primary' 
                        : 'bg-border'}`}
                >
                  {isCompleted ? (
                    <CheckCircleIcon className="w-6 h-6 text-white" />
                  ) : (
                    <span className="text-xs text-white font-bold">{step.id}</span>
                  )}
                </div>
                <span className={`text-xs mt-2 hidden sm:block ${isActive ? 'font-bold' : ''}`}>
                  {intl.formatMessage({ id: `financialFreedom.steps.step${step.id}.shortTitle` })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Add extra spacing to ensure the step text doesn't overlap with the divider */}
      <div className="mb-12 sm:mb-16"></div>
      
      {/* Current Step Info */}
      <div className="mt-2 pt-4 border-t border-default">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3
            ${steps.find(s => s.id === activeStepId)?.isCompleted 
              ? 'bg-success' 
              : 'bg-primary'}`}
          >
            <span className="text-sm text-white font-bold">{activeStepId}</span>
          </div>
          <div>
            <h3 className="font-semibold text-primary">
              {intl.formatMessage({ id: `financialFreedom.steps.step${activeStepId}.title` })}
            </h3>
            <p className="text-sm text-secondary mt-1">
              {intl.formatMessage({ id: `financialFreedom.steps.step${activeStepId}.description` })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 
