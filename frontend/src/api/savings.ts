import {
  Saving,
  SavingCategory,
  SavingsSummary,
  AccountType,
  SavingsGoal,
  SavingsGoalCreate,
  SavingsGoalUpdate,
  SavingsGoalWithSavings,
  GoalStatus
} from '@/types/financial-freedom';
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

/**
 * Invalidates the savings summary cache so next fetch gets fresh data.
 * Call this after creating savings entries (e.g., transfers between categories).
 */
export const invalidateSavingsCache = (): void => {
  delete apiCache.savingsSummary;
};

/**
 * Creates a single savings entry (deposit or withdrawal).
 */
export const createSaving = async (data: {
  category: string;
  saving_type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  description: string;
  account_type?: string;
}): Promise<Saving> => {
  const response = await fetch('/api/savings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
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

/**
 * Individual retirement account limit tracking
 */
export interface RetirementAccountLimit {
  account_type: AccountType;
  year: number;
  annual_limit: number;
  current_contributions: number;
  remaining_limit: number;
  percentage_used: number;
  is_over_limit: boolean;
}

/**
 * Response from retirement limits endpoint
 */
export interface RetirementLimitsResponse {
  year: number;
  accounts: RetirementAccountLimit[];
  total_retirement_contributions: number;
  ike_limit: number;
  ikze_limit_standard: number;
  ikze_limit_jdg: number;
}

/**
 * Fetches retirement account limits and current contributions.
 * Tracks Polish III Pillar accounts (IKE, IKZE, PPK, OIPE) against annual limits.
 *
 * @param year - Year to check (defaults to current year)
 * @param isSelfEmployed - If true, uses higher IKZE limit for self-employed (JDG)
 */
export const getRetirementLimits = async (
  year?: number,
  isSelfEmployed: boolean = false
): Promise<RetirementLimitsResponse | null> => {
  try {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (isSelfEmployed) params.append('is_self_employed', 'true');

    const url = `/api/savings/retirement-limits${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      logger.error('Failed to fetch retirement limits:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error('Error fetching retirement limits:', error);
    return null;
  }
};


export interface SalaryForPpk {
  date: string;
  grossAmount: number;
  netAmount: number;
  description: string;
  ownerName: string | null;
}

/**
 * Fetches the earliest recurring salary (owner=self) from the income API.
 * Used for PPK balance estimation — PPK only applies to UoP (employment contract).
 */
export const getEarliestRecurringSalary = async (
  email: string
): Promise<SalaryForPpk | null> => {
  try {
    const res = await fetch(
      `/api/backend/users/${encodeURIComponent(email)}/income`
    );
    if (!res.ok) return null;
    const incomes = await res.json();
    const salary = incomes
      .filter((i: { is_recurring?: boolean; category?: string; owner?: string | null }) =>
        i.is_recurring && i.category === 'salary' && (i.owner === 'self' || i.owner === null || i.owner === undefined)
      )
      .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))[0];
    if (!salary) return null;
    return {
      date: salary.date,
      grossAmount: salary.gross_amount || salary.amount,
      netAmount: salary.amount,
      description: salary.description || '',
      ownerName: salary.user_name || null,
    };
  } catch (error) {
    logger.error('Error fetching earliest recurring salary:', error);
    return null;
  }
};

// ============== Savings Goals API ==============

/**
 * Fetches all savings goals for the current user
 */
export const getSavingsGoals = async (
  status?: GoalStatus,
  category?: SavingCategory
): Promise<SavingsGoal[]> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);

    const url = `/api/savings/goals${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch savings goals');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error fetching savings goals:', error);
    return [];
  }
};

/**
 * Fetches a single savings goal with its linked savings entries
 */
export const getSavingsGoal = async (goalId: number): Promise<SavingsGoalWithSavings | null> => {
  try {
    const response = await fetch(`/api/savings/goals/${goalId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch savings goal');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error fetching savings goal:', error);
    return null;
  }
};

/**
 * Creates a new savings goal
 */
export const createSavingsGoal = async (goal: SavingsGoalCreate): Promise<SavingsGoal | null> => {
  try {
    const response = await fetch('/api/savings/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });

    if (!response.ok) {
      throw new Error('Failed to create savings goal');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error creating savings goal:', error);
    return null;
  }
};

/**
 * Updates an existing savings goal
 */
export const updateSavingsGoal = async (
  goalId: number,
  updates: SavingsGoalUpdate
): Promise<SavingsGoal | null> => {
  try {
    const response = await fetch(`/api/savings/goals/${goalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update savings goal');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error updating savings goal:', error);
    return null;
  }
};

/**
 * Deletes a savings goal
 */
export const deleteSavingsGoal = async (goalId: number): Promise<boolean> => {
  try {
    const response = await fetch(`/api/savings/goals/${goalId}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (error) {
    logger.error('Error deleting savings goal:', error);
    return false;
  }
};

/**
 * Marks a savings goal as complete
 */
export const completeGoal = async (goalId: number): Promise<SavingsGoal | null> => {
  try {
    const response = await fetch(`/api/savings/goals/${goalId}/complete`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to complete goal');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error completing goal:', error);
    return null;
  }
};
