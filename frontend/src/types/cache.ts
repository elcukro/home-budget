import { InsightsResponse } from './insights';

export interface FinancialSnapshot {
  totalIncome: number;
  totalExpenses: number;
  totalDebt: number;
  timestamp: string;
}

export interface InsightsMetadata {
  isCached: boolean;
  createdAt: string;
  lastRefreshDate?: string;
  validityReason: string;
  dataChanges?: {
    income: string;
    expenses: string;
    loans: string;
  };
  financialTotals?: {
    income: number;
    expenses: number;
    loans: number;
  };
}

export interface CachedInsights {
  id: string;
  userId: string;
  insights: InsightsResponse;
  financialSnapshot: FinancialSnapshot;
  createdAt: string;
  isStale: boolean;
}

export interface ChangeThresholds {
  incomeChangeThreshold: number;
  expensesChangeThreshold: number;
  debtChangeThreshold: number;
  maxCacheAge: number;
}

export interface CacheValidityCheck {
  isCacheValid: boolean;
  reason: string;
  changes?: {
    incomeChange: number;
    expensesChange: number;
    debtChange: number;
  };
}

export interface EnhancedInsightsResponse extends InsightsResponse {
  metadata: InsightsMetadata;
} 