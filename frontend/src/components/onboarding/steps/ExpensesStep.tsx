import { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { CurrencyInput } from '../CurrencyInput';
import FormFooter from '../common/FormFooter';
import { AnimatedAmount } from '../common/AnimatedAmount';

import type {
  ExpenseGroupDefinition,
  ExpenseGroupKey,
  OnboardingExpenseItem,
  OnboardingExpenses,
} from '../OnboardingWizard';

interface ExpensesStepProps {
  data: OnboardingExpenses;
  errors: Record<string, string>;
  onUpdate: (updater: (prev: OnboardingExpenses) => OnboardingExpenses) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  formatMoney: (value: number) => string;
  monthlyIncome: number;
  expenseGroups: ExpenseGroupDefinition[];
  expenseGroupHints: Record<ExpenseGroupKey, string>;
  generateId: (prefix: string) => string;
  getTotalTone: (total: number, monthlyIncome?: number) => 'low' | 'medium' | 'high';
}

export default function ExpensesStep({
  data,
  errors,
  onUpdate,
  onNext,
  onBack,
  onSkip,
  formatMoney,
  monthlyIncome,
  expenseGroups,
  expenseGroupHints,
  generateId,
  getTotalTone,
}: ExpensesStepProps) {
  const intl = useIntl();

  const [expandedGroups, setExpandedGroups] = useState<Record<ExpenseGroupKey, boolean>>(() =>
    expenseGroups.reduce<Record<ExpenseGroupKey, boolean>>((acc, group) => {
      acc[group.key] = true;
      return acc;
    }, {} as Record<ExpenseGroupKey, boolean>)
  );

  const totalsByGroup = useMemo(() => {
    const result: Record<ExpenseGroupKey, number> = {} as Record<ExpenseGroupKey, number>;
    expenseGroups.forEach((group) => {
      result[group.key] = (data[group.key] ?? []).reduce(
        (sum, item) => sum + (item.amount || 0),
        0
      );
    });
    return result;
  }, [data, expenseGroups]);

  const totalExpenses = useMemo(
    () =>
      expenseGroups.reduce(
        (sum, group) => sum + (totalsByGroup[group.key] ?? 0),
        0
      ),
    [expenseGroups, totalsByGroup]
  );

  const toggleGroup = useCallback((groupKey: ExpenseGroupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const customItemDefaultName = intl.formatMessage({
    id: 'onboarding.expenses.customItem.defaultName',
  });

  const handleAmountChange = useCallback(
    (groupKey: ExpenseGroupKey, itemId: string, amount: number) => {
      onUpdate((prev) => ({
        ...prev,
        [groupKey]: (prev[groupKey] ?? []).map((item) =>
          item.id === itemId ? { ...item, amount: Math.max(0, amount) } : item
        ),
      }));
    },
    [onUpdate]
  );

  const handleNameChange = useCallback(
    (groupKey: ExpenseGroupKey, itemId: string, name: string) => {
      onUpdate((prev) => ({
        ...prev,
        [groupKey]: (prev[groupKey] ?? []).map((item) =>
          item.id === itemId ? { ...item, name } : item
        ),
      }));
    },
    [onUpdate]
  );

  const handleAddCustomItem = useCallback(
    (groupKey: ExpenseGroupKey) => {
      const groupDefinition = expenseGroups.find((group) => group.key === groupKey);
      const newItem: OnboardingExpenseItem = {
        id: generateId(`${groupKey}-custom`),
        templateId: undefined,
        name: customItemDefaultName,
        amount: 0,
        category: groupDefinition?.defaultCategory ?? 'other',
        isCustom: true,
      };

      onUpdate((prev) => ({
        ...prev,
        [groupKey]: [...(prev[groupKey] ?? []), newItem],
      }));

      setExpandedGroups((prev) => ({
        ...prev,
        [groupKey]: true,
      }));
    },
    [customItemDefaultName, expenseGroups, generateId, onUpdate]
  );

  const handleRemoveItem = useCallback(
    (groupKey: ExpenseGroupKey, itemId: string) => {
      onUpdate((prev) => ({
        ...prev,
        [groupKey]: (prev[groupKey] ?? []).filter((item) => item.id !== itemId),
      }));
    },
    [onUpdate]
  );

  const totalTone = getTotalTone(totalExpenses, monthlyIncome);
  const introText = intl.formatMessage({
    id: 'onboarding.expenses.intro',
  });

  const addCustomExpenseLabel = intl.formatMessage({
    id: 'onboarding.expenses.customItem.addAction',
  });

  const removeCustomExpenseLabel = intl.formatMessage({
    id: 'onboarding.expenses.customItem.removeAction',
  });

  const customExpenseNamePlaceholder = intl.formatMessage({
    id: 'onboarding.expenses.customItem.namePlaceholder',
  });

  const totalExpensesLabel = intl.formatMessage({
    id: 'onboarding.expenses.summary.totalLabel',
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <div className="rounded-lg border border-muted/50 bg-muted/30 px-4 py-3 text-sm text-secondary">
        {introText}
      </div>

      <div className="space-y-4">
        {expenseGroups.map((group) => {
          const Icon = group.icon;
          const items = data[group.key] ?? [];
          const groupTotal = totalsByGroup[group.key] ?? 0;
          const isExpanded = expandedGroups[group.key];
          const groupHasError = Object.keys(errors).some((key) =>
            key.startsWith(`${group.key}.`)
          );
          const share =
            totalExpenses > 0 ? Math.round((groupTotal / totalExpenses) * 100) : 0;
          const tone = getTotalTone(groupTotal, monthlyIncome);
          const groupTitle = intl.formatMessage({
            id: `onboarding.expenses.groups.${group.key}.title`,
            defaultMessage: group.title,
          });
          const groupDescription = intl.formatMessage({
            id: `onboarding.expenses.groups.${group.key}.description`,
            defaultMessage: group.description,
          });
          const groupHint = intl.formatMessage({
            id: `onboarding.expenses.groups.${group.key}.hint`,
            defaultMessage: expenseGroupHints[group.key],
          });
          const shareLabel = intl.formatMessage(
            { id: 'onboarding.expenses.group.share' },
            { value: share }
          );

          return (
            <div
              key={group.key}
              className={`rounded-xl border border-muted/60 bg-card shadow-sm transition-colors ${
                groupHasError ? 'border-destructive/50' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center gap-4 rounded-t-xl px-4 py-4 text-left hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-primary">{groupTitle}</p>
                  <p className="text-xs text-secondary">{groupDescription}</p>
                  <p className="text-xs text-secondary/80">{groupHint}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <AnimatedAmount
                    value={groupTotal}
                    tone={tone}
                    formatMoney={formatMoney}
                    className="text-base font-semibold"
                  />
                  {totalExpenses > 0 && (
                    <span className="text-xs text-secondary">{shareLabel}</span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-secondary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-secondary" />
                )}
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t border-muted/50 px-4 py-4">
                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const amountError = errors[`${group.key}.${index}.amount`];
                      const nameError = errors[`${group.key}.${index}.name`];
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-muted/50 bg-background px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            {item.isCustom ? (
                              <Input
                                value={item.name}
                                onChange={(event) =>
                                  handleNameChange(group.key, item.id, event.target.value)
                                }
                                placeholder={customExpenseNamePlaceholder}
                                className="h-9"
                              />
                            ) : (
                              <p className="text-sm font-medium text-primary">
                                {intl.formatMessage(
                                  {
                                    id: `onboarding.expenses.groups.${group.key}.items.${
                                      item.templateId ?? item.id
                                    }`,
                                    defaultMessage: item.name,
                                  }
                                )}
                              </p>
                            )}
                            {item.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(group.key, item.id)}
                                className="rounded-full p-1 text-secondary transition-colors hover:text-destructive"
                                aria-label={removeCustomExpenseLabel}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {nameError && (
                            <p className="mt-1 text-xs text-destructive">{nameError}</p>
                          )}
                          <div className="mt-3">
                            <CurrencyInput
                              value={item.amount}
                              onValueChange={(amount) =>
                                handleAmountChange(group.key, item.id, amount)
                              }
                              placeholder={intl.formatMessage(
                                { id: 'onboarding.placeholders.exampleAmount' },
                                { value: '400' }
                              )}
                              className="h-9"
                            />
                            {amountError && (
                              <p className="mt-1 text-xs text-destructive">{amountError}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddCustomItem(group.key)}
                    className="inline-flex items-center gap-2 border-dashed border-muted/60 text-xs"
                  >
                    <Plus className="h-4 w-4" />
                    {addCustomExpenseLabel}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <span>{totalExpensesLabel}</span>
        <AnimatedAmount
          value={totalExpenses}
          tone={totalTone}
          formatMoney={formatMoney}
          className="text-base font-semibold"
        />
      </div>

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </form>
  );
}
