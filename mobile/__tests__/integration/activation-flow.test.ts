/**
 * Integration tests for the complete First Time User Activation Flow.
 *
 * Tests the interaction between auth store, onboarding store, and API
 * to verify the full activation journey works correctly end-to-end.
 */
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth';
import { useOnboardingStore } from '@/stores/onboarding';
import { initializeApiClient, getApiClient } from '@/lib/api';
import { BiometricAuth } from '@/utils/biometric';

// Mock API module
jest.mock('@/lib/api', () => ({
  initializeApiClient: jest.fn().mockReturnValue({
    auth: { mobileGoogleAuth: jest.fn() },
  }),
  getApiClient: jest.fn(),
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

// Mock BiometricAuth
jest.mock('@/utils/biometric', () => ({
  BiometricAuth: {
    isAvailable: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(false),
    setEnabled: jest.fn().mockResolvedValue(undefined),
    authenticateForLogin: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockInitializeApiClient = initializeApiClient as jest.MockedFunction<typeof initializeApiClient>;
const mockGetApiClient = getApiClient as jest.MockedFunction<typeof getApiClient>;
const mockBiometricAuth = BiometricAuth as jest.Mocked<typeof BiometricAuth>;

function createMockApiClient() {
  return {
    auth: {
      mobileGoogleAuth: jest.fn().mockResolvedValue({
        access_token: 'jwt-token-new-user',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 'new-user-id',
          email: 'newuser@test.com',
          name: 'New User',
          is_first_login: true,
        },
      }),
    },
    settings: {
      get: jest.fn().mockResolvedValue({ onboarding_completed: false }),
      update: jest.fn().mockResolvedValue({}),
    },
    income: { create: jest.fn().mockResolvedValue({}) },
    expenses: { create: jest.fn().mockResolvedValue({}) },
    savings: { create: jest.fn().mockResolvedValue({}) },
    users: { markFirstLoginComplete: jest.fn().mockResolvedValue({}) },
  };
}

describe('Activation Flow Integration', () => {
  let mockClient: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockApiClient();
    mockInitializeApiClient.mockReturnValue(mockClient as any);
    mockGetApiClient.mockReturnValue(mockClient as any);
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined as any);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined as any);

    // Reset stores
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      isFirstLogin: false,
      biometricEnabled: false,
    });
    useOnboardingStore.getState().reset();
  });

  describe('Scenario A: New user - complete onboarding', () => {
    it('should complete the full sign-in → onboarding → main app flow', async () => {
      // Step 1: User signs in with Google
      await useAuthStore.getState().signInWithGoogle('google-id-token');

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isFirstLogin).toBe(true);

      // Step 2: Check onboarding status (should be incomplete for new user)
      const onboardingComplete = await useOnboardingStore.getState().checkOnboardingStatus();
      expect(onboardingComplete).toBe(false);

      // Step 3: User fills in onboarding data through 7 steps
      // Welcome screen (step 0) - language and currency
      useOnboardingStore.getState().setField('language', 'pl');
      useOnboardingStore.getState().setField('currency', 'PLN');
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(1);

      // Trial info (step 1) - informational only
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(2);

      // About you (step 2)
      useOnboardingStore.getState().setField('birthYear', 1990);
      useOnboardingStore.getState().setField('childrenCount', 1);
      useOnboardingStore.getState().setField('employmentStatus', 'employed');
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(3);

      // Income (step 3)
      useOnboardingStore.getState().setField('netMonthlyIncome', 8000);
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(4);

      // Expenses (step 4)
      useOnboardingStore.getState().setField('housingCost', 2500);
      useOnboardingStore.getState().setField('foodCost', 1500);
      useOnboardingStore.getState().setField('transportCost', 500);
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(5);

      // Savings (step 5)
      useOnboardingStore.getState().setField('currentSavings', 15000);
      useOnboardingStore.getState().nextStep();
      expect(useOnboardingStore.getState().currentStep).toBe(6);

      // Tutorial (step 6) - user clicks "Zaczynamy!" to submit
      // Set the auth state to match what signInWithGoogle would have set
      useAuthStore.setState({
        user: { id: 'new-user-id', email: 'newuser@test.com', name: 'New User', photoUrl: null },
        token: 'jwt-token-new-user',
      });

      await useOnboardingStore.getState().submitOnboarding();

      // Verify all API calls were made
      expect(mockClient.settings.update).toHaveBeenCalledWith('newuser@test.com', expect.objectContaining({
        language: 'pl',
        currency: 'PLN',
        birth_year: 1990,
        children_count: 1,
        employment_status: 'employed',
        onboarding_completed: true,
      }));
      expect(mockClient.income.create).toHaveBeenCalledTimes(1);
      expect(mockClient.expenses.create).toHaveBeenCalledTimes(3);
      expect(mockClient.savings.create).toHaveBeenCalledTimes(1);
      expect(mockClient.users.markFirstLoginComplete).toHaveBeenCalledWith('newuser@test.com');

      // Verify final state
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useAuthStore.getState().isFirstLogin).toBe(false);
    });
  });

  describe('Scenario B: New user - skip onboarding', () => {
    it('should skip onboarding and go to main app with minimal data', async () => {
      useAuthStore.setState({
        user: { id: 'skip-user', email: 'skipper@test.com', name: 'Skipper', photoUrl: null },
        token: 'jwt-token-skip',
        isAuthenticated: true,
        isFirstLogin: true,
      });

      // User selects language and currency on welcome, then clicks skip
      useOnboardingStore.getState().setField('language', 'en');
      useOnboardingStore.getState().setField('currency', 'EUR');

      await useOnboardingStore.getState().skipOnboarding();

      // Only settings + first login should be updated
      expect(mockClient.settings.update).toHaveBeenCalledWith('skipper@test.com', {
        language: 'en',
        currency: 'EUR',
        onboarding_completed: true,
      });
      expect(mockClient.users.markFirstLoginComplete).toHaveBeenCalledWith('skipper@test.com');

      // No records should be created
      expect(mockClient.income.create).not.toHaveBeenCalled();
      expect(mockClient.expenses.create).not.toHaveBeenCalled();
      expect(mockClient.savings.create).not.toHaveBeenCalled();

      // State should reflect completion
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
      expect(useAuthStore.getState().isFirstLogin).toBe(false);
    });
  });

  describe('Scenario C: Returning user - bypass onboarding', () => {
    it('should go directly to main app when onboarding already completed', async () => {
      // Setup returning user with completed onboarding
      mockClient.settings.get.mockResolvedValue({ onboarding_completed: true });

      useAuthStore.setState({
        user: { id: 'returning', email: 'returning@test.com', name: 'Returning', photoUrl: null },
        token: 'valid-token',
        isAuthenticated: true,
        isFirstLogin: false,
      });

      const isComplete = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(isComplete).toBe(true);
      expect(useOnboardingStore.getState().isCompleted).toBe(true);

      // No onboarding operations should be triggered
      expect(mockClient.settings.update).not.toHaveBeenCalled();
      expect(mockClient.income.create).not.toHaveBeenCalled();
    });
  });

  describe('Scenario D: Biometric returning user', () => {
    it('should restore session via biometrics and bypass onboarding', async () => {
      const storedUser = {
        id: 'bio-user',
        email: 'bio@test.com',
        name: 'Bio User',
        photoUrl: null,
      };
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'auth_token') return 'stored-jwt-token';
        if (key === 'auth_user') return JSON.stringify(storedUser);
        return null;
      });
      mockBiometricAuth.authenticateForLogin.mockResolvedValue({ success: true });
      mockClient.settings.get.mockResolvedValue({ onboarding_completed: true });

      // Biometric sign in
      const success = await useAuthStore.getState().signInWithBiometric();
      expect(success).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Check onboarding - should be complete
      const isComplete = await useOnboardingStore.getState().checkOnboardingStatus();
      expect(isComplete).toBe(true);
    });

    it('should fall back gracefully when biometric auth fails', async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'auth_token') return 'stored-jwt-token';
        if (key === 'auth_user') return JSON.stringify({ id: '1', email: 'x@y.com', name: null, photoUrl: null });
        return null;
      });
      mockBiometricAuth.authenticateForLogin.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      const success = await useAuthStore.getState().signInWithBiometric();
      expect(success).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('Scenario E: Dev mode bypass', () => {
    it('should skip all API calls in dev mode', async () => {
      useAuthStore.setState({
        user: { id: 'dev', email: 'dev@firedup.app', name: 'Dev', photoUrl: null },
        token: 'dev-token-for-testing',
        isAuthenticated: true,
      });

      // Fill in data
      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);
      useOnboardingStore.getState().setField('housingCost', 2000);

      // Submit
      await useOnboardingStore.getState().submitOnboarding();

      // No API calls
      expect(mockClient.settings.update).not.toHaveBeenCalled();
      expect(mockClient.income.create).not.toHaveBeenCalled();
      expect(mockClient.expenses.create).not.toHaveBeenCalled();
      expect(mockClient.users.markFirstLoginComplete).not.toHaveBeenCalled();

      // Still marked as complete
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should show onboarding in dev mode when checking status', async () => {
      useAuthStore.setState({
        user: { id: 'dev', email: 'dev@firedup.app', name: 'Dev', photoUrl: null },
        token: 'dev-token-for-testing',
        isAuthenticated: true,
      });

      const isComplete = await useOnboardingStore.getState().checkOnboardingStatus();

      expect(isComplete).toBe(false);
      expect(mockClient.settings.get).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle API timeout during submission (stays on tutorial, can retry)', async () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'u1@test.com', name: 'U1', photoUrl: null },
        token: 'valid-token',
        isAuthenticated: true,
      });
      useOnboardingStore.getState().setField('netMonthlyIncome', 5000);

      mockClient.settings.update.mockRejectedValue(new Error('Request timeout'));

      await expect(useOnboardingStore.getState().submitOnboarding()).rejects.toThrow('Request timeout');

      // Should stay incomplete - user can retry
      expect(useOnboardingStore.getState().isCompleted).toBe(false);
      expect(useOnboardingStore.getState().isLoading).toBe(false);
      expect(useOnboardingStore.getState().error).toBe('Request timeout');

      // Retry should work when API recovers
      mockClient.settings.update.mockResolvedValue({});
      await useOnboardingStore.getState().submitOnboarding();
      expect(useOnboardingStore.getState().isCompleted).toBe(true);
    });

    it('should handle network failure during onboarding status check', async () => {
      useAuthStore.setState({
        user: { id: 'u2', email: 'u2@test.com', name: 'U2', photoUrl: null },
        token: 'valid-token',
      });
      mockClient.settings.get.mockRejectedValue(new Error('Network error'));

      // Should assume complete to not block user
      const result = await useOnboardingStore.getState().checkOnboardingStatus();
      expect(result).toBe(true);
    });

    it('should handle 401 during onboarding submission by signing out', async () => {
      const mockSignOut = jest.fn().mockResolvedValue(undefined);
      useAuthStore.setState({
        user: { id: 'u3', email: 'u3@test.com', name: 'U3', photoUrl: null },
        token: 'expired-token',
        signOut: mockSignOut,
      });

      const { ApiError: MockApiError } = jest.requireMock('@/lib/api');
      mockClient.settings.update.mockRejectedValue(new MockApiError(401, 'Token expired'));

      await expect(useOnboardingStore.getState().skipOnboarding()).rejects.toThrow();

      // The store should call signOut on the auth store
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should handle partial onboarding data (null values skip record creation)', async () => {
      useAuthStore.setState({
        user: { id: 'partial', email: 'partial@test.com', name: 'Partial', photoUrl: null },
        token: 'valid-token',
        isAuthenticated: true,
      });

      // Only set housing cost, skip income and other expenses
      useOnboardingStore.getState().setField('housingCost', 3000);

      await useOnboardingStore.getState().submitOnboarding();

      expect(mockClient.settings.update).toHaveBeenCalled();
      expect(mockClient.income.create).not.toHaveBeenCalled();
      expect(mockClient.expenses.create).toHaveBeenCalledTimes(1); // only housing
      expect(mockClient.savings.create).not.toHaveBeenCalled();
      expect(mockClient.users.markFirstLoginComplete).toHaveBeenCalled();
    });

    it('should handle rapid step navigation without overflow', () => {
      // Rapidly advance
      for (let i = 0; i < 20; i++) {
        useOnboardingStore.getState().nextStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(6);

      // Rapidly go back
      for (let i = 0; i < 20; i++) {
        useOnboardingStore.getState().prevStep();
      }
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });
});
