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
  REAL_ESTATE = "real_estate",
  OTHER = "other"
}

export enum SavingType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal"
}

export enum EntryType {
  CONTRIBUTION = "contribution",         // Regular deposit/withdrawal (counts toward annual limit)
  OPENING_BALANCE = "opening_balance",  // Historical balance from previous years (does NOT count toward limit)
  CORRECTION = "correction"              // Manual adjustment/correction
}

// Polish III Pillar retirement accounts and standard savings
export enum AccountType {
  STANDARD = "standard",     // Regular savings account
  IKE = "ike",               // Indywidualne Konto Emerytalne (limit 2026: 28,260 PLN)
  IKZE = "ikze",             // Indywidualne Konto Zabezpieczenia Emerytalnego (limit 2026: 11,304 / 16,956 PLN)
  PPK = "ppk",               // Pracownicze Plany Kapitałowe
  OIPE = "oipe"              // Ogólnoeuropejski Indywidualny Produkt Emerytalny
}

export interface Saving {
  id: number;
  user_id: number;
  category: SavingCategory;
  description?: string;
  amount: number;
  date: string;
  end_date?: string | null;  // Optional end date for recurring items (null = forever)
  is_recurring: boolean;
  target_amount?: number;  // Deprecated - use goal_id instead
  saving_type: SavingType;
  account_type?: AccountType;  // Type of savings account (IKE/IKZE/PPK/OIPE/standard)
  annual_return_rate?: number; // Expected annual return rate for compound interest (e.g., 0.05 for 5%)
  goal_id?: number | null;  // Link to a savings goal
  entry_type?: EntryType;  // Type of entry (contribution/opening_balance/correction)
  created_at: string;
  updated_at: string;
}

// ============== Savings Goals ==============

export enum GoalStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  PAUSED = "paused",
  ABANDONED = "abandoned"
}

export interface SavingsGoal {
  id: number;
  user_id: string;
  name: string;
  category: SavingCategory;
  target_amount: number;
  current_amount: number;
  deadline?: string | null;
  icon?: string | null;
  color?: string | null;
  status: GoalStatus;
  priority: number;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
  // Computed fields
  progress_percent: number;
  remaining_amount: number;
  is_on_track?: boolean | null;
  monthly_needed?: number | null;
}

export interface SavingsGoalWithSavings extends SavingsGoal {
  savings: Saving[];
}

export interface SavingsGoalCreate {
  name: string;
  category: SavingCategory;
  target_amount: number;
  deadline?: string | null;
  icon?: string | null;
  color?: string | null;
  priority?: number;
  notes?: string | null;
}

export interface SavingsGoalUpdate {
  name?: string;
  category?: SavingCategory;
  target_amount?: number;
  deadline?: string | null;
  icon?: string | null;
  color?: string | null;
  status?: GoalStatus;
  priority?: number;
  notes?: string | null;
}

export interface SavingsSummary {
  total_savings: number;
  category_totals: Record<SavingCategory, number>;
  monthly_contribution: number;
  ppk_balance?: number;  // PPK (Employee Capital Plans) total balance
  recent_transactions: Saving[];
  emergency_fund: number;
  emergency_fund_target: number;
  emergency_fund_progress: number;
}
