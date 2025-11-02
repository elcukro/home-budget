export interface BabyStep {
  id: number;
  titleKey: string;
  descriptionKey: string;
  isCompleted: boolean;
  progress: number; // 0-100
  targetAmount?: number;
  currentAmount?: number;
  completionDate?: string;
  notes?: string;
  isAutoCalculated?: boolean; // Flag for data-driven steps
}

export interface FinancialFreedomData {
  userId: string;
  steps: BabyStep[];
  startDate: string;
  lastUpdated: string;
}

export enum SavingCategory {
  EMERGENCY_FUND = "emergency_fund",
  SIX_MONTH_FUND = "six_month_fund",
  RETIREMENT = "retirement",
  COLLEGE = "college",
  GENERAL = "general",
  INVESTMENT = "investment",
  OTHER = "other"
}

export enum SavingType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal"
}

export interface Saving {
  id: number;
  user_id: number;
  category: SavingCategory;
  description?: string;
  amount: number;
  date: string;
  is_recurring: boolean;
  target_amount?: number;
  saving_type: SavingType;
  created_at: string;
  updated_at: string;
}

export interface SavingsSummary {
  total_savings: number;
  category_totals: Record<SavingCategory, number>;
  monthly_contribution: number;
  recent_transactions: Saving[];
  emergency_fund: number;
  emergency_fund_target: number;
  emergency_fund_progress: number;
}
