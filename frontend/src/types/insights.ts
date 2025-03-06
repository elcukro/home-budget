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

export interface InsightsResponse {
  categories: {
    health: Insight[];
    spending: Insight[];
    savings: Insight[];
    debt: Insight[];
    budget: Insight[];
  };
  status: {
    health: InsightStatus;
    spending: InsightStatus;
    savings: InsightStatus;
    debt: InsightStatus;
    budget: InsightStatus;
  };
  generatedAt: string;
} 