import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useOnboardingStore } from '@/stores/onboarding';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { checkOnboardingStatus, isCompleted: onboardingCompleted } = useOnboardingStore();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (isAuthenticated) {
        await checkOnboardingStatus();
      }
      setCheckingOnboarding(false);
    };

    if (!authLoading) {
      checkOnboarding();
    }
  }, [isAuthenticated, authLoading]);

  // Show nothing while checking auth or onboarding status
  if (authLoading || checkingOnboarding) {
    return null;
  }

  // Not authenticated - go to sign in
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Authenticated but hasn't completed onboarding - go to onboarding
  if (!onboardingCompleted) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  // Authenticated and onboarding completed - go to tabs
  return <Redirect href="/(tabs)" />;
}
