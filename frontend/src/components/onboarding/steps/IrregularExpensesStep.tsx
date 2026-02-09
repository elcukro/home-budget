import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { CurrencyInput } from '../CurrencyInput';
import FormFooter from '../common/FormFooter';
import { AnimatedAmount } from '../common/AnimatedAmount';
import type { IrregularExpenses } from '../OnboardingWizard';

const MONTH_NAMES_SHORT: Record<string, string[]> = {
  pl: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

interface IrregularExpensesStepProps {
  data: IrregularExpenses;
  errors: Record<string, string>;
  onUpdate: (updater: (prev: IrregularExpenses) => IrregularExpenses) => void;
  onNext: () => void;
  onBack: () => void;
  formatMoney: (value: number) => string;
  generateId: (prefix: string) => string;
  nextLabel: string;
}

export default function IrregularExpensesStep({
  data,
  errors,
  onUpdate,
  onNext,
  onBack,
  formatMoney,
  generateId,
  nextLabel,
}: IrregularExpensesStepProps) {
  const intl = useIntl();

  const totalAnnual = useMemo(
    () => data.reduce((sum, item) => sum + (item.amount || 0), 0),
    [data]
  );

  const totalMonthly = totalAnnual / 12;

  const monthLabel = intl.formatMessage({
    id: 'onboarding.irregularExpenses.month.label',
  });
  const monthPlaceholder = intl.formatMessage({
    id: 'onboarding.irregularExpenses.month.placeholder',
  });
  const introText = intl.formatMessage({
    id: 'onboarding.irregularExpenses.intro',
  });
  const annualHint = intl.formatMessage({
    id: 'onboarding.irregularExpenses.annualHint',
  });
  const addCustomLabel = intl.formatMessage({
    id: 'onboarding.irregularExpenses.custom.add',
  });
  const removeCustomLabel = intl.formatMessage({
    id: 'onboarding.irregularExpenses.custom.remove',
  });
  const customNamePlaceholder = intl.formatMessage({
    id: 'onboarding.irregularExpenses.custom.namePlaceholder',
  });
  const totalAnnualLabel = intl.formatMessage({
    id: 'onboarding.irregularExpenses.totalAnnual',
  });
  const totalMonthlyLabel = intl.formatMessage({
    id: 'onboarding.irregularExpenses.totalMonthly',
  });
  const finalNextLabel = nextLabel || intl.formatMessage({ id: 'onboarding.navigation.nextDefault' });

  const monthNames = MONTH_NAMES_SHORT[intl.locale] || MONTH_NAMES_SHORT.en;

  const handleAmountChange = useCallback(
    (id: string, amount: number) => {
      onUpdate((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, amount: Math.max(0, amount) } : item
        )
      );
    },
    [onUpdate]
  );

  const handleMonthChange = useCallback(
    (id: string, month: number) => {
      onUpdate((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, month } : item
        )
      );
    },
    [onUpdate]
  );

  const handleNameChange = useCallback(
    (id: string, name: string) => {
      onUpdate((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, name } : item
        )
      );
    },
    [onUpdate]
  );

  const handleAddCustomItem = useCallback(() => {
    onUpdate((prev) => [
      ...prev,
      {
        id: generateId('irregular-custom'),
        templateId: undefined,
        name: intl.formatMessage({
          id: 'onboarding.irregularExpenses.custom.defaultName',
        }),
        amount: 0,
        category: 'other',
        isCustom: true,
      },
    ]);
  }, [generateId, intl, onUpdate]);

  const handleRemoveItem = useCallback(
    (id: string) => {
      onUpdate((prev) => prev.filter((item) => item.id !== id));
    },
    [onUpdate]
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <div className="rounded-lg border border-muted/50 bg-muted/30 px-4 py-3 text-sm text-secondary">
        <p>{introText}</p>
        <p className="mt-1 text-secondary/80">{annualHint}</p>
      </div>

      <div className="space-y-4">
        {data.map((item, index) => {
          const amountError = errors[`${index}.amount`];
          const nameError = errors[`${index}.name`];
          return (
            <div
              key={item.id}
              className="rounded-xl border border-muted/60 bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 space-y-2">
                  {item.isCustom ? (
                    <Input
                      value={item.name}
                      onChange={(event) => handleNameChange(item.id, event.target.value)}
                      placeholder={customNamePlaceholder}
                      aria-invalid={Boolean(nameError)}
                    />
                  ) : (
                    <p className="text-sm font-semibold text-primary">{item.name}</p>
                  )}
                  {nameError && (
                    <p className="text-xs text-destructive">{nameError}</p>
                  )}
                </div>
                <div className="flex items-end gap-3">
                  <div className="w-40">
                    <CurrencyInput
                      value={item.amount}
                      onValueChange={(value) => handleAmountChange(item.id, value)}
                      placeholder="0"
                      aria-invalid={Boolean(amountError)}
                    />
                    {amountError && (
                      <p className="mt-1 text-xs text-destructive">{amountError}</p>
                    )}
                  </div>
                  {item.amount > 0 && (
                    <select
                      value={item.month || ''}
                      onChange={(event) => handleMonthChange(item.id, Number(event.target.value))}
                      aria-label={monthLabel}
                      className="h-10 w-[5.5rem] rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="" disabled>
                        {monthPlaceholder}
                      </option>
                      {monthNames.map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                  {item.isCustom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={removeCustomLabel}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={handleAddCustomItem}>
          <Plus className="mr-2 h-4 w-4" />
          {addCustomLabel}
        </Button>
        <div className="flex flex-col gap-2 text-right">
          <div className="flex items-center justify-between gap-6 rounded-lg border border-muted/50 bg-muted/20 px-4 py-2 text-sm text-secondary">
            <span>{totalAnnualLabel}</span>
            <AnimatedAmount value={totalAnnual} formatMoney={formatMoney} tone="low" />
          </div>
          <div className="flex items-center justify-between gap-6 rounded-lg border border-muted/50 bg-muted/10 px-4 py-2 text-sm text-secondary">
            <span>{totalMonthlyLabel}</span>
            <AnimatedAmount value={totalMonthly} formatMoney={formatMoney} tone="low" />
          </div>
        </div>
      </div>

      <FormFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel={finalNextLabel}
      />
    </form>
  );
}
