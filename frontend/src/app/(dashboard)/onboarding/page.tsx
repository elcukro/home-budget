'use client';

import { useSearchParams } from 'next/navigation';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const fromPayment = searchParams?.get('from') === 'payment';

  return <OnboardingWizard fromPayment={fromPayment} />;
}
