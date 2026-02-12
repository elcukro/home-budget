'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  HomeIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  CreditCardIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  StarIcon,
  UserPlusIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';
import SproutlyFiLogo from './SproutlyFiLogo';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSettings } from '@/contexts/SettingsContext';

// Use Next.js API proxy for all backend calls to ensure auth headers are added

const navigation = [
  { name: 'navigation.onboarding', href: '/onboarding?force=true', icon: UserPlusIcon },
  { name: 'navigation.dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'navigation.financialFreedom', href: '/financial-freedom', icon: StarIcon },
  { name: 'navigation.income', href: '/income', icon: BanknotesIcon },
  { name: 'navigation.expenses', href: '/expenses', icon: CreditCardIcon },
  { name: 'navigation.loans', href: '/loans', icon: BuildingLibraryIcon },
  { name: 'navigation.savings', href: '/savings', icon: CurrencyDollarIcon },
  { name: 'navigation.bankTransactions', href: '/banking/transactions', icon: ArrowPathIcon },
  { name: 'navigation.reports', href: '/reports', icon: ChartBarIcon },
  { name: 'navigation.aiAnalysis', href: '/ai-analysis', icon: SparklesIcon },
  { name: 'navigation.settings', href: '/settings', icon: Cog6ToothIcon }
];

function SubscriptionBadge() {
  const { subscription, isPremium, isTrial } = useSubscription();

  if (subscription?.is_lifetime) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm">
        LIFETIME
      </span>
    );
  }

  if (isPremium && !isTrial) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm">
        PREMIUM
      </span>
    );
  }

  if (isTrial) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
        TRIAL
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
      FREE
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const intl = useIntl();
  const { data: session } = useSession();
  const { settings, isLoading: settingsLoading } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [, setOnboardingCheckDone] = useState(false);

  useEffect(() => {
    const checkShouldShowOnboarding = async () => {
      const userEmail = session?.user?.email;

      // Wait until we have user email and settings are loaded
      if (!userEmail || settingsLoading) return;

      // If onboarding already completed, definitely hide
      if (settings?.onboarding_completed === true) {
        setShowOnboarding(false);
        setOnboardingCheckDone(true);
        return;
      }

      // Settings loaded and onboarding_completed is false or undefined - check user data
      try {
        const [incomeRes, expensesRes, loansRes, savingsRes] = await Promise.all([
          fetch('/api/income'),
          fetch(`/api/backend/users/${encodeURIComponent(userEmail)}/expenses`),
          fetch('/api/backend/loans'),
          fetch('/api/savings'),
        ]);

        const hasIncome = incomeRes.ok && (await incomeRes.json()).length > 0;
        const hasExpenses = expensesRes.ok && (await expensesRes.json()).length > 0;
        const hasLoans = loansRes.ok && (await loansRes.json()).length > 0;
        const hasSavings = savingsRes.ok && (await savingsRes.json()).length > 0;

        // Only show onboarding if user is missing data in at least one section
        const hasAllData = hasIncome && hasExpenses && hasLoans && hasSavings;
        setShowOnboarding(!hasAllData);
      } catch {
        // On error, keep hidden (safe default)
        setShowOnboarding(false);
      }
      setOnboardingCheckDone(true);
    };

    void checkShouldShowOnboarding();
  }, [session?.user?.email, settings?.onboarding_completed, settingsLoading]);

  const isOnboardingPage = pathname === '/onboarding';

  // During onboarding, show only the onboarding link; otherwise, conditionally include it
  const filteredNavigation = isOnboardingPage
    ? navigation.filter((item) => item.href.startsWith('/onboarding'))
    : showOnboarding
      ? navigation
      : navigation.filter((item) => !item.href.startsWith('/onboarding'));

  return (
    <div className="sticky top-0 h-screen w-64 border-r border-default bg-muted z-40">
      <div className="h-full px-3 py-4 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-[#E5DDD2] scrollbar-track-transparent">
        <div className="space-y-3 min-h-full flex flex-col">
          <div className="flex items-center justify-between px-3">
            <SproutlyFiLogo />
          </div>

          {session?.user && (
            <div className="px-3 py-2 border-b border-default/70">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-primary truncate">
                      {session.user.name}
                    </p>
                    {session.user.isPartner ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 text-violet-700">
                        {intl.formatMessage({ id: "partner.badge" })}
                      </span>
                    ) : (
                      <SubscriptionBadge />
                    )}
                  </div>
                  <p className="text-xs text-secondary truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-1">
            {filteredNavigation.map((item) => {
              const itemPath = item.href.split('?')[0];
              const isActive = pathname === itemPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-mint/50 text-primary'
                      : 'text-secondary hover:bg-mint/40 hover:text-primary'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-primary' : 'text-secondary'
                    }`}
                    aria-hidden="true"
                  />
                  {intl.formatMessage({ id: item.name })}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4">
            {session && (
              <button
                onClick={() => signOut({
                  callbackUrl: '/',
                  redirect: true
                })}
                className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-mint/40 hover:text-primary transition-colors"
              >
                <ArrowRightOnRectangleIcon
                  className="mr-3 h-5 w-5 flex-shrink-0 text-secondary"
                  aria-hidden="true"
                />
                {intl.formatMessage({ id: 'auth.signOut' })}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
