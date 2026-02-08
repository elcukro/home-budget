'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  Flame, Target, Wallet, PiggyBank, Receipt, Calculator,
  TrendingUp, Home, Shield, Coins, BadgeDollarSign, AlertTriangle,
  Heart, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Insight, InsightStatus, InsightCategoryKey,
  HeroDashboard, HeroDashboardHealthStatus, Top3Move, MoveIconType,
} from '@/types/insights';
import { EnhancedInsightsResponse, InsightsMetadata } from '@/types/cache';
import { cn } from '@/lib/utils';
import LoanOverpaymentSim from '@/components/ai/LoanOverpaymentSim';
import FireCalculatorSim from '@/components/ai/FireCalculatorSim';
import SavingsGoalSim from '@/components/ai/SavingsGoalSim';
import BiggestOpportunityCard from '@/components/ai/BiggestOpportunityCard';
import QuickWinsSection from '@/components/ai/QuickWinsSection';
import CategoryHealthMeter from '@/components/ai/CategoryHealthMeter';

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

// Move icon mapping
const moveIcons: Record<MoveIconType, React.ElementType> = {
  mortgage: Home,
  savings: PiggyBank,
  investment: TrendingUp,
  budget: Coins,
  tax: BadgeDollarSign,
  emergency: Shield,
};

// Health status icon and color
const getHealthConfig = (status: HeroDashboardHealthStatus) => {
  switch (status) {
    case 'excellent':
      return { color: 'text-success', bg: 'bg-success/15', icon: Heart };
    case 'good':
      return { color: 'text-success', bg: 'bg-success/10', icon: CheckCircleIcon };
    case 'warning':
      return { color: 'text-warning', bg: 'bg-warning/10', icon: ExclamationTriangleIcon };
    case 'critical':
      return { color: 'text-destructive', bg: 'bg-destructive/10', icon: ExclamationCircleIcon };
  }
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

// ─── Hero Dashboard Section ──────────────────────────────────────────────────

const HeroSection: React.FC<{
  hero: HeroDashboard;
  formatCurrency: (value: number) => string;
  intl: ReturnType<typeof useIntl>;
}> = ({ hero, formatCurrency, intl }) => {
  const healthConfig = getHealthConfig(hero.health_status);
  const HealthIcon = healthConfig.icon;

  return (
    <div className="space-y-5">
      {/* Greeting + Health Status */}
      <div className="flex items-center gap-4">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', healthConfig.bg)}>
          <HealthIcon className={cn('h-6 w-6', healthConfig.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-primary">
            {intl.formatMessage({ id: 'aiAnalysis.title' })}
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            {hero.greeting}
          </p>
        </div>
        <span className={cn(
          'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap',
          hero.health_status === 'excellent' || hero.health_status === 'good'
            ? 'bg-success/15 text-success border-success/30'
            : hero.health_status === 'warning'
              ? 'bg-warning/15 text-warning border-warning/30'
              : 'bg-destructive/15 text-destructive border-destructive/30'
        )}>
          {intl.formatMessage({ id: `aiAnalysis.hero.healthStatus.${hero.health_status}` })}
        </span>
      </div>

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cost of Living */}
        <div className="relative overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-orange-600">
            {intl.formatMessage({ id: 'aiAnalysis.hero.costOfLiving' })}
          </p>
          <p className="text-2xl font-bold tabular-nums text-orange-700 mt-1">
            {formatCurrency(hero.monthly_cost_of_living)}
          </p>
          <p className="text-[10px] text-orange-500 mt-1">
            {intl.formatMessage({ id: 'aiAnalysis.hero.recurringOnly' })}
          </p>
        </div>

        {/* Income */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
            {intl.formatMessage({ id: 'aiAnalysis.hero.income' })}
          </p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700 mt-1">
            {formatCurrency(hero.monthly_income)}
          </p>
        </div>

        {/* Surplus */}
        <div className={cn(
          'relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
          hero.monthly_surplus >= 0
            ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/50'
            : 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/50'
        )}>
          <p className={cn(
            'text-xs font-medium uppercase tracking-wide',
            hero.monthly_surplus >= 0 ? 'text-sky-600' : 'text-red-600'
          )}>
            {intl.formatMessage({ id: 'aiAnalysis.hero.surplus' })}
          </p>
          <p className={cn(
            'text-2xl font-bold tabular-nums mt-1',
            hero.monthly_surplus >= 0 ? 'text-sky-700' : 'text-red-700'
          )}>
            {hero.monthly_surplus >= 0 ? '+' : ''}{formatCurrency(hero.monthly_surplus)}
          </p>
        </div>
      </div>

      {/* FIRE Progress Bar */}
      {hero.fire_target > 0 && (
        <Card className="rounded-2xl border border-default shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-primary">
                  {intl.formatMessage({ id: 'aiAnalysis.hero.fireProgress' })}
                </span>
              </div>
              <span className="text-sm text-secondary">
                {intl.formatMessage(
                  { id: 'aiAnalysis.hero.fireTarget' },
                  { target: formatCurrency(hero.fire_target) }
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress
                value={Math.min(hero.fire_progress_percent, 100)}
                max={100}
                className="h-3 bg-muted/50"
                indicatorClassName={cn(
                  'rounded-full transition-all duration-700',
                  hero.fire_progress_percent >= 75 ? 'bg-success' :
                    hero.fire_progress_percent >= 25 ? 'bg-warning' : 'bg-primary'
                )}
              />
              <span className="text-sm font-bold text-primary whitespace-nowrap tabular-nums">
                {hero.fire_progress_percent.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Distortion Alert */}
      {hero.budget_distortion?.is_distorted && (
        <Card className="rounded-2xl border border-warning/30 bg-warning/5 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">
                  {intl.formatMessage({ id: 'aiAnalysis.hero.budgetDistortion.title' })}
                </p>
                <p className="text-sm text-secondary mt-1">
                  {hero.budget_distortion.explanation}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <span className="text-secondary">
                    {intl.formatMessage(
                      { id: 'aiAnalysis.hero.budgetDistortion.explanation' },
                      { amount: formatCurrency(hero.budget_distortion.one_time_total) }
                    )}
                  </span>
                  <span className="font-medium text-success">
                    {intl.formatMessage(
                      { id: 'aiAnalysis.hero.budgetDistortion.correctedSurplus' },
                      { amount: formatCurrency(hero.budget_distortion.corrected_surplus) }
                    )}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Top 3 Financial Moves ──────────────────────────────────────────────────

const MoveCard: React.FC<{
  rank: number;
  move: Top3Move;
}> = ({ rank, move }) => {
  const Icon = moveIcons[move.icon_type] || TrendingUp;

  return (
    <Card className="rounded-2xl border border-default shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex-shrink-0">
                {rank}
              </span>
              <h4 className="font-semibold text-primary text-sm leading-tight">
                {move.title}
              </h4>
            </div>
            <p className="mt-2 text-secondary text-sm leading-relaxed">
              {move.description}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/20 px-2.5 py-1 text-xs">
              <ArrowRight className="h-3 w-3 text-success" />
              <span className="font-semibold text-success">{move.impact}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Top3MovesSection: React.FC<{
  moves: Top3Move[];
  intl: ReturnType<typeof useIntl>;
}> = ({ moves, intl }) => {
  if (!moves || moves.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">
        {intl.formatMessage({ id: 'aiAnalysis.hero.top3Moves' })}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {moves.slice(0, 3).map((move, i) => (
          <MoveCard key={i} rank={i + 1} move={move} />
        ))}
      </div>
    </div>
  );
};

// ─── Insight Card Component ──────────────────────────────────────────────────

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

// ─── Category Section Component ──────────────────────────────────────────────

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

// ─── FIRE Metrics Banner (legacy, shown when hero_dashboard is missing) ──────

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

// ─── Metadata Banner ─────────────────────────────────────────────────────────

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
      'rounded-2xl border shadow-sm',
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

const CATEGORY_ORDER: InsightCategoryKey[] = [
  'savings', 'baby_steps', 'fire', 'debt', 'tax_optimization',
];

// ─── Main AI Analysis Page ───────────────────────────────────────────────────

const AIAnalysisPage = () => {
  const intl = useIntl();
  const { data: session } = useSession();
  const { formatCurrency } = useSettings();

  const [insights, setInsights] = useState<EnhancedInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);
  const [activeSimulator, setActiveSimulator] = useState<'loan' | 'fire' | 'savings'>('loan');
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const simulatorRef = useRef<HTMLDivElement>(null);

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
        const _detail = typeof errorData.detail === 'string' ? errorData.detail : '';

        setErrorMessageId('dashboard.summary.aiInsights.apiErrors.generic');
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

  // Extract all insights into a flat list for insight cards
  const allInsights = useMemo(() => {
    if (!insights?.categories) return [];
    const all: Insight[] = [];
    for (const catKey of CATEGORY_ORDER) {
      const items = insights.categories[catKey];
      if (items) all.push(...items);
    }
    return all;
  }, [insights]);

  // Find the highest-impact opportunity
  const biggestOpportunity = useMemo(() => {
    // Prefer high-priority recommendations
    const highPrio = allInsights.find(i => i.type === 'recommendation' && i.priority === 'high');
    if (highPrio) return highPrio;
    // Fallback: any recommendation
    return allInsights.find(i => i.type === 'recommendation') ?? null;
  }, [allInsights]);

  const scrollToSimulator = () => {
    simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const heroData = insights?.hero_dashboard;

  return (
    <div className="space-y-6">
      {/* Header (only when no hero dashboard) */}
      {!heroData && !isLoading && (
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
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-secondary">
            {intl.formatMessage({ id: 'dashboard.summary.aiInsights.loading' })}
          </p>
        </div>
      )}

      {/* Error: Generic */}
      {!isLoading && errorMessageId && (
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

          {/* ─── NEW: Hero Dashboard Section ─── */}
          {heroData ? (
            <>
              <HeroSection
                hero={heroData}
                formatCurrency={formatCurrency}
                intl={intl}
              />

              {/* Top 3 Financial Moves */}
              <Top3MovesSection
                moves={heroData.top3_moves}
                intl={intl}
              />
            </>
          ) : (
            /* Fallback: Legacy FIRE Metrics Banner when hero_dashboard is not present (old cache) */
            <FireMetricsBanner
              currentBabyStep={insights.currentBabyStep}
              fireNumber={insights.fireNumber}
              savingsRate={insights.savingsRate}
              formatCurrency={formatCurrency}
              intl={intl}
            />
          )}

          {/* Biggest Opportunity + Category Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              {biggestOpportunity && (
                <BiggestOpportunityCard
                  insight={biggestOpportunity}
                  onRunSimulator={scrollToSimulator}
                />
              )}
            </div>
            <div>
              <Card className="rounded-2xl border border-default shadow-sm h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-primary">
                    {intl.formatMessage({ id: 'aiAnalysis.insightCards.healthMeters.title' })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryHealthMeter
                    categories={CATEGORY_ORDER}
                    statusMap={insights.status}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Wins */}
          <QuickWinsSection insights={allInsights} />

          {/* Interactive Simulators */}
          <div ref={simulatorRef}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.title' })}
                </h2>
                <p className="text-xs text-secondary">
                  {intl.formatMessage({ id: 'aiAnalysis.simulators.subtitle' })}
                </p>
              </div>
            </div>

            {/* Simulator tabs */}
            <div className="flex gap-2 mb-4">
              {(['loan', 'fire', 'savings'] as const).map((tab) => {
                const labels: Record<string, string> = {
                  loan: intl.formatMessage({ id: 'aiAnalysis.simulators.loanOverpayment.title' }),
                  fire: intl.formatMessage({ id: 'aiAnalysis.simulators.fire.title' }),
                  savings: intl.formatMessage({ id: 'aiAnalysis.simulators.savings.title' }),
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveSimulator(tab)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      activeSimulator === tab
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-secondary hover:bg-muted/80',
                    )}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {activeSimulator === 'loan' && (
              <LoanOverpaymentSim />
            )}
            {activeSimulator === 'fire' && (
              <FireCalculatorSim
                prefillAnnualExpenses={insights.fireNumber ? Math.round(insights.fireNumber * 0.04) : undefined}
              />
            )}
            {activeSimulator === 'savings' && (
              <SavingsGoalSim />
            )}
          </div>

          {/* ─── Detailed Analysis (Category Sections) ─── */}
          <div className="space-y-4">
            <button
              onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <SparklesIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-primary group-hover:text-primary/80 transition-colors">
                  {intl.formatMessage({ id: 'aiAnalysis.hero.detailedAnalysis' })}
                </h2>
              </div>
              <div className="p-1 rounded-lg group-hover:bg-primary/10 transition-colors">
                {showDetailedAnalysis ? (
                  <ChevronUpIcon className="h-5 w-5 text-secondary" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-secondary" />
                )}
              </div>
            </button>

            {showDetailedAnalysis && (
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
            )}
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
