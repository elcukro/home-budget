'use client';

import { useIntl } from 'react-intl';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SparklesIcon } from '@heroicons/react/24/outline';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Circle,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { EnhancedInsightsResponse } from '@/types/cache';
import { InsightStatus, InsightCategoryKey } from '@/types/insights';

type PanelState = 'loading' | 'loaded' | 'no-api-key' | 'error' | 'no-data';

function StatusIcon({ status }: { status: InsightStatus }) {
  switch (status) {
    case 'good':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'ok':
      return <Circle className="h-4 w-4 text-yellow-500" />;
    case 'can_be_improved':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'bad':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

function StatusBadge({ status, label }: { status: InsightStatus; label: string }) {
  const colorMap: Record<InsightStatus, string> = {
    good: 'bg-green-50 text-green-700 border-green-200',
    ok: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    can_be_improved: 'bg-amber-50 text-amber-700 border-amber-200',
    bad: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${colorMap[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      <StatusIcon status={status} />
      {label}
    </span>
  );
}

const CATEGORY_ORDER: InsightCategoryKey[] = [
  'savings',
  'baby_steps',
  'fire',
  'debt',
  'tax_optimization',
];

interface AIInsightsPanelProps {
  className?: string;
  onInsightsLoaded?: (data: EnhancedInsightsResponse) => void;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ className, onInsightsLoaded }) => {
  const intl = useIntl();
  const { data: session } = useSession();
  const [insights, setInsights] = useState<EnhancedInsightsResponse | null>(null);
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onInsightsLoadedRef = useRef(onInsightsLoaded);
  onInsightsLoadedRef.current = onInsightsLoaded;

  const fetchInsights = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.email) return;

    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setPanelState('loading');
      }

      const url = new URL(
        `/api/backend/users/${encodeURIComponent(session.user.email)}/insights`,
        window.location.origin
      );
      if (forceRefresh) {
        url.searchParams.set('refresh', 'true');
      } else {
        // On initial load, only fetch from cache — never trigger slow AI generation
        url.searchParams.set('cache_only', 'true');
      }

      const response = await fetch(url);

      // 204 = no cached insights available
      if (response.status === 204) {
        setPanelState('no-data');
        setInsights(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = typeof errorData.detail === 'string' ? errorData.detail : '';

        if (detail === 'API_KEY_MISSING' || detail.includes('API key not found')) {
          setPanelState('no-api-key');
        } else {
          setPanelState('error');
        }
        setInsights(null);
        return;
      }

      const data = await response.json();
      setInsights(data);
      setPanelState('loaded');
      onInsightsLoadedRef.current?.(data);
    } catch {
      setPanelState('error');
      setInsights(null);
    } finally {
      setIsRefreshing(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchInsights();
    }
  }, [session?.user?.email, fetchInsights]);

  const getCategoryLabel = (key: InsightCategoryKey) => {
    return intl.formatMessage({ id: `dashboard.aiInsightsSection.categories.${key}` });
  };

  // Find top recommendation from insights
  const getTopRecommendation = () => {
    if (!insights?.categories) return null;
    for (const catKey of CATEGORY_ORDER) {
      const items = insights.categories[catKey];
      if (items) {
        const rec = items.find(i => i.type === 'recommendation' && i.priority === 'high');
        if (rec) return rec;
      }
    }
    // Fallback: first recommendation
    for (const catKey of CATEGORY_ORDER) {
      const items = insights.categories[catKey];
      if (items) {
        const rec = items.find(i => i.type === 'recommendation');
        if (rec) return rec;
      }
    }
    return null;
  };

  // Get top 3 action items across all categories
  const getTopActions = () => {
    if (!insights?.categories) return [];
    const actions: { title: string; description: string; priority: string }[] = [];
    for (const catKey of CATEGORY_ORDER) {
      const items = insights.categories[catKey];
      if (items) {
        for (const item of items) {
          if (item.type === 'recommendation' || item.type === 'alert') {
            actions.push({
              title: item.title,
              description: item.description,
              priority: item.priority,
            });
          }
        }
      }
    }
    return actions.sort((a, b) => {
      const prioOrder = { high: 0, medium: 1, low: 2 };
      return (prioOrder[a.priority as keyof typeof prioOrder] ?? 2) -
        (prioOrder[b.priority as keyof typeof prioOrder] ?? 2);
    }).slice(0, 3);
  };

  // Loading skeleton
  if (panelState === 'loading') {
    return (
      <div className={`rounded-2xl border border-default bg-card p-6 animate-pulse ${className || ''}`}>
        <div className="h-5 w-48 bg-muted rounded mb-4" />
        <div className="flex gap-2 mb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-7 w-24 bg-muted rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  // No API key configured server-side - hide the panel entirely
  if (panelState === 'no-api-key') {
    return null;
  }

  // No cached insights available — prompt user to generate on AI analysis page
  if (panelState === 'no-data') {
    return (
      <div className={`rounded-2xl border border-default bg-card p-6 ${className || ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <SparklesIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-primary">
                {intl.formatMessage({ id: 'dashboard.aiInsightsSection.title' })}
              </h3>
              <p className="text-xs text-secondary mt-0.5">
                {intl.formatMessage({ id: 'dashboard.aiInsightsSection.noDataDescription' })}
              </p>
            </div>
          </div>
          <Link
            href="/ai-analysis"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-colors"
          >
            {intl.formatMessage({ id: 'dashboard.aiInsightsSection.generateAnalysis' })}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (panelState === 'error') {
    return (
      <div className={`rounded-2xl border border-destructive/20 bg-destructive/5 p-6 ${className || ''}`}>
        <div className="flex items-start gap-4">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive">
              {intl.formatMessage({ id: 'dashboard.aiInsightsSection.error' })}
            </p>
            <button
              onClick={() => fetchInsights()}
              className="mt-2 text-sm font-medium text-destructive hover:underline"
            >
              {intl.formatMessage({ id: 'dashboard.aiInsightsSection.retry' })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const topRec = getTopRecommendation();
  const topActions = getTopActions();

  return (
    <div className={`rounded-2xl border border-default bg-card shadow-sm ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <SparklesIcon className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-primary">
            {intl.formatMessage({ id: 'dashboard.aiInsightsSection.title' })}
          </h3>
          {insights.metadata?.isCached && (
            <span className="text-[10px] font-medium text-secondary bg-muted px-2 py-0.5 rounded-full">
              {intl.formatMessage({ id: 'dashboard.aiInsightsSection.cachedLabel' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchInsights(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title={intl.formatMessage({ id: 'dashboard.summary.aiInsights.refresh' })}
          >
            <RefreshCw className={`h-4 w-4 text-secondary ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/ai-analysis"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium transition-colors"
          >
            {intl.formatMessage({ id: 'dashboard.aiInsightsSection.viewFull' })}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Category Status Badges */}
      {insights.status && (
        <div className="px-6 pb-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((catKey) => {
              const status = insights.status[catKey];
              if (!status) return null;
              return (
                <StatusBadge
                  key={catKey}
                  status={status}
                  label={getCategoryLabel(catKey)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Content Grid: Problem & Top Moves */}
      <div className="px-6 pb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Problem & Solution */}
          {topRec && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {intl.formatMessage({ id: 'dashboard.aiInsightsSection.problemTitle' })}
                </h4>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {topRec.title}
              </p>
              <p className="text-xs text-gray-600 line-clamp-2">
                {topRec.description}
              </p>
            </div>
          )}

          {/* Top 3 Financial Moves */}
          {topActions.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-sky-600" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                  {intl.formatMessage({ id: 'dashboard.aiInsightsSection.topMovesTitle' })}
                </h4>
              </div>
              <ol className="space-y-1.5">
                {topActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700 flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-gray-700 line-clamp-1">
                      {action.title}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsightsPanel;
