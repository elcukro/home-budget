import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

import { CurrencyInput } from '../CurrencyInput';
import FieldGroup from '../common/FieldGroup';
import FormFooter from '../common/FormFooter';

import type { OnboardingData, PropertyItem } from '../OnboardingWizard';

interface AssetsStepProps {
  data: OnboardingData['assets'];
  errors: Record<string, string>;
  onChange: (updates: Partial<OnboardingData['assets']>) => void;
  onAddProperty: (collection: 'properties' | 'vehicles') => void;
  onUpdateProperty: (
    collection: 'properties' | 'vehicles',
    id: string,
    updates: Partial<PropertyItem>
  ) => void;
  onRemoveProperty: (collection: 'properties' | 'vehicles', id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function AssetsStep({
  data,
  errors,
  onChange,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onNext,
  onBack,
  onSkip,
}: AssetsStepProps) {
  const intl = useIntl();

  const investmentOptions = useMemo(
    () => [
      {
        value: 'stocks',
        label: intl.formatMessage({
          id: 'onboarding.assets.investments.options.stocks',
        }),
      },
      {
        value: 'etf',
        label: intl.formatMessage({
          id: 'onboarding.assets.investments.options.etf',
        }),
      },
      {
        value: 'funds',
        label: intl.formatMessage({
          id: 'onboarding.assets.investments.options.funds',
        }),
      },
      {
        value: 'bonds',
        label: intl.formatMessage({
          id: 'onboarding.assets.investments.options.bonds',
        }),
      },
      {
        value: 'crypto',
        label: intl.formatMessage({
          id: 'onboarding.assets.investments.options.crypto',
        }),
      },
    ],
    [intl],
  );

  const savingsPlaceholder = intl.formatMessage(
    { id: 'onboarding.placeholders.exampleAmount' },
    { value: '20 000' },
  );

  const emergencyFundLabel = intl.formatMessage({
    id: 'onboarding.assets.fields.emergencyFund.label',
  });

  const emergencyFundValueLabel = intl.formatMessage(
    { id: 'onboarding.assets.fields.emergencyFund.monthsLabel' },
    { months: data.emergencyFundMonths },
  );

  const investmentsTitle = intl.formatMessage({
    id: 'onboarding.assets.investments.title',
  });

  const totalInvestmentsLabel = intl.formatMessage({
    id: 'onboarding.assets.investments.totalLabel',
  });

  const totalInvestmentsPlaceholder = intl.formatMessage({
    id: 'onboarding.assets.investments.totalPlaceholder',
  });

  const propertiesTitle = intl.formatMessage({
    id: 'onboarding.assets.sections.properties',
  });

  const vehiclesTitle = intl.formatMessage({
    id: 'onboarding.assets.sections.vehicles',
  });

  const addItemLabel = intl.formatMessage({
    id: 'onboarding.assets.actions.addItem',
  });

  const removeItemLabel = intl.formatMessage({
    id: 'onboarding.assets.actions.removeItem',
  });

  const emptySectionLabel = intl.formatMessage({
    id: 'onboarding.assets.sections.empty',
  });

  const itemNamePlaceholder = intl.formatMessage({
    id: 'onboarding.assets.sections.namePlaceholder',
  });

  const itemValuePlaceholder = intl.formatMessage({
    id: 'onboarding.assets.sections.valuePlaceholder',
  });

  const toggleInvestment = (value: string, checked: boolean) => {
    onChange({
      investments: {
        ...data.investments,
        categories: checked
          ? Array.from(new Set([...data.investments.categories, value]))
          : data.investments.categories.filter((item) => item !== value),
      },
    });
  };

  return (
    <div className="space-y-5">
      <FieldGroup
        label={intl.formatMessage({ id: 'onboarding.assets.fields.cash.label' })}
        error={errors['savings']}
      >
        <CurrencyInput
          value={data.savings}
          onValueChange={(amount) => onChange({ savings: amount })}
          placeholder={savingsPlaceholder}
        />
      </FieldGroup>

      <FieldGroup
        label={emergencyFundLabel}
        error={errors['emergencyFundMonths']}
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={12}
            value={data.emergencyFundMonths}
            onChange={(event) =>
              onChange({
                emergencyFundMonths: Number(event.target.value) || 0,
              })
            }
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <span className="w-14 text-right text-sm font-medium text-primary">
            {emergencyFundValueLabel}
          </span>
        </div>
      </FieldGroup>

      <div className="rounded-lg border border-muted/60 bg-muted/30 p-4">
        <p className="mb-2 text-sm font-medium text-primary">{investmentsTitle}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {investmentOptions.map((option) => {
            const checkboxId = `investment-${option.value}`;
            const checked = data.investments.categories.includes(option.value);
            return (
              <label
                key={option.value}
                htmlFor={checkboxId}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-muted/60 bg-card px-3 py-2 text-sm"
              >
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={(next) =>
                    toggleInvestment(option.value, Boolean(next))
                  }
                />
                {option.label}
              </label>
            );
          })}
        </div>
        <div className="mt-3">
          <FieldGroup
            label={totalInvestmentsLabel}
            error={errors['investments.totalValue']}
          >
            <CurrencyInput
              value={data.investments.totalValue}
              onValueChange={(amount) =>
                onChange({
                  investments: {
                    ...data.investments,
                    totalValue: amount,
                  },
                })
              }
              placeholder={totalInvestmentsPlaceholder}
            />
          </FieldGroup>
        </div>
      </div>

      <PropertySection
        title={propertiesTitle}
        items={data.properties}
        onAdd={() => onAddProperty('properties')}
        onUpdate={(id, updates) => onUpdateProperty('properties', id, updates)}
        onRemove={(id) => onRemoveProperty('properties', id)}
        errors={errors}
        addItemLabel={addItemLabel}
        removeItemLabel={removeItemLabel}
        emptyLabel={emptySectionLabel}
        namePlaceholder={itemNamePlaceholder}
        valuePlaceholder={itemValuePlaceholder}
      />

      <PropertySection
        title={vehiclesTitle}
        items={data.vehicles}
        onAdd={() => onAddProperty('vehicles')}
        onUpdate={(id, updates) => onUpdateProperty('vehicles', id, updates)}
        onRemove={(id) => onRemoveProperty('vehicles', id)}
        errors={errors}
        addItemLabel={addItemLabel}
        removeItemLabel={removeItemLabel}
        emptyLabel={emptySectionLabel}
        namePlaceholder={itemNamePlaceholder}
        valuePlaceholder={itemValuePlaceholder}
      />

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </div>
  );
}

interface PropertySectionProps {
  title: string;
  items: PropertyItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<PropertyItem>) => void;
  onRemove: (id: string) => void;
  errors: Record<string, string>;
  addItemLabel: string;
  removeItemLabel: string;
  emptyLabel: string;
  namePlaceholder: string;
  valuePlaceholder: string;
}

function PropertySection({
  title,
  items,
  onAdd,
  onUpdate,
  onRemove,
  errors,
  addItemLabel,
  removeItemLabel,
  emptyLabel,
  namePlaceholder,
  valuePlaceholder,
}: PropertySectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="inline-flex items-center gap-2 border-dashed border-muted/60 text-xs"
        >
          <Plus className="h-4 w-4" />
          {addItemLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-secondary">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-muted/50 bg-card px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={item.name}
                  onChange={(event) =>
                    onUpdate(item.id, { name: event.target.value })
                  }
                  placeholder={namePlaceholder}
                />
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-full p-1 text-secondary transition-colors hover:text-destructive"
                  aria-label={removeItemLabel}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {errors[`assets.items.${index}.name`] && (
                <p className="mt-1 text-xs text-destructive">
                  {errors[`assets.items.${index}.name`]}
                </p>
              )}
              <div className="mt-3">
                <CurrencyInput
                  value={item.value}
                  onValueChange={(amount) => onUpdate(item.id, { value: amount })}
                  placeholder={valuePlaceholder}
                />
                {errors[`assets.items.${index}.value`] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors[`assets.items.${index}.value`]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
