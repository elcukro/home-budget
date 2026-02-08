'use client';

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Target, PiggyBank, Shield, TrendingUp, CheckCircle2 } from 'lucide-react';
import { SuggestedGoal } from '@/types/insights';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, React.ElementType> = {
  emergency_fund: Shield,
  investment: TrendingUp,
  retirement: TrendingUp,
  savings: PiggyBank,
  default: Target,
};

interface SuggestedGoalCardProps {
  goal: SuggestedGoal;
}

const SuggestedGoalCard: React.FC<SuggestedGoalCardProps> = ({ goal }) => {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  const Icon = categoryIcons[goal.category] || categoryIcons.default;

  const handleCreateGoal = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/backend/savings/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: goal.name,
          category: goal.category,
          target_amount: goal.targetAmount,
          deadline: goal.deadline,
          priority: goal.priority,
        }),
      });

      if (response.ok) {
        setIsCreated(true);
        toast({
          title: intl.formatMessage({ id: 'aiAnalysis.suggestedGoals.created' }),
        });
      } else {
        toast({
          title: intl.formatMessage({ id: 'aiAnalysis.suggestedGoals.error' }),
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: intl.formatMessage({ id: 'aiAnalysis.suggestedGoals.error' }),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      isCreated
        ? 'bg-success/5 border-success/30'
        : 'bg-card border-default hover:border-primary/30 hover:shadow-sm'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="font-semibold text-sm text-primary truncate">{goal.name}</h5>
            {goal.accountType && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase flex-shrink-0">
                {goal.accountType}
              </span>
            )}
          </div>
          <p className="text-lg font-bold text-primary mt-0.5">
            {formatCurrency(goal.targetAmount)}
          </p>
          {goal.deadline && (
            <p className="text-xs text-secondary">
              {intl.formatMessage({ id: 'aiAnalysis.suggestedGoals.deadline' })}: {new Date(goal.deadline).toLocaleDateString(intl.locale)}
            </p>
          )}
          <p className="text-xs text-secondary mt-1.5 leading-relaxed">
            {goal.reason}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {isCreated ? (
          <div className="flex items-center gap-1.5 text-success text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            {intl.formatMessage({ id: 'aiAnalysis.suggestedGoals.created' })}
          </div>
        ) : (
          <button
            onClick={handleCreateGoal}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-60"
          >
            {isCreating ? (
              <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            {intl.formatMessage({ id: 'aiAnalysis.suggestedGoals.createButton' })}
          </button>
        )}
      </div>
    </div>
  );
};

export default SuggestedGoalCard;
