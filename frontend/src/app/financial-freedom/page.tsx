'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import BabyStepsProgress from '@/components/financial-freedom/BabyStepsProgress';
import BabyStepCard from '@/components/financial-freedom/BabyStepCard';
import ProgressSummary from '@/components/financial-freedom/ProgressSummary';
import { BabyStep, FinancialFreedomData } from '@/types/financial-freedom';
import { useSettings } from '@/contexts/SettingsContext';
import ProtectedPage from '@/components/ProtectedPage';
import { getFinancialFreedomData, updateFinancialFreedomData, resetFinancialFreedomData } from '@/api/financialFreedom';
import { getNonMortgageDebt, getNonMortgagePrincipal } from '@/api/loans';
import { getEmergencyFundSavings, getGeneralSavings, getMonthlyRecurringExpenses, clearApiCache } from '@/api/savings';

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
const calculateEmergencyFundProgress = (currentSavings: number, monthlyExpenses: number): number => {
  // Target is 6 months of expenses
  const targetAmount = monthlyExpenses * 6;
  
  if (targetAmount <= 0) {
    // If monthly expenses are 0 or negative, consider it 100% complete
    return 100;
  }
  
  const progressPercentage = Math.round((currentSavings / targetAmount) * 100);
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
  const dataRefreshedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Main data fetching effect - only runs once when session is authenticated
  useEffect(() => {
    const fetchData = async () => {
      if (sessionStatus === 'authenticated' && session?.user?.id) {
        try {
          setLoading(true);
          setError(null);
          
          // Fetch financial freedom data
          const financialFreedomData = await getFinancialFreedomData();
          setData(financialFreedomData);
          
          // Fetch non-mortgage debt data
          const nonMortgageDebt = await getNonMortgageDebt();
          setTotalNonMortgageDebt(nonMortgageDebt);
          
          const nonMortgagePrincipal = await getNonMortgagePrincipal();
          
          // Calculate debt progress percentage
          const debtProgressPercentage = calculateDebtProgress(nonMortgageDebt, nonMortgagePrincipal);
          
          // Fetch emergency fund savings and monthly expenses
          const [emergencyFundSavings, generalSavings, monthlyExpenses] = await Promise.all([
            getEmergencyFundSavings(),
            getGeneralSavings(),
            getMonthlyRecurringExpenses()
          ]);
          
          // Calculate emergency fund progress percentage
          const targetAmount = monthlyExpenses * 6;
          const emergencyFundProgressPercentage = calculateEmergencyFundProgress(generalSavings, monthlyExpenses);
          
          // Update data with fetched values
          if (financialFreedomData) {
            const updatedSteps = financialFreedomData.steps.map((step: BabyStep) => {
              if (step.id === 1) {
                // Update Baby Step 1 (Starter Emergency Fund)
                const starterEmergencyFundTarget = 3000;
                const starterEmergencyFundProgress = Math.min(100, Math.round((emergencyFundSavings / starterEmergencyFundTarget) * 100));
                
                return {
                  ...step,
                  progress: starterEmergencyFundProgress,
                  targetAmount: starterEmergencyFundTarget,
                  currentAmount: emergencyFundSavings,
                  isCompleted: starterEmergencyFundProgress === 100
                };
              } else if (step.id === 2) {
                return {
                  ...step,
                  progress: debtProgressPercentage,
                  targetAmount: nonMortgagePrincipal,
                  currentAmount: nonMortgageDebt,
                  isCompleted: debtProgressPercentage === 100
                };
              } else if (step.id === 3) {
                return {
                  ...step,
                  progress: emergencyFundProgressPercentage,
                  targetAmount: targetAmount,
                  currentAmount: generalSavings,
                  isCompleted: emergencyFundProgressPercentage === 100
                };
              }
              return step;
            });
            
            const updatedData = {
              ...financialFreedomData,
              steps: updatedSteps,
              lastUpdated: new Date().toISOString()
            };
            
            // Update local state
            setData(updatedData);
            
            // Save to the API
            updateFinancialFreedomData({ 
              steps: updatedSteps,
              startDate: financialFreedomData.startDate
            }).catch(error => {
              console.error('Error updating financial freedom data:', error);
            });
          }
          
          setLoading(false);
        } catch (error) {
          console.error('Error fetching financial freedom data:', error);
          setError('Failed to load financial freedom data. Please try again later.');
          setLoading(false);
        }
      }
    };

    // Start fetching data
    let isMounted = true;
    fetchData().catch(err => {
      if (isMounted) {
        console.error('Unhandled error in fetchData:', err);
        setError('An unexpected error occurred. Please try again later.');
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [sessionStatus, intl]); // Only depend on sessionStatus, not the entire session object

  // Refresh data when the page loads (only once)
  useEffect(() => {
    // Only refresh if we have data, session is authenticated, and we haven't refreshed yet
    if (!data || sessionStatus !== 'authenticated' || dataRefreshedRef.current) return;
    
    // Set the ref to true to prevent further refreshes
    dataRefreshedRef.current = true;
    
    // Use a single function to refresh all data to avoid multiple state updates
    const refreshAllData = async () => {
      try {
        // Fetch all required data in parallel
        const [nonMortgageDebt, nonMortgagePrincipal, emergencyFundSavings, generalSavings, monthlyExpenses] = await Promise.all([
          getNonMortgageDebt(),
          getNonMortgagePrincipal(),
          getEmergencyFundSavings(),
          getGeneralSavings(),
          getMonthlyRecurringExpenses()
        ]);
        
        // Update total non-mortgage debt state
        setTotalNonMortgageDebt(nonMortgageDebt);
        
        if (data) {
          // Calculate progress percentages
          const debtProgressPercentage = calculateDebtProgress(nonMortgageDebt, nonMortgagePrincipal);
          const emergencyFundProgressPercentage = calculateEmergencyFundProgress(generalSavings, monthlyExpenses);
          
          // Create a single updated steps array with all changes
          const updatedSteps = data.steps.map((step: BabyStep) => {
            if (step.id === 1) {
              // Update Baby Step 1 (Starter Emergency Fund)
              const starterEmergencyFundTarget = 3000;
              const starterEmergencyFundProgress = Math.min(100, Math.round((emergencyFundSavings / starterEmergencyFundTarget) * 100));
              
              return {
                ...step,
                progress: starterEmergencyFundProgress,
                targetAmount: starterEmergencyFundTarget,
                currentAmount: emergencyFundSavings,
                isCompleted: starterEmergencyFundProgress === 100
              };
            } else if (step.id === 2) {
              // Update Baby Step 2 (Debt)
              return {
                ...step,
                progress: debtProgressPercentage,
                targetAmount: nonMortgagePrincipal,
                currentAmount: nonMortgageDebt,
                isCompleted: debtProgressPercentage === 100
              };
            } else if (step.id === 3) {
              // Update Baby Step 3 (Emergency Fund)
              const targetAmount = monthlyExpenses * 6;
              console.log(`Monthly expenses: ${monthlyExpenses}, Target: ${targetAmount}`);
              return {
                ...step,
                progress: emergencyFundProgressPercentage,
                targetAmount: targetAmount,
                currentAmount: generalSavings,
                isCompleted: emergencyFundProgressPercentage === 100
              };
            }
            return step;
          });
          
          // Update data state once with all changes
          const updatedData = {
            ...data,
            steps: updatedSteps,
            lastUpdated: new Date().toISOString()
          };
          
          // Update local state
          setData(updatedData);
          
          // Save to the API
          updateFinancialFreedomData({ 
            steps: updatedSteps,
            startDate: data.startDate
          }).catch(error => {
            console.error('Error updating financial freedom data:', error);
          });
        }
      } catch (error) {
        console.error('Error refreshing financial freedom data:', error);
      }
    };
    
    // Start refreshing data
    let isMounted = true;
    refreshAllData().catch(err => {
      if (isMounted) {
        console.error('Unhandled error in refreshAllData:', err);
      }
    });
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [data, sessionStatus]);

  // Reset the refresh flag when data changes completely (e.g., on reset)
  useEffect(() => {
    if (!data) {
      dataRefreshedRef.current = false;
    }
  }, [data]);

  // Function to refresh all data (for debug button)
  const refreshAllData = async () => {
    try {
      // Fetch all required data in parallel
      const [nonMortgageDebt, nonMortgagePrincipal, emergencyFundSavings, generalSavings, monthlyExpenses] = await Promise.all([
        getNonMortgageDebt(),
        getNonMortgagePrincipal(),
        getEmergencyFundSavings(),
        getGeneralSavings(),
        getMonthlyRecurringExpenses()
      ]);
      
      // Update total non-mortgage debt state
      setTotalNonMortgageDebt(nonMortgageDebt);
      
      if (data) {
        // Calculate progress percentages
        const debtProgressPercentage = calculateDebtProgress(nonMortgageDebt, nonMortgagePrincipal);
        const emergencyFundProgressPercentage = calculateEmergencyFundProgress(generalSavings, monthlyExpenses);
        
        // Create a single updated steps array with all changes
        const updatedSteps = data.steps.map((step: BabyStep) => {
          if (step.id === 1) {
            // Update Baby Step 1 (Starter Emergency Fund)
            const starterEmergencyFundTarget = 3000;
            const starterEmergencyFundProgress = Math.min(100, Math.round((emergencyFundSavings / starterEmergencyFundTarget) * 100));
            
            return {
              ...step,
              progress: starterEmergencyFundProgress,
              targetAmount: starterEmergencyFundTarget,
              currentAmount: emergencyFundSavings,
              isCompleted: starterEmergencyFundProgress === 100
            };
          } else if (step.id === 2) {
            // Update Baby Step 2 (Debt)
            return {
              ...step,
              progress: debtProgressPercentage,
              targetAmount: nonMortgagePrincipal,
              currentAmount: nonMortgageDebt,
              isCompleted: debtProgressPercentage === 100
            };
          } else if (step.id === 3) {
            // Update Baby Step 3 (Emergency Fund)
            const targetAmount = monthlyExpenses * 6;
            console.log(`Monthly expenses: ${monthlyExpenses}, Target: ${targetAmount}`);
            return {
              ...step,
              progress: emergencyFundProgressPercentage,
              targetAmount: targetAmount,
              currentAmount: generalSavings,
              isCompleted: emergencyFundProgressPercentage === 100
            };
          }
          return step;
        });
        
        // Update data state once with all changes
        const updatedData = {
          ...data,
          steps: updatedSteps,
          lastUpdated: new Date().toISOString()
        };
        
        // Update local state
        setData(updatedData);
        
        // Save to the API
        updateFinancialFreedomData({ 
          steps: updatedSteps,
          startDate: data.startDate
        }).catch(error => {
          console.error('Error updating financial freedom data:', error);
        });
      }
    } catch (error) {
      console.error('Error refreshing financial freedom data:', error);
    }
  };

  const refreshStepData = async (stepId: number) => {
    if (!data) return;
    
    try {
      if (stepId === 1) {
        // Refresh Baby Step 1 (Starter Emergency Fund)
        const emergencyFundSavings = await getEmergencyFundSavings();
        const starterEmergencyFundTarget = 3000;
        const progressPercentage = Math.min(100, Math.round((emergencyFundSavings / starterEmergencyFundTarget) * 100));
        
        const updatedSteps = data.steps.map((step: BabyStep) => 
          step.id === 1 ? {
            ...step,
            progress: progressPercentage,
            targetAmount: starterEmergencyFundTarget,
            currentAmount: emergencyFundSavings,
            isCompleted: progressPercentage === 100
          } : step
        );
        
        const updatedData = {
          ...data,
          steps: updatedSteps,
          lastUpdated: new Date().toISOString()
        };
        
        // Update local state
        setData(updatedData);
        
        // Save to the API
        updateFinancialFreedomData({ 
          steps: updatedSteps,
          startDate: data.startDate
        }).catch(error => {
          console.error('Error updating financial freedom data:', error);
        });
      } else if (stepId === 2) {
        // Refresh Baby Step 2 (Debt)
        const nonMortgageDebt = await getNonMortgageDebt();
        const nonMortgagePrincipal = await getNonMortgagePrincipal();
        setTotalNonMortgageDebt(nonMortgageDebt);
        
        const progressPercentage = calculateDebtProgress(nonMortgageDebt, nonMortgagePrincipal);
        
        const updatedSteps = data.steps.map((step: BabyStep) => 
          step.id === 2 ? {
            ...step,
            progress: progressPercentage,
            targetAmount: nonMortgagePrincipal,
            currentAmount: nonMortgageDebt,
            isCompleted: progressPercentage === 100
          } : step
        );
        
        const updatedData = {
          ...data,
          steps: updatedSteps,
          lastUpdated: new Date().toISOString()
        };
        
        // Update local state
        setData(updatedData);
        
        // Save to the API
        updateFinancialFreedomData({ 
          steps: updatedSteps,
          startDate: data.startDate
        }).catch(error => {
          console.error('Error updating financial freedom data:', error);
        });
      } else if (stepId === 3) {
        // Refresh Baby Step 3 (Emergency Fund)
        const emergencyFundSavings = await getEmergencyFundSavings();
        const generalSavings = await getGeneralSavings();
        const monthlyExpenses = await getMonthlyRecurringExpenses();
        
        const targetAmount = monthlyExpenses * 6;
        const progressPercentage = calculateEmergencyFundProgress(generalSavings, monthlyExpenses);
        
        const updatedSteps = data.steps.map((step: BabyStep) => 
          step.id === 3 ? {
            ...step,
            progress: progressPercentage,
            targetAmount: targetAmount,
            currentAmount: generalSavings,
            isCompleted: progressPercentage === 100
          } : step
        );
        
        const updatedData = {
          ...data,
          steps: updatedSteps,
          lastUpdated: new Date().toISOString()
        };
        
        // Update local state
        setData(updatedData);
        
        // Save to the API
        updateFinancialFreedomData({ 
          steps: updatedSteps,
          startDate: data.startDate
        }).catch(error => {
          console.error('Error updating financial freedom data:', error);
        });
      }
    } catch (error) {
      console.error(`Error refreshing step ${stepId} data:`, error);
    }
  };

  const handleUpdateStep = (stepId: number, updates: Partial<BabyStep>) => {
    if (!data) return;
    
    const updatedSteps = data.steps.map((step: BabyStep) => 
      step.id === stepId ? { ...step, ...updates } : step
    );
    
    const updatedData = {
      ...data,
      steps: updatedSteps,
      lastUpdated: new Date().toISOString(),
    };
    
    setData(updatedData);
    
    // Save to the API
    updateFinancialFreedomData({ 
      steps: updatedSteps,
      startDate: data.startDate
    }).catch(error => {
      console.error('Error updating financial freedom data:', error);
    });
    
    console.log('Updated step:', stepId, updates);
  };

  const handleResetProgress = () => {
    if (!data) return;
    
    // First, reset the data on the backend
    resetFinancialFreedomData()
      .then(() => {
        // Then fetch fresh data from the backend
        return getFinancialFreedomData();
      })
      .then(freshData => {
        // Update the local state with the fresh data
        setData(freshData);
      })
      .catch(error => {
        console.error('Error resetting financial freedom data:', error);
      });
    
    console.log('Reset progress');
  };

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
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
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
          <h1 className="text-2xl font-bold mb-2 text-default">
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
          <h2 className="text-xl font-semibold mb-4 text-default">
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
                onRefresh={step.id === 1 || step.id === 2 || step.id === 3 ? () => refreshStepData(step.id) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Debug section - only visible in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 p-4 border border-gray-300 rounded-md bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">Debug Tools</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  clearApiCache();
                  await refreshAllData();
                  alert('API cache cleared and data refreshed');
                }}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Clear Cache & Refresh Data
              </button>
            </div>
          </div>
        )}

        <div className="mb-8">
          <ProgressSummary 
            data={data} 
            onResetProgress={handleResetProgress} 
            formatCurrency={formatCurrency}
            currency={settings?.currency || 'USD'}
          />
        </div>
      </div>
    </ProtectedPage>
  );
} 