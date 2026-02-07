'use client';

import { useIntl } from 'react-intl';
import { Progress } from '@/components/ui/progress';
import { InsightStatus, InsightCategoryKey } from '@/types/insights';
import { cn } from '@/lib/utils';

function statusToScore(status: InsightStatus): number {
  switch (status) {
    case 'good': return 90;
    case 'ok': return 70;
    case 'can_be_improved': return 50;
    case 'bad': return 20;
    default: return 0;
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-yellow-400';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-destructive';
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-destructive';
}

interface CategoryHealthMeterProps {
  categories: InsightCategoryKey[];
  statusMap: Record<string, InsightStatus>;
  className?: string;
}

export default function CategoryHealthMeter({
  categories,
  statusMap,
  className,
}: CategoryHealthMeterProps) {
  const intl = useIntl();

  return (
    <div className={cn('space-y-3', className)}>
      {categories.map((catKey) => {
        const status = statusMap[catKey];
        if (!status) return null;

        const score = statusToScore(status);
        const label = intl.formatMessage({ id: `dashboard.summary.aiInsights.categories.${catKey}` });

        return (
          <div key={catKey} className="flex items-center gap-3">
            <span className="text-xs font-medium text-secondary w-24 flex-shrink-0 truncate">
              {label}
            </span>
            <Progress
              value={score}
              className="h-2 flex-1"
              indicatorClassName={scoreColor(score)}
            />
            <span className={cn(
              'text-xs font-bold tabular-nums w-8 text-right',
              scoreTextColor(score),
            )}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
