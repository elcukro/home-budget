import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import CountUp from './CountUp';

export interface InfoPanelItem {
  label: string;
  value: string;
  numericValue?: number;
  hint?: string;
  hintColor?: string;
  muted?: boolean;
}

interface InfoPanelProps {
  title: string;
  icon?: React.ReactNode;
  items: InfoPanelItem[];
  delay?: number;
  accentColor?: string;
  formatMoney?: (value: number) => string;
  headerValue?: string;
}

export default function InfoPanel({
  title,
  icon,
  items,
  delay = 0,
  accentColor,
  formatMoney,
  headerValue,
}: InfoPanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'rounded-xl border border-muted/60 bg-card overflow-hidden transition-all duration-500',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-muted/40 px-4 py-3"
        style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : undefined}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-secondary">{icon}</span>
          )}
          <p className="text-sm font-semibold text-primary">{title}</p>
        </div>
        {headerValue && (
          <p className="text-sm font-bold tabular-nums text-primary">{headerValue}</p>
        )}
      </div>
      <dl className="divide-y divide-muted/30 text-sm">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'px-4 py-2.5 transition-all duration-300',
              visible ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
            )}
            style={{ transitionDelay: `${delay + 80 + index * 40}ms` }}
          >
            <div className="flex items-center justify-between gap-4">
              <dt className={cn('text-secondary', item.muted && 'text-muted-foreground/60')}>
                {item.label}
              </dt>
              <dd className={cn(
                'font-medium tabular-nums',
                item.muted ? 'text-muted-foreground/60' : 'text-primary'
              )}>
                {item.numericValue !== undefined && formatMoney ? (
                  <CountUp
                    value={item.numericValue}
                    format={formatMoney}
                    started={visible}
                    duration={700}
                  />
                ) : (
                  item.value
                )}
              </dd>
            </div>
            {item.hint && (
              <p
                className={cn('mt-1 text-xs', item.hintColor || 'text-secondary')}
              >
                {item.hint}
              </p>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
