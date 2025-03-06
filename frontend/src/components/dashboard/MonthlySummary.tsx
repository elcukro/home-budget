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
      return 'bg-green-50 dark:bg-green-900/20';
    case 'can_be_improved':
      return 'bg-blue-50 dark:bg-blue-900/20';
    case 'ok':
      return 'bg-yellow-50 dark:bg-yellow-900/20';
    case 'bad':
      return 'bg-red-50 dark:bg-red-900/20';
    default:
      return 'bg-gray-50 dark:bg-gray-900/20';
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
        return 'border-l-4 border-l-red-500/50';
      case 'medium':
        return 'border-l-4 border-l-yellow-500/50';
      case 'low':
        return 'border-l-4 border-l-green-500/50';
    }
  };

  return (
    <div className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${getPriorityBorder()}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
          {getIcon()}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            {insight.title}
          </h4>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            {insight.description}
          </p>
          {insight.actionItems && insight.actionItems.length > 0 && (
            <ul className="mt-3 space-y-1">
              {insight.actionItems.map((item, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {insight.metrics && insight.metrics.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {insight.metrics.map((metric, index) => (
                <div key={index} className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{metric.label}: </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{metric.value}</span>
                  {metric.trend === 'up' && <span className="text-green-500">↑</span>}
                  {metric.trend === 'down' && <span className="text-red-500">↓</span>}
                  {metric.trend === 'stable' && <span className="text-gray-500">→</span>}
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
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  const fetchInsights = async (forceRefresh = false) => {
    if (!session?.user?.email) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = new URL(`${API_URL}/users/${encodeURIComponent(session.user.email)}/insights`, window.location.origin);
      if (forceRefresh) {
        url.searchParams.set('refresh', 'true');
      }
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorDetail = errorData.detail || 'Failed to fetch insights';
        
        // Check for specific Claude API errors
        if (errorDetail.includes('Claude API error: 529')) {
          throw new Error('Claude API is currently overloaded. Please try again later.');
        } else if (errorDetail.includes('Claude API error: 401')) {
          throw new Error('Invalid Claude API key. Please check your settings.');
        } else if (errorDetail.includes('Claude API error: 403')) {
          throw new Error('Your Claude API key does not have permission to use this model.');
        } else if (errorDetail.includes('Claude API error: 429')) {
          throw new Error('Claude API rate limit exceeded. Please try again later.');
        } else if (errorDetail.includes('Claude API error')) {
          throw new Error(`${errorDetail}. Please try again later.`);
        } else {
          throw new Error(errorDetail);
        }
      }
      
      const data = await response.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.totalExpenses' }),
      value: formatCurrency(data?.totalExpenses ?? 0),
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.loanPayments' }),
      value: formatCurrency(data?.totalLoanPayments ?? 0),
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.netCashflow' }),
      value: formatCurrency(data?.netCashflow ?? 0),
      color: (data?.netCashflow ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bgColor: (data?.netCashflow ?? 0) >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.savingsRate' }),
      value: intl.formatNumber(data?.savingsRate ?? 0, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
    },
    {
      label: intl.formatMessage({ id: 'dashboard.summary.debtToIncome' }),
      value: intl.formatNumber(data?.debtToIncome ?? 0, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900',
    },
  ];

  return (
    <div className="bg-white dark:bg-background-primary rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-default">
          {intl.formatMessage({ id: 'dashboard.summary.title' })}
        </h2>
        <button
          onClick={() => setShowInsights(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
        >
          {intl.formatMessage({ id: 'dashboard.summary.aiInsights.button' })}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700"
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
          <div className="bg-white dark:bg-background-primary rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-default">
                {intl.formatMessage({ id: 'dashboard.summary.aiInsights.modalTitle' })}
              </h3>
              <button
                onClick={() => setShowInsights(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-300">
                    {intl.formatMessage({ id: 'dashboard.summary.aiInsights.loading' })}
                  </span>
                </div>
              ) : error === 'API_KEY_MISSING' ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {intl.formatMessage({ id: 'settings.messages.claudeApiKeyRequired' })}
                  </p>
                  <Link
                    href="/settings"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                  >
                    {intl.formatMessage({ id: 'navigation.settings' })}
                  </Link>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <h4 className="text-red-700 dark:text-red-400 font-medium mb-2">
                      {intl.formatMessage({ id: 'dashboard.summary.aiInsights.errorTitle' })}
                    </h4>
                    <p className="text-red-600 dark:text-red-300">
                      {error}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => fetchInsights(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 mr-2"
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
                    className="inline-flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors duration-200"
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
                      <div key={category} className={`p-6 rounded-lg ${getStatusColor(status)}`}>
                        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 capitalize mb-4">
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

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowInsights(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors duration-200"
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