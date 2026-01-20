import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { initializeApiClient, getApiClient } from '@/lib/api';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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

  // Actions
  initialize: () => Promise<void>;
  signInWithGoogle: (idToken: string, photoUrl?: string | null) => Promise<void>;
  devLogin: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      // Load stored token and user
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);

      if (token && userJson) {
        let user = JSON.parse(userJson) as User;

        // Migration: if photoUrl is missing, try to get it from Google
        if (!user.photoUrl && token !== 'dev-token-for-testing') {
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
        });
      } else {
        // Initialize API client without token (for login endpoint)
        initializeApiClient(
          async () => null,
          () => {}
        );

        set({ isLoading: false });
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

  signOut: async () => {
    try {
      // Clear stored credentials
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);

      set({
        token: null,
        user: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  },
}));
