'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import StatisticsSection from '@/components/landing/StatisticsSection';
import ProblemsSection from '@/components/landing/ProblemsSection';
import SolutionSection from '@/components/landing/SolutionSection';
import BabyStepsExplainer from '@/components/landing/BabyStepsExplainer';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ModulesShowcase from '@/components/landing/ModulesShowcase';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PricingSection from '@/components/landing/PricingSection';
import FAQSection from '@/components/landing/FAQSection';
import FinalCTASection from '@/components/landing/FinalCTASection';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // If user is authenticated, redirect to dashboard
    if (mounted && status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router, mounted]);

  // If authenticated after mount, show nothing while redirecting
  if (mounted && status === 'authenticated') {
    return null;
  }

  // Always render landing page content (session check happens in background)
  return (
    <>
      <LandingHeader />
      <main>
        <HeroSection />
        <StatisticsSection />
        <ProblemsSection />
        <SolutionSection />
        <BabyStepsExplainer />
        <FeaturesSection />
        <ModulesShowcase />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </>
  );
}
