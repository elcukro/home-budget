import { useMemo } from 'react';
import {
  Car,
  Home,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
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

import type { LiabilityItem } from '../OnboardingWizard';

interface LiabilitiesStepProps {
  items: LiabilityItem[];
  errors: Record<string, string>;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<LiabilityItem>) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  monthlyIncome: number;
  formatMoney: (value: number) => string;
}

export default function LiabilitiesStep({
  items,
  errors,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
  onBack,
  monthlyIncome,
  formatMoney,
}: LiabilitiesStepProps) {
  const intl = useIntl();

  const introTitle = intl.formatMessage({
    id: 'onboarding.liabilities.intro.title',
  });
  const introDescription = intl.formatMessage({
    id: 'onboarding.liabilities.intro.description',
  });
  const addLiabilityLabel = intl.formatMessage({
    id: 'onboarding.liabilities.actions.add',
  });
  const removeLiabilityLabel = intl.formatMessage({
    id: 'onboarding.liabilities.actions.remove',
  });
  const totalMonthlyLabel = intl.formatMessage({
    id: 'onboarding.liabilities.summary.monthly',
  });
  const totalRemainingLabel = intl.formatMessage({
    id: 'onboarding.liabilities.summary.remaining',
  });
  const typeLabel = intl.formatMessage({
    id: 'onboarding.liabilities.fields.type.label',
  });
  const selectPlaceholder = intl.formatMessage({ id: 'common.select' });
  const monthlyPaymentLabel = intl.formatMessage({
    id: 'onboarding.liabilities.fields.monthlyPayment.label',
  });
  const monthlyPaymentPlaceholder = intl.formatMessage(
    { id: 'onboarding.placeholders.exampleAmount' },
    { value: '1 250' },
  );
  const remainingAmountLabelDefault = intl.formatMessage({
    id: 'onboarding.liabilities.fields.remainingAmount.label',
  });
  const remainingAmountLabelBuyout = intl.formatMessage({
    id: 'onboarding.liabilities.fields.remainingAmount.buyoutLabel',
  });
  const remainingAmountPlaceholder = intl.formatMessage(
    { id: 'onboarding.placeholders.exampleAmount' },
    { value: '180 000' },
  );
  const interestRateLabel = intl.formatMessage({
    id: 'onboarding.liabilities.fields.interestRate.label',
  });
  const interestRatePlaceholder = intl.formatMessage(
    { id: 'onboarding.placeholders.exampleNumber' },
    { value: '6.2' },
  );
  const repaymentTypeLabel = intl.formatMessage({
    id: 'onboarding.liabilities.fields.repaymentType.label',
  });
  const repaymentTypeHint = intl.formatMessage({
    id: 'onboarding.liabilities.fields.repaymentType.hint',
  });
  const propertyValueLabel = intl.formatMessage({
    id: 'onboarding.liabilities.fields.propertyValue.label',
  });
  const propertyValueHint = intl.formatMessage({
    id: 'onboarding.liabilities.fields.propertyValue.hint',
  });
  const propertyValuePlaceholder = intl.formatMessage(
    { id: 'onboarding.placeholders.exampleAmount' },
    { value: '520 000' },
  );
  const endDateLabel = intl.formatMessage({
    id: 'onboarding.liabilities.fields.endDate.label',
  });
  const endDateHint = intl.formatMessage({
    id: 'onboarding.liabilities.fields.endDate.hint',
  });

  const liabilityTypeOptions = useMemo(
    () => [
      {
        value: 'mortgage',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.mortgage.option',
        }),
      },
      {
        value: 'car',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.car.option',
        }),
      },
      {
        value: 'personal',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.personal.option',
        }),
      },
      {
        value: 'student',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.student.option',
        }),
      },
      {
        value: 'credit_card',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.credit_card.option',
        }),
      },
      {
        value: 'cash_loan',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.cash_loan.option',
        }),
      },
      {
        value: 'installment',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.installment.option',
        }),
      },
      {
        value: 'leasing',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.leasing.option',
        }),
      },
      {
        value: 'overdraft',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.overdraft.option',
        }),
      },
      {
        value: 'other',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.types.other.option',
        }),
      },
    ],
    [intl],
  );

  const cardTitleMap = useMemo(
    () =>
      ({
        mortgage: intl.formatMessage({
          id: 'onboarding.liabilities.types.mortgage.cardTitle',
        }),
        car: intl.formatMessage({
          id: 'onboarding.liabilities.types.car.cardTitle',
        }),
        personal: intl.formatMessage({
          id: 'onboarding.liabilities.types.personal.cardTitle',
        }),
        student: intl.formatMessage({
          id: 'onboarding.liabilities.types.student.cardTitle',
        }),
        credit_card: intl.formatMessage({
          id: 'onboarding.liabilities.types.credit_card.cardTitle',
        }),
        cash_loan: intl.formatMessage({
          id: 'onboarding.liabilities.types.cash_loan.cardTitle',
        }),
        installment: intl.formatMessage({
          id: 'onboarding.liabilities.types.installment.cardTitle',
        }),
        leasing: intl.formatMessage({
          id: 'onboarding.liabilities.types.leasing.cardTitle',
        }),
        overdraft: intl.formatMessage({
          id: 'onboarding.liabilities.types.overdraft.cardTitle',
        }),
        other: intl.formatMessage({
          id: 'onboarding.liabilities.types.other.cardTitle',
        }),
        default: intl.formatMessage({
          id: 'onboarding.liabilities.types.default.cardTitle',
        }),
      }) as Record<string, string>,
    [intl],
  );

  const repaymentTypeOptions = useMemo(
    () => [
      {
        value: 'equal',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.fields.repaymentType.options.equal',
        }),
      },
      {
        value: 'decreasing',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.fields.repaymentType.options.decreasing',
        }),
      },
      {
        value: 'unknown',
        label: intl.formatMessage({
          id: 'onboarding.liabilities.fields.repaymentType.options.unknown',
        }),
      },
    ],
    [intl],
  );

  const totals = useMemo(() => {
    const totalMonthly = items.reduce(
      (sum, item) => sum + (item.monthlyPayment || 0),
      0
    );
    const totalRemaining = items.reduce(
      (sum, item) => sum + (item.remainingAmount || 0),
      0
    );
    const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;
    return { totalMonthly, totalRemaining, dti };
  }, [items, monthlyIncome]);
  const dtiValue = totals.dti.toFixed(1);

  const dtiLevel = useMemo(() => {
    const dti = totals.dti;
    if (dti === 0) return { key: 'none' as const, color: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground', pct: 0 };
    if (dti < 20) return { key: 'excellent' as const, color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', pct: dti / 60 * 100 };
    if (dti < 36) return { key: 'acceptable' as const, color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500', pct: dti / 60 * 100 };
    if (dti < 43) return { key: 'high' as const, color: 'text-orange-700', bg: 'bg-orange-50', bar: 'bg-orange-500', pct: dti / 60 * 100 };
    return { key: 'critical' as const, color: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-500', pct: Math.min(dti / 60 * 100, 100) };
  }, [totals.dti]);

  const getCardTitle = (type: string) =>
    cardTitleMap[type] ?? cardTitleMap.default;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mortgage':
        return Home;
      case 'car':
        return Car;
      case 'credit_card':
      case 'overdraft':
        return Wallet;
      case 'leasing':
        return TrendingDown;
      default:
        return Target;
    }
  };

  const handleTypeChange = (id: string, value: string) => {
    const currentItem = items.find((liability) => liability.id === id);
    const isRevolvingCredit = ['credit_card', 'overdraft'].includes(value);
    onUpdate(id, {
      type: value,
      repaymentType: isRevolvingCredit
        ? 'unknown'
        : currentItem?.repaymentType || 'equal',
      propertyValue:
        value === 'mortgage' ? currentItem?.propertyValue ?? null : null,
    });
  };

  // Revolving credit (credit_card, overdraft) doesn't have end date
  const shouldShowEndDate = (type: string) => !['credit_card', 'overdraft'].includes(type);
  // Revolving credit and leasing don't have repayment type (equal/decreasing)
  const shouldShowRepaymentType = (type: string) => !['credit_card', 'overdraft', 'leasing'].includes(type);
  const shouldShowPropertyValue = (type: string) => type === 'mortgage';
  // Leasing doesn't need interest rate (it's included in the rate)
  const shouldShowInterestRate = (type: string) => type !== 'leasing';

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
        <p className="text-sm font-semibold text-primary">
          {introTitle}
        </p>
        <p className="mt-1 text-xs text-secondary">
          {introDescription}
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const Icon = getTypeIcon(item.type);
          const remainingLabel =
            item.type === 'leasing'
              ? remainingAmountLabelBuyout
              : remainingAmountLabelDefault;
          const fieldError = (field: keyof LiabilityItem) =>
            errors[`liabilities.${index}.${field}`] ??
            errors[`${index}.${field}`] ??
            errors[field];

          return (
            <div
              key={item.id}
              className="space-y-4 rounded-xl border border-muted/60 bg-[#fafaf9] p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <Icon className="h-5 w-5" />
                  <p className="text-sm font-semibold">{getCardTitle(item.type)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-full p-1 text-secondary transition-colors hover:text-destructive"
                  aria-label={removeLiabilityLabel}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup
                  label={typeLabel}
                  error={fieldError('type')}
                >
                  <Select
                    value={item.type}
                    onValueChange={(value) => handleTypeChange(item.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {liabilityTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup
                  label={monthlyPaymentLabel}
                  error={fieldError('monthlyPayment')}
                >
                  <CurrencyInput
                    value={item.monthlyPayment}
                    onValueChange={(amount) =>
                      onUpdate(item.id, { monthlyPayment: amount })
                    }
                    placeholder={monthlyPaymentPlaceholder}
                  />
                </FieldGroup>

                <FieldGroup
                  label={remainingLabel}
                  error={fieldError('remainingAmount')}
                >
                  <CurrencyInput
                    value={item.remainingAmount}
                    onValueChange={(amount) =>
                      onUpdate(item.id, { remainingAmount: amount })
                    }
                    placeholder={remainingAmountPlaceholder}
                  />
                </FieldGroup>

                {shouldShowInterestRate(item.type) && (
                  <FieldGroup label={interestRateLabel} error={fieldError('interestRate')}>
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={100}
                      value={item.interestRate ?? ''}
                      onChange={(event) =>
                        onUpdate(item.id, {
                          interestRate:
                            event.target.value === ''
                              ? null
                              : Number(event.target.value) || 0,
                        })
                      }
                      placeholder={interestRatePlaceholder}
                    />
                  </FieldGroup>
                )}

                {shouldShowRepaymentType(item.type) && (
                  <FieldGroup label={repaymentTypeLabel} hint={repaymentTypeHint}>
                    <Select
                      value={item.repaymentType || 'unknown'}
                      onValueChange={(value) =>
                        onUpdate(item.id, {
                          repaymentType: value as LiabilityItem['repaymentType'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {repaymentTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                )}

                {shouldShowPropertyValue(item.type) && (
                  <FieldGroup
                    label={propertyValueLabel}
                    hint={propertyValueHint}
                  >
                    <CurrencyInput
                      value={item.propertyValue ?? 0}
                      onValueChange={(amount) =>
                        onUpdate(item.id, { propertyValue: amount })
                      }
                      placeholder={propertyValuePlaceholder}
                    />
                  </FieldGroup>
                )}

                {shouldShowEndDate(item.type) && (
                  <FieldGroup
                    label={endDateLabel}
                    hint={endDateHint}
                    className="md:col-span-2"
                  >
                    <Input
                      type="date"
                      value={item.endDate ?? ''}
                      onChange={(event) =>
                        onUpdate(item.id, { endDate: event.target.value })
                      }
                    />
                  </FieldGroup>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="inline-flex items-center gap-2 border-primary/40 bg-primary/5 text-primary shadow-sm transition-transform hover:translate-y-[-1px]"
        >
          <Plus className="h-4 w-4" />
          {addLiabilityLabel}
        </Button>

      </div>

      {items.length > 0 && (
        <div className={`rounded-xl border p-4 space-y-4 ${dtiLevel.bg} border-current/10`}>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <p className="text-secondary">
              {totalMonthlyLabel}:{' '}
              <span className="font-semibold text-primary">
                {formatMoney(totals.totalMonthly)}
              </span>
            </p>
            <p className="text-secondary">
              {totalRemainingLabel}:{' '}
              <span className="font-semibold text-primary">
                {formatMoney(totals.totalRemaining)}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-primary">
                {intl.formatMessage({ id: 'onboarding.liabilities.summary.dtiLabel' })}
              </p>
              <span className={`text-2xl font-bold ${dtiLevel.color}`}>
                {dtiValue}%
              </span>
            </div>

            <div className="relative h-3 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${dtiLevel.bar}`}
                style={{ width: `${dtiLevel.pct}%` }}
              />
              {/* Threshold markers */}
              <div className="absolute inset-y-0 left-[33.3%] w-px bg-white/60" />
              <div className="absolute inset-y-0 left-[60%] w-px bg-white/60" />
              <div className="absolute inset-y-0 left-[71.7%] w-px bg-white/60" />
            </div>
            <div className="flex justify-between text-[10px] text-secondary/70">
              <span>0%</span>
              <span>20%</span>
              <span>36%</span>
              <span>43%</span>
              <span>60%+</span>
            </div>
          </div>

          <p className={`text-sm font-medium ${dtiLevel.color}`}>
            {intl.formatMessage({ id: `onboarding.liabilities.summary.dtiLevel.${dtiLevel.key}` })}
          </p>
        </div>
      )}

      <FormFooter onNext={onNext} onBack={onBack} />
    </div>
  );
}
