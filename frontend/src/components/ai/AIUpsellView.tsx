'use client';

import { useIntl } from 'react-intl';
import Link from 'next/link';
import {
  SparklesIcon,
  LockClosedIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { Flame, Target, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const AIUpsellView = () => {
  const intl = useIntl();

  const features = [
    { icon: Target, labelId: 'aiAnalysis.upsell.features.babySteps' },
    { icon: Wallet, labelId: 'aiAnalysis.upsell.features.debt' },
    { icon: PiggyBank, labelId: 'aiAnalysis.upsell.features.savings' },
    { icon: Flame, labelId: 'aiAnalysis.upsell.features.fire' },
    { icon: Receipt, labelId: 'aiAnalysis.upsell.features.tax' },
  ];

  // Sample insights for preview (static, locale-aware)
  const sampleInsights = [
    {
      type: 'achievement' as const,
      title: intl.formatMessage({ id: 'aiAnalysis.upsell.sample.achievement.title' }),
      description: intl.formatMessage({ id: 'aiAnalysis.upsell.sample.achievement.description' }),
      priority: 'medium' as const,
    },
    {
      type: 'recommendation' as const,
      title: intl.formatMessage({ id: 'aiAnalysis.upsell.sample.recommendation.title' }),
      description: intl.formatMessage({ id: 'aiAnalysis.upsell.sample.recommendation.description' }),
      priority: 'high' as const,
    },
    {
      type: 'observation' as const,
      title: intl.formatMessage({ id: 'aiAnalysis.upsell.sample.observation.title' }),
      description: intl.formatMessage({ id: 'aiAnalysis.upsell.sample.observation.description' }),
      priority: 'low' as const,
    },
  ];

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-destructive/70';
      case 'medium': return 'border-l-warning/70';
      case 'low': return 'border-l-success/70';
      default: return 'border-l-primary/70';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'achievement': return <CheckIcon className="h-5 w-5 text-success" />;
      case 'recommendation': return <SparklesIcon className="h-5 w-5 text-warning" />;
      case 'observation': return <SparklesIcon className="h-5 w-5 text-primary" />;
      default: return <SparklesIcon className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-warning/10 border border-primary/20 px-8 py-10 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(var(--color-primary-rgb),0.08),transparent_50%)]" />
        <div className="relative">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 shadow-lg">
              <SparklesIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
            {intl.formatMessage({ id: 'aiAnalysis.upsell.hero.title' })}
          </h2>
          <p className="text-secondary max-w-lg mx-auto">
            {intl.formatMessage({ id: 'aiAnalysis.upsell.hero.subtitle' })}
          </p>
        </div>
      </div>

      {/* Sample Insights Preview (with frosted glass overlay) */}
      <div className="relative">
        <div className="space-y-3">
          {sampleInsights.map((insight, index) => (
            <div
              key={index}
              className={cn(
                'rounded-xl border border-default p-4 border-l-4 bg-card/60',
                getPriorityBorder(insight.priority)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getTypeIcon(insight.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-primary text-sm">{insight.title}</h4>
                  <p className="mt-1 text-secondary text-sm leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Frosted glass overlay with lock */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/70 to-card/95 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-end pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mb-3">
            <LockClosedIcon className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs text-secondary font-medium uppercase tracking-wide">
            {intl.formatMessage({ id: 'aiAnalysis.upsell.preview.badge' })}
          </p>
        </div>
      </div>

      {/* Feature Bullets */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="py-6">
          <h3 className="font-semibold text-primary mb-4 text-center">
            {intl.formatMessage({ id: 'aiAnalysis.upsell.features.title' })}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
                  <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-primary font-medium">
                    {intl.formatMessage({ id: feature.labelId })}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-3">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-semibold text-base transition-colors shadow-lg shadow-primary/20"
        >
          <SparklesIcon className="h-5 w-5" />
          {intl.formatMessage({ id: 'aiAnalysis.upsell.cta' })}
        </Link>
        <p className="text-sm text-secondary">
          {intl.formatMessage({ id: 'aiAnalysis.upsell.trial' })}
        </p>
      </div>
    </div>
  );
};

export default AIUpsellView;
