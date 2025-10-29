'use client';

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { BabyStep } from '@/types/financial-freedom';
import { CheckCircleIcon, PencilIcon, CheckIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSettings } from '@/contexts/SettingsContext';

interface BabyStepCardProps {
  step: BabyStep;
  onUpdate: (updates: Partial<BabyStep>) => void;
  formatCurrency: (amount: number) => string;
  currency: string;
}

export default function BabyStepCard({ step, onUpdate, formatCurrency, currency }: BabyStepCardProps) {
  // Access the settings context to get emergency_fund_months
  const { settings } = useSettings();
  const intl = useIntl();
  const [isEditing, setIsEditing] = useState(false);
  const [currentAmount, setCurrentAmount] = useState(step.currentAmount || 0);
  const [targetAmount, setTargetAmount] = useState(step.targetAmount || 0);
  const [notes, setNotes] = useState(step.notes || '');

  const handleSave = () => {
    onUpdate({
      currentAmount,
      targetAmount,
      notes,
      progress: targetAmount > 0 ? Math.min(Math.round((currentAmount / targetAmount) * 100), 100) : 0,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCurrentAmount(step.currentAmount || 0);
    setTargetAmount(step.targetAmount || 0);
    setNotes(step.notes || '');
    setIsEditing(false);
  };

  const handleToggleComplete = () => {
    // Only allow toggling completion for steps 4-7
    if (step.id <= 3) {
      console.log('Steps 1-3 completion status is determined automatically by progress');
      return;
    }
    
    onUpdate({
      isCompleted: !step.isCompleted,
      completionDate: !step.isCompleted ? new Date().toISOString() : undefined,
      progress: !step.isCompleted ? 100 : step.progress,
    });
  };

  // Removed handleRefresh function as we no longer need individual step refresh

  const getStepStatusClass = () => {
    // For steps 1-3, completion is determined entirely by progress percentage
    // This ensures the visual indicator is always accurate for auto-calculated steps
    if (step.id <= 3) {
      if (step.progress >= 100) return 'bg-success/15 border-success';
      if (step.progress > 0) return 'bg-mint/40 border-mint/60';
      return 'bg-muted border-default';
    } 
    // For steps 4-7, use the existing logic (manually toggled completion)
    else {
      if (step.isCompleted) return 'bg-success/15 border-success';
      if (step.progress > 0) return 'bg-mint/40 border-mint/60';
      return 'bg-muted border-default';
    }
  };

  const renderProgressCircle = () => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (step.progress / 100) * circumference;
    
    // For steps 1-3, completion is determined by progress percentage (100%)
    const isComplete = step.id <= 3 ? step.progress >= 100 : step.isCompleted;
    
    return (
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            stroke="#E5DDD2"
            strokeWidth="8"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          <circle
            stroke={isComplete ? '#4BA56A' : '#6B9F91'}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {isComplete ? (
            <CheckCircleIcon className="w-8 h-8 text-success" />
          ) : (
            <span className="text-lg font-bold text-primary">{step.progress}%</span>
          )}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    if (isEditing) {
      return (
        <div className="space-y-4 mt-4">
          {(step.id === 1 || step.id === 2 || step.id === 3 || step.id === 6) && (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {intl.formatMessage({ id: 'financialFreedom.currentAmount' })}
                </label>
                <input
                  type="number"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-default rounded-md bg-input text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {intl.formatMessage({ id: 'financialFreedom.targetAmount' })}
                </label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-default rounded-md bg-input text-primary"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {intl.formatMessage({ id: 'financialFreedom.notes' })}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-md bg-input text-primary"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1 border border-default rounded-md text-secondary hover:bg-muted"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <CheckIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        {step.id === 1 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step1.target' },
                { amount: formatCurrency(step.targetAmount || 3000) }
              )}
            </p>
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step1.current' },
                { amount: formatCurrency(step.currentAmount || 0) }
              )}
            </p>
          </div>
        )}

        {step.id === 2 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {step.isCompleted
                ? intl.formatMessage({ id: 'financialFreedom.steps.step2.debtFree' })
                : (step.currentAmount || 0) > 0
                ? intl.formatMessage(
                    { id: 'financialFreedom.steps.step2.remainingDebt' },
                    { amount: formatCurrency(step.currentAmount || 0) }
                  )
                : intl.formatMessage({ id: 'financialFreedom.steps.step2.debtFree' })}
            </p>
            {(step.currentAmount || 0) > 0 && (
              <p className="text-xs text-secondary italic mt-1">
                {intl.formatMessage({ id: 'financialFreedom.steps.step2.tip' })}
              </p>
            )}
          </div>
        )}

        {step.id === 3 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step3.target' },
                { amount: formatCurrency(step.targetAmount || 0) }
              )}
            </p>
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step3.current' },
                { amount: formatCurrency(step.currentAmount || 0) }
              )}
            </p>
            <p className="text-xs text-secondary italic mt-1">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step3.tip' },
                { months: settings?.emergency_fund_months || 3 }
              )}
            </p>
          </div>
        )}

        {step.id === 4 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step4.target' }
              )}
            </p>
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.steps.step4.current' },
                { percent: step.progress || 0 }
              )}
            </p>
          </div>
        )}

        {step.id === 5 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {step.isCompleted
                ? intl.formatMessage({ id: 'financialFreedom.steps.step5.completed' })
                : step.progress > 0
                ? intl.formatMessage({ id: 'financialFreedom.steps.step5.inProgress' })
                : intl.formatMessage({ id: 'financialFreedom.steps.step5.notApplicable' })}
            </p>
          </div>
        )}

        {step.id === 6 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {step.isCompleted
                ? intl.formatMessage({ id: 'financialFreedom.steps.step6.mortgageFree' })
                : intl.formatMessage(
                    { id: 'financialFreedom.steps.step6.remainingMortgage' },
                    { amount: formatCurrency(step.currentAmount || 0) }
                  )}
            </p>
            {!step.isCompleted && step.targetAmount > 0 && (
              <p className="text-sm text-secondary">
                {intl.formatMessage(
                  { id: 'financialFreedom.steps.step6.originalAmount' },
                  { amount: formatCurrency(step.targetAmount || 0) }
                )}
              </p>
            )}
            <p className="text-xs text-secondary italic mt-1">
              {intl.formatMessage({ id: 'financialFreedom.steps.step6.tip' })}
            </p>
          </div>
        )}

        {step.id === 7 && (
          <div className="space-y-1">
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'financialFreedom.steps.step7.wealthBuilding' })}
            </p>
          </div>
        )}

        {step.notes && (
          <div className="mt-3 p-2 bg-muted rounded-md">
            <p className="text-xs text-secondary italic">{step.notes}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`p-4 rounded-lg border ${getStepStatusClass()} transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-primary">
            {step.id === 1 
              ? intl.formatMessage({ id: step.titleKey }, { amount: formatCurrency(step.targetAmount || 3000) })
              : step.id === 3
              ? intl.formatMessage({ id: step.titleKey }, { months: settings?.emergency_fund_months || 3 })
              : intl.formatMessage({ id: step.titleKey })
            }
          </h3>
          <p className="text-sm text-secondary mt-1">
            {step.id === 1
              ? intl.formatMessage({ id: step.descriptionKey }, { amount: formatCurrency(step.targetAmount || 3000) })
              : step.id === 3
              ? intl.formatMessage({ id: step.descriptionKey }, { months: settings?.emergency_fund_months || 3 })
              : intl.formatMessage({ id: step.descriptionKey })
            }
          </p>
        </div>
        {renderProgressCircle()}
      </div>

      {renderStepContent()}

      <div className="mt-4 flex justify-end space-x-2">
        {/* Only show buttons for steps 4-7, except for step 6 (mortgage) which is data-driven */}
        {step.id > 3 && step.id !== 6 && !step.isAutoCalculated && (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-xs bg-muted text-secondary rounded-md hover:bg-mint/40 flex items-center transition-colors"
            >
              <PencilIcon className="w-3 h-3 mr-1" />
              {intl.formatMessage({ id: 'financialFreedom.actions.updateProgress' })}
            </button>
            <button
              onClick={handleToggleComplete}
              className={`px-3 py-1 text-xs rounded-md flex items-center ${
                step.isCompleted
                  ? 'bg-sand/60 text-primary hover:bg-sand/80'
                  : 'bg-success/20 text-success hover:bg-success/30'
              }`}
            >
              <CheckCircleIcon className="w-3 h-3 mr-1" />
              {intl.formatMessage({
                id: step.isCompleted
                  ? 'financialFreedom.actions.markIncomplete'
                  : 'financialFreedom.actions.markComplete',
              })}
            </button>
          </>
        )}
      </div>
    </div>
  );
} 
