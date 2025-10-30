'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import BabyStepsProgress from '@/components/financial-freedom/BabyStepsProgress';
import BabyStepCard from '@/components/financial-freedom/BabyStepCard';
import ProgressSummary from '@/components/financial-freedom/ProgressSummary';
import { BabyStep, FinancialFreedomData } from '@/types/financial-freedom';
import { useSettings } from '@/contexts/SettingsContext';
import ProtectedPage from '@/components/ProtectedPage';
import { getFinancialFreedomData, updateFinancialFreedomData } from '@/api/financialFreedom';
import { getNonMortgageDebt, getNonMortgagePrincipal, getMortgageData } from '@/api/loans';
import { getEmergencyFundSavings, getGeneralSavings, getMonthlyRecurringExpenses } from '@/api/savings';

// Helper function to calculate debt progress percentage
const calculateDebtProgress = (remainingDebt: number, totalPrincipal: number): number => {
  if (totalPrincipal <= 0) {
    // No loans means 100% complete
    return 100;
  }
  
  const progressPercentage = Math.round((1 - (remainingDebt / totalPrincipal)) * 100);
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, progressPercentage));
};

// Helper function to calculate emergency fund progress percentage
const calculateEmergencyFundProgress = (currentSavings: number, monthlyExpenses: number, monthsTarget = 3): number => {
  // Target is the specified number of months of expenses
  const targetAmount = monthlyExpenses * monthsTarget;
  
  if (targetAmount <= 0) {
    // If monthly expenses are 0 or negative, consider it 100% complete
    return 100;
  }
  
  const progressPercentage = Math.round((currentSavings / targetAmount) * 100);
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, progressPercentage));
};

// Helper function to calculate mortgage progress percentage
const calculateMortgageProgress = (remainingBalance: number, principalAmount: number): number => {
  if (principalAmount <= 0) {
    // No mortgage means either 0% or 100% complete depending on context
    return 0;
  }
  
  // Progress is represented by how much of the mortgage has been paid off
  const progressPercentage = Math.round((1 - (remainingBalance / principalAmount)) * 100);
  // Ensure percentage is between 0 and 100
  return Math.max(0, Math.min(100, progressPercentage));
};

export default function FinancialFreedomPage() {
  const intl = useIntl();
  const { data: session, status: sessionStatus } = useSession();
  const { settings, formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialFreedomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalNonMortgageDebt, setTotalNonMortgageDebt] = useState<number>(0);

  // Single data loading effect - loads all data at once
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user?.id) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadAllData = async () => {
      try {
        console.log('Financial Freedom: Loading all data');
        
        // Load all data in parallel in a single batch
        const [
          financialFreedomData,
          nonMortgageDebt,
          nonMortgagePrincipal,
          emergencyFundSavings,
          generalSavings, 
          monthlyExpenses,
          mortgageData
        ] = await Promise.all([
          getFinancialFreedomData(),
          getNonMortgageDebt(),
          getNonMortgagePrincipal(),
          getEmergencyFundSavings(),
          getGeneralSavings(),
          getMonthlyRecurringExpenses(),
          getMortgageData()
        ]);
        
        if (!isMounted) return;
        
        // Set total debt state
        setTotalNonMortgageDebt(nonMortgageDebt);
        
        // Get settings values or use defaults
        const emergencyFundMonths = settings?.emergency_fund_months || 3;
        const targetAmount = monthlyExpenses * emergencyFundMonths;
        
        const starterEmergencyFundTarget = settings?.emergency_fund_target || 1000;
        const starterEmergencyFundProgress = Math.min(100, Math.round((emergencyFundSavings / starterEmergencyFundTarget) * 100));
        
        // Calculate progress percentages
        const debtProgressPercentage = calculateDebtProgress(nonMortgageDebt, nonMortgagePrincipal);
        const emergencyFundProgressPercentage = calculateEmergencyFundProgress(generalSavings, monthlyExpenses, emergencyFundMonths);
        const mortgageProgressPercentage = mortgageData && mortgageData.hasMortgage && mortgageData.principal_amount > 0
          ? calculateMortgageProgress(mortgageData.remaining_balance, mortgageData.principal_amount)
          : 0;
        
        // Update the steps with calculated values
        const updatedSteps = financialFreedomData.steps.map((step: BabyStep) => {
          if (step.id === 1) {
            return {
              ...step,
              progress: starterEmergencyFundProgress,
              targetAmount: starterEmergencyFundTarget,
              currentAmount: emergencyFundSavings,
              isCompleted: starterEmergencyFundProgress === 100,
              isAutoCalculated: true
            };
          } else if (step.id === 2) {
            return {
              ...step,
              progress: debtProgressPercentage,
              targetAmount: nonMortgagePrincipal,
              currentAmount: nonMortgageDebt,
              isCompleted: debtProgressPercentage === 100,
              isAutoCalculated: true
            };
          } else if (step.id === 3) {
            return {
              ...step,
              progress: emergencyFundProgressPercentage,
              targetAmount: targetAmount,
              currentAmount: generalSavings,
              isCompleted: emergencyFundProgressPercentage === 100,
              isAutoCalculated: true
            };
          } else if (step.id === 6) {
            // Ensure we only populate this data if the user actually has a mortgage
            if (mortgageData && mortgageData.hasMortgage) {
              return {
                ...step,
                progress: mortgageProgressPercentage,
                targetAmount: mortgageData.principal_amount,
                currentAmount: mortgageData.remaining_balance,
                isCompleted: mortgageProgressPercentage === 100,
                // Skip manual updates for data-driven steps
                isAutoCalculated: true
              };
            }
            return step;
          }
          return step;
        });
        
        // Create the final data object
        const finalData = {
          ...financialFreedomData,
          steps: updatedSteps,
          lastUpdated: new Date().toISOString()
        };
        
        // Update state with all the data
        setData(finalData);
        setLoading(false);
        
      } catch (error) {
        console.error('Error loading financial freedom data:', error);
        if (isMounted) {
          setError('Failed to load financial freedom data. Please try again later.');
          setLoading(false);
        }
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
    };
  }, [sessionStatus]); // Only depend on sessionStatus

  const handleUpdateStep = useCallback((stepId: number, updates: Partial<BabyStep>) => {
    if (!data) return;
    
    // Only allow updates for steps 4-7 (steps 1-3 are fully automated)
    if (stepId <= 3) {
      console.log('Steps 1-3 are auto-calculated and cannot be manually updated');
      return;
    }
    
    console.log('Updating step:', stepId);
    
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
      console.error('Error updating financial freedom data:', error);
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded">
          {error}
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
      </div>
    </ProtectedPage>
  );
} 
