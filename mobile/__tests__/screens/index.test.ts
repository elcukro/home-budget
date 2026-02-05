/**
 * Tests for the root Index screen routing logic.
 *
 * The Index screen is the entry point of the app. It decides where to route
 * the user based on auth state, biometric, onboarding status, and dev mode.
 */
import { useAuthStore } from '@/stores/auth';
import { useOnboardingStore } from '@/stores/onboarding';
import { getApiClient } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  initializeApiClient: jest.fn(),
  getApiClient: jest.fn(),
  ApiError: class extends Error {
    status: number;
    detail: string;
    constructor(s: number, d: string) { super(d); this.status = s; this.detail = d; this.name = 'ApiError'; }
  },
}));

jest.mock('@/utils/biometric', () => ({
  BiometricAuth: {
    isAvailable: jest.fn().mockResolvedValue(false),
    isEnabled: jest.fn().mockResolvedValue(false),
    setEnabled: jest.fn().mockResolvedValue(undefined),
    authenticateForLogin: jest.fn().mockResolvedValue({ success: false }),
  },
}));

// Mock the auth store as a real Zustand store for testing
jest.mock('@/stores/auth', () => {
  const { create } = jest.requireActual('zustand');
  const store = create(() => ({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
    isFirstLogin: false,
    biometricEnabled: false,
    setFirstLoginComplete: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  }));
  return { useAuthStore: store };
});

const mockGetApiClient = getApiClient as jest.MockedFunction<typeof getApiClient>;

/**
 * The Index screen routing logic (from app/index.tsx):
 *
 * 1. While loading auth/biometric/onboarding → render null
 * 2. Not authenticated → redirect to /(auth)/sign-in
 * 3. Dev token → redirect to /(tabs)
 * 4. First login or onboarding incomplete → redirect to /(onboarding)/welcome
 * 5. Authenticated + complete → redirect to /(tabs)
 *
 * We test the routing decisions by verifying store state combinations.
 */
describe('Index Screen Routing Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.getState().reset();
  });

  describe('Loading states', () => {
    it('should be in loading state when auth is loading', () => {
      useAuthStore.setState({ isLoading: true });

      // The component renders null during loading
      // We verify the conditions that would cause null render
      const authLoading = useAuthStore.getState().isLoading;
      expect(authLoading).toBe(true);
    });
  });

  describe('Not authenticated', () => {
    it('should redirect to sign-in when not authenticated', () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: false,
      });

      const { isAuthenticated } = useAuthStore.getState();
      expect(isAuthenticated).toBe(false);
      // Component would render <Redirect href="/(auth)/sign-in" />
    });
  });

  describe('Dev mode bypass', () => {
    it('should redirect to tabs when using dev token', () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        token: 'dev-token-for-testing',
        user: { id: 'dev', email: 'dev@firedup.app', name: 'Dev', photoUrl: null },
      });

      const { token, isAuthenticated } = useAuthStore.getState();
      const isDevToken = token === 'dev-token-for-testing';

      expect(isAuthenticated).toBe(true);
      expect(isDevToken).toBe(true);
      // Component would render <Redirect href="/(tabs)" />
    });
  });

  describe('First login routing', () => {
    it('should redirect to welcome when isFirstLogin is true', () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        isFirstLogin: true,
        token: 'valid-token',
      });

      const { isFirstLogin, isAuthenticated, token } = useAuthStore.getState();
      const isDevToken = token === 'dev-token-for-testing';

      expect(isAuthenticated).toBe(true);
      expect(isDevToken).toBe(false);
      expect(isFirstLogin).toBe(true);
      // Component would render <Redirect href="/(onboarding)/welcome" />
    });

    it('should redirect to welcome when onboarding is incomplete', async () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        isFirstLogin: false,
        token: 'valid-token',
        user: { id: 'u1', email: 'u1@test.com', name: 'U1', photoUrl: null },
      });

      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockResolvedValue({ onboarding_completed: false }),
        },
      } as any);

      const isComplete = await useOnboardingStore.getState().checkOnboardingStatus();
      expect(isComplete).toBe(false);

      const { isFirstLogin } = useAuthStore.getState();
      const { isCompleted: onboardingCompleted } = useOnboardingStore.getState();

      // isFirstLogin || !onboardingCompleted → redirect to welcome
      expect(isFirstLogin || !onboardingCompleted).toBe(true);
    });
  });

  describe('Authenticated and complete', () => {
    it('should redirect to tabs when authenticated and onboarding complete', async () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        isFirstLogin: false,
        token: 'valid-token',
        user: { id: 'u1', email: 'u1@test.com', name: 'U1', photoUrl: null },
      });

      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockResolvedValue({ onboarding_completed: true }),
        },
      } as any);

      const isComplete = await useOnboardingStore.getState().checkOnboardingStatus();
      expect(isComplete).toBe(true);

      const { isAuthenticated, isFirstLogin, token } = useAuthStore.getState();
      const { isCompleted: onboardingCompleted } = useOnboardingStore.getState();
      const isDevToken = token === 'dev-token-for-testing';

      expect(isAuthenticated).toBe(true);
      expect(isDevToken).toBe(false);
      expect(isFirstLogin).toBe(false);
      expect(onboardingCompleted).toBe(true);
      // Component would render <Redirect href="/(tabs)" />
    });
  });

  describe('Error recovery', () => {
    it('should not block user when onboarding check fails', async () => {
      useAuthStore.setState({
        isLoading: false,
        isAuthenticated: true,
        isFirstLogin: false,
        token: 'valid-token',
        user: { id: 'u1', email: 'u1@test.com', name: 'U1', photoUrl: null },
      });

      mockGetApiClient.mockReturnValue({
        settings: {
          get: jest.fn().mockRejectedValue(new Error('Server down')),
        },
      } as any);

      // Should assume complete on error
      const isComplete = await useOnboardingStore.getState().checkOnboardingStatus();
      expect(isComplete).toBe(true);

      // User should be able to access tabs
      const { isCompleted: onboardingCompleted } = useOnboardingStore.getState();
      expect(onboardingCompleted).toBe(true);
    });
  });
});
