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

  // Redirect first-time users to welcome page (trial info + plan comparison)
  useEffect(() => {
    if (isLoading || !user) return;

    // Don't redirect if already on onboarding page
    const isOnboardingPage = pathname === '/onboarding';
    if (isOnboardingPage) return;

    if (user.is_first_login) {
      router.replace('/welcome');
    }
  }, [user, isLoading, pathname, router]);

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
