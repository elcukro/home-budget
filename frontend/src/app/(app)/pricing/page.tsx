'use client';

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCrown, faStar, faInfinity } from '@fortawesome/free-solid-svg-icons';

const plans = [
  {
    id: 'monthly',
    nameKey: 'pricing.plans.monthly.name',
    price: 19.99,
    periodKey: 'pricing.plans.monthly.period',
    descriptionKey: 'pricing.plans.monthly.description',
    features: [
      'pricing.features.unlimited_entries',
      'pricing.features.bank_integration',
      'pricing.features.ai_insights',
      'pricing.features.all_exports',
      'pricing.features.all_reports',
    ],
  },
  {
    id: 'annual',
    nameKey: 'pricing.plans.annual.name',
    price: 199,
    periodKey: 'pricing.plans.annual.period',
    descriptionKey: 'pricing.plans.annual.description',
    savingsKey: 'pricing.plans.annual.savings',
    popular: true,
    features: [
      'pricing.features.unlimited_entries',
      'pricing.features.bank_integration',
      'pricing.features.ai_insights',
      'pricing.features.all_exports',
      'pricing.features.all_reports',
    ],
  },
];

const comparisonRows = [
  { key: 'expenses', freeValue: '50/mies', premiumValue: 'unlimited' },
  { key: 'incomes', freeValue: '3/mies', premiumValue: 'unlimited' },
  { key: 'loans', freeValue: '5', premiumValue: 'unlimited' },
  { key: 'savings', freeValue: '5', premiumValue: 'unlimited' },
  { key: 'bank', freeValue: false, premiumValue: true },
  { key: 'ai', freeValue: false, premiumValue: true },
  { key: 'export', freeValue: 'JSON', premiumValue: 'JSON, CSV, XLSX' },
  { key: 'reports', freeValue: 'monthly', premiumValue: 'all' },
];

function PricingContent() {
  const intl = useIntl();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const { subscription, isPremium, isTrial, trialDaysLeft, createCheckout } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  // Check for success/cancel params from Stripe redirect
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  if (success) {
    toast({
      title: intl.formatMessage({ id: 'pricing.success.title' }),
      description: intl.formatMessage({ id: 'pricing.success.description' }),
    });
  }

  if (canceled) {
    toast({
      title: intl.formatMessage({ id: 'pricing.canceled.title' }),
      description: intl.formatMessage({ id: 'pricing.canceled.description' }),
      variant: 'destructive',
    });
  }

  const handleSubscribe = async (planId: string) => {
    if (!isAuthenticated) {
      router.push('/auth/signin?callbackUrl=/pricing');
      return;
    }
    try {
      setLoading(planId);
      const checkoutUrl = await createCheckout(planId);
      window.location.href = checkoutUrl;
    } catch (err) {
      toast({
        title: intl.formatMessage({ id: 'pricing.error.title' }),
        description: err instanceof Error ? err.message : intl.formatMessage({ id: 'pricing.error.description' }),
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const getButtonText = (planId: string) => {
    if (loading === planId) {
      return intl.formatMessage({ id: 'pricing.loading' });
    }
    if (isPremium && subscription?.plan_type === planId) {
      return intl.formatMessage({ id: 'pricing.current_plan' });
    }
    if (subscription?.is_lifetime) {
      return intl.formatMessage({ id: 'pricing.lifetime_active' });
    }
    return intl.formatMessage({ id: 'pricing.subscribe' });
  };

  const isButtonDisabled = (planId: string) => {
    if (loading !== null) return true;
    if (subscription?.is_lifetime) return true;
    if (isPremium && subscription?.plan_type === planId) return true;
    return false;
  };

  return (
    <div className="container max-w-6xl py-8 mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 text-foreground">
          {intl.formatMessage({ id: 'pricing.title' })}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {intl.formatMessage({ id: 'pricing.subtitle' })}
        </p>
      </div>

      {/* Trial Banner */}
      {isTrial && trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-8 text-center">
          <p className="text-primary font-medium flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faStar} className="w-4 h-4" />
            {intl.formatMessage(
              { id: 'pricing.trial_banner' },
              { days: trialDaysLeft }
            )}
          </p>
        </div>
      )}

      {/* Already Premium Banner */}
      {isPremium && !isTrial && (
        <div className="bg-success/10 border border-success rounded-lg p-4 mb-8 text-center">
          <p className="text-success font-medium flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faCrown} className="w-4 h-4" />
            {intl.formatMessage(
              { id: 'pricing.premium_active' },
              { plan: subscription?.plan_type }
            )}
          </p>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-2xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : 'border-default'}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                {intl.formatMessage({ id: 'pricing.popular' })}
              </div>
            )}
            <CardHeader className="text-center">
              <CardTitle className="text-xl">
                {intl.formatMessage({ id: plan.nameKey })}
              </CardTitle>
              <CardDescription>
                {intl.formatMessage({ id: plan.descriptionKey })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground ml-2">
                  PLN {intl.formatMessage({ id: plan.periodKey })}
                </span>
                {plan.savingsKey && (
                  <p className="text-success text-sm mt-2 font-medium">
                    {intl.formatMessage({ id: plan.savingsKey })}
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="w-4 h-4 text-success flex-shrink-0"
                    />
                    <span className="text-sm text-foreground">
                      {intl.formatMessage({ id: feature })}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.id)}
                disabled={isButtonDisabled(plan.id)}
              >
                {getButtonText(plan.id)}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8 text-foreground">
          {intl.formatMessage({ id: 'pricing.comparison.title' })}
        </h2>
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <table className="w-full min-w-[500px]">
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
                {comparisonRows.map((row) => (
                  <tr key={row.key} className="border-b border-default last:border-0">
                    <td className="py-3 px-4 text-foreground">
                      {intl.formatMessage({ id: `pricing.comparison.${row.key}` })}
                    </td>
                    <td className="text-center py-3 px-4">
                      {typeof row.freeValue === 'boolean' ? (
                        row.freeValue ? (
                          <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-success" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">{row.freeValue}</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      {typeof row.premiumValue === 'boolean' ? (
                        row.premiumValue ? (
                          <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-success" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )
                      ) : row.premiumValue === 'unlimited' ? (
                        <span className="text-success flex items-center justify-center gap-1">
                          <FontAwesomeIcon icon={faInfinity} className="w-4 h-4" />
                        </span>
                      ) : row.premiumValue === 'all' ? (
                        <span className="text-success">
                          {intl.formatMessage({ id: 'pricing.comparison.all' })}
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

      {/* FAQ or Additional Info */}
      <div className="mt-16 text-center">
        <p className="text-muted-foreground">
          {intl.formatMessage({ id: 'pricing.questions' })}{' '}
          <a href="mailto:support@firedup.app" className="text-primary hover:underline">
            support@firedup.app
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return <PricingContent />;
}
