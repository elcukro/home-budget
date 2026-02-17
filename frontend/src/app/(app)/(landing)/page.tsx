'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import StatisticsSection from '@/components/landing/StatisticsSection';
import ProblemsSection from '@/components/landing/ProblemsSection';
import SolutionSection from '@/components/landing/SolutionSection';
import BabyStepsExplainer from '@/components/landing/BabyStepsExplainer';
import FeaturesSection from '@/components/landing/FeaturesSection';
import SecuritySection from '@/components/landing/SecuritySection';
import ModulesShowcase from '@/components/landing/ModulesShowcase';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PricingSection from '@/components/landing/PricingSection';
import FAQSection from '@/components/landing/FAQSection';
import ManualSection from '@/components/landing/ManualSection';
import FinalCTASection from '@/components/landing/FinalCTASection';
import BlogPreviewSectionClient from '@/components/blog/BlogPreviewSectionClient';
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

        {/* YNAB comparison callout */}
        <div className="bg-emerald-50 border-y border-emerald-100 py-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
            <span className="text-emerald-800 text-sm">🇵🇱 Używasz YNAB lub szukasz alternatywy?</span>
            <Link href="/ynab-alternatywa" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2">
              Sprawdź porównanie FiredUp vs YNAB →
            </Link>
          </div>
        </div>

        <SolutionSection />
        <BabyStepsExplainer />
        <FeaturesSection />
        <SecuritySection />
        <ModulesShowcase />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <ManualSection />
        <BlogPreviewSectionClient />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </>
  );
}
