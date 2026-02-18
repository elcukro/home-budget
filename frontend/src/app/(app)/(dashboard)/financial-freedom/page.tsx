'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import BabyStepsProgress from '@/components/financial-freedom/BabyStepsProgress';
import BabyStepCard from '@/components/financial-freedom/BabyStepCard';
import ProgressSummary from '@/components/financial-freedom/ProgressSummary';
import FIRECalculator from '@/components/financial-freedom/FIRECalculator';
import { BabyStep, FinancialFreedomData } from '@/types/financial-freedom';
import { useSettings } from '@/contexts/SettingsContext';
import ProtectedPage from '@/components/ProtectedPage';
import { getFinancialFreedomData, updateFinancialFreedomData } from '@/api/financialFreedom';
import { getLiquidSavingsForEmergencyFund, getMonthlyRecurringExpenses } from '@/api/savings';
import { logger } from '@/lib/logger';


export default function FinancialFreedomPage() {
  const intl = useIntl();
  const { data: session, status: sessionStatus } = useSession();
  const { settings, formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialFreedomData | null>(null);
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);
  const [monthlyExpensesAmount, setMonthlyExpensesAmount] = useState<number>(8000);
  const [totalSavings, setTotalSavings] = useState<number>(0);

  // Single data loading effect - loads all data at once
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user?.id) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMessageId(null);

    const loadAllData = async () => {
      try {
        logger.debug('Financial Freedom: Loading all data');
        
        // Load data in parallel — backend /calculated handles steps 1-3 & 6,
        // liquid savings + monthly expenses are needed for FIRECalculator display only
        const [
          financialFreedomData,
          liquidSavings,
          monthlyExpenses,
        ] = await Promise.all([
          getFinancialFreedomData(),
          getLiquidSavingsForEmergencyFund(),
          getMonthlyRecurringExpenses(),
        ]);

        if (!isMounted) return;

        // Populate state for FIRECalculator component
        setMonthlyExpensesAmount(monthlyExpenses || 8000);
        setTotalSavings(liquidSavings || 0);

        // Steps 1-3 & 6 already calculated by backend (/calculated endpoint).
        // Just mark them as auto-calculated for UI feedback.
        const updatedSteps = financialFreedomData.steps.map((step: BabyStep) => {
          if (step.id <= 3 || step.id === 6) {
            return { ...step, isAutoCalculated: true };
          }
          return step;
        });

        setData({
          ...financialFreedomData,
          steps: updatedSteps,
          lastUpdated: new Date().toISOString()
        });
        setLoading(false);
        
      } catch (error) {
        logger.error('Error loading financial freedom data:', error);
        if (isMounted) {
          setErrorMessageId('financialFreedom.loadError');
          setLoading(false);
        }
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
    };
  }, [sessionStatus, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateStep = useCallback((stepId: number, updates: Partial<BabyStep>) => {
    if (!data) return;
    
    // Only allow updates for steps 4-7 (steps 1-3 are fully automated)
    if (stepId <= 3) {
      logger.debug('Steps 1-3 are auto-calculated and cannot be manually updated');
      return;
    }
    
    logger.debug('Updating step:', stepId);
    
    // Create updated steps array
    const updatedSteps = data.steps.map((step: BabyStep) => 
      step.id === stepId ? { ...step, ...updates } : step
    );
    
    // Update local state
    setData({
      ...data,
      steps: updatedSteps,
      lastUpdated: new Date().toISOString()
    });
    
    // Save to the API
    updateFinancialFreedomData({ 
      steps: updatedSteps,
      startDate: data.startDate
    }).catch(error => {
      logger.error('Error updating financial freedom data:', error);
    });
  }, [data]);

  // Reset progress functionality has been removed

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-primary">{intl.formatMessage({ id: 'common.loading' })}</div>
        </div>
      </div>
    );
  }

  if (errorMessageId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded">
          {intl.formatMessage({ id: errorMessageId })}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-secondary">
          {intl.formatMessage({ id: 'financialFreedom.noData' })}
        </div>
      </div>
    );
  }

  const activeStep = data.steps.find((step: BabyStep) => !step.isCompleted) || data.steps[data.steps.length - 1];

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 text-primary">
            {intl.formatMessage({ id: 'financialFreedom.title' })}
          </h1>
          <p className="text-secondary">
            {intl.formatMessage({ id: 'financialFreedom.subtitle' })}
          </p>
          <p className="mt-2 text-secondary">
            {intl.formatMessage({ id: 'financialFreedom.overview' })}
          </p>
        </div>

        <div className="mb-8">
          <BabyStepsProgress steps={data.steps} activeStepId={activeStep.id} />
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-primary">
            {intl.formatMessage({ id: 'financialFreedom.yourProgress' })}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.steps.map((step: BabyStep) => (
              <BabyStepCard
                key={step.id}
                step={step}
                onUpdate={(updates: Partial<BabyStep>) => handleUpdateStep(step.id, updates)}
                formatCurrency={formatCurrency}
                currency={settings?.currency || 'USD'}
                monthlyExpenses={monthlyExpensesAmount}
              />
            ))}
          </div>
        </div>

        {/* Removed debug section - no longer needed */}

        <div className="mb-8">
          <ProgressSummary
            data={data}
            formatCurrency={formatCurrency}
            currency={settings?.currency || 'USD'}
          />
        </div>

        {/* FIRE Calculator */}
        <div className="mb-8">
          <FIRECalculator
            monthlyExpenses={monthlyExpensesAmount}
            currentSavings={totalSavings}
            monthlyInvestment={2000}
          />
        </div>
      </div>
    </ProtectedPage>
  );
} 
