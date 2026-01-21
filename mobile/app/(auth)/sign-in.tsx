import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Hero illustration - journey to FIRE
const heroImage = require('@/assets/illustrations/signin-hero.png');
const mascot = require('@/assets/illustrations/mascot/flame-happy.png');

// Feature icons
const iconControl = require('@/assets/illustrations/icons/dashboard-control.png');
const iconHabits = require('@/assets/illustrations/icons/habit-streak.png');
const iconFire = require('@/assets/illustrations/icons/freedom-mountain.png');

// Detect Expo Go properly
const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically import GoogleSignin to avoid crash in Expo Go
let GoogleSignin: any = null;
let statusCodes: any = {};
let isSuccessResponse: any = () => false;
let isErrorWithCode: any = () => false;
let googleSignInAvailable = false;

try {
  const googleSignInModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignInModule.GoogleSignin;
  statusCodes = googleSignInModule.statusCodes;
  isSuccessResponse = googleSignInModule.isSuccessResponse;
  isErrorWithCode = googleSignInModule.isErrorWithCode;
  googleSignInAvailable = true;
} catch (e) {
  console.log('GoogleSignin not available (Expo Go mode) - using dev login');
}

// DEV MODE - auto-enable when GoogleSignin is not available (Expo Go)
const DEV_MODE = !googleSignInAvailable || isExpoGo;

// Get client IDs from app.json extra config
const googleAuthConfig = Constants.expoConfig?.extra?.googleAuth;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, devLogin, isLoading: authLoading } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Configure Google Sign-In on mount
  useEffect(() => {
    if (!DEV_MODE && googleAuthConfig) {
      try {
        GoogleSignin.configure({
          webClientId: googleAuthConfig.webClientId,
          iosClientId: googleAuthConfig.iosClientId,
          offlineAccess: false,
        });
        setIsConfigured(true);
        console.log('Google Sign-In configured successfully');
      } catch (err) {
        console.error('Failed to configure Google Sign-In:', err);
        setError('Nie udało się skonfigurować Google Sign-In');
      }
    }
  }, []);

  // Dev login bypass for testing
  const handleDevLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await devLogin();
      // Redirect to root - index.tsx will check onboarding status
      router.replace('/');
    } catch (err) {
      console.error('Dev login error:', err);
      setError('Wystąpił błąd podczas logowania');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (DEV_MODE) {
      return handleDevLogin();
    }

    if (!isConfigured) {
      setError('Google Sign-In nie jest skonfigurowany. Sprawdź konfigurację.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check if Google Play Services are available (Android only)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign in with Google
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const { idToken, user } = response.data;

        if (!idToken) {
          throw new Error('Nie otrzymano tokenu ID od Google');
        }

        console.log('Google Sign-In successful, exchanging token...');

        // Exchange Google token for app token via backend
        // Pass photo URL from Google user info
        await signInWithGoogle(idToken, user?.photo || null);

        console.log('Backend auth successful, navigating to app...');
        // Redirect to root - index.tsx will check onboarding status
        router.replace('/');
      } else {
        // User cancelled the sign-in
        console.log('Sign-in cancelled by user');
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);

      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User cancelled, don't show error
            break;
          case statusCodes.IN_PROGRESS:
            setError('Logowanie już trwa...');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setError('Google Play Services niedostępne');
            break;
          default:
            setError(`Błąd logowania: ${err.message || 'Nieznany błąd'}`);
        }
      } else {
        // Backend error or network error
        const message = err?.message || 'Wystąpił błąd podczas logowania';
        setError(message);

        // Show alert for detailed error in development
        if (__DEV__) {
          Alert.alert('Błąd logowania', JSON.stringify(err, null, 2));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || authLoading;

  return (
    <View style={styles.container}>
      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Hero Illustration - Full Width */}
        <View style={styles.heroContainer}>
          <Image
            source={heroImage}
            style={styles.heroImage}
            resizeMode="contain"
          />

          {/* Feature cards - directly under illustration */}
          <View style={styles.features}>
            <View style={styles.featureCard}>
              <Image source={iconControl} style={styles.featureIconImg} resizeMode="contain" />
              <Text style={styles.featureText}>Pełna{'\n'}kontrola</Text>
            </View>
            <View style={styles.featureCard}>
              <Image source={iconHabits} style={styles.featureIconImg} resizeMode="contain" />
              <Text style={styles.featureText}>Buduj{'\n'}nawyki</Text>
            </View>
            <View style={styles.featureCard}>
              <Image source={iconFire} style={styles.featureIconImg} resizeMode="contain" />
              <Text style={styles.featureText}>Osiągnij{'\n'}FIRE</Text>
            </View>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.logoRow}>
            <Image source={mascot} style={styles.mascotIcon} resizeMode="contain" />
            <Text style={styles.title}>FiredUp</Text>
          </View>
          <Text style={styles.subtitle}>Twoja droga do wolności finansowej</Text>
        </View>

        {/* Bottom Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Main CTA Button - Game Style */}
          <TouchableOpacity
            style={[styles.playButton, loading && styles.playButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.playButtonText}>🚀 Rozpocznij podróż</Text>
            )}
          </TouchableOpacity>

          {/* Google subtitle */}
          <Text style={styles.googleHint}>
            Zaloguj się przez Google
          </Text>


          {/* Terms */}
          <Text style={styles.terms}>
            Kontynuując, akceptujesz{' '}
            <Text style={styles.termsLink}>Regulamin</Text>
            {' '}i{' '}
            <Text style={styles.termsLink}>Politykę Prywatności</Text>
          </Text>

          {/* Debug info in development */}
          {__DEV__ && (
            <Text style={styles.debugText}>
              {Platform.OS} | {DEV_MODE ? 'DEV' : 'PROD'} | {isConfigured ? '✓' : '✗'} | {isExpoGo ? 'ExpoGo' : 'Build'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7ed', // Warm orange tint
  },
  content: {
    flex: 1,
  },

  // Hero - takes up most of the screen
  heroContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  heroImage: {
    width: SCREEN_WIDTH * 1.1,
    height: SCREEN_WIDTH * 0.85,
  },

  // Title
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mascotIcon: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: -2,
    textShadowColor: 'rgba(234, 88, 12, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#78350f',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 24,
  },
  featureCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconImg: {
    width: 72,
    height: 72,
    marginBottom: -4,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 15,
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: 24,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 14,
  },

  // Game-style Play Button - Green
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginBottom: 8,
    // Multiple shadows for depth
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 8,
    // Border for 3D effect
    borderBottomWidth: 4,
    borderBottomColor: '#16a34a',
  },
  playButtonDisabled: {
    opacity: 0.7,
  },
  playButtonText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },

  googleHint: {
    fontSize: 13,
    color: '#9a3412',
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },

  terms: {
    fontSize: 11,
    color: '#9a3412',
    textAlign: 'center',
    lineHeight: 16,
    opacity: 0.6,
  },
  termsLink: {
    color: '#ea580c',
    fontWeight: '600',
  },
  debugText: {
    fontSize: 10,
    color: '#9a3412',
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.4,
  },
});
