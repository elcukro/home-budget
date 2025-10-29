import { useIntl } from 'react-intl';
import { ArrowPathIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { InsightsMetadata } from '@/types/cache';
import { useState } from 'react';

interface InsightsStatusBannerProps {
  metadata: InsightsMetadata;
  onRefresh: () => void;
  isLoading: boolean;
}

const InsightsStatusBanner: React.FC<InsightsStatusBannerProps> = ({
  metadata,
  onRefresh,
  isLoading
}) => {
  const intl = useIntl();
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(intl.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    } as Intl.DateTimeFormatOptions);
  };

  const getStatusColor = () => {
    if (!metadata.isCached) return 'bg-success/15';
    return 'bg-mint/40';
  };

  // Calculate days since last refresh
  const getDaysSinceRefresh = () => {
    if (!metadata.lastRefreshDate) return 0;
    const lastRefresh = new Date(metadata.lastRefreshDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastRefresh.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysSinceRefresh = getDaysSinceRefresh();
  
  const toggleDetails = () => {
    setIsDetailsExpanded(!isDetailsExpanded);
  };

  return (
    <div className={`mb-6 p-4 rounded-lg ${getStatusColor()} text-primary`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <ClockIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            {metadata.isCached ? (
              <button 
                onClick={toggleDetails}
                className="text-sm font-medium flex items-center gap-1 hover:underline"
              >
                {metadata.validityReason}
                {isDetailsExpanded ? 
                  <ChevronUpIcon className="h-4 w-4" /> : 
                  <ChevronDownIcon className="h-4 w-4" />
                }
              </button>
            ) : (
              <p className="text-sm font-medium">
                {metadata.validityReason}
              </p>
            )}
            
            <p className="text-sm mt-1 opacity-80">
              {intl.formatMessage(
                { id: 'dashboard.summary.aiInsights.generatedAt' },
                { date: formatDate(metadata.createdAt) }
              )}
            </p>
            
            {isDetailsExpanded && metadata.isCached && (
              <div className="mt-2 text-sm animate-fadeIn">
                {metadata.lastRefreshDate && (
                  <p className="opacity-80">
                    {intl.formatMessage(
                      { id: 'dashboard.summary.aiInsights.lastRefreshed' },
                      { 
                        date: formatDate(metadata.lastRefreshDate),
                        days: daysSinceRefresh
                      }
                    )}
                  </p>
                )}
                
                {metadata.dataChanges && (
                  <div className="mt-2">
                    <p className="opacity-80">
                      {intl.formatMessage({ id: 'dashboard.summary.aiInsights.dataChanges' })}:
                    </p>
                    <ul className="mt-1 space-y-1 pl-2">
                      <li>
                        {intl.formatMessage(
                          { id: 'dashboard.summary.aiInsights.incomeChange' },
                          { change: metadata.dataChanges.income }
                        )}
                      </li>
                      <li>
                        {intl.formatMessage(
                          { id: 'dashboard.summary.aiInsights.expensesChange' },
                          { change: metadata.dataChanges.expenses }
                        )}
                      </li>
                      <li>
                        {intl.formatMessage(
                          { id: 'dashboard.summary.aiInsights.loansChange' },
                          { change: metadata.dataChanges.loans }
                        )}
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors duration-200 disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">
            {intl.formatMessage({ id: 'dashboard.summary.aiInsights.refresh' })}
          </span>
        </button>
      </div>
    </div>
  );
};

export default InsightsStatusBanner; 
