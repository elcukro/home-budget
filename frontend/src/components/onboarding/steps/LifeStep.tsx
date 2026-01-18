import { useMemo, useCallback } from 'react';
import { Info } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../CurrencyInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import FieldGroup from '../common/FieldGroup';
import FormFooter from '../common/FormFooter';
import TooltipTrigger from '../common/TooltipTrigger';
import HouseholdCostEstimator from '../HouseholdCostEstimator';

import type { OnboardingData } from '../OnboardingWizard';

interface LifeStepProps {
  data: OnboardingData['life'];
  errors: Record<string, string>;
  onChange: (updates: Partial<OnboardingData['life']>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  nextLabel?: string;
}

export default function LifeStep({
  data,
  errors,
  onChange,
  onNext,
  onBack,
  onSkip,
  nextLabel,
}: LifeStepProps) {
  const intl = useIntl();

  const shouldAskPartnerBudget = useMemo(
    () => data.maritalStatus === 'relationship' || data.maritalStatus === 'married',
    [data.maritalStatus]
  );

  const handleEstimateApply = useCallback(
    (estimate: number) => {
      onChange({ householdCost: estimate });
    },
    [onChange]
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
          {intl.formatMessage({ id: 'onboarding.life.intro' })}
        </p>
        <p className="mt-1 text-xs text-secondary">
          {intl.formatMessage({ id: 'onboarding.life.subIntro' })}
        </p>
      </div>

      <FieldGroup
        label={
          <>
            {intl.formatMessage({ id: 'onboarding.life.fields.maritalStatus.label' })}{' '}
            <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.life.fields.maritalStatus.tooltip' })}>
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        error={errors['maritalStatus']}
        required
      >
        <Select
          value={data.maritalStatus}
          onValueChange={(value) =>
            onChange({
              maritalStatus: value as OnboardingData['life']['maritalStatus'],
              includePartnerFinances: value === 'married' ? data.includePartnerFinances : false,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={intl.formatMessage({ id: 'common.select' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">
              {intl.formatMessage({ id: 'onboarding.life.fields.maritalStatus.options.single' })}
            </SelectItem>
            <SelectItem value="relationship">
              {intl.formatMessage({ id: 'onboarding.life.fields.maritalStatus.options.relationship' })}
            </SelectItem>
            <SelectItem value="married">
              {intl.formatMessage({ id: 'onboarding.life.fields.maritalStatus.options.married' })}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      {shouldAskPartnerBudget && (
        <div className="flex items-center justify-between rounded-lg border border-muted/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">
              {intl.formatMessage({ id: 'onboarding.life.fields.partnerBudget.label' })}
            </p>
            <p className="text-xs text-secondary">
              {intl.formatMessage({ id: 'onboarding.life.fields.partnerBudget.hint' })}
            </p>
          </div>
          <Switch
            checked={data.includePartnerFinances}
            onCheckedChange={(checked) => onChange({ includePartnerFinances: checked })}
          />
        </div>
      )}

      <FieldGroup
        label={
          <>
            {intl.formatMessage({ id: 'onboarding.life.fields.childrenCount.label' })}{' '}
            <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.life.fields.childrenCount.tooltip' })}>
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        error={errors['childrenCount']}
      >
        <Input
          type="number"
          min={0}
          max={10}
          value={data.childrenCount}
          onChange={(event) =>
            onChange({ childrenCount: Number(event.target.value) || 0 })
          }
          placeholder={intl.formatMessage(
            { id: 'onboarding.placeholders.exampleNumber' },
            { value: 2 },
          )}
        />
      </FieldGroup>

      {data.childrenCount > 0 && (
        <FieldGroup
          label={intl.formatMessage({ id: 'onboarding.life.fields.childrenAgeRange.label' })}
          error={errors['childrenAgeRange']}
          hint={intl.formatMessage({ id: 'onboarding.life.fields.childrenAgeRange.hint' })}
        >
          <Select
            value={data.childrenAgeRange ?? ''}
            onValueChange={(value) =>
              onChange({
                childrenAgeRange: value as OnboardingData['life']['childrenAgeRange'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={intl.formatMessage({
                  id: 'onboarding.life.fields.childrenAgeRange.placeholder',
                })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0-6">
                {intl.formatMessage({ id: 'onboarding.life.fields.childrenAgeRange.options.0_6' })}
              </SelectItem>
              <SelectItem value="7-12">
                {intl.formatMessage({ id: 'onboarding.life.fields.childrenAgeRange.options.7_12' })}
              </SelectItem>
              <SelectItem value="13+">
                {intl.formatMessage({ id: 'onboarding.life.fields.childrenAgeRange.options.13_plus' })}
              </SelectItem>
              <SelectItem value="mixed">
                {intl.formatMessage({ id: 'onboarding.life.fields.childrenAgeRange.options.mixed' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      )}

      <FieldGroup
        label={
          <>
            {intl.formatMessage({ id: 'onboarding.life.fields.birthYear.label' })}{' '}
            <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.life.fields.birthYear.tooltip' })}>
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        error={errors['birthYear']}
        hint={intl.formatMessage({ id: 'onboarding.life.fields.birthYear.hint' })}
      >
        <Input
          type="number"
          min={1920}
          max={new Date().getFullYear()}
          value={data.birthYear ?? ''}
          onChange={(event) =>
            onChange({ birthYear: event.target.value ? Number(event.target.value) : undefined })
          }
          placeholder={intl.formatMessage(
            { id: 'onboarding.placeholders.exampleNumber' },
            { value: 1995 },
          )}
        />
      </FieldGroup>

      <FieldGroup
        label={
          <>
            {intl.formatMessage({ id: 'onboarding.life.fields.housingType.label' })}{' '}
            <TooltipTrigger text={intl.formatMessage({ id: 'onboarding.life.fields.housingType.tooltip' })}>
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        hint={intl.formatMessage({ id: 'onboarding.life.fields.housingType.hint' })}
        error={errors['housingType']}
        required
      >
        <Select
          value={data.housingType}
          onValueChange={(value) =>
            onChange({
              housingType: value as OnboardingData['life']['housingType'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={intl.formatMessage({ id: 'common.select' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rent">
              {intl.formatMessage({ id: 'onboarding.life.fields.housingType.options.rent' })}
            </SelectItem>
            <SelectItem value="mortgage">
              {intl.formatMessage({ id: 'onboarding.life.fields.housingType.options.mortgage' })}
            </SelectItem>
            <SelectItem value="owned">
              {intl.formatMessage({ id: 'onboarding.life.fields.housingType.options.owned' })}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      {data.housingType === 'mortgage' && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">
              {intl.formatMessage({ id: 'onboarding.life.fields.hasMortgage.label' })}
            </p>
            <p className="text-xs text-secondary">
              {intl.formatMessage({ id: 'onboarding.life.fields.hasMortgage.hint' })}
            </p>
          </div>
          <Switch
            checked={data.hasMortgage ?? false}
            onCheckedChange={(checked) => onChange({ hasMortgage: checked })}
          />
        </div>
      )}

      <FieldGroup
        label={intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.label' })}
        error={errors['employmentStatus']}
        required
      >
        <Select
          value={data.employmentStatus}
          onValueChange={(value) =>
            onChange({
              employmentStatus: value as OnboardingData['life']['employmentStatus'],
              // Reset PPK when switching away from employee
              ppkEnrolled: value === 'employee' ? data.ppkEnrolled : undefined,
              // Reset tax form when not business
              taxForm: (value === 'business' || value === 'b2b') ? data.taxForm : '',
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={intl.formatMessage({ id: 'common.select' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">
              {intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.options.employee' })}
            </SelectItem>
            <SelectItem value="b2b">
              {intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.options.b2b' })}
            </SelectItem>
            <SelectItem value="business">
              {intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.options.business' })}
            </SelectItem>
            <SelectItem value="contract">
              {intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.options.contract' })}
            </SelectItem>
            <SelectItem value="freelancer">
              {intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.options.freelancer' })}
            </SelectItem>
            <SelectItem value="unemployed">
              {intl.formatMessage({ id: 'onboarding.life.fields.employmentStatus.options.unemployed' })}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      {/* PPK for employees */}
      {data.employmentStatus === 'employee' && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">
              {intl.formatMessage({ id: 'onboarding.life.fields.ppkEnrolled.label' })}
            </p>
            <p className="text-xs text-secondary">
              {intl.formatMessage({ id: 'onboarding.life.fields.ppkEnrolled.hint' })}
            </p>
          </div>
          <Switch
            checked={data.ppkEnrolled ?? false}
            onCheckedChange={(checked) => onChange({ ppkEnrolled: checked })}
          />
        </div>
      )}

      {/* KUP 50% for employees/contractors/freelancers with creative work */}
      {(data.employmentStatus === 'employee' || data.employmentStatus === 'contract' || data.employmentStatus === 'freelancer') && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">
              {intl.formatMessage({ id: 'onboarding.life.fields.useAuthorsCosts.label' })}
            </p>
            <p className="text-xs text-secondary">
              {intl.formatMessage({ id: 'onboarding.life.fields.useAuthorsCosts.hint' })}
            </p>
          </div>
          <Switch
            checked={data.useAuthorsCosts ?? false}
            onCheckedChange={(checked) => onChange({ useAuthorsCosts: checked })}
          />
        </div>
      )}

      {(data.employmentStatus === 'business' || data.employmentStatus === 'b2b') && (
        <FieldGroup
          label={intl.formatMessage({ id: 'onboarding.life.fields.taxForm.label' })}
          error={errors['taxForm']}
          required
        >
          <Select
            value={data.taxForm}
            onValueChange={(value) =>
              onChange({
                taxForm: value as OnboardingData['life']['taxForm'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={intl.formatMessage({ id: 'onboarding.life.fields.taxForm.placeholder' })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scale">
                {intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.scale' })}
              </SelectItem>
              <SelectItem value="linear">
                {intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.linear' })}
              </SelectItem>
              <SelectItem value="lumpsum">
                {intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.lumpsum' })}
              </SelectItem>
              <SelectItem value="card">
                {intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.card' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      )}

      <FieldGroup
        label={intl.formatMessage({ id: 'onboarding.life.fields.householdCost.label' })}
        error={errors['householdCost']}
        required
        hint={intl.formatMessage({ id: 'onboarding.life.fields.householdCost.hint' })}
        className="pt-2"
      >
        <CurrencyInput
          value={data.householdCost}
          onValueChange={(amount) => onChange({ householdCost: amount })}
          placeholder={intl.formatMessage(
            { id: 'onboarding.placeholders.exampleAmount' },
            { value: '4 800' },
          )}
        />
        <HouseholdCostEstimator
          currentHousingType={data.housingType}
          currentChildrenCount={data.childrenCount}
          currentIncludePartner={data.includePartnerFinances}
          onEstimateApply={handleEstimateApply}
        />
      </FieldGroup>

      <FormFooter
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        nextLabel={nextLabel}
      />
    </form>
  );
}
