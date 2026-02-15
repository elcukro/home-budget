'use client';

import { useRouter } from 'next/navigation';
import { useIntl } from 'react-intl';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Flame,
  Sparkles,
  ArrowRight,
  Building2,
  Brain,
  FileSpreadsheet,
  Infinity,
  Crown,
} from 'lucide-react';
import Link from 'next/link';

const PREMIUM_FEATURES = [
  {
    icon: Infinity,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleKey: 'welcome.features.unlimited.title',
    descKey: 'welcome.features.unlimited.desc',
  },
  {
    icon: Building2,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    titleKey: 'welcome.features.bank.title',
    descKey: 'welcome.features.bank.desc',
  },
  {
    icon: Brain,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleKey: 'welcome.features.ai.title',
    descKey: 'welcome.features.ai.desc',
  },
  {
    icon: FileSpreadsheet,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    titleKey: 'welcome.features.reports.title',
    descKey: 'welcome.features.reports.desc',
  },
];

function formatTrialDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function WelcomePage() {
  const router = useRouter();
  const intl = useIntl();
  const { data: session } = useSession();
  const { subscription, isLoading, isTrial } = useSubscription();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 fixed inset-0">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-700 font-medium">
            {intl.formatMessage({ id: 'auth.loading' })}
          </p>
        </div>
      </div>
    );
  }

  const trialEndDate = subscription?.trial_ends_at;
  const locale = intl.locale;

  const _handleContinue = () => {
    router.push('/onboarding');
  };

  const handleSkip = () => {
    // Don't mark first-login-complete here — let the onboarding wizard handle it
    router.push('/onboarding');
  };

  const firstName = session?.user?.name?.split(' ')[0] || '';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-2xl mx-4 py-12">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <Flame className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Greeting */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-3">
            {firstName
              ? intl.formatMessage(
                  { id: 'welcome.greeting', defaultMessage: 'Witaj, {name}!' },
                  { name: firstName }
                )
              : intl.formatMessage({ id: 'welcome.title' })}
          </h1>
          <p className="text-lg text-emerald-700/70 max-w-lg mx-auto">
            {intl.formatMessage({ id: 'welcome.subtitle' })}
          </p>
        </div>

        {/* Trial Badge */}
        {isTrial && trialEndDate && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-full px-6 py-3 shadow-sm">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <div className="text-sm">
                <span className="text-emerald-700 font-medium">
                  {intl.formatMessage(
                    { id: 'welcome.trial.active', defaultMessage: '7 dni Premium gratis' }
                  )}
                </span>
                <span className="text-emerald-600/60 ml-2">
                  do {formatTrialDate(trialEndDate, locale)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Features Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-8 mb-8 shadow-lg shadow-emerald-100/30">
          <h2 className="text-lg font-semibold text-emerald-900 mb-6 text-center">
            {intl.formatMessage({ id: 'welcome.features.heading' })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PREMIUM_FEATURES.map((feature) => (
              <div key={feature.titleKey} className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 ${feature.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                >
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <div>
                  <p className="font-medium text-emerald-900 text-sm">
                    {intl.formatMessage({ id: feature.titleKey })}
                  </p>
                  <p className="text-emerald-700/60 text-xs">
                    {intl.formatMessage({ id: feature.descKey })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* What's included in free */}
          <div className="mt-6 pt-6 border-t border-emerald-100">
            <p className="text-xs text-emerald-600/60 text-center">
              {intl.formatMessage({ id: 'welcome.finePrint' })}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleSkip}

            className="text-base px-10 py-6 h-auto group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
          >
            {intl.formatMessage({ id: 'welcome.start', defaultMessage: 'Zaczynajmy!' })}
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Pricing nudge */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 text-emerald-600/50 text-sm">
            <Crown className="w-4 h-4" />
            <span>
              {intl.formatMessage(
                {
                  id: 'welcome.pricing.nudge',
                  defaultMessage: 'Plany Premium od 19,99 PLN/mies.',
                }
              )}
            </span>
            <Link
              href="/checkout"
              className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 font-medium"
            >
              {intl.formatMessage(
                {
                  id: 'welcome.pricing.link',
                  defaultMessage: 'Zobacz plany',
                }
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
