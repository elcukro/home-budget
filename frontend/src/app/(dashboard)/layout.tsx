'use client';

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import { Toaster as SonnerToaster } from "@/components/ui/toaster";
import { useUser } from "@/contexts/UserContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const isOnboardingPage = pathname === '/onboarding';
  const isFirstLogin = !isLoading && user?.is_first_login && !isOnboardingPage;

  // Check if user has onboarding progress in localStorage
  const hasOnboardingProgress = typeof window !== 'undefined' && (() => {
    try {
      const stored = localStorage.getItem('sproutlyfi-onboarding');
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return parsed?.currentStepIndex > 0;
    } catch {
      return false;
    }
  })();

  // Redirect first-time users: to onboarding if they have progress, otherwise to welcome
  useEffect(() => {
    if (isFirstLogin) {
      router.replace(hasOnboardingProgress ? '/onboarding' : '/welcome');
    }
  }, [isFirstLogin, hasOnboardingProgress, router]);

  // Don't render dashboard while loading or redirecting to welcome
  if (isLoading || isFirstLogin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
      <Footer />
      <SonnerToaster />
    </div>
  );
}
