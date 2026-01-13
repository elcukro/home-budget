import { SavingCategory, SavingsSummary } from '@/types/financial-freedom';
import { logger } from '@/lib/logger';

// Cache for API responses
interface ApiCache {
  savingsSummary?: {
    data: SavingsSummary;
    timestamp: number;
  };
  monthlyExpenses?: {
    data: number;
    timestamp: number;
  };
}

// Cache duration in milliseconds (1 minute during development)
const CACHE_DURATION = 1 * 60 * 1000;

// In-memory cache
const apiCache: ApiCache = {};

const createEmptySummary = (): SavingsSummary => ({
  total_savings: 0,
  category_totals: {
    [SavingCategory.EMERGENCY_FUND]: 0,
    [SavingCategory.SIX_MONTH_FUND]: 0,
    [SavingCategory.RETIREMENT]: 0,
    [SavingCategory.COLLEGE]: 0,
    [SavingCategory.GENERAL]: 0,
    [SavingCategory.INVESTMENT]: 0,
    [SavingCategory.REAL_ESTATE]: 0,
    [SavingCategory.OTHER]: 0,
  },
  monthly_contribution: 0,
  recent_transactions: [],
  emergency_fund: 0,
  emergency_fund_target: 0,
  emergency_fund_progress: 0,
});

// Removed clearApiCache function as it's no longer needed

/**
 * Fetches the savings summary for the current user with caching
 */
export const getSavingsSummary = async (): Promise<SavingsSummary> => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (
    apiCache.savingsSummary && 
    now - apiCache.savingsSummary.timestamp < CACHE_DURATION
  ) {
    logger.debug('Using cached savings summary');
    return apiCache.savingsSummary.data;
  }
  
  try {
    const response = await fetch('/api/savings/summary');
    
    if (!response.ok) {
      throw new Error('Failed to fetch savings summary');
    }
    
    const data = await response.json();
    const normalized: SavingsSummary = {
      total_savings: data.total_savings ?? 0,
      category_totals: {
        ...createEmptySummary().category_totals,
        ...(data.category_totals ?? {}),
      },
      monthly_contribution: data.monthly_contribution ?? 0,
      recent_transactions: data.recent_transactions ?? [],
      emergency_fund: data.emergency_fund ?? 0,
      emergency_fund_target: data.emergency_fund_target ?? 0,
      emergency_fund_progress: data.emergency_fund_progress ?? 0,
    };
    
    // Cache the response
    apiCache.savingsSummary = {
      data: normalized,
      timestamp: now,
    };
    
    return normalized;
  } catch (error) {
    logger.error('Error fetching savings summary:', error);
    return createEmptySummary();
  }
};

/**
 * Gets the total amount in the emergency fund with caching
 */
export const getEmergencyFundSavings = async (): Promise<number> => {
  try {
    const summary = await getSavingsSummary();
    return summary.category_totals[SavingCategory.EMERGENCY_FUND] || 0;
  } catch (error) {
    logger.error('Error fetching emergency fund savings:', error);
    return 0;
  }
};

/**
 * Gets the total amount in general savings with caching
 */
export const getGeneralSavings = async (): Promise<number> => {
  try {
    const summary = await getSavingsSummary();
    return summary.category_totals[SavingCategory.GENERAL] || 0;
  } catch (error) {
    logger.error('Error fetching general savings:', error);
    return 0;
  }
};

/**
 * Gets liquid savings for full emergency fund (Step 3)
 * Includes: emergency_fund, six_month_fund, general
 * Excludes: retirement, college, investment, real_estate, other (non-liquid assets)
 */
export const getLiquidSavingsForEmergencyFund = async (): Promise<number> => {
  try {
    const summary = await getSavingsSummary();
    const liquidCategories = [
      SavingCategory.EMERGENCY_FUND,
      SavingCategory.SIX_MONTH_FUND,
      SavingCategory.GENERAL,
    ];

    return liquidCategories.reduce((total, category) => {
      return total + (summary.category_totals[category] || 0);
    }, 0);
  } catch (error) {
    logger.error('Error fetching liquid savings for emergency fund:', error);
    return 0;
  }
};

/**
 * Gets the monthly recurring expenses for the user with caching
 */
export const getMonthlyRecurringExpenses = async (): Promise<number> => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (
    apiCache.monthlyExpenses && 
    now - apiCache.monthlyExpenses.timestamp < CACHE_DURATION
  ) {
    logger.debug('Using cached monthly expenses');
    return apiCache.monthlyExpenses.data;
  }
  
  try {
    // In a real implementation, this would fetch from an API endpoint
    const response = await fetch('/api/expenses/monthly');
    
    if (response.status === 404) {
      // If the endpoint doesn't exist yet, return a default value without warning
      // This is expected during development
      const defaultValue = 3000;
      apiCache.monthlyExpenses = {
        data: defaultValue,
        timestamp: now
      };
      
      return defaultValue;
    }
    
    if (!response.ok) {
      // For other errors, log a warning
      logger.warn('Monthly expenses endpoint error:', response.status, response.statusText);
      
      // Cache the default value
      const defaultValue = 3000;
      apiCache.monthlyExpenses = {
        data: defaultValue,
        timestamp: now
      };
      
      return defaultValue;
    }
    
    const data = await response.json();
    const monthlyExpenses = data.total || 3000;
    
    // Cache the response
    apiCache.monthlyExpenses = {
      data: monthlyExpenses,
      timestamp: now
    };
    
    return monthlyExpenses;
  } catch (error) {
    logger.error('Error fetching monthly expenses:', error);
    return 3000; // Default value for demo purposes
  }
}; 
