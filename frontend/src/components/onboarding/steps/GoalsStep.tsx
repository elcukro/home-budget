import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useIntl } from 'react-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import type { GoalItem } from '../OnboardingWizard';

interface GoalsStepProps {
  goals: GoalItem[];
  errors: Record<string, string>;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<GoalItem>) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function GoalsStep({
  goals,
  errors,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
  onBack,
}: GoalsStepProps) {
  const intl = useIntl();

  const introText = intl.formatMessage({ id: 'onboarding.goals.intro' });
  const addGoalLabel = intl.formatMessage({ id: 'onboarding.goals.actions.add' });
  const removeGoalLabel = intl.formatMessage({ id: 'onboarding.goals.actions.remove' });
  const nameLabel = intl.formatMessage({ id: 'onboarding.goals.fields.name.label' });
  const namePlaceholder = intl.formatMessage({
    id: 'onboarding.goals.fields.name.placeholder',
  });
  const typeLabel = intl.formatMessage({ id: 'onboarding.goals.fields.type.label' });
  const selectPlaceholder = intl.formatMessage({ id: 'common.select' });
  const targetAmountLabel = intl.formatMessage({
    id: 'onboarding.goals.fields.targetAmount.label',
  });
  const targetAmountPlaceholder = intl.formatMessage(
    { id: 'onboarding.placeholders.exampleAmount' },
    { value: '30 000' },
  );
  const targetDateLabel = intl.formatMessage({
    id: 'onboarding.goals.fields.targetDate.label',
  });
  const priorityLabel = intl.formatMessage({
    id: 'onboarding.goals.fields.priority.label',
  });
  const priorityHint = intl.formatMessage({
    id: 'onboarding.goals.fields.priority.hint',
  });

  const goalTypeOptions = useMemo(
    () => [
      {
        value: 'short',
        label: intl.formatMessage({ id: 'onboarding.goals.fields.type.options.short' }),
      },
      {
        value: 'medium',
        label: intl.formatMessage({ id: 'onboarding.goals.fields.type.options.medium' }),
      },
      {
        value: 'long',
        label: intl.formatMessage({ id: 'onboarding.goals.fields.type.options.long' }),
      },
    ],
    [intl],
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-secondary">{introText}</p>

      {errors['goals'] && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {errors['goals']}
        </div>
      )}

      <div className="space-y-4">
        {goals.map((goal, index) => (
          <div
            key={goal.id}
            className="space-y-3 rounded-lg border border-muted/60 bg-muted/30 p-4"
          >
            <FieldGroup
              label={nameLabel}
              error={
                errors[`goals.${goal.id}.name`] ??
                errors[`goals.${index}.name`] ??
                errors[`${index}.name`] ??
                errors['name']
              }
            >
              <Input
                value={goal.name}
                onChange={(event) => onUpdate(goal.id, { name: event.target.value })}
                placeholder={namePlaceholder}
              />
            </FieldGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup
                label={typeLabel}
                error={
                  errors[`goals.${goal.id}.type`] ??
                  errors[`goals.${index}.type`] ??
                  errors[`${index}.type`] ??
                  errors['type']
                }
              >
                <Select
                  value={goal.type}
                  onValueChange={(value) =>
                    onUpdate(goal.id, {
                      type: value as GoalItem['type'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {goalTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup
                label={targetAmountLabel}
                error={
                  errors[`goals.${goal.id}.targetAmount`] ??
                  errors[`goals.${index}.targetAmount`] ??
                  errors[`${index}.targetAmount`] ??
                  errors['targetAmount']
                }
              >
                <CurrencyInput
                  value={goal.targetAmount}
                  onValueChange={(amount) =>
                    onUpdate(goal.id, {
                      targetAmount: amount,
                    })
                  }
                  placeholder={targetAmountPlaceholder}
                />
              </FieldGroup>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup
                label={targetDateLabel}
                error={
                  errors[`goals.${goal.id}.targetDate`] ??
                  errors[`goals.${index}.targetDate`] ??
                  errors[`${index}.targetDate`] ??
                  errors['targetDate']
                }
              >
                <Input
                  type="date"
                  value={goal.targetDate ?? ''}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) =>
                    onUpdate(goal.id, { targetDate: event.target.value })
                  }
                />
              </FieldGroup>
              <FieldGroup
                label={priorityLabel}
                hint={priorityHint}
                error={
                  errors[`goals.${goal.id}.priority`] ??
                  errors[`goals.${index}.priority`] ??
                  errors[`${index}.priority`] ??
                  errors['priority']
                }
              >
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onUpdate(goal.id, { priority: level })}
                      className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                        goal.priority === level
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted/60 bg-card text-secondary hover:bg-muted/40'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </FieldGroup>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => onRemove(goal.id)}
              aria-label={removeGoalLabel}
            >
              <Trash2 className="h-4 w-4" />
              {removeGoalLabel}
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="inline-flex items-center gap-2"
        aria-label={addGoalLabel}
      >
        <Plus className="h-4 w-4" />
        {addGoalLabel}
      </Button>

      <FormFooter
        onNext={onNext}
        onBack={onBack}
        isLast
      />
    </div>
  );
}
