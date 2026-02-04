'use client';

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/contexts/SettingsContext';
import ProtectedPage from '@/components/ProtectedPage';
import Link from 'next/link';
import {
  SparklesIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { Flame, Target, Wallet, PiggyBank, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Insight, InsightStatus } from '@/types/insights';
import { EnhancedInsightsResponse, InsightsMetadata } from '@/types/cache';
import { cn } from '@/lib/utils';

// Parse markdown links and render as Next.js Link components
const parseMarkdownLinks = (text: string): React.ReactNode => {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the link
    const [, linkText, href] = match;
    parts.push(
      <Link
        key={match.index}
        href={href}
        className="text-primary hover:underline font-medium"
      >
        {linkText}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Category icons mapping
const categoryIcons: Record<string, React.ElementType> = {
  baby_steps: Target,
  debt: Wallet,
  savings: PiggyBank,
  fire: Flame,
  tax_optimization: Receipt,
};

// Status color mapping
const getStatusColor = (status: InsightStatus): string => {
  switch (status) {
    case 'good':
      return 'bg-success/15 border-success/30';
    case 'can_be_improved':
      return 'bg-mint/40 border-mint/50';
    case 'ok':
      return 'bg-sand/60 border-sand/70';
    case 'bad':
      return 'bg-destructive/15 border-destructive/30';
    default:
      return 'bg-muted border-muted';
  }
};

const getStatusBadgeColor = (status: InsightStatus): string => {
  switch (status) {
    case 'good':
      return 'bg-success/20 text-success border-success/30';
    case 'can_be_improved':
      return 'bg-warning/20 text-warning border-warning/30';
    case 'ok':
      return 'bg-sand/40 text-primary border-sand/50';
    case 'bad':
      return 'bg-destructive/20 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-secondary border-muted';
  }
};

// Insight Card Component
const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const getIcon = () => {
    switch (insight.type) {
      case 'observation':
        return <SparklesIcon className="h-5 w-5" />;
      case 'alert':
        return <ExclamationCircleIcon className="h-5 w-5" />;
      case 'achievement':
        return <CheckCircleIcon className="h-5 w-5" />;
      case 'recommendation':
        return <LightBulbIcon className="h-5 w-5" />;
    }
  };

  const getPriorityStyles = () => {
    switch (insight.priority) {
      case 'high':
        return 'border-l-4 border-l-destructive/70 bg-destructive/5';
      case 'medium':
        return 'border-l-4 border-l-warning/70 bg-warning/5';
      case 'low':
        return 'border-l-4 border-l-success/70 bg-success/5';
    }
  };

  const getTypeColor = () => {
    switch (insight.type) {
      case 'alert':
        return 'text-destructive';
      case 'achievement':
        return 'text-success';
      case 'recommendation':
        return 'text-warning';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className={cn('rounded-xl border border-default p-4 transition-shadow hover:shadow-md', getPriorityStyles())}>
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', getTypeColor())}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-primary text-sm">
            {insight.title}
          </h4>
          <p className="mt-1.5 text-secondary text-sm leading-relaxed">
            {insight.description}
          </p>

          {insight.actionItems && insight.actionItems.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-primary/70 uppercase tracking-wide">
                Do zrobienia:
              </p>
              <ul className="space-y-1">
                {insight.actionItems.map((item, index) => (
                  <li key={index} className="text-sm text-secondary flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span>{parseMarkdownLinks(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.metrics && insight.metrics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {insight.metrics.map((metric, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-default px-2.5 py-1 text-xs"
                >
                  <span className="text-secondary">{metric.label}:</span>
                  <span className="font-semibold text-primary">{metric.value}</span>
                  {metric.trend === 'up' && <span className="text-success">↑</span>}
                  {metric.trend === 'down' && <span className="text-destructive">↓</span>}
                  {metric.trend === 'stable' && <span className="text-secondary">→</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Category Section Component
const CategorySection: React.FC<{
  categoryKey: string;
  insights: Insight[];
  status: InsightStatus;
  intl: ReturnType<typeof useIntl>;
}> = ({ categoryKey, insights, status, intl }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = categoryIcons[categoryKey] || Target;

  return (
    <Card className={cn('rounded-2xl border shadow-sm transition-all', getStatusColor(status))}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-primary">
                {intl.formatMessage({ id: `dashboard.summary.aiInsights.categories.${categoryKey}` })}
              </CardTitle>
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium mt-1',
                getStatusBadgeColor(status)
              )}>
                {intl.formatMessage({ id: `dashboard.summary.aiInsights.status.${status}` })}
              </span>
            </div>
          </div>
          <button className="p-1 rounded-lg hover:bg-primary/10 transition-colors">
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-secondary" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-secondary" />
            )}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// FIRE Metrics Banner
const FireMetricsBanner: React.FC<{
  currentBabyStep?: number;
  fireNumber?: number;
  savingsRate?: number;
  formatCurrency: (value: number) => string;
  intl: ReturnType<typeof useIntl>;
}> = ({ currentBabyStep, fireNumber, savingsRate, formatCurrency, intl }) => {
  if (!currentBabyStep && !fireNumber && !savingsRate) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {currentBabyStep !== undefined && currentBabyStep > 0 && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-wide text-secondary">
                {intl.formatMessage({ id: 'aiAnalysis.metrics.currentStep' })}
              </p>
              <p className="text-2xl font-bold text-primary">
                Baby Step {currentBabyStep}
              </p>
            </div>
          </div>
        </div>
      )}

      {fireNumber !== undefined && fireNumber > 0 && (
        <div className="rounded-xl bg-warning/10 border border-warning/20 p-4">
          <div className="flex items-center gap-3">
            <Flame className="h-8 w-8 text-warning" />
            <div>
              <p className="text-xs uppercase tracking-wide text-secondary">
                {intl.formatMessage({ id: 'aiAnalysis.metrics.fireNumber' })}
              </p>
              <p className="text-2xl font-bold text-warning">
                {formatCurrency(fireNumber)}
              </p>
            </div>
          </div>
        </div>
      )}

      {savingsRate !== undefined && (
        <div className="rounded-xl bg-success/10 border border-success/20 p-4">
          <div className="flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs uppercase tracking-wide text-secondary">
                {intl.formatMessage({ id: 'aiAnalysis.metrics.savingsRate' })}
              </p>
              <p className="text-2xl font-bold text-success">
                {savingsRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Metadata Banner
const MetadataBanner: React.FC<{
  metadata: InsightsMetadata;
  onRefresh: () => void;
  isLoading: boolean;
  intl: ReturnType<typeof useIntl>;
}> = ({ metadata, onRefresh, isLoading, intl }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(intl.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    } as Intl.DateTimeFormatOptions);
  };

  const getDaysSinceRefresh = () => {
    if (!metadata.lastRefreshDate) return 0;
    const lastRefresh = new Date(metadata.lastRefreshDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastRefresh.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysSinceRefresh = getDaysSinceRefresh();

  return (
    <Card className={cn(
      'rounded-2xl border shadow-sm mb-6',
      metadata.isCached ? 'bg-mint/20 border-mint/30' : 'bg-success/10 border-success/20'
    )}>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ClockIcon className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-primary">
                  {metadata.isCached
                    ? intl.formatMessage({ id: 'aiAnalysis.status.cached' })
                    : intl.formatMessage({ id: 'aiAnalysis.status.fresh' })
                  }
                </p>
                {metadata.isCached && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-secondary hover:text-primary transition-colors"
                  >
                    {showDetails ? (
                      <ChevronUpIcon className="h-4 w-4" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-sm text-secondary mt-0.5">
                {intl.formatMessage(
                  { id: 'dashboard.summary.aiInsights.generatedAt' },
                  { date: formatDate(metadata.createdAt) }
                )}
              </p>

              {showDetails && metadata.isCached && (
                <div className="mt-3 text-sm space-y-2 animate-fadeIn">
                  {metadata.lastRefreshDate && (
                    <p className="text-secondary">
                      {intl.formatMessage(
                        { id: 'dashboard.summary.aiInsights.lastRefreshed' },
                        { date: formatDate(metadata.lastRefreshDate), days: daysSinceRefresh }
                      )}
                    </p>
                  )}
                  {metadata.dataChanges && (
                    <div className="bg-card/50 rounded-lg p-2 space-y-1">
                      <p className="text-xs font-medium text-primary/70">
                        {intl.formatMessage({ id: 'dashboard.summary.aiInsights.dataChanges' })}:
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <span>{intl.formatMessage({ id: 'dashboard.summary.aiInsights.incomeChange' }, { change: metadata.dataChanges.income })}</span>
                        <span>{intl.formatMessage({ id: 'dashboard.summary.aiInsights.expensesChange' }, { change: metadata.dataChanges.expenses })}</span>
                        <span>{intl.formatMessage({ id: 'dashboard.summary.aiInsights.loansChange' }, { change: metadata.dataChanges.loans })}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors disabled:opacity-60"
          >
            <ArrowPathIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {isLoading
              ? intl.formatMessage({ id: 'dashboard.summary.aiInsights.refreshing' })
              : intl.formatMessage({ id: 'dashboard.summary.aiInsights.refresh' })
            }
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

// Main AI Analysis Page
const AIAnalysisPage = () => {
  const intl = useIntl();
  const { data: session } = useSession();
  const { formatCurrency } = useSettings();

  const [insights, setInsights] = useState<EnhancedInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);

  const fetchInsights = async (forceRefresh = false) => {
    if (!session?.user?.email) return;

    try {
      setIsLoading(true);
      setErrorMessageId(null);

      // Use Next.js API proxy for backend calls (adds auth headers automatically)
      const url = new URL(
        `/api/backend/users/${encodeURIComponent(session.user.email)}/insights`,
        window.location.origin
      );
      if (forceRefresh) {
        url.searchParams.set('refresh', 'true');
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = typeof errorData.detail === 'string' ? errorData.detail : '';

        if (detail === 'API_KEY_MISSING' || detail.includes('API key not found')) {
          setErrorMessageId('settings.messages.claudeApiKeyRequired');
        } else if (detail.includes('Anthropic API error')) {
          setErrorMessageId('dashboard.summary.aiInsights.apiErrors.generic');
        } else {
          setErrorMessageId('dashboard.summary.aiInsights.apiErrors.generic');
        }
        setInsights(null);
        return;
      }

      const data = await response.json();
      setInsights(data);
    } catch (_err) {
      setErrorMessageId('dashboard.summary.aiInsights.apiErrors.generic');
      setInsights(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      fetchInsights();
    }
  }, [session?.user?.email]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-primary/10 via-white to-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
            <SparklesIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              {intl.formatMessage({ id: 'aiAnalysis.title' })}
            </h1>
            <p className="text-sm text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.subtitle' })}
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-secondary">
            {intl.formatMessage({ id: 'dashboard.summary.aiInsights.loading' })}
          </p>
        </div>
      )}

      {/* Error: API Key Missing */}
      {!isLoading && errorMessageId === 'settings.messages.claudeApiKeyRequired' && (
        <Card className="rounded-2xl border-warning/30 bg-warning/10">
          <CardContent className="py-8 text-center">
            <Cog6ToothIcon className="h-12 w-12 text-warning mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary mb-2">
              {intl.formatMessage({ id: 'aiAnalysis.noApiKey.title' })}
            </h3>
            <p className="text-secondary mb-4 max-w-md mx-auto">
              {intl.formatMessage({ id: 'settings.messages.claudeApiKeyRequired' })}
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              {intl.formatMessage({ id: 'navigation.settings' })}
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Error: Generic */}
      {!isLoading && errorMessageId && errorMessageId !== 'settings.messages.claudeApiKeyRequired' && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/10">
          <CardContent className="py-8 text-center">
            <ExclamationCircleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary mb-2">
              {intl.formatMessage({ id: 'dashboard.summary.aiInsights.errorTitle' })}
            </h3>
            <p className="text-secondary mb-4">
              {intl.formatMessage({ id: errorMessageId })}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => fetchInsights(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                {intl.formatMessage({ id: 'dashboard.summary.aiInsights.tryAgain' })}
              </button>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-secondary rounded-xl font-medium transition-colors"
              >
                {intl.formatMessage({ id: 'navigation.settings' })}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success: Show Insights */}
      {!isLoading && !errorMessageId && insights && (
        <>
          {/* Metadata Banner */}
          <MetadataBanner
            metadata={insights.metadata}
            onRefresh={() => fetchInsights(true)}
            isLoading={isLoading}
            intl={intl}
          />

          {/* FIRE Metrics */}
          <FireMetricsBanner
            currentBabyStep={insights.currentBabyStep}
            fireNumber={insights.fireNumber}
            savingsRate={insights.savingsRate}
            formatCurrency={formatCurrency}
            intl={intl}
          />

          {/* Category Sections */}
          <div className="space-y-4">
            {Object.entries(insights.categories).map(([categoryKey, categoryInsights]) => {
              const status = insights.status[categoryKey as keyof typeof insights.status];
              return (
                <CategorySection
                  key={categoryKey}
                  categoryKey={categoryKey}
                  insights={categoryInsights}
                  status={status}
                  intl={intl}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default function AIAnalysisPageWrapper() {
  return (
    <ProtectedPage>
      <AIAnalysisPage />
    </ProtectedPage>
  );
}
