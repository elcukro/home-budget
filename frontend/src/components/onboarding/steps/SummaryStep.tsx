import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  Landmark,
  PiggyBank,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useIntl } from 'react-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import SummaryCard from '../common/SummaryCard';
import InfoPanel from '../common/InfoPanel';
import type { InfoPanelItem } from '../common/InfoPanel';
import CountUp from '../common/CountUp';

import type { GoalItem, OnboardingData, OnboardingMetrics } from '../OnboardingWizard';

interface SummaryStepProps {
  data: OnboardingData;
  metrics: OnboardingMetrics;
  taxFormLabels: Record<string, string>;
  onBack: () => void;
  onReset: () => void;
  onFinish: () => void;
  formatMoney: (value: number) => string;
}

type SummaryCardTone = 'positive' | 'neutral' | 'warning';

export default function SummaryStep({
  data,
  metrics,
  taxFormLabels,
  onBack,
  onFinish,
  formatMoney,
}: SummaryStepProps) {
  const intl = useIntl();
  const [headerVisible, setHeaderVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setHeaderVisible(true), 100);
    const t2 = window.setTimeout(() => setCtaVisible(true), 1200);
    // Celebration confetti burst
    const t3 = window.setTimeout(() => {
      const end = Date.now() + 600;
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }, 300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  const additionalSourcesTotal = Object.values(data.income.additionalSources).reduce(
    (sum, src) => sum + (src.enabled ? src.amount : 0),
    0
  );

  const propertiesTotal = data.assets.properties.reduce(
    (sum, item) => sum + item.value,
    0
  );

  // --- Goals ---
  const noGoalsLabel = intl.formatMessage({
    id: 'onboarding.summary.goals.none',
  });

  // --- Income ---
  const incomeItems: InfoPanelItem[] = [
    {
      label: intl.formatMessage({ id: 'onboarding.summary.income.salary' }),
      value: formatMoney(data.income.salaryNet),
      numericValue: data.income.salaryNet,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.income.additionalSources' }),
      value: formatMoney(additionalSourcesTotal),
      numericValue: additionalSourcesTotal,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.income.irregularIncome' }),
      value: formatMoney(data.income.irregularIncomeAnnual / 12),
      numericValue: data.income.irregularIncomeAnnual / 12,
    },
  ];

  if (data.life.taxForm) {
    incomeItems.push({
      label: intl.formatMessage({ id: 'onboarding.summary.income.taxForm' }),
      value: taxFormLabels[data.life.taxForm],
    });
  }

  if (data.life.employmentStatus === 'employee' && data.life.ppkEnrolled !== undefined) {
    incomeItems.push({
      label: intl.formatMessage({ id: 'onboarding.summary.income.ppk' }),
      value: data.life.ppkEnrolled
        ? intl.formatMessage({ id: 'common.yes' })
        : intl.formatMessage({ id: 'common.no' }),
    });
  }

  if (data.life.useAuthorsCosts) {
    incomeItems.push({
      label: intl.formatMessage({ id: 'onboarding.summary.income.authorsCosts' }),
      value: intl.formatMessage({ id: 'common.yes' }),
    });
  }

  if (data.life.birthYear) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - data.life.birthYear;
    if (age < 26) {
      incomeItems.push({
        label: intl.formatMessage({ id: 'onboarding.summary.income.youthRelief' }),
        value: intl.formatMessage(
          { id: 'onboarding.summary.income.youthReliefEligible' },
          { age }
        ),
      });
    }
  }

  // --- Expenses ---
  const expensesItems: InfoPanelItem[] = [
    {
      label: intl.formatMessage({ id: 'onboarding.summary.expenses.fixedCosts' }),
      value: formatMoney(metrics.regularMonthlyExpenses),
      numericValue: metrics.regularMonthlyExpenses,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.expenses.irregularMonthly' }),
      value: formatMoney(metrics.irregularMonthlyExpenses),
      numericValue: metrics.irregularMonthlyExpenses,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.expenses.irregularAnnual' }),
      value: formatMoney(metrics.irregularAnnualExpenses),
      numericValue: metrics.irregularAnnualExpenses,
      muted: true,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.expenses.monthlyLiabilities' }),
      value: formatMoney(metrics.liabilitiesMonthly),
      numericValue: metrics.liabilitiesMonthly,
    },
    (() => {
      const dti = metrics.dti;
      let levelKey: string;
      let color: string;
      if (dti === 0) { levelKey = 'none'; color = 'text-muted-foreground'; }
      else if (dti < 20) { levelKey = 'excellent'; color = 'text-emerald-600'; }
      else if (dti < 36) { levelKey = 'acceptable'; color = 'text-blue-600'; }
      else if (dti < 50) { levelKey = 'high'; color = 'text-amber-600'; }
      else { levelKey = 'critical'; color = 'text-red-600'; }
      return {
        label: intl.formatMessage({ id: 'onboarding.summary.expenses.dti' }),
        value: intl.formatMessage(
          { id: 'onboarding.summary.expenses.dtiValue' },
          { value: dti.toFixed(0) }
        ),
        hint: intl.formatMessage({ id: `onboarding.liabilities.summary.dtiLevel.${levelKey}` }),
        hintColor: color,
      };
    })(),
  ];

  // --- Assets ---
  const assetsItems: InfoPanelItem[] = [
    {
      label: intl.formatMessage({ id: 'onboarding.summary.assets.savings' }),
      value: formatMoney(data.assets.savings),
      numericValue: data.assets.savings,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.assets.investments' }),
      value: formatMoney(data.assets.investments.totalValue),
      numericValue: data.assets.investments.totalValue,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.assets.retirement' }),
      value: formatMoney(Object.values(data.assets.retirementAccounts).reduce((sum, a) => sum + (a.enabled ? a.value : 0), 0)),
      numericValue: Object.values(data.assets.retirementAccounts).reduce((sum, a) => sum + (a.enabled ? a.value : 0), 0),
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.assets.properties' }),
      value: formatMoney(propertiesTotal),
      numericValue: propertiesTotal,
    },
    {
      label: intl.formatMessage({ id: 'onboarding.summary.assets.emergencyCoverage' }),
      value: intl.formatMessage(
        { id: 'onboarding.summary.assets.emergencyCoverageValue' },
        { months: Math.round(metrics.emergencyCoverage) }
      ),
    },
  ];

  // --- Hero cards ---
  const cards: Array<{
    title: string;
    value: number;
    tone: SummaryCardTone;
    icon: React.ReactNode;
  }> = [
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.monthlyIncome' }),
      value: metrics.monthlyIncome,
      tone: 'positive',
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.monthlyExpenses' }),
      value: metrics.regularMonthlyExpenses + metrics.irregularMonthlyExpenses + metrics.liabilitiesMonthly,
      tone: 'neutral',
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.monthlySurplus' }),
      value: metrics.surplus,
      tone: metrics.surplus >= 0 ? 'positive' : 'warning',
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.netWorth' }),
      value: metrics.netWorth,
      tone: 'positive',
      icon: <Landmark className="h-4 w-4" />,
    },
  ];

  const backLabel = intl.formatMessage({ id: 'onboarding.navigation.back' });
  const finishLabel = intl.formatMessage({
    id: 'onboarding.summary.actions.finish',
  });

  return (
    <div className="space-y-6">
      {/* Celebration header */}
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent px-6 py-6 text-center transition-all duration-700',
          headerVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-6 scale-95 opacity-0'
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-primary">
            {intl.formatMessage({ id: 'onboarding.summary.celebration.title' })}
          </h3>
          <p className="mt-1 text-sm text-secondary">
            {intl.formatMessage({ id: 'onboarding.summary.celebration.subtitle' })}
          </p>
        </div>
      </div>

      {/* Key metrics - hero cards with count-up */}
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, index) => (
          <SummaryCard
            key={card.title}
            title={card.title}
            value={card.value}
            format={formatMoney}
            tone={card.tone}
            icon={card.icon}
            delay={200 + index * 100}
          />
        ))}
      </div>

      {/* Detail panels with count-up on money values */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoPanel
          title={intl.formatMessage({ id: 'onboarding.summary.panels.income' })}
          icon={<Banknote className="h-4 w-4" />}
          items={incomeItems}
          delay={600}
          accentColor="#22c55e"
          formatMoney={formatMoney}
          headerValue={formatMoney(metrics.monthlyIncome)}
        />
        <InfoPanel
          title={intl.formatMessage({
            id: 'onboarding.summary.panels.expensesLiabilities',
          })}
          icon={<Receipt className="h-4 w-4" />}
          items={expensesItems}
          delay={700}
          accentColor="#f59e0b"
          formatMoney={formatMoney}
          headerValue={formatMoney(
            metrics.regularMonthlyExpenses +
            metrics.irregularMonthlyExpenses +
            metrics.liabilitiesMonthly
          )}
        />
        <InfoPanel
          title={intl.formatMessage({ id: 'onboarding.summary.panels.assets' })}
          icon={<PiggyBank className="h-4 w-4" />}
          items={assetsItems}
          delay={800}
          accentColor="#3b82f6"
          formatMoney={formatMoney}
          headerValue={formatMoney(metrics.assetsTotal)}
        />
        <GoalsPanel
          title={intl.formatMessage({ id: 'onboarding.summary.panels.goals' })}
          goals={data.goals}
          noGoalsLabel={noGoalsLabel}
          formatMoney={formatMoney}
          delay={900}
        />
      </div>

      {/* CTA footer */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 transition-all duration-500',
          ctaVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}
      >
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Button>
        <Button
          onClick={onFinish}
          size="lg"
          className="gap-2 bg-primary px-6 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
        >
          {finishLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Goals panel with visual priority ---

interface GoalsPanelProps {
  title: string;
  goals: GoalItem[];
  noGoalsLabel: string;
  formatMoney: (value: number) => string;
  delay: number;
}

const priorityColors = [
  '', // 0 unused
  'bg-muted text-muted-foreground',
  'bg-blue-500/20 text-blue-600',
  'bg-amber-500/20 text-amber-600',
  'bg-orange-500/20 text-orange-600',
  'bg-red-500/20 text-red-600',
];

function GoalsPanel({
  title,
  goals,
  noGoalsLabel,
  formatMoney,
  delay,
}: GoalsPanelProps) {
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
        className="flex items-center gap-2 border-b border-muted/40 px-4 py-3"
        style={{ borderLeft: '3px solid #a855f7' }}
      >
        <Target className="h-4 w-4 text-secondary" />
        <p className="text-sm font-semibold text-primary">{title}</p>
      </div>

      {goals.length === 0 ? (
        <p className="px-4 py-3 text-sm text-secondary">{noGoalsLabel}</p>
      ) : (
        <div className="divide-y divide-muted/30">
          {goals.map((goal, index) => (
            <div
              key={goal.id}
              className={cn(
                'px-4 py-3 transition-all duration-300',
                visible ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
              )}
              style={{ transitionDelay: `${delay + 80 + index * 60}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-primary">
                  {goal.name}
                </span>
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  priorityColors[goal.priority] || priorityColors[1]
                )}>
                  {goal.priority}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-sm tabular-nums text-secondary">
                  <CountUp
                    value={goal.targetAmount}
                    format={formatMoney}
                    started={visible}
                    duration={700}
                  />
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        'h-1.5 w-3 rounded-full transition-colors',
                        level <= goal.priority
                          ? 'bg-purple-500'
                          : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
