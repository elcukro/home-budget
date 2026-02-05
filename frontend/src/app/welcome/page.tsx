'use client';

import { useRouter } from 'next/navigation';
import { useIntl } from 'react-intl';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown,
  faCheck,
  faCalendarDays,
  faInfinity,
  faRocket,
  faBuildingColumns,
  faRobot,
  faFileExport,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { Loader2 } from 'lucide-react';

const PREMIUM_FEATURES = [
  { iconKey: faRocket, titleKey: 'welcome.features.unlimited.title', descKey: 'welcome.features.unlimited.desc' },
  { iconKey: faBuildingColumns, titleKey: 'welcome.features.bank.title', descKey: 'welcome.features.bank.desc' },
  { iconKey: faRobot, titleKey: 'welcome.features.ai.title', descKey: 'welcome.features.ai.desc' },
  { iconKey: faFileExport, titleKey: 'welcome.features.reports.title', descKey: 'welcome.features.reports.desc' },
  { iconKey: faCircleCheck, titleKey: 'welcome.features.all.title', descKey: 'welcome.features.all.desc' },
];

const COMPARISON_ROWS = [
  { key: 'expenses', freeValue: '50/mies.', premiumValue: 'unlimited' },
  { key: 'incomes', freeValue: '20/mies.', premiumValue: 'unlimited' },
  { key: 'loans', freeValue: '3', premiumValue: 'unlimited' },
  { key: 'savings', freeValue: '3', premiumValue: 'unlimited' },
  { key: 'bank', freeValue: false, premiumValue: true },
  { key: 'ai', freeValue: false, premiumValue: true },
  { key: 'export', freeValue: false, premiumValue: true },
  { key: 'reports', freeValue: false, premiumValue: true },
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
  const { status: sessionStatus } = useSession();
  const { subscription, isLoading, isTrial } = useSubscription();

  // Redirect unauthenticated users
  if (sessionStatus === 'unauthenticated') {
    router.replace('/');
    return null;
  }

  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isLifetime = subscription?.is_lifetime ?? false;
  const trialExpired = !isTrial && !isLifetime && subscription?.status !== 'active';
  const trialEndDate = subscription?.trial_ends_at;
  const locale = intl.locale;

  const handleContinue = () => {
    router.push('/onboarding');
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  // Lifetime users see a simplified version
  if (isLifetime) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <FontAwesomeIcon icon={faCrown} className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {intl.formatMessage({ id: 'welcome.lifetime.title' })}
          </h1>
          <p className="text-muted-foreground text-lg">
            {intl.formatMessage({ id: 'welcome.lifetime.subtitle' })}
          </p>
          <Button size="lg" className="w-full sm:w-auto" onClick={handleContinue}>
            {intl.formatMessage({ id: 'welcome.continue' })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-8 px-4 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FontAwesomeIcon icon={faCrown} className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            {intl.formatMessage({
              id: trialExpired ? 'welcome.expired.title' : 'welcome.title',
            })}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {intl.formatMessage({
              id: trialExpired ? 'welcome.expired.subtitle' : 'welcome.subtitle',
            })}
          </p>
        </div>

        {/* Trial Date Card */}
        {isTrial && trialEndDate && !trialExpired && (
          <Card className="mb-8 border-primary">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FontAwesomeIcon icon={faCalendarDays} className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {intl.formatMessage({ id: 'welcome.trial.endsLabel' })}
                </p>
                <p className="text-lg font-bold text-primary">
                  {formatTrialDate(trialEndDate, locale)}
                </p>
                <p className="text-xs text-muted-foreground italic">
                  {intl.formatMessage({ id: 'welcome.trial.reminder' })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Features */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {intl.formatMessage({ id: 'welcome.features.heading' })}
          </h2>
          <div className="grid gap-3">
            {PREMIUM_FEATURES.map((feature) => (
              <Card key={feature.titleKey}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FontAwesomeIcon icon={feature.iconKey} className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {intl.formatMessage({ id: feature.titleKey })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {intl.formatMessage({ id: feature.descKey })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Plan Comparison Table */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {intl.formatMessage({ id: 'welcome.comparison.heading' })}
          </h2>
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left py-3 px-4 text-foreground font-semibold">
                      {intl.formatMessage({ id: 'pricing.comparison.feature' })}
                    </th>
                    <th className="text-center py-3 px-4 text-foreground font-semibold">
                      {intl.formatMessage({ id: 'pricing.comparison.free' })}
                    </th>
                    <th className="text-center py-3 px-4 text-foreground font-semibold">
                      <span className="flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faCrown} className="w-4 h-4 text-primary" />
                        {intl.formatMessage({ id: 'pricing.comparison.premium' })}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-default last:border-0">
                      <td className="py-3 px-4 text-foreground">
                        {intl.formatMessage({ id: `pricing.comparison.${row.key}` })}
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof row.freeValue === 'boolean' ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span className="text-muted-foreground">{row.freeValue}</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {typeof row.premiumValue === 'boolean' ? (
                          <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-success" />
                        ) : row.premiumValue === 'unlimited' ? (
                          <span className="text-success flex items-center justify-center gap-1">
                            <FontAwesomeIcon icon={faInfinity} className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-success">{row.premiumValue}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Fine Print */}
        <p className="text-center text-sm text-muted-foreground mb-8">
          {intl.formatMessage({ id: 'welcome.finePrint' })}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" onClick={handleContinue}>
            {intl.formatMessage({ id: 'welcome.continue' })}
          </Button>
          <Button variant="ghost" onClick={handleSkip}>
            {intl.formatMessage({ id: 'welcome.skip' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
