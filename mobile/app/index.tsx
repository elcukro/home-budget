import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useOnboardingStore } from '@/stores/onboarding';
import { BiometricAuth } from '@/utils/biometric';

const isDevToken = (token: string | null) => token === 'dev-token-for-testing';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading, isFirstLogin, biometricEnabled, signInWithBiometric, token } = useAuthStore();
  const { checkOnboardingStatus, isCompleted: onboardingCompleted } = useOnboardingStore();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [checkingBiometric, setCheckingBiometric] = useState(true);

  // Check biometric authentication on app launch
  useEffect(() => {
    const checkBiometric = async () => {
      // Only check biometric if:
      // 1. Not authenticated yet
      // 2. Biometric is enabled
      // 3. Has stored credentials (token exists in secure store)
      if (!isAuthenticated && biometricEnabled && !authLoading) {
        const hasStoredCredentials = token !== null || await BiometricAuth.isEnabled();
        if (hasStoredCredentials) {
          const success = await signInWithBiometric();
          if (!success) {
            console.log('Biometric authentication failed or was cancelled');
          }
        }
      }
      setCheckingBiometric(false);
    };

    if (!authLoading) {
      checkBiometric();
    }
  }, [authLoading, isAuthenticated, biometricEnabled]);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (isAuthenticated) {
        await checkOnboardingStatus();
      }
      setCheckingOnboarding(false);
    };

    if (!authLoading && !checkingBiometric) {
      checkOnboarding();
    }
  }, [isAuthenticated, authLoading, checkingBiometric]);

  // Show nothing while checking auth, biometric or onboarding status
  if (authLoading || checkingBiometric || checkingOnboarding) {
    return null;
  }

  // Not authenticated - go to sign in
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Dev mode bypasses onboarding for testing
  if (isDevToken(token)) {
    return <Redirect href="/(tabs)" />;
  }

  // Authenticated but first login or hasn't completed onboarding - go to onboarding
  if (isFirstLogin || !onboardingCompleted) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  // Authenticated and onboarding completed - go to tabs
  return <Redirect href="/(tabs)" />;
}
