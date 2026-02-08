'use client';

import { useIntl } from 'react-intl';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Insight } from '@/types/insights';
import { cn } from '@/lib/utils';

interface BiggestOpportunityCardProps {
  insight: Insight;
  onRunSimulator?: () => void;
  className?: string;
}

export default function BiggestOpportunityCard({
  insight,
  onRunSimulator,
  className,
}: BiggestOpportunityCardProps) {
  const intl = useIntl();

  const getDifficultyBadge = () => {
    switch (insight.priority) {
      case 'low':
        return {
          label: intl.formatMessage({ id: 'aiAnalysis.insightCards.difficulty.low' }),
          color: 'bg-success/15 text-success border-success/30',
        };
      case 'medium':
        return {
          label: intl.formatMessage({ id: 'aiAnalysis.insightCards.difficulty.medium' }),
          color: 'bg-warning/15 text-warning border-warning/30',
        };
      case 'high':
        return {
          label: intl.formatMessage({ id: 'aiAnalysis.insightCards.difficulty.high' }),
          color: 'bg-destructive/15 text-destructive border-destructive/30',
        };
    }
  };

  const badge = getDifficultyBadge();

  return (
    <Card className={cn(
      'rounded-2xl border shadow-sm overflow-hidden',
      'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50',
      className,
    )}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 flex-shrink-0">
            <Lightbulb className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                {intl.formatMessage({ id: 'aiAnalysis.insightCards.biggestOpportunity.title' })}
              </h3>
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                badge.color,
              )}>
                {badge.label}
              </span>
            </div>
            <p className="text-sm font-semibold text-primary mb-1">
              {insight.title}
            </p>
            <p className="text-xs text-secondary line-clamp-2 mb-3">
              {insight.description}
            </p>

            {/* Metrics if available */}
            {insight.metrics && insight.metrics.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {insight.metrics.map((metric, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/60 border border-amber-200/50 px-2 py-1 text-xs"
                  >
                    <span className="text-secondary">{metric.label}:</span>
                    <span className="font-semibold text-amber-700">{metric.value}</span>
                  </span>
                ))}
              </div>
            )}

            {onRunSimulator && (
              <button
                onClick={onRunSimulator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {intl.formatMessage({ id: 'aiAnalysis.insightCards.biggestOpportunity.runSimulator' })}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
