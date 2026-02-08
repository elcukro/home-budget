export interface Insight {
  type: 'observation' | 'recommendation' | 'alert' | 'achievement';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionItems?: string[];
  metrics?: {
    label: string;
    value: string;
    trend: 'up' | 'down' | 'stable';
  }[];
}

export type InsightStatus = 'good' | 'can_be_improved' | 'ok' | 'bad';

// New FIRE-aligned category keys
export type InsightCategoryKey = 'baby_steps' | 'debt' | 'savings' | 'fire' | 'tax_optimization';

export interface CategoryChartData {
  type: 'donut' | 'bar' | 'progress' | 'timeline';
  data: {
    label: string;
    value: number;
    color?: string;
  }[];
}

export interface SuggestedGoal {
  name: string;
  category: string;
  targetAmount: number;
  deadline?: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  accountType?: string;
}

export interface InsightsResponse {
  categories: {
    baby_steps: Insight[];
    debt: Insight[];
    savings: Insight[];
    fire: Insight[];
    tax_optimization: Insight[];
  };
  status: {
    baby_steps: InsightStatus;
    debt: InsightStatus;
    savings: InsightStatus;
    fire: InsightStatus;
    tax_optimization: InsightStatus;
  };
  // FIRE-specific metrics
  currentBabyStep?: number;
  fireNumber?: number;
  savingsRate?: number;
  generatedAt?: string;
  metadata?: {
    isCached?: boolean;
    createdAt?: string;
    lastRefreshDate?: string;
    language?: string;
    validityReason?: string;
    generatedAt?: string;
    source?: string;
  };
} 