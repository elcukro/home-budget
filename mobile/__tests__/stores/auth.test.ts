import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/auth';
import { initializeApiClient } from '@/lib/api';
import { BiometricAuth } from '@/utils/biometric';

// Mock the API module
jest.mock('@/lib/api', () => ({
  initializeApiClient: jest.fn().mockReturnValue({
    auth: {
      mobileGoogleAuth: jest.fn(),
    },
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
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    authenticateForLogin: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockInitializeApiClient = initializeApiClient as jest.MockedFunction<typeof initializeApiClient>;
const mockBiometricAuth = BiometricAuth as jest.Mocked<typeof BiometricAuth>;

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store
    useAuthStore.setState({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      isFirstLogin: false,
      biometricEnabled: false,
    });
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined as any);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined as any);
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isFirstLogin).toBe(false);
      expect(state.biometricEnabled).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should load stored token and user when available', async () => {
      const storedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        photoUrl: null,
      };
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'auth_token') return 'stored-token';
        if (key === 'auth_user') return JSON.stringify(storedUser);
        return null;
      });
      mockBiometricAuth.isEnabled.mockResolvedValue(true);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.token).toBe('stored-token');
      expect(state.user).toEqual(storedUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.biometricEnabled).toBe(true);
    });

    it('should set isLoading false when no stored credentials', async () => {
      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.biometricEnabled).toBe(false);
    });

    it('should initialize API client with token getter', async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'auth_token') return 'test-token';
        if (key === 'auth_user') return JSON.stringify({ id: '1', email: 'a@b.com', name: null, photoUrl: null });
        return null;
      });

      await useAuthStore.getState().initialize();

      expect(mockInitializeApiClient).toHaveBeenCalled();
    });

    it('should handle initialization error gracefully', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('signInWithGoogle', () => {
    it('should exchange token and store credentials', async () => {
      const mockResponse = {
        access_token: 'jwt-token-123',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 'user-id',
          email: 'user@test.com',
          name: 'Google User',
          is_first_login: false,
        },
      };
      const mockClient = {
        auth: {
          mobileGoogleAuth: jest.fn().mockResolvedValue(mockResponse),
        },
      };
      mockInitializeApiClient.mockReturnValue(mockClient as any);

      await useAuthStore.getState().signInWithGoogle('google-id-token', 'https://photo.url');

      // Should store token and user in SecureStore
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'jwt-token-123');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_user',
        expect.stringContaining('"email":"user@test.com"')
      );

      const state = useAuthStore.getState();
      expect(state.token).toBe('jwt-token-123');
      expect(state.user?.email).toBe('user@test.com');
      expect(state.user?.photoUrl).toBe('https://photo.url');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should set isFirstLogin from response', async () => {
      const mockResponse = {
        access_token: 'jwt-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 'user-id',
          email: 'new@test.com',
          name: 'New User',
          is_first_login: true,
        },
      };
      const mockClient = {
        auth: { mobileGoogleAuth: jest.fn().mockResolvedValue(mockResponse) },
      };
      mockInitializeApiClient.mockReturnValue(mockClient as any);

      await useAuthStore.getState().signInWithGoogle('google-token');

      expect(useAuthStore.getState().isFirstLogin).toBe(true);
    });

    it('should handle photoUrl as null when not provided', async () => {
      const mockResponse = {
        access_token: 'jwt-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'id', email: 'x@y.com', name: null, is_first_login: false },
      };
      const mockClient = {
        auth: { mobileGoogleAuth: jest.fn().mockResolvedValue(mockResponse) },
      };
      mockInitializeApiClient.mockReturnValue(mockClient as any);

      await useAuthStore.getState().signInWithGoogle('google-token');

      expect(useAuthStore.getState().user?.photoUrl).toBeNull();
    });

    it('should throw and set isLoading false on failure', async () => {
      const mockClient = {
        auth: { mobileGoogleAuth: jest.fn().mockRejectedValue(new Error('Auth failed')) },
      };
      mockInitializeApiClient.mockReturnValue(mockClient as any);

      await expect(useAuthStore.getState().signInWithGoogle('bad-token')).rejects.toThrow('Auth failed');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('signInWithBiometric', () => {
    it('should restore session on successful biometric auth', async () => {
      const storedUser = { id: '1', email: 'bio@test.com', name: 'Bio User', photoUrl: null };
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'auth_token') return 'stored-token';
        if (key === 'auth_user') return JSON.stringify(storedUser);
        return null;
      });
      mockBiometricAuth.authenticateForLogin.mockResolvedValue({ success: true });

      const result = await useAuthStore.getState().signInWithBiometric();

      expect(result).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().token).toBe('stored-token');
      expect(useAuthStore.getState().user).toEqual(storedUser);
    });

    it('should return false when no stored credentials', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await useAuthStore.getState().signInWithBiometric();

      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should return false when biometric auth fails', async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'auth_token') return 'stored-token';
        if (key === 'auth_user') return JSON.stringify({ id: '1', email: 'x@y.com', name: null, photoUrl: null });
        return null;
      });
      mockBiometricAuth.authenticateForLogin.mockResolvedValue({ success: false, error: 'User cancelled' });

      const result = await useAuthStore.getState().signInWithBiometric();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await useAuthStore.getState().signInWithBiometric();

      expect(result).toBe(false);
    });
  });

  describe('setFirstLoginComplete', () => {
    it('should set isFirstLogin to false', () => {
      useAuthStore.setState({ isFirstLogin: true });

      useAuthStore.getState().setFirstLoginComplete();

      expect(useAuthStore.getState().isFirstLogin).toBe(false);
    });
  });

  describe('setBiometricEnabled', () => {
    it('should enable biometric when available', async () => {
      mockBiometricAuth.isAvailable.mockResolvedValue(true);

      await useAuthStore.getState().setBiometricEnabled(true);

      expect(mockBiometricAuth.setEnabled).toHaveBeenCalledWith(true);
      expect(useAuthStore.getState().biometricEnabled).toBe(true);
    });

    it('should throw when biometric not available', async () => {
      mockBiometricAuth.isAvailable.mockResolvedValue(false);

      await expect(useAuthStore.getState().setBiometricEnabled(true))
        .rejects.toThrow('Biometric authentication not available on this device');
    });

    it('should disable biometric without checking availability', async () => {
      useAuthStore.setState({ biometricEnabled: true });

      await useAuthStore.getState().setBiometricEnabled(false);

      expect(mockBiometricAuth.setEnabled).toHaveBeenCalledWith(false);
      expect(useAuthStore.getState().biometricEnabled).toBe(false);
      // isAvailable should not be called for disabling
      expect(mockBiometricAuth.isAvailable).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should clear all credentials and state', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@test.com', name: 'Test', photoUrl: null },
        token: 'some-token',
        isAuthenticated: true,
        isFirstLogin: true,
        biometricEnabled: true,
      });

      await useAuthStore.getState().signOut();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user');
      expect(mockBiometricAuth.setEnabled).toHaveBeenCalledWith(false);

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isFirstLogin).toBe(false);
      expect(state.biometricEnabled).toBe(false);
    });

    it('should throw on storage error', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete failed'));

      await expect(useAuthStore.getState().signOut()).rejects.toThrow('Delete failed');
    });
  });

  describe('devLogin', () => {
    it('should create dev user with dev token', async () => {
      await useAuthStore.getState().devLogin();

      const state = useAuthStore.getState();
      expect(state.token).toBe('dev-token-for-testing');
      expect(state.user?.email).toBe('dev@firedup.app');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'dev-token-for-testing');
    });
  });
});
