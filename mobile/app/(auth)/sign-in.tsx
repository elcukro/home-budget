import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

// DEV MODE - set to false when using native build with Google Sign-In
const DEV_MODE = false;

// Get client IDs from app.json extra config
const googleAuthConfig = Constants.expoConfig?.extra?.googleAuth;

export default function SignInScreen() {
  const router = useRouter();
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
      router.replace('/(tabs)');
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
        const { idToken } = response.data;

        if (!idToken) {
          throw new Error('Nie otrzymano tokenu ID od Google');
        }

        console.log('Google Sign-In successful, exchanging token...');

        // Exchange Google token for app token via backend
        await signInWithGoogle(idToken);

        console.log('Backend auth successful, navigating to app...');
        router.replace('/(tabs)');
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
      <View style={styles.content}>
        {/* Branding */}
        <View style={styles.branding}>
          <Text style={styles.logo}>🔥</Text>
          <Text style={styles.title}>FiredUp</Text>
          <Text style={styles.subtitle}>Twoje finanse pod kontrolą</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <FeatureItem
            icon="📊"
            title="Śledź wydatki"
            description="Monitoruj przychody i wydatki"
          />
          <FeatureItem
            icon="🎯"
            title="Cele finansowe"
            description="Baby Steps Dave'a Ramseya"
          />
          <FeatureItem
            icon="🏦"
            title="Połącz bank"
            description="Automatyczny import transakcji"
          />
        </View>

        {/* Dev mode indicator */}
        {DEV_MODE && (
          <View style={styles.devModeContainer}>
            <Text style={styles.devModeText}>
              🔧 DEV MODE - logowanie testowe
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.signInButton, loading && styles.signInButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.signInButtonText}>
                {DEV_MODE ? 'Zaloguj (DEV)' : 'Zaloguj przez Google'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Dev login button when not in DEV_MODE but for testing */}
        {__DEV__ && !DEV_MODE && (
          <TouchableOpacity
            style={styles.devButton}
            onPress={handleDevLogin}
            disabled={loading}
          >
            <Text style={styles.devButtonText}>
              🔧 Dev Login (skip OAuth)
            </Text>
          </TouchableOpacity>
        )}

        {/* Terms */}
        <Text style={styles.terms}>
          Logując się, akceptujesz Regulamin i Politykę Prywatności
        </Text>

        {/* Debug info in development */}
        {__DEV__ && (
          <Text style={styles.debugText}>
            Platform: {Platform.OS} | DEV_MODE: {DEV_MODE ? 'ON' : 'OFF'} | Configured: {isConfigured ? 'YES' : 'NO'}
          </Text>
        )}
      </View>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  branding: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  features: {
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
  },
  devModeContainer: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  devModeText: {
    color: '#92400e',
    textAlign: 'center',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 12,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  devButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  devButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  terms: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  debugText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});
