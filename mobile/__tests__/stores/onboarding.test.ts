import { useOnboardingStore, TOTAL_ONBOARDING_STEPS } from '@/stores/onboarding';
import { useAuthStore } from '@/stores/auth';
import { getApiClient, ApiError } from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api', () => ({
  getApiClient: jest.fn(),
  initializeApiClient: jest.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.name = 'ApiError';
      this.status = status;
      this.detail = detail;
    }
  },
}));

// Mock the auth store
jest.mock('@/stores/auth', () => {
  const actual = jest.requireActual('zustand');
  const store = actual.create(() => ({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    isFirstLogin: false,
    biometricEnabled: false,
    setFirstLoginComplete: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  }));
  return { useAuthStore: store };
});

const mockGetApiClient = getApiClient as jest.MockedFunction<typeof getApiClient>;

function resetStores() {
  useOnboardingStore.getState().reset();
  useAuthStore.setState({
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User', photoUrl: null },
    token: 'valid-token',
    isLoading: false,
    isAuthenticated: true,
    isFirstLogin: true,
    biometricEnabled: false,
  });
}

describe('Onboarding Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStores();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      useOnboardingStore.getState().reset();
      const state = useOnboardingStore.getState();

      expect(state.currentStep).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should have correct initial data values', () => {
      useOnboardingStore.getState().reset();
      const { data } = useOnboardingStore.getState();

      expect(data.language).toBe('pl');
      expect(data.currency).toBe('PLN');
      expect(data.birthYear).toBeNull();
      expect(data.childrenCount).toBe(0);
      expect(data.employmentStatus).toBeNull();
      expect(data.netMonthlyIncome).toBeNull();
      expect(data.uses50KUP).toBe(false);
      expect(data.grossMonthlyIncome).toBeNull();
      expect(data.housingCost).toBeNull();
      expect(data.foodCost).toBeNull();
      expect(data.transportCost).toBeNull();
      expect(data.currentSavings).toBeNull();
    });

    it('should have TOTAL_ONBOARDING_STEPS equal to 7', () => {
      expect(TOTAL_ONBOARDING_STEPS).toBe(7);
    });
  });

  describe('setField', () => {
    it('should update language field', () => {
      useOnboardingStore.getState().setField('language', 'en');
      expect(useOnboardingStore.getState().data.language).toBe('en');
    });

    it('should update currency field', () => {
      useOnboardingStore.getState().setField('currency', 'EUR');
      expect(useOnboardingStore.getState().data.currency).toBe('EUR');
    });

    it('should update numeric fields', () => {
      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);
      expect(useOnboardingStore.getState().data.netMonthlyIncome).toBe(5000);
    });

    it('should handle null values for optional fields', () => {
      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);
      useOnboardingStore.getState().setField('netMonthlyIncome', null);
      expect(useOnboardingStore.getState().data.netMonthlyIncome).toBeNull();
    });

    it('should update employmentStatus', () => {
      useOnboardingStore.getState().setField('employmentStatus', 'b2b');
      expect(useOnboardingStore.getState().data.employmentStatus).toBe('b2b');
    });

    it('should update boolean field uses50KUP', () => {
      useOnboardingStore.getState().setField('uses50KUP', true);
      expect(useOnboardingStore.getState().data.uses50KUP).toBe(true);
    });

    it('should maintain immutability - data reference changes on update', () => {
      const dataBefore = useOnboardingStore.getState().data;
      useOnboardingStore.getState().setField('language', 'en');
      const dataAfter = useOnboardingStore.getState().data;

      expect(dataBefore).not.toBe(dataAfter);
      expect(dataBefore.language).toBe('pl');
      expect(dataAfter.language).toBe('en');
    });

    it('should not affect other fields when updating one field', () => {
      useOnboardingStore.getState().setField('netMonthlyIncome', 8000);
      useOnboardingStore.getState().setField('housingCost', 2000);

      const { data } = useOnboardingStore.getState();
      expect(data.netMonthlyIncome).toBe(8000);
      expect(data.housingCost).toBe(2000);
      expect(data.language).toBe('pl'); // unchanged
    });
  });

  describe('Step Navigation', () => {
    it('should advance step with nextStep', () => {
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it('should go back with prevStep', () => {
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });

    it('should not go below step 0 (boundary check)', () => {
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);

      // Try again to be sure
      useOnboardingStore.getState().prevStep();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it('should not go above step 6 (boundary check)', () => {
      // Advance to step 6
      for (let i = 0; i < 10; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(TOTAL_ONBOARDING_STEPS - 1);
    });

    it('should navigate through all 7 steps', () => {
      for (let i = 0; i < TOTAL_ONBOARDING_STEPS - 1; i++) {
        expect(useOnboardingStore.getState().currentStep).toBe(i);
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(6);
    });
  });

  describe('skipOnboarding', () => {
    it('should call settings.update with language/currency and mark complete', async () => {
      const mockSettingsUpdate = jest.fn().mockResolvedValue({});
      const mockMarkFirstLogin = jest.fn().mockResolvedValue({});
      mockGetApiClient.mockReturnValue({
        settings: { update: mockSettingsUpdate },
        users: { markFirstLoginComplete: mockMarkFirstLogin },
      } as any);

      useOnboardingStore.getState().setField('language', 'en');
      useOnboardingStore.getState().setField('currency', 'EUR');

      await useOnboardingStore.getState().skipOnboarding();

      expect(mockSettingsUpdate).toHaveBeenCalledWith('test@example.com', {
        language: 'en',
        currency: 'EUR',
        onboarding_completed: true,
      });
      expect(mockMarkFirstLogin).toHaveBeenCalledWith('test@example.com');
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });

    it('should handle dev mode - skip API calls', async () => {
      useAuthStore.setState({ token: 'dev-token-for-testing' });

      await useOnboardingStore.getState().skipOnboarding();

      expect(mockGetApiClient).not.toHaveBeenCalled();
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });

    it('should throw error if user is null', async () => {
      useAuthStore.setState({ user: null });

      await expect(useOnboardingStore.getState().skipOnboarding()).rejects.toThrow('User not found');
      expect(useOnboardingStore.getState().isLoading).toBe(false);
      expect(useOnboardingStore.getState().error).toBe('User not found');
    });

    it('should throw error if API client is null', async () => {
      mockGetApiClient.mockReturnValue(null);

      await expect(useOnboardingStore.getState().skipOnboarding()).rejects.toThrow('API client not initialized');
    });

    it('should sign out on 401 error', async () => {
      const mockSignOut = jest.fn().mockResolvedValue(undefined);
      useAuthStore.setState({ signOut: mockSignOut });

      const { ApiError: MockApiError } = jest.requireMock('@/lib/api');
      mockGetApiClient.mockReturnValue({
        settings: {
          update: jest.fn().mockRejectedValue(new MockApiError(401, 'Unauthorized')),
        },
      } as any);

      await expect(useOnboardingStore.getState().skipOnboarding()).rejects.toThrow();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should set loading state during operation', async () => {
      const mockSettingsUpdate = jest.fn().mockImplementation(() => {
        // Check that loading is true during the call
        expect(useOnboardingStore.getState().isLoading).toBe(true);
        return Promise.resolve({});
      });
      mockGetApiClient.mockReturnValue({
        settings: { update: mockSettingsUpdate },
        users: { markFirstLoginComplete: jest.fn().mockResolvedValue({}) },
      } as any);

      await useOnboardingStore.getState().skipOnboarding();
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('should update settings and mark first login complete', async () => {
      const mockSettingsUpdate = jest.fn().mockResolvedValue({});
      const mockMarkFirstLogin = jest.fn().mockResolvedValue({});
      mockGetApiClient.mockReturnValue({
        settings: { update: mockSettingsUpdate },
        users: { markFirstLoginComplete: mockMarkFirstLogin },
      } as any);

      await useOnboardingStore.getState().completeOnboarding();

      expect(mockSettingsUpdate).toHaveBeenCalledWith('test@example.com', {
        language: 'pl',
        currency: 'PLN',
        onboarding_completed: true,
      });
      expect(mockMarkFirstLogin).toHaveBeenCalledWith('test@example.com');
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should handle dev mode', async () => {
      useAuthStore.setState({ token: 'dev-token-for-testing' });

      await useOnboardingStore.getState().completeOnboarding();

      expect(mockGetApiClient).not.toHaveBeenCalled();
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should set error on failure', async () => {
      const { ApiError: MockApiError } = jest.requireMock('@/lib/api');
      mockGetApiClient.mockReturnValue({
        settings: {
          update: jest.fn().mockRejectedValue(new MockApiError(500, 'Server error')),
        },
      } as any);

      await expect(useOnboardingStore.getState().completeOnboarding()).rejects.toThrow();
      expect(useOnboardingStore.getState().error).toBe('500: Server error');
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });
  });

  describe('submitOnboarding', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        settings: { update: jest.fn().mockResolvedValue({}) },
        income: { create: jest.fn().mockResolvedValue({}) },
        expenses: { create: jest.fn().mockResolvedValue({}) },
        savings: { create: jest.fn().mockResolvedValue({}) },
        users: { markFirstLoginComplete: jest.fn().mockResolvedValue({}) },
      };
      mockGetApiClient.mockReturnValue(mockClient);
    });

    it('should perform all 5 sequential operations with full data', async () => {
      // Set all data fields
      const store = useOnboardingStore.getState();
      store.setField('language', 'en');
      store.setField('currency', 'EUR');
      store.setField('birthYear', 1990);
      store.setField('childrenCount', 2);
      store.setField('employmentStatus', 'employed');
      store.setField('uses50KUP', true);
      store.setField('netMonthlyIncome', 8000);
      store.setField('housingCost', 2500);
      store.setField('foodCost', 1500);
      store.setField('transportCost', 500);
      store.setField('currentSavings', 20000);

      await useOnboardingStore.getState().submitOnboarding();

      // Step 1: Settings update
      expect(mockClient.settings.update).toHaveBeenCalledWith('test@example.com', {
        language: 'en',
        currency: 'EUR',
        birth_year: 1990,
        children_count: 2,
        employment_status: 'employed',
        use_authors_costs: true,
        onboarding_completed: true,
      });

      // Step 2: Income record
      expect(mockClient.income.create).toHaveBeenCalledWith('test@example.com', expect.objectContaining({
        category: 'Wynagrodzenie',
        description: 'Wynagrodzenie netto',
        amount: 8000,
        is_recurring: true,
      }));

      // Step 3: Three expense records
      expect(mockClient.expenses.create).toHaveBeenCalledTimes(3);
      expect(mockClient.expenses.create).toHaveBeenCalledWith('test@example.com', expect.objectContaining({
        category: 'Mieszkanie',
        amount: 2500,
        is_recurring: true,
      }));
      expect(mockClient.expenses.create).toHaveBeenCalledWith('test@example.com', expect.objectContaining({
        category: 'Jedzenie',
        amount: 1500,
        is_recurring: true,
      }));
      expect(mockClient.expenses.create).toHaveBeenCalledWith('test@example.com', expect.objectContaining({
        category: 'Transport',
        amount: 500,
        is_recurring: true,
      }));

      // Step 4: Savings record
      expect(mockClient.savings.create).toHaveBeenCalledWith(expect.objectContaining({
        category: 'general',
        amount: 20000,
        saving_type: 'deposit',
        account_type: 'standard',
      }));

      // Step 5: Mark first login complete
      expect(mockClient.users.markFirstLoginComplete).toHaveBeenCalledWith('test@example.com');

      // Final state
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });

    it('should skip income record if not provided', async () => {
      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.income.create).not.toHaveBeenCalled();
      expect(mockClient.settings.update).toHaveBeenCalled();
      expect(mockClient.users.markFirstLoginComplete).toHaveBeenCalled();
    });

    it('should skip expense records if amounts are null', async () => {
      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.expenses.create).not.toHaveBeenCalled();
    });

    it('should skip expense records if amounts are zero', async () => {
      useOnboardingStore.getState().setField('housingCost', 0);
      useOnboardingStore.getState().setField('foodCost', 0);
      useOnboardingStore.getState().setField('transportCost', 0);

      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.expenses.create).not.toHaveBeenCalled();
    });

    it('should skip savings record if not provided', async () => {
      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.savings.create).not.toHaveBeenCalled();
    });

    it('should skip savings record if amount is zero', async () => {
      useOnboardingStore.getState().setField('currentSavings', 0);

      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.savings.create).not.toHaveBeenCalled();
    });

    it('should create only housing expense when only housing cost provided', async () => {
      useOnboardingStore.getState().setField('housingCost', 3000);

      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.expenses.create).toHaveBeenCalledTimes(1);
      expect(mockClient.expenses.create).toHaveBeenCalledWith('test@example.com', expect.objectContaining({
        category: 'Mieszkanie',
        amount: 3000,
      }));
    });

    it('should handle dev mode - skip all API calls', async () => {
      useAuthStore.setState({ token: 'dev-token-for-testing' });

      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);
      useOnboardingStore.getState().setField('housingCost', 2000);

      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.settings.update).not.toHaveBeenCalled();
      expect(mockClient.income.create).not.toHaveBeenCalled();
      expect(mockClient.expenses.create).not.toHaveBeenCalled();
      expect(mockClient.savings.create).not.toHaveBeenCalled();
      expect(mockClient.users.markFirstLoginComplete).not.toHaveBeenCalled();
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should reset data after successful submission', async () => {
      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);

      await useOnboardingStore.getState().submitOnboarding();

      // Data should be reset to initial values
      expect(useOnboardingStore.getState().data.netMonthlyIncome).toBeNull();
      expect(useOnboardingStore.getState().data.language).toBe('pl');
    });

    it('should throw and set error on API failure', async () => {
      mockClient.settings.update.mockRejectedValue(new Error('Network error'));

      await expect(useOnboardingStore.getState().submitOnboarding()).rejects.toThrow('Network error');
      expect(useOnboardingStore.getState().error).toBe('Network error');
      expect(useOnboardingStore.getState().isLoading).toBe(false);
      expect(useOnboardingStore.getState().isCompleted).toBe(false);
    });

    it('should format ApiError messages with status code', async () => {
      const { ApiError: MockApiError } = jest.requireMock('@/lib/api');
      mockClient.settings.update.mockRejectedValue(new MockApiError(422, 'Validation failed'));

      await expect(useOnboardingStore.getState().submitOnboarding()).rejects.toThrow();
      expect(useOnboardingStore.getState().error).toBe('422: Validation failed');
    });

    it('should throw error if user is null', async () => {
      useAuthStore.setState({ user: null });

      await expect(useOnboardingStore.getState().submitOnboarding()).rejects.toThrow('User not found');
    });

    it('should throw error if API client is null', async () => {
      mockGetApiClient.mockReturnValue(null);

      await expect(useOnboardingStore.getState().submitOnboarding()).rejects.toThrow('API client not initialized');
    });
  });

  describe('checkOnboardingStatus', () => {
    it('should return true when onboarding_completed is true', async () => {
      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockResolvedValue({ onboarding_completed: true }),
        },
      } as any);

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(true);
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should return false when onboarding_completed is false', async () => {
      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockResolvedValue({ onboarding_completed: false }),
        },
      } as any);

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(false);
      expect(useOnboardingStore.getState().isCompleted).toBe(false);
    });

    it('should return false when onboarding_completed is undefined', async () => {
      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockResolvedValue({}),
        },
      } as any);

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(false);
    });

    it('should return false in dev mode', async () => {
      useAuthStore.setState({ token: 'dev-token-for-testing' });

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(false);
      expect(useOnboardingStore.getState().isCompleted).toBe(false);
    });

    it('should return true when user is null (do not block)', async () => {
      useAuthStore.setState({ user: null });

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(true);
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should return true when API client is null (do not block)', async () => {
      mockGetApiClient.mockReturnValue(null);

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(true);
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should return true on API error (do not block user)', async () => {
      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockRejectedValue(new Error('Network error')),
        },
      } as any);

      const result = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(result).toBe(true);
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Modify state
      useOnboardingStore.getState().setField('language', 'en');
      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);
      useOnboardingStore.getState().nextStep();
      useOnboardingStore.getState().nextStep();

      // Reset
      useOnboardingStore.getState().reset();

      const state = useOnboardingStore.getState();
      expect(state.currentStep).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.data.language).toBe('pl');
      expect(state.data.netMonthlyIncome).toBeNull();
    });
  });
});
