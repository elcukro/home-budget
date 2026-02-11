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

export type HeroDashboardHealthStatus = 'excellent' | 'good' | 'warning' | 'critical';
export type MoveIconType = 'mortgage' | 'savings' | 'investment' | 'budget' | 'tax' | 'emergency';

export interface BudgetDistortion {
  is_distorted: boolean;
  one_time_total: number;
  explanation: string;
  corrected_surplus: number;
}

export interface Top3Move {
  title: string;
  description: string;
  impact: string;
  icon_type: MoveIconType;
}

export interface HeroDashboard {
  greeting: string;
  health_status: HeroDashboardHealthStatus;
  monthly_cost_of_living: number;
  monthly_income: number;
  monthly_surplus: number;
  fire_progress_percent: number;
  fire_target: number;
  budget_distortion?: BudgetDistortion;
  top3_moves: Top3Move[];
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
  // Hero dashboard data (optional - may not be present in older cached insights)
  hero_dashboard?: HeroDashboard;
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