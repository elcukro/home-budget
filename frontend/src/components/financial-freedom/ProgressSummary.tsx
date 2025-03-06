'use client';

import { useIntl } from 'react-intl';
import { FinancialFreedomData } from '@/types/financial-freedom';

interface ProgressSummaryProps {
  data: FinancialFreedomData;
  formatCurrency: (amount: number) => string;
  currency: string;
}

export default function ProgressSummary({ 
  data, 
  formatCurrency,
  currency
}: ProgressSummaryProps) {
  const intl = useIntl();
  
  const completedSteps = data.steps.filter(step => step.isCompleted).length;
  const totalSteps = data.steps.length;
  const completionPercentage = Math.round((completedSteps / totalSteps) * 100);
  
  const currentStep = data.steps.find(step => !step.isCompleted) || data.steps[data.steps.length - 1];
  const currentStepProgress = currentStep.progress;
  
  const startDate = new Date(data.startDate);
  const lastUpdated = new Date(data.lastUpdated);
  
  const formatDate = (date: string | Date) => {
    if (!date) return intl.formatMessage({ id: 'common.notAvailable' });
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString(intl.locale);
  };

  // Reset progress functionality has been removed

  return (
    <div className="bg-white dark:bg-background-primary rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-default mb-4">
        {intl.formatMessage({ id: 'financialFreedom.summary' })}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <p className="text-sm text-secondary mb-1">
              {intl.formatMessage({ id: 'financialFreedom.overallProgress' })}
            </p>
            <div className="flex items-center">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mr-4">
                <div 
                  className="bg-blue-500 dark:bg-blue-600 h-4 rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium text-default whitespace-nowrap">
                {completedSteps} / {totalSteps} ({completionPercentage}%)
              </span>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-secondary mb-1">
              {intl.formatMessage({ id: 'financialFreedom.currentStep' })}
            </p>
            <p className="font-medium text-default">
              {intl.formatMessage({ id: `financialFreedom.steps.step${currentStep.id}.title` })}
            </p>
            <div className="flex items-center mt-1">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-4">
                <div 
                  className="bg-green-500 dark:bg-green-600 h-2 rounded-full"
                  style={{ width: `${currentStepProgress}%` }}
                ></div>
              </div>
              <span className="text-xs font-medium text-default whitespace-nowrap">
                {currentStepProgress}%
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.startDate' },
                { date: formatDate(startDate) }
              )}
            </p>
            <p className="text-sm text-secondary">
              {intl.formatMessage(
                { id: 'financialFreedom.lastUpdated' },
                { date: formatDate(lastUpdated) }
              )}
            </p>
            
            {/* Reset progress functionality has been removed */}
          </div>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-default mb-2">
          {intl.formatMessage({ id: 'financialFreedom.insights.title' })}
        </h3>
        <ul className="space-y-2 text-sm text-secondary">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            {intl.formatMessage(
              { id: 'financialFreedom.insights.nextMilestone' },
              { 
                milestone: intl.formatMessage({ 
                  id: `financialFreedom.steps.step${currentStep.id}.title` 
                }) 
              }
            )}
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            {intl.formatMessage(
              { id: 'financialFreedom.insights.suggestion' },
              { text: intl.formatMessage({ id: `financialFreedom.steps.step${currentStep.id}.tip` }) }
            )}
          </li>
        </ul>
      </div>
    </div>
  );
} 