import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { initializeApiClient, getApiClient } from '@/lib/api';
import { BiometricAuth } from '@/utils/biometric';

// Dynamically import GoogleSignin to avoid crash in Expo Go
let GoogleSignin: any = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch (e) {
  console.log('GoogleSignin not available (Expo Go mode)');
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface User {
  id: string;
  email: string;
  name: string | null;
  photoUrl: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isFirstLogin: boolean;
  biometricEnabled: boolean;

  // Actions
  initialize: () => Promise<void>;
  signInWithGoogle: (idToken: string, photoUrl?: string | null) => Promise<void>;
  signInWithBiometric: () => Promise<boolean>;
  devLogin: () => Promise<void>;
  signOut: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setFirstLoginComplete: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isFirstLogin: false,
  biometricEnabled: false,

  initialize: async () => {
    try {
      // Load stored token and user
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const biometricEnabled = await BiometricAuth.isEnabled();

      if (token && userJson) {
        let user = JSON.parse(userJson) as User;

        // Migration: if photoUrl is missing, try to get it from Google
        if (!user.photoUrl && token !== 'dev-token-for-testing' && GoogleSignin) {
          try {
            const googleUser = await GoogleSignin.getCurrentUser();
            if (googleUser?.user?.photo) {
              user = { ...user, photoUrl: googleUser.user.photo };
              // Save updated user data
              await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
              console.log('Migrated user photo URL from Google');
            }
          } catch (err) {
            console.log('Could not get Google user photo:', err);
          }
        }

        // Initialize API client
        initializeApiClient(
          async () => token,
          () => get().signOut()
        );

        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          biometricEnabled,
        });
      } else {
        // Initialize API client without token (for login endpoint)
        initializeApiClient(
          async () => null,
          () => {}
        );

        set({ isLoading: false, biometricEnabled: false });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async (idToken: string, photoUrl?: string | null) => {
    try {
      set({ isLoading: true });

      // Initialize API client for auth request
      const client = initializeApiClient(
        async () => null,
        () => {}
      );

      // Exchange Google token for app token
      const response = await client.auth.mobileGoogleAuth(idToken);

      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        photoUrl: photoUrl || null,
      };

      // Store credentials
      await SecureStore.setItemAsync(TOKEN_KEY, response.access_token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

      // Re-initialize API client with token
      initializeApiClient(
        async () => response.access_token,
        () => get().signOut()
      );

      set({
        token: response.access_token,
        user,
        isAuthenticated: true,
        isFirstLogin: response.user.is_first_login ?? false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Google sign in failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Dev login for testing without Google OAuth
  devLogin: async () => {
    try {
      set({ isLoading: true });

      // Create a fake dev user
      const devUser: User = {
        id: 'dev-user-1',
        email: 'dev@firedup.app',
        name: 'Dev User',
        photoUrl: null,
      };

      const devToken = 'dev-token-for-testing';

      // Store credentials
      await SecureStore.setItemAsync(TOKEN_KEY, devToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(devUser));

      // Initialize API client with dev token (API calls will fail but UI will work)
      initializeApiClient(
        async () => devToken,
        () => get().signOut()
      );

      set({
        token: devToken,
        user: devUser,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Dev login failed:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  signInWithBiometric: async () => {
    try {
      // First check if we have stored credentials
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      
      if (!token || !userJson) {
        return false;
      }

      // Authenticate with biometrics
      const result = await BiometricAuth.authenticateForLogin();
      
      if (!result.success) {
        console.log('Biometric auth failed:', result.error);
        return false;
      }

      // If successful, restore the session
      const user = JSON.parse(userJson) as User;
      
      // Initialize API client
      initializeApiClient(
        async () => token,
        () => get().signOut()
      );

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error('Biometric sign in failed:', error);
      return false;
    }
  },

  setBiometricEnabled: async (enabled: boolean) => {
    try {
      if (enabled) {
        // Check if biometric is available before enabling
        const isAvailable = await BiometricAuth.isAvailable();
        if (!isAvailable) {
          throw new Error('Biometric authentication not available on this device');
        }
      }
      
      await BiometricAuth.setEnabled(enabled);
      set({ biometricEnabled: enabled });
    } catch (error) {
      console.error('Failed to set biometric preference:', error);
      throw error;
    }
  },

  setFirstLoginComplete: () => {
    set({ isFirstLogin: false });
  },

  signOut: async () => {
    try {
      // Clear stored credentials
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);

      // Also disable biometric on sign out
      await BiometricAuth.setEnabled(false);

      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isFirstLogin: false,
        biometricEnabled: false,
      });
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  },
}));
