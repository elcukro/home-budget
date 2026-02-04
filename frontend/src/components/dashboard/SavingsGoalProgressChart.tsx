'use client';

import { useIntl } from 'react-intl';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useEffect, useState, useMemo } from 'react';
import { Target, TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { SavingsGoal, GoalStatus } from '@/types/financial-freedom';
import Link from 'next/link';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend
);

interface SavingsGoalProgressChartProps {
  goals: SavingsGoal[];
  formatCurrency: (amount: number) => string;
  onGoalClick?: (goalId: number) => void;
}

interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  overallProgress: number;
  averageProgress: number;
  atRiskGoals: number;
  overdueGoals: number;
}

// Helper function to check if a goal is overdue (deadline in the past and not completed)
function isGoalOverdue(goal: SavingsGoal): boolean {
  if (!goal.deadline || goal.status === GoalStatus.COMPLETED) return false;
  const deadlineDate = new Date(goal.deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

// Helper function to calculate projected completion date based on current pace
function getProjectedCompletionDate(goal: SavingsGoal): Date | null {
  // If already completed or no target/current amount, return null
  if (goal.status === GoalStatus.COMPLETED || goal.target_amount <= 0) return null;
  if (goal.current_amount >= goal.target_amount) return null;

  // Calculate based on monthly_needed (if available) or estimate from progress
  if (goal.monthly_needed && goal.monthly_needed > 0) {
    const remainingMonths = goal.remaining_amount / goal.monthly_needed;
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(remainingMonths));
    return projectedDate;
  }

  // If we don't have monthly_needed, we can't calculate projection
  return null;
}

// Get status badge info for a goal
function getGoalStatusInfo(goal: SavingsGoal, intl: ReturnType<typeof useIntl>): {
  badge: 'on_track' | 'at_risk' | 'overdue' | 'completed' | null;
  badgeText: string;
  projectedDate: Date | null;
} | null {
  // Edge case: 100%+ funded - treat as completed
  if (goal.progress_percent >= 100 || goal.current_amount >= goal.target_amount) {
    return {
      badge: 'completed',
      badgeText: intl.formatMessage({ id: 'dashboard.savingsGoalProgress.status.completed' }),
      projectedDate: null,
    };
  }

  // Edge case: goal with $0 target - skip status display
  if (goal.target_amount <= 0) {
    return null;
  }

  // Check if overdue
  if (isGoalOverdue(goal)) {
    return {
      badge: 'overdue',
      badgeText: intl.formatMessage({ id: 'dashboard.savingsGoalProgress.status.overdue' }),
      projectedDate: getProjectedCompletionDate(goal),
    };
  }

  // Check if goal has deadline and on-track info
  if (goal.deadline && goal.is_on_track !== null && goal.is_on_track !== undefined) {
    if (goal.is_on_track) {
      return {
        badge: 'on_track',
        badgeText: intl.formatMessage({ id: 'dashboard.savingsGoalProgress.status.onTrack' }),
        projectedDate: null,
      };
    } else {
      return {
        badge: 'at_risk',
        badgeText: intl.formatMessage({ id: 'dashboard.savingsGoalProgress.status.atRisk' }),
        projectedDate: getProjectedCompletionDate(goal),
      };
    }
  }

  // No deadline - no status badge
  return null;
}

const progressColors = {
  high: '#22C55E',      // 75%+ progress
  medium: '#0EA5E9',    // 50-74% progress
  low: '#F59E0B',       // 25-49% progress
  minimal: '#EF4444',   // <25% progress
};

function getProgressColor(progress: number): string {
  if (progress >= 75) return progressColors.high;
  if (progress >= 50) return progressColors.medium;
  if (progress >= 25) return progressColors.low;
  return progressColors.minimal;
}

export default function SavingsGoalProgressChart({
  goals,
  formatCurrency,
  onGoalClick,
}: SavingsGoalProgressChartProps) {
  const intl = useIntl();
  const [chartKey, setChartKey] = useState(Date.now());

  useEffect(() => {
    setChartKey(Date.now());
  }, [intl]);

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === GoalStatus.ACTIVE || g.status === GoalStatus.PAUSED),
    [goals]
  );

  const stats: GoalStats = useMemo(() => {
    const active = goals.filter((g) => g.status === GoalStatus.ACTIVE);
    const completed = goals.filter((g) => g.status === GoalStatus.COMPLETED);
    // Filter out goals with $0 target to avoid division issues
    const validGoals = goals.filter((g) => g.target_amount > 0);
    const totalTarget = validGoals.reduce((sum, g) => sum + g.target_amount, 0);
    const totalCurrent = validGoals.reduce((sum, g) => sum + g.current_amount, 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    const avgProgress =
      validGoals.length > 0
        ? validGoals.reduce((sum, g) => sum + g.progress_percent, 0) / validGoals.length
        : 0;

    // Count at-risk and overdue goals
    const atRisk = active.filter(
      (g) => g.deadline && g.is_on_track === false && !isGoalOverdue(g)
    ).length;
    const overdue = active.filter((g) => isGoalOverdue(g)).length;

    return {
      totalGoals: goals.length,
      activeGoals: active.length,
      completedGoals: completed.length,
      totalTargetAmount: totalTarget,
      totalCurrentAmount: totalCurrent,
      overallProgress: Math.min(overallProgress, 100),
      averageProgress: Math.min(avgProgress, 100),
      atRiskGoals: atRisk,
      overdueGoals: overdue,
    };
  }, [goals]);

  const sortedGoals = useMemo(
    () =>
      [...activeGoals].sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === GoalStatus.ACTIVE) return -1;
          if (b.status === GoalStatus.ACTIVE) return 1;
        }
        return b.progress_percent - a.progress_percent;
      }),
    [activeGoals]
  );

  const chartData: ChartData<'bar'> = useMemo(() => {
    const labels = sortedGoals.map((goal) => goal.name);
    const currentData = sortedGoals.map((goal) => goal.current_amount);
    const remainingData = sortedGoals.map((goal) =>
      Math.max(0, goal.target_amount - goal.current_amount)
    );

    return {
      labels,
      datasets: [
        {
          label: intl.formatMessage({ id: 'dashboard.savingsGoalProgress.currentAmount' }),
          data: currentData,
          backgroundColor: sortedGoals.map((goal) =>
            getProgressColor(goal.progress_percent)
          ),
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
        },
        {
          label: intl.formatMessage({ id: 'dashboard.savingsGoalProgress.remaining' }),
          data: remainingData,
          backgroundColor: 'rgba(156, 163, 175, 0.2)',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
        },
      ],
    };
  }, [sortedGoals, intl]);

  const axisColor = 'rgba(31, 28, 26, 0.9)';
  const gridColor = 'rgba(31, 28, 26, 0.1)';

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: axisColor,
            font: { size: 11 },
            usePointStyle: true,
            boxWidth: 8,
          },
        },
        tooltip: {
          callbacks: {
            title: (contexts) => {
              if (!contexts?.length) return '';
              const index = contexts[0].dataIndex;
              const goal = sortedGoals[index];
              return goal?.name || '';
            },
            label: (context) => {
              const datasetIndex = context.datasetIndex;
              const index = context.dataIndex;
              const goal = sortedGoals[index];

              if (datasetIndex === 0) {
                return `${intl.formatMessage({
                  id: 'dashboard.savingsGoalProgress.saved',
                })}: ${formatCurrency(goal.current_amount)} (${goal.progress_percent.toFixed(0)}%)`;
              }
              return `${intl.formatMessage({
                id: 'dashboard.savingsGoalProgress.remaining',
              })}: ${formatCurrency(goal.remaining_amount)}`;
            },
            afterBody: (contexts) => {
              if (!contexts?.length) return [];
              const index = contexts[0].dataIndex;
              const goal = sortedGoals[index];
              const lines: string[] = [];

              lines.push(
                `${intl.formatMessage({
                  id: 'dashboard.savingsGoalProgress.target',
                })}: ${formatCurrency(goal.target_amount)}`
              );

              if (goal.deadline) {
                lines.push(
                  `${intl.formatMessage({
                    id: 'dashboard.savingsGoalProgress.deadline',
                  })}: ${intl.formatDate(new Date(goal.deadline), {
                    year: 'numeric',
                    month: 'short',
                  })}`
                );
              }

              if (goal.monthly_needed && goal.monthly_needed > 0) {
                lines.push(
                  `${intl.formatMessage({
                    id: 'dashboard.savingsGoalProgress.monthlyNeeded',
                  })}: ${formatCurrency(goal.monthly_needed)}`
                );
              }

              // Add status info
              const statusInfo = getGoalStatusInfo(goal, intl);
              if (statusInfo) {
                lines.push('');
                lines.push(
                  `${intl.formatMessage({ id: 'dashboard.savingsGoalProgress.status.label' })}: ${statusInfo.badgeText}`
                );
                // Add projected completion date for at-risk or overdue goals
                if (statusInfo.projectedDate && (statusInfo.badge === 'at_risk' || statusInfo.badge === 'overdue')) {
                  lines.push(
                    `${intl.formatMessage({ id: 'dashboard.savingsGoalProgress.projectedCompletion' })}: ${intl.formatDate(statusInfo.projectedDate, {
                      year: 'numeric',
                      month: 'short',
                    })}`
                  );
                }
              }

              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: gridColor },
          ticks: {
            color: axisColor,
            callback: (value) => formatCurrency(value as number),
          },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: axisColor,
            font: { size: 11 },
            callback: function (_, index) {
              const goal = sortedGoals[index];
              if (!goal) return '';
              const name = goal.name;
              return name.length > 18 ? name.substring(0, 15) + '...' : name;
            },
          },
        },
      },
      onClick: (_event, elements) => {
        if (elements.length > 0 && onGoalClick) {
          const index = elements[0].index;
          const goal = sortedGoals[index];
          if (goal) {
            onGoalClick(goal.id);
          }
        }
      },
    }),
    [sortedGoals, intl, formatCurrency, onGoalClick]
  );

  if (!goals || goals.length === 0) {
    return (
      <div className="bg-card border border-default p-6 rounded-xl shadow-sm h-full flex flex-col">
        <h2 className="text-lg font-semibold text-primary mb-4">
          {intl.formatMessage({ id: 'dashboard.savingsGoalProgress.title' })}
        </h2>
        <div className="flex-grow flex flex-col items-center justify-center py-12 text-secondary">
          <Target className="h-12 w-12 opacity-30 mb-4" />
          <p className="text-center text-sm mb-4">
            {intl.formatMessage({ id: 'dashboard.savingsGoalProgress.emptyState' })}
          </p>
          <Link
            href="/savings"
            className="text-primary hover:underline text-sm font-medium"
          >
            {intl.formatMessage({ id: 'dashboard.savingsGoalProgress.addGoal' })}
          </Link>
        </div>
      </div>
    );
  }

  const chartHeight = Math.max(200, sortedGoals.length * 50 + 60);

  return (
    <div className="bg-card border border-default p-6 rounded-xl shadow-sm h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-primary">
          {intl.formatMessage({ id: 'dashboard.savingsGoalProgress.title' })}
        </h2>
        <p className="text-sm text-secondary">
          {intl.formatMessage({ id: 'dashboard.savingsGoalProgress.description' })}
        </p>
      </div>

      {sortedGoals.length > 0 ? (
        <div
          className="relative flex-grow mb-6"
          style={{ height: `${chartHeight}px`, minHeight: '200px' }}
        >
          <Bar key={chartKey} data={chartData} options={options} />
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center py-8 text-secondary text-sm">
          {intl.formatMessage({
            id: 'dashboard.savingsGoalProgress.noActiveGoals',
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-xs text-secondary">
              {intl.formatMessage({
                id: 'dashboard.savingsGoalProgress.statistics.overallProgress',
              })}
            </p>
          </div>
          <p className="text-lg font-semibold text-primary">
            {stats.overallProgress.toFixed(0)}%
          </p>
          <p className="text-xs text-secondary">
            {formatCurrency(stats.totalCurrentAmount)} /{' '}
            {formatCurrency(stats.totalTargetAmount)}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <Target className="h-3.5 w-3.5 text-sky-600" />
            <p className="text-xs text-secondary">
              {intl.formatMessage({
                id: 'dashboard.savingsGoalProgress.statistics.activeGoals',
              })}
            </p>
          </div>
          <p className="text-lg font-semibold text-primary">{stats.activeGoals}</p>
          <p className="text-xs text-secondary">
            {intl.formatMessage(
              { id: 'dashboard.savingsGoalProgress.statistics.ofTotal' },
              { total: stats.totalGoals }
            )}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-xs text-secondary">
              {intl.formatMessage({
                id: 'dashboard.savingsGoalProgress.statistics.completed',
              })}
            </p>
          </div>
          <p className="text-lg font-semibold text-emerald-600">
            {stats.completedGoals}
          </p>
          <p className="text-xs text-secondary">
            {intl.formatMessage({
              id: 'dashboard.savingsGoalProgress.statistics.goalsReached',
            })}
          </p>
        </div>

        {/* Show at-risk/overdue stat if any exist, otherwise show average progress */}
        {(stats.atRiskGoals > 0 || stats.overdueGoals > 0) ? (
          <div className={`rounded-lg p-3 ${stats.overdueGoals > 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className={`h-3.5 w-3.5 ${stats.overdueGoals > 0 ? 'text-red-600' : 'text-amber-600'}`} />
              <p className={`text-xs ${stats.overdueGoals > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                {stats.overdueGoals > 0
                  ? intl.formatMessage({ id: 'dashboard.savingsGoalProgress.statistics.overdueGoals' })
                  : intl.formatMessage({ id: 'dashboard.savingsGoalProgress.statistics.atRiskGoals' })}
              </p>
            </div>
            <p className={`text-lg font-semibold ${stats.overdueGoals > 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {stats.overdueGoals > 0 ? stats.overdueGoals : stats.atRiskGoals}
            </p>
            <p className={`text-xs ${stats.overdueGoals > 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {intl.formatMessage({ id: 'dashboard.savingsGoalProgress.statistics.needsAttention' })}
            </p>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <p className="text-xs text-secondary">
                {intl.formatMessage({
                  id: 'dashboard.savingsGoalProgress.statistics.avgProgress',
                })}
              </p>
            </div>
            <p className="text-lg font-semibold text-primary">
              {stats.averageProgress.toFixed(0)}%
            </p>
            <p className="text-xs text-secondary">
              {intl.formatMessage({
                id: 'dashboard.savingsGoalProgress.statistics.perGoal',
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
