import { useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

import { CurrencyInput } from '../CurrencyInput';
import FieldGroup from '../common/FieldGroup';
import FormFooter from '../common/FormFooter';

import type { OnboardingData, PropertyItem } from '../OnboardingWizard';

type RetirementAccountKey = 'ike' | 'ikze' | 'ppk' | 'oipe';

interface AssetsStepProps {
  data: OnboardingData['assets'];
  errors: Record<string, string>;
  ppkEnrolled?: boolean;
  monthlyExpenses: number;
  includePartnerFinances?: boolean;
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
}

export default function AssetsStep({
  data,
  errors,
  ppkEnrolled,
  monthlyExpenses,
  includePartnerFinances,
  onChange,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onNext,
  onBack,
}: AssetsStepProps) {
  const intl = useIntl();

  // One-time: auto-enable PPK if enrolled on step 1
  const ppkPrefilled = useRef(false);
  useEffect(() => {
    if (ppkPrefilled.current) return;
    if (ppkEnrolled && !data.retirementAccounts.ppk.enabled) {
      ppkPrefilled.current = true;
      onChange({
        retirementAccounts: {
          ...data.retirementAccounts,
          ppk: { ...data.retirementAccounts.ppk, enabled: true },
        },
      });
    }
  }, [ppkEnrolled, data.retirementAccounts, onChange]);

  // Reactive: recalculate emergency fund months when savings change
  const computedMonths = useMemo(() => {
    if (monthlyExpenses <= 0) return 0;
    return Math.min(12, Math.round(data.savings / monthlyExpenses));
  }, [data.savings, monthlyExpenses]);

  const prevComputedMonths = useRef(computedMonths);
  useEffect(() => {
    if (computedMonths !== prevComputedMonths.current) {
      prevComputedMonths.current = computedMonths;
      onChange({ emergencyFundMonths: computedMonths });
    }
  }, [computedMonths, onChange]);

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

  const retirementOptions: Array<{ key: RetirementAccountKey; label: string }> = useMemo(
    () => [
      {
        key: 'ppk',
        label: intl.formatMessage({
          id: 'onboarding.assets.retirement.options.ppk',
        }),
      },
      {
        key: 'ike',
        label: intl.formatMessage({
          id: 'onboarding.assets.retirement.options.ike',
        }),
      },
      {
        key: 'ikze',
        label: intl.formatMessage({
          id: 'onboarding.assets.retirement.options.ikze',
        }),
      },
      {
        key: 'oipe',
        label: intl.formatMessage({
          id: 'onboarding.assets.retirement.options.oipe',
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
    { months: computedMonths },
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

  const retirementTitle = intl.formatMessage({
    id: 'onboarding.assets.retirement.title',
  });

  const retirementHint = intl.formatMessage({
    id: 'onboarding.assets.retirement.hint',
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

  const propertiesHint = intl.formatMessage({
    id: 'onboarding.assets.sections.propertiesHint',
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

  const toggleRetirement = (key: RetirementAccountKey, enabled: boolean) => {
    onChange({
      retirementAccounts: {
        ...data.retirementAccounts,
        [key]: { ...data.retirementAccounts[key], enabled },
      },
    });
  };

  const updateRetirementValue = (key: RetirementAccountKey, value: number) => {
    onChange({
      retirementAccounts: {
        ...data.retirementAccounts,
        [key]: { ...data.retirementAccounts[key], value },
      },
    });
  };

  const updateRetirementPartnerValue = (key: RetirementAccountKey, partnerValue: number) => {
    onChange({
      retirementAccounts: {
        ...data.retirementAccounts,
        [key]: { ...data.retirementAccounts[key], partnerValue },
      },
    });
  };

  // Only IKE, IKZE, OIPE can have partner accounts (not PPK — it's employer-tied)
  const partnerRetirementKeys: RetirementAccountKey[] = ['ike', 'ikze', 'oipe'];

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

      {monthlyExpenses > 0 && data.savings > 0 && (
        <div className={`rounded-lg border px-4 py-3 ${
          computedMonths >= 6 ? 'border-emerald-500/30 bg-emerald-500/5' :
          computedMonths >= 3 ? 'border-amber-500/30 bg-amber-500/5' :
          'border-destructive/30 bg-destructive/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">{emergencyFundLabel}</span>
            <span className={`text-sm font-semibold ${
              computedMonths >= 6 ? 'text-emerald-600' :
              computedMonths >= 3 ? 'text-amber-600' :
              'text-destructive'
            }`}>
              {emergencyFundValueLabel}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                computedMonths >= 6 ? 'bg-emerald-500' :
                computedMonths >= 3 ? 'bg-amber-500' :
                'bg-destructive'
              }`}
              style={{ width: `${Math.min(100, (computedMonths / 12) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-muted/60 bg-muted/30 p-4">
        <p className="mb-2 text-sm font-medium text-primary">{investmentsTitle}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {investmentOptions.map((option) => {
            const checked = data.investments.categories.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-muted/60 bg-card px-3 py-2 text-sm"
              >
                <span>{option.label}</span>
                <Switch
                  checked={checked}
                  onCheckedChange={(next) =>
                    toggleInvestment(option.value, Boolean(next))
                  }
                />
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

      <div className="rounded-lg border border-muted/60 bg-muted/30 p-4">
        <p className="mb-1 text-sm font-medium text-primary">{retirementTitle}</p>
        <p className="mb-3 text-xs text-secondary">{retirementHint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {retirementOptions.map((option) => {
            const account = data.retirementAccounts[option.key];
            const showPartner = includePartnerFinances && partnerRetirementKeys.includes(option.key);
            return (
              <div
                key={option.key}
                className="rounded-md border border-muted/60 bg-card px-3 py-2"
              >
                <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{option.label}</span>
                  <Switch
                    checked={account.enabled}
                    onCheckedChange={(next) =>
                      toggleRetirement(option.key, Boolean(next))
                    }
                  />
                </label>
                {account.enabled && (
                  <div className="mt-2 space-y-2">
                    <div>
                      {showPartner && (
                        <p className="mb-1 text-xs text-secondary">
                          {intl.formatMessage({ id: 'onboarding.assets.retirement.yourBalance' })}
                        </p>
                      )}
                      <CurrencyInput
                        value={account.value}
                        onValueChange={(amount) =>
                          updateRetirementValue(option.key, amount)
                        }
                        placeholder="0"
                      />
                    </div>
                    {showPartner && (
                      <div>
                        <p className="mb-1 text-xs text-secondary">
                          {intl.formatMessage({ id: 'onboarding.assets.retirement.partnerBalance' })}
                        </p>
                        <CurrencyInput
                          value={account.partnerValue ?? 0}
                          onValueChange={(amount) =>
                            updateRetirementPartnerValue(option.key, amount)
                          }
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PropertySection
        title={propertiesTitle}
        hint={propertiesHint}
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

      <FormFooter onNext={onNext} onBack={onBack} />
    </div>
  );
}

interface PropertySectionProps {
  title: string;
  hint?: string;
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
  hint,
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
        <div>
          <p className="text-sm font-semibold text-primary">{title}</p>
          {hint && <p className="text-xs text-secondary">{hint}</p>}
        </div>
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
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(event) =>
                    onUpdate(item.id, { name: event.target.value })
                  }
                  placeholder={namePlaceholder}
                  className="flex-1"
                />
                <CurrencyInput
                  value={item.value}
                  onValueChange={(amount) => onUpdate(item.id, { value: amount })}
                  placeholder={valuePlaceholder}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 rounded-full p-1 text-secondary transition-colors hover:text-destructive"
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
              {errors[`assets.items.${index}.value`] && (
                <p className="mt-1 text-xs text-destructive">
                  {errors[`assets.items.${index}.value`]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
