import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import CountUp from './CountUp';

interface SummaryCardProps {
  title: string;
  value: number;
  format: (value: number) => string;
  tone?: 'positive' | 'neutral' | 'warning';
  icon?: React.ReactNode;
  delay?: number;
}

const toneClassMap: Record<Required<SummaryCardProps>['tone'], string> = {
  positive: 'border-emerald-500/30 bg-emerald-500/10',
  neutral: 'border-muted/60 bg-muted/30',
  warning: 'border-amber-500/30 bg-amber-500/10',
};

const toneValueMap: Record<Required<SummaryCardProps>['tone'], string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-primary',
  warning: 'text-amber-600 dark:text-amber-400',
};

export default function SummaryCard({
  title,
  value,
  format,
  tone = 'neutral',
  icon,
  delay = 0,
}: SummaryCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-500',
        toneClassMap[tone],
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0'
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/60 text-secondary">
            {icon}
          </span>
        )}
        <p className="text-xs font-medium uppercase tracking-wider text-secondary">
          {title}
        </p>
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', toneValueMap[tone])}>
        <CountUp value={value} format={format} started={visible} duration={900} />
      </p>
    </div>
  );
}
