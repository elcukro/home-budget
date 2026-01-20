/**
 * API client for FiredUp backend
 */

// Production API URL
const API_BASE_URL = 'https://firedup.app';

// ============== Type Definitions ==============

export interface Loan {
  id: string;
  description: string;
  balance: number;
  monthlyPayment: number;
  interestRate: number;
  progress: number;
  totalAmount: number;
  next_payment_date?: string;
}

export interface CashFlowEntry {
  month: string;
  income: number;
  expenses: number;
  loanPayments: number;
  netFlow: number;
}

export interface DistributionEntry {
  category: string;
  amount: number;
  percentage: number;
}

export interface DashboardSummary {
  total_monthly_income: number;
  total_monthly_expenses: number;
  total_monthly_loan_payments: number;
  monthly_balance: number;
  savings_rate: number;
  debt_to_income: number;
  income_distribution: DistributionEntry[];
  expense_distribution: DistributionEntry[];
  cash_flow: CashFlowEntry[];
  loans: Loan[];
  activities: Array<{
    id: number;
    title: string;
    amount: number;
    type: string;
    date: string;
    operation: 'create' | 'update' | 'delete';
  }>;
  total_savings_balance: number;
  monthly_savings: number;
  savings_goals: Array<{
    category: string;
    currentAmount: number;
    targetAmount: number;
    progress: number;
  }>;
}

export interface FinancialFreedomStep {
  id: number;
  titleKey: string;
  descriptionKey: string;
  isCompleted: boolean;
  progress: number;
  targetAmount: number | null;
  currentAmount: number | null;
  completionDate: string | null;
  notes: string;
}

export interface FinancialFreedomResponse {
  userId: string;
  steps: FinancialFreedomStep[];
  startDate: string;
  lastUpdated: string;
}

export interface FinancialFreedomUpdate {
  steps: FinancialFreedomStep[];
  startDate?: string;
}

// For local development, you can switch to:
// const API_BASE_URL = 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiClient {
  private baseUrl: string;
  private getToken: () => Promise<string | null>;
  private onUnauthorized?: () => void;

  constructor(
    getToken: () => Promise<string | null>,
    onUnauthorized?: () => void
  ) {
    this.baseUrl = API_BASE_URL;
    this.getToken = getToken;
    this.onUnauthorized = onUnauthorized;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, params, ...fetchOptions } = options;

    // Build URL with query params
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Get auth token
    const token = await this.getToken();

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Make request
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle errors
    if (!response.ok) {
      if (response.status === 401) {
        this.onUnauthorized?.();
      }

      let errorDetail: string;
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || response.statusText;
      } catch {
        errorDetail = response.statusText;
      }

      throw new ApiError(response.status, errorDetail);
    }

    // Handle empty responses
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============== Auth ==============

  auth = {
    mobileGoogleAuth: (idToken: string) =>
      this.request<{
        access_token: string;
        token_type: string;
        expires_in: number;
        user: { id: string; email: string; name: string | null };
      }>('/auth/mobile/google', {
        method: 'POST',
        body: { id_token: idToken },
      }),

    getCurrentUser: () =>
      this.request<{ id: string; email: string; name: string | null }>('/auth/mobile/me'),
  };

  // ============== Dashboard ==============

  dashboard = {
    /**
     * Get full dashboard summary with all calculations done server-side.
     * This is the main endpoint for dashboard data - handles recurring items,
     * loan payments, savings, etc. correctly.
     */
    getSummary: (userId: string) =>
      this.request<{
        total_monthly_income: number;
        total_monthly_expenses: number;
        total_monthly_loan_payments: number;
        total_loan_balance: number;
        monthly_balance: number;
        savings_rate: number;
        debt_to_income: number;
        income_distribution: Array<{ category: string; amount: number; percentage: number }>;
        expense_distribution: Array<{ category: string; amount: number; percentage: number }>;
        cash_flow: Array<{ month: string; income: number; expenses: number; loanPayments: number; netFlow: number }>;
        loans: Array<{
          id: string;
          description: string;
          balance: number;
          monthlyPayment: number;
          interestRate: number;
          progress: number;
          totalAmount: number;
        }>;
        activities: Array<{
          id: number;
          title: string;
          amount: number;
          type: string;
          date: string;
          operation: 'create' | 'update' | 'delete';
        }>;
        total_savings_balance: number;
        monthly_savings: number;
        savings_goals: Array<{
          category: string;
          currentAmount: number;
          targetAmount: number;
          progress: number;
        }>;
      }>(`/users/${userId}/summary`),
  };

  // ============== Financial Freedom ==============
  // Note: Uses /internal-api/ prefix to avoid conflict with web page route

  financialFreedom = {
    get: () =>
      this.request<FinancialFreedomResponse>('/internal-api/financial-freedom'),

    /**
     * Get financial freedom data with auto-calculated values for steps 1-3 and 6.
     * This endpoint calculates progress based on actual financial data (savings, loans, expenses).
     */
    getCalculated: () =>
      this.request<FinancialFreedomResponse>('/internal-api/financial-freedom/calculated'),

    update: (data: FinancialFreedomUpdate) =>
      this.request<FinancialFreedomResponse>('/internal-api/financial-freedom', {
        method: 'PUT',
        body: data,
      }),
  };

  // ============== Expenses ==============

  expenses = {
    list: (userId: string) =>
      this.request<Array<{
        id: number;
        category: string;
        description: string;
        amount: number;
        is_recurring: boolean;
        date: string;
        end_date: string | null;
        source: string;
      }>>(`/users/${userId}/expenses`),

    create: (userId: string, data: {
      category: string;
      description: string;
      amount: number;
      is_recurring?: boolean;
      date: string;
      end_date?: string;
    }) =>
      this.request(`/users/${userId}/expenses`, {
        method: 'POST',
        body: data,
      }),
  };

  // ============== Categories ==============

  categories = {
    list: (userId: string, params?: { type?: 'income' | 'expense' }) =>
      this.request<Array<{
        id: number;
        name: string;
        icon: string | null;
        color: string | null;
        type: 'income' | 'expense';
        budget_limit: number | null;
      }>>(`/users/${userId}/categories`, { params }),
  };

  // ============== Settings ==============

  settings = {
    get: (userId: string) =>
      this.request<{
        id: number;
        user_id: string;
        language: string;
        currency: string;
        base_currency: string;
        emergency_fund_target: number;
        emergency_fund_months: number;
        // Polish tax profile
        employment_status: string | null;
        tax_form: string | null;
        birth_year: number | null;
        children_count: number;
        // Timestamps
        created_at: string;
        updated_at: string | null;
      }>(`/users/${userId}/settings`),

    update: (userId: string, data: {
      language?: string;
      currency?: string;
      base_currency?: string;
      emergency_fund_target?: number;
      emergency_fund_months?: number;
      employment_status?: string | null;
      tax_form?: string | null;
      birth_year?: number | null;
      children_count?: number;
    }) =>
      this.request(`/users/${userId}/settings`, {
        method: 'PUT',
        body: data,
      }),
  };

  // ============== Subscription ==============
  // Note: Uses /internal-api/ prefix to bypass Next.js routing in production

  subscription = {
    getStatus: (userId: string) =>
      this.request<{
        status: string; // trialing, active, past_due, canceled, incomplete, free
        plan_type: string; // free, trial, monthly, annual, lifetime
        is_premium: boolean;
        is_trial: boolean;
        trial_ends_at: string | null;
        trial_days_left: number | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        is_lifetime: boolean;
      }>(`/internal-api/billing/status`, { params: { user_id: userId } }),
  };
}

// Singleton instance - will be initialized with auth store
let apiClientInstance: ApiClient | null = null;

export function initializeApiClient(
  getToken: () => Promise<string | null>,
  onUnauthorized?: () => void
): ApiClient {
  apiClientInstance = new ApiClient(getToken, onUnauthorized);
  return apiClientInstance;
}

export function getApiClient(): ApiClient | null {
  return apiClientInstance;
}
