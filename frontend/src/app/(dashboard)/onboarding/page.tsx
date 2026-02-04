'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { useSettings } from '@/contexts/SettingsContext';
import { Loader2 } from 'lucide-react';

type OnboardingMode = 'fresh' | 'merge' | 'default';

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { settings, isLoading: settingsLoading } = useSettings();
  const fromPayment = searchParams?.get('from') === 'payment';
  const forceOnboarding = searchParams?.get('force') === 'true';
  const modeParam = searchParams?.get('mode');
  const mode: OnboardingMode = modeParam === 'fresh' || modeParam === 'merge' ? modeParam : 'default';

  const [isChecking, setIsChecking] = useState(true);
  const [hasExistingData, setHasExistingData] = useState(false);

  useEffect(() => {
    const checkForExistingData = async () => {
      if (!session?.user?.email) {
        setIsChecking(false);
        return;
      }

      // Allow forced onboarding (from settings page)
      if (forceOnboarding) {
        setIsChecking(false);
        return;
      }

      // Check if user has completed onboarding before
      if (settings?.onboarding_completed) {
        router.replace('/settings?tab=general&onboarding=redirect');
        return;
      }

      try {
        // Check for existing data (income and expenses are the most common)
        const [incomeRes, expensesRes] = await Promise.all([
          fetch('/api/income'),
          fetch(`/api/backend/users/${encodeURIComponent(session.user.email)}/expenses`),
        ]);

        const hasIncome = incomeRes.ok && (await incomeRes.json()).length > 0;

        let hasExpenses = false;
        if (expensesRes.ok) {
          const expensesData = await expensesRes.json();
          hasExpenses = expensesData.length > 0;
        }

        if (hasIncome || hasExpenses) {
          setHasExistingData(true);
          router.replace('/settings?tab=general&onboarding=redirect');
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error('Failed to check for existing data:', error);
        setIsChecking(false);
      }
    };

    if (!settingsLoading) {
      checkForExistingData();
    }
  }, [session, settings, settingsLoading, forceOnboarding, router]);

  // Show loading state while checking
  if (isChecking || settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <OnboardingWizard fromPayment={fromPayment} mode={mode} />;
}
