import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';

import SummaryCard from '../common/SummaryCard';
import InfoPanel from '../common/InfoPanel';

import type { OnboardingData, OnboardingMetrics } from '../OnboardingWizard';

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
  onReset,
  onFinish,
  formatMoney,
}: SummaryStepProps) {
  const intl = useIntl();

  const additionalSourcesTotal = Object.values(data.income.additionalSources).reduce(
    (sum, src) => sum + (src.enabled ? src.amount : 0),
    0
  );

  const propertiesTotal = data.assets.properties.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const noGoalsLabel = intl.formatMessage({
    id: 'onboarding.summary.goals.none',
  });

  const goalsSummaryPlaceholder = intl.formatMessage({
    id: 'onboarding.summary.goals.noneValue',
  });

  const goalsSummary: Array<[string, string]> =
    data.goals.length === 0
      ? [[noGoalsLabel, goalsSummaryPlaceholder] as [string, string]]
      : data.goals.map<[string, string]>((goal) => {
          const goalName =
            goal.name ||
            intl.formatMessage({ id: 'onboarding.summary.goals.unnamed' });
          const goalValue = intl.formatMessage(
            { id: 'onboarding.summary.goals.entry' },
            {
              amount: formatMoney(goal.targetAmount),
              priority: goal.priority,
            }
          );
          return [goalName, goalValue];
        });

  const incomeItems: Array<[string, string]> = [
    [
      intl.formatMessage({ id: 'onboarding.summary.income.salary' }),
      formatMoney(data.income.salaryNet),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.income.additionalSources' }),
      formatMoney(additionalSourcesTotal),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.income.irregularIncome' }),
      formatMoney(data.income.irregularIncomeAnnual / 12),
    ],
  ];

  if (data.life.taxForm) {
    incomeItems.push([
      intl.formatMessage({ id: 'onboarding.summary.income.taxForm' }),
      taxFormLabels[data.life.taxForm],
    ]);
  }

  // Add PPK enrollment status for employees
  if (data.life.employmentStatus === 'employee' && data.life.ppkEnrolled !== undefined) {
    incomeItems.push([
      intl.formatMessage({ id: 'onboarding.summary.income.ppk' }),
      data.life.ppkEnrolled
        ? intl.formatMessage({ id: 'common.yes' })
        : intl.formatMessage({ id: 'common.no' }),
    ]);
  }

  // Add KUP 50% status for eligible employment types
  if (data.life.useAuthorsCosts) {
    incomeItems.push([
      intl.formatMessage({ id: 'onboarding.summary.income.authorsCosts' }),
      intl.formatMessage({ id: 'common.yes' }),
    ]);
  }

  // Add youth relief eligibility based on birth year
  if (data.life.birthYear) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - data.life.birthYear;
    if (age < 26) {
      incomeItems.push([
        intl.formatMessage({ id: 'onboarding.summary.income.youthRelief' }),
        intl.formatMessage({ id: 'onboarding.summary.income.youthReliefEligible' }, { age }),
      ]);
    }
  }

  const expensesItems: Array<[string, string]> = [
    [
      intl.formatMessage({ id: 'onboarding.summary.expenses.fixedCosts' }),
      formatMoney(metrics.regularMonthlyExpenses),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.expenses.irregularMonthly' }),
      formatMoney(metrics.irregularMonthlyExpenses),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.expenses.irregularAnnual' }),
      formatMoney(metrics.irregularAnnualExpenses),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.expenses.monthlyLiabilities' }),
      formatMoney(metrics.liabilitiesMonthly),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.expenses.dti' }),
      intl.formatMessage(
        { id: 'onboarding.summary.expenses.dtiValue' },
        { value: metrics.dti.toFixed(0) }
      ),
    ],
  ];

  const emergencyCoverageValue = intl.formatMessage(
    { id: 'onboarding.summary.assets.emergencyCoverageValue' },
    { months: metrics.emergencyCoverage.toFixed(1) }
  );

  const assetsItems: Array<[string, string]> = [
    [
      intl.formatMessage({ id: 'onboarding.summary.assets.savings' }),
      formatMoney(data.assets.savings),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.assets.investments' }),
      formatMoney(data.assets.investments.totalValue),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.assets.properties' }),
      formatMoney(propertiesTotal),
    ],
    [
      intl.formatMessage({ id: 'onboarding.summary.assets.emergencyCoverage' }),
      emergencyCoverageValue,
    ],
  ];

  const cards: Array<{ title: string; value: string; tone: SummaryCardTone }> = [
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.monthlyIncome' }),
      value: formatMoney(metrics.monthlyIncome),
      tone: 'positive',
    },
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.monthlyExpenses' }),
      value: formatMoney(
        metrics.regularMonthlyExpenses + metrics.irregularMonthlyExpenses
      ),
      tone: 'neutral',
    },
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.monthlySurplus' }),
      value: formatMoney(metrics.surplus),
      tone: metrics.surplus >= 0 ? 'positive' : 'warning',
    },
    {
      title: intl.formatMessage({ id: 'onboarding.summary.cards.netWorth' }),
      value: formatMoney(metrics.netWorth),
      tone: 'positive',
    },
  ];

  const resetLabel = intl.formatMessage({
    id: 'onboarding.summary.actions.reset',
  });
  const backLabel = intl.formatMessage({ id: 'onboarding.navigation.back' });
  const finishLabel = intl.formatMessage({
    id: 'onboarding.summary.actions.finish',
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <SummaryCard
            key={card.title}
            title={card.title}
            value={card.value}
            tone={card.tone}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoPanel
          title={intl.formatMessage({ id: 'onboarding.summary.panels.income' })}
          items={incomeItems}
        />
        <InfoPanel
          title={intl.formatMessage({
            id: 'onboarding.summary.panels.expensesLiabilities',
          })}
          items={expensesItems}
        />
        <InfoPanel
          title={intl.formatMessage({ id: 'onboarding.summary.panels.assets' })}
          items={assetsItems}
        />
        <InfoPanel
          title={intl.formatMessage({ id: 'onboarding.summary.panels.goals' })}
          items={goalsSummary}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onReset}>
          {resetLabel}
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack}>
            {backLabel}
          </Button>
          <Button onClick={onFinish}>{finishLabel}</Button>
        </div>
      </div>
    </div>
  );
}
