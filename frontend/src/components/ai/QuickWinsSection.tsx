'use client';

import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Zap, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Insight } from '@/types/insights';
import { cn } from '@/lib/utils';

const QUICK_WINS_STORAGE_KEY = 'firedup_quick_wins_completed';

function getCompletedWins(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(QUICK_WINS_STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // ignore
  }
  return new Set();
}

function saveCompletedWins(wins: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUICK_WINS_STORAGE_KEY, JSON.stringify([...wins]));
  } catch {
    // ignore
  }
}

interface QuickWinsSectionProps {
  insights: Insight[];
  className?: string;
}

export default function QuickWinsSection({ insights, className }: QuickWinsSectionProps) {
  const intl = useIntl();
  const [completedWins, setCompletedWins] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCompletedWins(getCompletedWins());
  }, []);

  const toggleWin = useCallback((title: string) => {
    setCompletedWins(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      saveCompletedWins(next);
      return next;
    });
  }, []);

  // Get top 3 quick wins (low priority = easy)
  const quickWins = insights
    .filter(i => i.type === 'recommendation' && i.priority !== 'high')
    .slice(0, 3);

  if (quickWins.length === 0) return null;

  return (
    <Card className={cn('rounded-2xl border border-default shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
            <Zap className="h-5 w-5 text-sky-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-primary">
            {intl.formatMessage({ id: 'aiAnalysis.insightCards.quickWins.title' })}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {quickWins.map((win) => {
            const isCompleted = completedWins.has(win.title);
            return (
              <button
                key={win.title}
                onClick={() => toggleWin(win.title)}
                className={cn(
                  'flex items-start gap-3 w-full text-left rounded-xl border p-3 transition-all',
                  isCompleted
                    ? 'border-success/30 bg-success/5'
                    : 'border-default bg-card hover:bg-muted/30',
                )}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-secondary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    isCompleted ? 'text-secondary line-through' : 'text-primary',
                  )}>
                    {win.title}
                  </p>
                  <p className="text-xs text-secondary line-clamp-1 mt-0.5">
                    {win.description}
                  </p>
                </div>
                {win.metrics && win.metrics.length > 0 && (
                  <span className="text-xs font-semibold text-success flex-shrink-0">
                    {win.metrics[0].value}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
