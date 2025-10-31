'use client';

import { useIntl } from 'react-intl';
import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Insight, InsightStatus, InsightsResponse } from '@/types/insights';
import { SparklesIcon, ExclamationCircleIcon, CheckCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { useSettings } from '@/contexts/SettingsContext';
import Link from 'next/link';
import InsightsStatusBanner from './InsightsStatusBanner';
import { EnhancedInsightsResponse } from '@/types/cache';
import { useSession } from 'next-auth/react';

interface MonthlySummaryProps {
  data: {
    totalIncome: number;
    totalExpenses: number;
    totalLoanPayments: number;
    netCashflow: number;
    savingsRate: number;
    debtToIncome: number;
  };
  formatCurrency: (amount: number) => string;
}

const getStatusColor = (status: InsightStatus): string => {
  switch (status) {
    case 'good':
      return 'bg-success/15';
    case 'can_be_improved':
      return 'bg-mint/40';
    case 'ok':
      return 'bg-sand/60';
    case 'bad':
      return 'bg-destructive/15';
    default:
      return 'bg-muted';
  }
};

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const getIcon = () => {
    switch (insight.type) {
      case 'observation':
        return <SparklesIcon className="h-6 w-6" />;
      case 'alert':
        return <ExclamationCircleIcon className="h-6 w-6" />;
      case 'achievement':
        return <CheckCircleIcon className="h-6 w-6" />;
      case 'recommendation':
        return <LightBulbIcon className="h-6 w-6" />;
    }
  };

  const getPriorityBorder = () => {
    switch (insight.priority) {
      case 'high':
        return 'border-l-4 border-l-destructive/70';
      case 'medium':
        return 'border-l-4 border-l-warning/70';
      case 'low':
        return 'border-l-4 border-l-success/70';
    }
  };

  return (
    <div className={`p-4 rounded-lg border border-default bg-card ${getPriorityBorder()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-secondary">
          {getIcon()}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-primary">
            {insight.title}
          </h4>
          <p className="mt-1 text-secondary">
            {insight.description}
          </p>
          {insight.actionItems && insight.actionItems.length > 0 && (
            <ul className="mt-3 space-y-1">
              {insight.actionItems.map((item, index) => (
                <li key={index} className="text-sm text-secondary flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {insight.metrics && insight.metrics.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {insight.metrics.map((metric, index) => (
                <div key={index} className="text-sm">
                  <span className="text-secondary">{metric.label}: </span>
                  <span className="font-medium text-primary">{metric.value}</span>
                  {metric.trend === 'up' && <span className="text-success ml-1">↑</span>}
                  {metric.trend === 'down' && <span className="text-destructive ml-1">↓</span>}
                  {metric.trend === 'stable' && <span className="text-secondary ml-1">→</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MonthlySummary: React.FC<MonthlySummaryProps> = ({ data, formatCurrency }) => {
  const intl = useIntl();
  const { settings } = useSettings();
  const [showInsights, setShowInsights] = useState(false);
  const [insights, setInsights] = useState<EnhancedInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessageId, setErrorMessageId] = useState<string | null>(null);
  const [errorMessageValues, setErrorMessageValues] = useState<Record<string, string | number> | undefined>(undefined);
  const { data: session } = useSession();

  const fetchInsights = async (forceRefresh = false) => {
    if (!session?.user?.email) {
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessageId(null);
      setErrorMessageValues(undefined);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = new URL(`${API_URL}/users/${encodeURIComponent(session.user.email)}/insights`, window.location.origin);
      if (forceRefresh) {
        url.searchParams.set('refresh', 'true');
      }
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detailRaw = typeof errorData.detail === 'string' ? errorData.detail : '';

        const mapDetailToMessage = (
          detail: string,
        ): { id: string; values?: Record<string, string | number> } => {
          if (detail === 'API_KEY_MISSING') {
            return { id: 'settings.messages.claudeApiKeyRequired' };
          }
          if (detail.includes('OpenAI API error: 529')) {
            return { id: 'dashboard.summary.aiInsights.apiErrors.overloaded' };
          }
          if (detail.includes('OpenAI API error: 401')) {
            return { id: 'dashboard.summary.aiInsights.apiErrors.invalidKey' };
          }
          if (detail.includes('OpenAI API error: 403')) {
            return { id: 'dashboard.summary.aiInsights.apiErrors.forbidden' };
          }
          if (detail.includes('OpenAI API error: 429')) {
            return { id: 'dashboard.summary.aiInsights.apiErrors.rateLimit' };
          }
          if (detail.includes('OpenAI API error')) {
            return { id: 'dashboard.summary.aiInsights.apiErrors.generic' };
          }
          if (detail) {
            return {
              id: 'dashboard.summary.aiInsights.apiErrors.generic',
            };
          }
          return { id: 'dashboard.summary.aiInsights.apiErrors.generic' };
        };

        const { id, values } = mapDetailToMessage(detailRaw);
        setErrorMessageId(id);
        setErrorMessageValues(values);
        setInsights(null);
        return;
      }

      const data = await response.json();
      setInsights(data);
    } catch (err) {
      const fallbackDetail = err instanceof Error ? err.message : undefined;
      setErrorMessageId('dashboard.summary.aiInsights.apiErrors.generic');
      setErrorMessageValues(
        fallbackDetail ? { detail: fallbackDetail } : undefined,
      );
      setInsights(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showInsights && !insights && !isLoading) {
      fetchInsights();
    }
  }, [showInsights]);

  const metrics = [
    {
      label: intl.formatMessage({ id: 'dashboard.summary.totalIncome' }),
      value: formatCurrency(data?.totalIncome ?? 0),
      color: 'text-success',
      bgColor: 'bg-success/15',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.totalExpenses' }),
      value: formatCurrency(data?.totalExpenses ?? 0),
      color: 'text-destructive',
      bgColor: 'bg-destructive/15',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.loanPayments' }),
      value: formatCurrency(data?.totalLoanPayments ?? 0),
      color: 'text-primary',
      bgColor: 'bg-mint/40',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.netCashflow' }),
      value: formatCurrency(data?.netCashflow ?? 0),
      color: (data?.netCashflow ?? 0) >= 0 ? 'text-success' : 'text-destructive',
      bgColor: (data?.netCashflow ?? 0) >= 0 ? 'bg-success/15' : 'bg-destructive/15',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.savingsRate' }),
      value: intl.formatNumber(data?.savingsRate ?? 0, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      color: 'text-lilac',
      bgColor: 'bg-lilac/40',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.debtToIncome' }),
      value: intl.formatNumber(data?.debtToIncome ?? 0, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      color: 'text-warning',
      bgColor: 'bg-warning/20',
    },
  ];

  return (
    <div className="bg-card border border-default rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-primary">
          {intl.formatMessage({ id: 'dashboard.summary.title' })}
        </h2>
        <button
          onClick={() => setShowInsights(true)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors duration-200"
        >
          {intl.formatMessage({ id: 'dashboard.summary.aiInsights.button' })}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="flex items-center p-4 rounded-lg border border-default bg-muted"
          >
            <div className={`w-12 h-12 rounded-full ${metric.bgColor} flex items-center justify-center mr-4`}>
              <span className={`text-lg font-semibold ${metric.color}`}>
                {index + 1}
              </span>
            </div>
            <div>
              <p className="text-sm text-secondary mb-1">
                {metric.label}
              </p>
              <p className={`text-lg font-semibold ${metric.color}`}>
                {metric.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insights Modal */}
      {showInsights && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border border-default rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-default flex justify-between items-center">
              <h3 className="text-xl font-semibold text-primary">
                {intl.formatMessage({ id: 'dashboard.summary.aiInsights.modalTitle' })}
              </h3>
              <button
                onClick={() => setShowInsights(false)}
                className="text-secondary hover:text-primary transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-secondary">
                    {intl.formatMessage({ id: 'dashboard.summary.aiInsights.loading' })}
                  </span>
                </div>
              ) : errorMessageId === 'settings.messages.claudeApiKeyRequired' ? (
                <div className="text-center py-8">
                  <p className="text-secondary mb-4">
                    {intl.formatMessage({ id: 'settings.messages.claudeApiKeyRequired' })}
                  </p>
                  <Link
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors duration-200"
                  >
                    {intl.formatMessage({ id: 'navigation.settings' })}
                  </Link>
                </div>
              ) : errorMessageId ? (
                <div className="text-center py-8">
                  <div className="bg-destructive/15 border border-destructive rounded-lg p-4 mb-4">
                    <h4 className="text-destructive font-medium mb-2">
                      {intl.formatMessage({ id: 'dashboard.summary.aiInsights.errorTitle' })}
                    </h4>
                    <p className="text-destructive">
                      {intl.formatMessage(
                        { id: errorMessageId },
                        errorMessageValues,
                      )}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => fetchInsights(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors duration-200 mr-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        {intl.formatMessage({ id: 'dashboard.summary.aiInsights.refreshing' })}
                      </>
                    ) : (
                      intl.formatMessage({ id: 'dashboard.summary.aiInsights.tryAgain' })
                    )}
                  </button>
                  
                  <Link
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 bg-muted hover:bg-mint/40 text-secondary rounded-lg text-sm font-medium transition-colors duration-200"
                  >
                    {intl.formatMessage({ id: 'navigation.settings' })}
                  </Link>
                </div>
              ) : insights ? (
                <div className="space-y-6">
                  <InsightsStatusBanner
                    metadata={insights.metadata}
                    onRefresh={() => fetchInsights(true)}
                    isLoading={isLoading}
                  />
                  
                  {Object.entries(insights.categories).map(([category, categoryInsights]) => {
                    const status = insights.status[category as keyof typeof insights.status];
                    return (
                      <div key={category} className={`p-6 rounded-lg border border-default/60 ${getStatusColor(status)}`}>
                        <h4 className="text-lg font-medium text-primary capitalize mb-4">
                          {intl.formatMessage({ id: `dashboard.summary.aiInsights.categories.${category}` })}
                        </h4>
                        <div className="space-y-4">
                          {categoryInsights.map((insight, index) => (
                            <InsightCard key={index} insight={insight} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="p-6 border-t border-default flex justify-end">
              <button
                onClick={() => setShowInsights(false)}
                className="px-4 py-2 bg-muted hover:bg-mint/40 text-secondary rounded-lg text-sm font-medium transition-colors duration-200"
              >
                {intl.formatMessage({ id: 'dashboard.summary.aiInsights.close' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlySummary; 
