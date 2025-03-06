import { SavingCategory, SavingsSummary } from '@/types/financial-freedom';

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

/**
 * Clears the API cache
 */
export const clearApiCache = (): void => {
  Object.keys(apiCache).forEach(key => {
    delete apiCache[key as keyof ApiCache];
  });
  console.log('API cache cleared');
};

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
    console.log('Using cached savings summary');
    return apiCache.savingsSummary.data;
  }
  
  try {
    const response = await fetch('/api/savings/summary');
    
    if (!response.ok) {
      throw new Error('Failed to fetch savings summary');
    }
    
    const data = await response.json();
    
    // Cache the response
    apiCache.savingsSummary = {
      data,
      timestamp: now
    };
    
    return data;
  } catch (error) {
    console.error('Error fetching savings summary:', error);
    // Return default empty summary
    return {
      total_savings: 0,
      category_totals: {
        [SavingCategory.EMERGENCY_FUND]: 0,
        [SavingCategory.RETIREMENT]: 0,
        [SavingCategory.COLLEGE]: 0,
        [SavingCategory.GENERAL]: 0,
        [SavingCategory.INVESTMENT]: 0,
        [SavingCategory.OTHER]: 0
      },
      monthly_contribution: 0,
      recent_transactions: []
    };
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
    console.error('Error fetching emergency fund savings:', error);
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
    console.error('Error fetching general savings:', error);
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
    console.log('Using cached monthly expenses');
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
      console.warn('Monthly expenses endpoint error:', response.status, response.statusText);
      
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
    console.error('Error fetching monthly expenses:', error);
    return 3000; // Default value for demo purposes
  }
}; 