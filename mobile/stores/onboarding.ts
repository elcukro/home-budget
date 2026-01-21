import { create } from 'zustand';
import { getApiClient, ApiError } from '@/lib/api';
import { useAuthStore } from './auth';

// Dev mode detection - skip onboarding API calls in dev mode
const isDevToken = (token: string | null) => token === 'dev-token-for-testing';

// Total onboarding steps: welcome, about-you, income, expenses, savings
export const TOTAL_ONBOARDING_STEPS = 5;

// Employment status options (matching web onboarding)
export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Etat' },
  { value: 'b2b', label: 'B2B' },
  { value: 'self_employed', label: 'Własna firma' },
  { value: 'contract', label: 'Umowa zlecenie' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'unemployed', label: 'Bezrobotny' },
] as const;

export type EmploymentStatus = typeof EMPLOYMENT_STATUS_OPTIONS[number]['value'];

// Language options
export const LANGUAGE_OPTIONS = [
  { value: 'pl', label: 'Polski', flag: '🇵🇱' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

export type Language = typeof LANGUAGE_OPTIONS[number]['value'];

// Currency options
export const CURRENCY_OPTIONS = [
  { value: 'PLN', label: 'PLN', symbol: 'zł', flag: '🇵🇱' },
  { value: 'EUR', label: 'EUR', symbol: '€', flag: '🇪🇺' },
  { value: 'USD', label: 'USD', symbol: '$', flag: '🇺🇸' },
  { value: 'GBP', label: 'GBP', symbol: '£', flag: '🇬🇧' },
] as const;

export type Currency = typeof CURRENCY_OPTIONS[number]['value'];

// Collected data interface
export interface OnboardingData {
  // Settings (Step 1: Welcome)
  language: Language;
  currency: Currency;

  // Personal info (Step 2: About You)
  birthYear: number | null;
  childrenCount: number;
  employmentStatus: EmploymentStatus | null;

  // Income (Step 3)
  netMonthlyIncome: number | null;
  uses50KUP: boolean; // 50% costs of obtaining revenue
  grossMonthlyIncome: number | null; // Only needed if uses50KUP is true

  // Expenses (Step 4)
  housingCost: number | null;
  foodCost: number | null;
  transportCost: number | null;

  // Savings (Step 5)
  currentSavings: number | null;
}

const initialData: OnboardingData = {
  language: 'pl',
  currency: 'PLN',
  birthYear: null,
  childrenCount: 0,
  employmentStatus: null,
  netMonthlyIncome: null,
  uses50KUP: false,
  grossMonthlyIncome: null,
  housingCost: null,
  foodCost: null,
  transportCost: null,
  currentSavings: null,
};

interface OnboardingState {
  currentStep: number;           // 0-4 (5 steps total)
  isCompleted: boolean;          // Synced with backend
  isLoading: boolean;
  error: string | null;

  // Collected data
  data: OnboardingData;

  // Actions
  setField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  submitOnboarding: () => Promise<void>;
  checkOnboardingStatus: () => Promise<boolean>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 0,
  isCompleted: false,
  isLoading: false,
  error: null,
  data: { ...initialData },

  setField: (field, value) => {
    set((state) => ({
      data: { ...state.data, [field]: value },
    }));
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < TOTAL_ONBOARDING_STEPS - 1) {
      set({ currentStep: currentStep + 1 });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },

  skipOnboarding: async () => {
    try {
      set({ isLoading: true, error: null });

      // Get user from auth store and collected data
      const { user, token } = useAuthStore.getState();
      const { data } = get();

      // In dev mode, just mark as complete locally
      if (isDevToken(token)) {
        set({ isCompleted: true, isLoading: false });
        return;
      }

      if (!user) {
        throw new Error('User not found');
      }

      const client = getApiClient();
      if (!client) {
        throw new Error('API client not initialized');
      }

      // Update settings with collected language/currency and mark as completed
      await client.settings.update(user.email, {
        language: data.language,
        currency: data.currency,
        onboarding_completed: true,
      });

      set({ isCompleted: true, isLoading: false });
    } catch (error) {
      // If 401, the onUnauthorized callback should handle sign out
      // But let's make sure and also handle it here
      if (error instanceof ApiError && error.status === 401) {
        console.error('Token expired, signing out...');
        await useAuthStore.getState().signOut();
      }

      const errorMessage = error instanceof ApiError
        ? `${error.status}: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`
        : error instanceof Error
          ? error.message
          : 'Wystąpił błąd';
      console.error('Failed to skip onboarding:', errorMessage);
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  completeOnboarding: async () => {
    try {
      set({ isLoading: true, error: null });

      // Get user from auth store and collected data
      const { user, token } = useAuthStore.getState();
      const { data } = get();

      // In dev mode, just mark as complete locally
      if (isDevToken(token)) {
        set({ isCompleted: true, isLoading: false });
        return;
      }

      if (!user) {
        throw new Error('User not found');
      }

      const client = getApiClient();
      if (!client) {
        throw new Error('API client not initialized');
      }

      // Update settings with collected language/currency and mark as completed
      await client.settings.update(user.email, {
        language: data.language,
        currency: data.currency,
        onboarding_completed: true,
      });

      set({ isCompleted: true, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof ApiError
        ? `${error.status}: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`
        : error instanceof Error
          ? error.message
          : 'Wystąpił błąd';
      console.error('Failed to complete onboarding:', errorMessage);
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  submitOnboarding: async () => {
    try {
      set({ isLoading: true, error: null });

      const { data } = get();
      const { user, token } = useAuthStore.getState();

      console.log('[Onboarding] Starting submission with data:', JSON.stringify(data, null, 2));

      // In dev mode, just mark as complete locally
      if (isDevToken(token)) {
        set({ isCompleted: true, isLoading: false, data: { ...initialData } });
        return;
      }

      if (!user) {
        throw new Error('User not found');
      }

      const client = getApiClient();
      if (!client) {
        throw new Error('API client not initialized');
      }

      const today = new Date().toISOString().split('T')[0];

      // 1. Update settings with collected data (no need to fetch first - we have all required fields)
      console.log('[Onboarding] Step 1: Updating settings...');
      await client.settings.update(user.email, {
        language: data.language,
        currency: data.currency,
        birth_year: data.birthYear,
        children_count: data.childrenCount,
        employment_status: data.employmentStatus,
        use_authors_costs: data.uses50KUP,  // Backend field name for 50% KUP
        onboarding_completed: true,
      });
      console.log('[Onboarding] Step 1: Settings updated successfully');

      // 2. Create income record if provided
      if (data.netMonthlyIncome && data.netMonthlyIncome > 0) {
        console.log('[Onboarding] Step 2: Creating income record...');
        await client.income.create(user.email, {
          category: 'Wynagrodzenie',
          description: 'Wynagrodzenie netto',
          amount: data.netMonthlyIncome,
          is_recurring: true,
          date: today,
        });
        console.log('[Onboarding] Step 2: Income record created');
      }

      // 3. Create expense records if provided
      if (data.housingCost && data.housingCost > 0) {
        console.log('[Onboarding] Step 3a: Creating housing expense...');
        await client.expenses.create(user.email, {
          category: 'Mieszkanie',
          description: 'Czynsz/rata + media',
          amount: data.housingCost,
          is_recurring: true,
          date: today,
        });
        console.log('[Onboarding] Step 3a: Housing expense created');
      }

      if (data.foodCost && data.foodCost > 0) {
        console.log('[Onboarding] Step 3b: Creating food expense...');
        await client.expenses.create(user.email, {
          category: 'Jedzenie',
          description: 'Jedzenie i zakupy',
          amount: data.foodCost,
          is_recurring: true,
          date: today,
        });
        console.log('[Onboarding] Step 3b: Food expense created');
      }

      if (data.transportCost && data.transportCost > 0) {
        console.log('[Onboarding] Step 3c: Creating transport expense...');
        await client.expenses.create(user.email, {
          category: 'Transport',
          description: 'Transport',
          amount: data.transportCost,
          is_recurring: true,
          date: today,
        });
        console.log('[Onboarding] Step 3c: Transport expense created');
      }

      // 4. Create savings record if provided
      if (data.currentSavings && data.currentSavings > 0) {
        console.log('[Onboarding] Step 4: Creating savings record...');
        await client.savings.create({
          category: 'general',
          description: 'Aktualne oszczędności',
          amount: data.currentSavings,
          is_recurring: false,
          date: today,
          saving_type: 'deposit',
          account_type: 'standard',
        });
        console.log('[Onboarding] Step 4: Savings record created');
      }

      console.log('[Onboarding] All steps completed successfully!');
      set({ isCompleted: true, isLoading: false, data: { ...initialData } });
    } catch (error) {
      console.error('[Onboarding] Error occurred:', error);
      const errorMessage = error instanceof ApiError
        ? `${error.status}: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`
        : error instanceof Error
          ? error.message
          : 'Wystąpił błąd podczas zapisywania danych';
      console.error('[Onboarding] Error message:', errorMessage);
      set({
        isLoading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  checkOnboardingStatus: async (): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null });

      // Get user from auth store
      const { user, token } = useAuthStore.getState();

      // In dev mode, show onboarding (for testing)
      if (isDevToken(token)) {
        set({ isCompleted: false, isLoading: false });
        return false;
      }

      if (!user) {
        // No user, assume complete
        set({ isCompleted: true, isLoading: false });
        return true;
      }

      const client = getApiClient();
      if (!client) {
        // If no client, assume onboarding is complete (don't block)
        set({ isCompleted: true, isLoading: false });
        return true;
      }

      // Fetch settings using email as user ID
      const settings = await client.settings.get(user.email) as any;
      const isCompleted = settings.onboarding_completed ?? false;

      set({ isCompleted, isLoading: false });
      return isCompleted;
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      // On error, assume onboarding is complete to not block user
      set({ isCompleted: true, isLoading: false });
      return true;
    }
  },

  reset: () => {
    set({
      currentStep: 0,
      isCompleted: false,
      isLoading: false,
      error: null,
      data: { ...initialData },
    });
  },
}));
