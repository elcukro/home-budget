import { useCallback, useMemo } from 'react';
import { Info, TrendingUp } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { CurrencyInput } from '../CurrencyInput';
import FieldGroup from '../common/FieldGroup';
import FormFooter from '../common/FormFooter';
import TooltipTrigger from '../common/TooltipTrigger';
import { AnimatedAmount } from '../common/AnimatedAmount';
import SalaryDistributionChart from '../charts/SalaryDistributionChart';

import type { AdditionalSource, OnboardingData } from '../OnboardingWizard';

interface IncomeStepProps {
  data: OnboardingData['income'];
  errors: Record<string, string>;
  onChange: (
    updates: Partial<OnboardingData['income']>,
    nested?: keyof OnboardingData['income']['additionalSources'],
    nestedUpdates?: Partial<AdditionalSource>
  ) => void;
  onNext: () => void;
  onBack: () => void;
  monthlyIncome: number;
  formatMoney: (value: number) => string;
  childrenCount: number;
  includePartnerFinances: boolean;
  nextLabel?: string;
}

const TOOLTIP_IDS: Partial<
  Record<keyof OnboardingData['income']['additionalSources'], string>
> = {
  rental: 'onboarding.income.additionalSources.tooltips.rental',
  bonuses: 'onboarding.income.additionalSources.tooltips.bonuses',
  freelance: 'onboarding.income.additionalSources.tooltips.freelance',
  benefits: 'onboarding.income.additionalSources.tooltips.benefits',
  childBenefit: 'onboarding.income.additionalSources.tooltips.childBenefit',
};

export default function IncomeStep({
  data,
  errors,
  onChange,
  onNext,
  onBack,
  monthlyIncome,
  formatMoney,
  childrenCount,
  includePartnerFinances,
  nextLabel,
}: IncomeStepProps) {
  const intl = useIntl();
  const irregularMonthly = data.irregularIncomeAnnual / 12;

  const additionalEntries = useMemo(
    () => {
      const entries: Array<
        [keyof OnboardingData['income']['additionalSources'], string]
      > = [
        ['rental', intl.formatMessage({ id: 'onboarding.income.additionalSources.rental' })],
        ['bonuses', intl.formatMessage({ id: 'onboarding.income.additionalSources.bonuses' })],
        ['freelance', intl.formatMessage({ id: 'onboarding.income.additionalSources.freelance' })],
      ];

      if (childrenCount > 0) {
        entries.push([
          'childBenefit',
          intl.formatMessage(
            { id: 'onboarding.income.additionalSources.childBenefit' },
            { limit: formatMoney(childrenCount * 800) },
          ),
        ]);
      }

      entries.push([
        'benefits',
        intl.formatMessage({ id: 'onboarding.income.additionalSources.benefits' }),
      ]);

      return entries;
    },
    [childrenCount, formatMoney, intl]
  );

  const activeAdditionalSources = useMemo(
    () =>
      additionalEntries
        .map(([key, label]) => ({ key, label, source: data.additionalSources[key] }))
        .filter(({ source }) => source.enabled),
    [additionalEntries, data.additionalSources]
  );

  const additionalTotal = useMemo(
    () => activeAdditionalSources.reduce((sum, entry) => sum + entry.source.amount, 0),
    [activeAdditionalSources]
  );

  const toggleSource = useCallback(
    (
      key: keyof OnboardingData['income']['additionalSources'],
      enabled: boolean
    ) => {
      const source = data.additionalSources[key];
      if (key === 'childBenefit') {
        const maxBenefit = Math.max(0, childrenCount * 800);
        const nextAmount =
          enabled && !source.enabled
            ? maxBenefit
            : enabled
            ? Math.min(Math.max(0, source.amount || maxBenefit), maxBenefit)
            : 0;

        onChange(
          {},
          key,
          {
            enabled: enabled && childrenCount > 0,
            amount: enabled ? nextAmount : 0,
          }
        );
        return;
      }

      onChange(
        {},
        key,
        {
          enabled,
          amount: enabled ? source.amount || 0 : 0,
        }
      );
    },
    [childrenCount, data.additionalSources, onChange]
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-primary">
          {intl.formatMessage({ id: 'onboarding.income.intro' })}
        </p>
        <p className="mt-1 text-xs text-secondary">
          {intl.formatMessage({ id: 'onboarding.income.subIntro' })}
        </p>
      </div>

      <FieldGroup
        label={
          <>
            {intl.formatMessage({ id: includePartnerFinances ? 'onboarding.income.fields.salaryNet.yourLabel' : 'onboarding.income.fields.salaryNet.label' })}{' '}
            <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.income.fields.salaryNet.tooltip' })}>
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        error={errors['salaryNet']}
        required
      >
        <CurrencyInput
          value={data.salaryNet}
          onValueChange={(amount) => onChange({ salaryNet: amount })}
          placeholder={intl.formatMessage(
            { id: 'onboarding.placeholders.exampleAmount' },
            { value: '7 500' },
          )}
        />
      </FieldGroup>

      {includePartnerFinances && (
        <>
          <FieldGroup
            label={
              <>
                {intl.formatMessage({ id: 'onboarding.income.fields.partnerSalaryNet.label' })}{' '}
                <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.income.fields.partnerSalaryNet.tooltip' })}>
                  <Info className="h-4 w-4 text-primary" />
                </TooltipTrigger>
              </>
            }
            error={errors['partnerSalaryNet']}
          >
            <CurrencyInput
              value={data.partnerSalaryNet}
              onValueChange={(amount) => onChange({ partnerSalaryNet: amount })}
              placeholder={intl.formatMessage(
                { id: 'onboarding.placeholders.exampleAmount' },
                { value: '5 000' },
              )}
            />
          </FieldGroup>

          <FieldGroup
            label={intl.formatMessage({ id: 'onboarding.income.fields.partnerEmploymentType' })}
            error={errors['partnerEmploymentType']}
          >
            <Select
              value={data.partnerEmploymentType || ''}
              onValueChange={(value) => onChange({ partnerEmploymentType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={intl.formatMessage({ id: 'settings.taxProfile.selectEmployment' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">{intl.formatMessage({ id: 'settings.taxProfile.employmentStatuses.employee' })}</SelectItem>
                <SelectItem value="b2b">{intl.formatMessage({ id: 'settings.taxProfile.employmentStatuses.b2b' })}</SelectItem>
                <SelectItem value="contract">{intl.formatMessage({ id: 'settings.taxProfile.employmentStatuses.contract' })}</SelectItem>
                <SelectItem value="freelancer">{intl.formatMessage({ id: 'settings.taxProfile.employmentStatuses.freelancer' })}</SelectItem>
                <SelectItem value="business">{intl.formatMessage({ id: 'settings.taxProfile.employmentStatuses.business' })}</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
        </>
      )}

      <div className="rounded-lg border border-muted/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              {intl.formatMessage({ id: 'onboarding.income.additionalSources.title' })}
            </p>
            <p className="text-xs text-secondary">
              {intl.formatMessage({ id: 'onboarding.income.additionalSources.subtitle' })}
            </p>
          </div>
          {childrenCount > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {intl.formatMessage(
                { id: 'onboarding.income.additionalSources.childBadge' },
                {
                  count: childrenCount,
                  limit: formatMoney(childrenCount * 800),
                },
              )}
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {additionalEntries.map(([key, label]) => {
            const source = data.additionalSources[key];
            const isChildBenefit = key === 'childBenefit';
            const maxBenefit = Math.max(0, childrenCount * 800);
            if (isChildBenefit && childrenCount === 0) {
              return null;
            }
            const tooltipId = TOOLTIP_IDS[key];

            return (
              <div
                key={key}
                className={`flex flex-col gap-2 rounded-md border p-3 transition-colors ${
                  source.enabled
                    ? 'border-success/40 bg-success/10 shadow-sm'
                    : 'border-muted/60 bg-muted/40'
                }`}
              >
                <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium text-primary">
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      {label}
                      {tooltipId && (
                        <TooltipTrigger
                          text={intl.formatMessage({ id: tooltipId })}
                        >
                          <Info className="h-4 w-4 text-primary" />
                        </TooltipTrigger>
                      )}
                    </span>
                    {isChildBenefit && (
                      <span className="text-xs text-secondary">
                        {intl.formatMessage(
                          { id: 'onboarding.income.additionalSources.childBenefitLimit' },
                          { limit: formatMoney(maxBenefit) },
                        )}
                      </span>
                    )}
                  </span>
                  <Switch
                    checked={source.enabled && (!isChildBenefit || childrenCount > 0)}
                    onCheckedChange={(checked) => toggleSource(key, Boolean(checked))}
                    disabled={isChildBenefit && childrenCount === 0}
                  />
                </label>
                {source.enabled && (
                  <CurrencyInput
                    value={source.amount}
                    onValueChange={(amount) =>
                      onChange({}, key, {
                        enabled: true,
                        amount: isChildBenefit
                          ? Math.min(Math.max(0, amount), maxBenefit)
                          : amount,
                      })
                    }
                    placeholder={
                      isChildBenefit
                        ? formatMoney(maxBenefit)
                        : intl.formatMessage(
                            { id: 'onboarding.placeholders.exampleAmount' },
                            { value: '1 200' },
                          )
                    }
                    className="h-9"
                  />
                )}
              </div>
            );
          })}
        </div>

        {activeAdditionalSources.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            <span className="font-medium">
              {intl.formatMessage({ id: 'onboarding.income.additionalSources.activeTitle' })}
            </span>
            {activeAdditionalSources.map(({ key, label }) => (
              <span
                key={key}
                className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                {label}
              </span>
            ))}
            <span className="ml-auto font-medium">
              {intl.formatMessage(
                { id: 'onboarding.income.additionalSources.total' },
                { amount: formatMoney(additionalTotal) },
              )}
            </span>
          </div>
        )}
      </div>

      <FieldGroup
        label={
          <>
            {intl.formatMessage({ id: 'onboarding.income.fields.irregularIncome.label' })}{' '}
            <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.income.fields.irregularIncome.tooltip' })}>
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        error={errors['irregularIncomeAnnual']}
        hint={intl.formatMessage({ id: 'onboarding.income.fields.irregularIncome.hint' })}
      >
        <div className="space-y-2">
          <CurrencyInput
            value={data.irregularIncomeAnnual}
            onValueChange={(amount) => onChange({ irregularIncomeAnnual: amount })}
            placeholder={intl.formatMessage(
              { id: 'onboarding.placeholders.exampleAmount' },
              { value: '6 000' },
            )}
          />
          {irregularMonthly > 0 && (
            <p className="text-xs text-secondary">
              {intl.formatMessage(
                { id: 'onboarding.income.fields.irregularIncome.monthlyEquivalent' },
                { amount: formatMoney(Math.round(irregularMonthly)) },
              )}
            </p>
          )}
        </div>
      </FieldGroup>

      <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            <p className="text-sm font-medium">
              {intl.formatMessage({ id: 'onboarding.income.summary.totalMonthlyIncome' })}
            </p>
          </div>
          <AnimatedAmount
            value={Math.round(monthlyIncome)}
            formatMoney={formatMoney}
            className="text-xl font-semibold"
          />
        </div>
        <p className="text-xs text-secondary">
          {intl.formatMessage(
            { id: 'onboarding.income.summary.description' },
            { amount: formatMoney(Math.round(monthlyIncome)) },
          )}
        </p>
      </div>

      <SalaryDistributionChart salary={data.salaryNet} formatMoney={formatMoney} />

      <FormFooter
        onNext={onNext}
        onBack={onBack}
        nextLabel={nextLabel}
      />
    </form>
  );
}
