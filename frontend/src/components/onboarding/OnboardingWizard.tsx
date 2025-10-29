'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  Smile,
  User,
  Wallet,
  Home,
  TrendingDown,
  TrendingUp,
  Target,
  Info,
  Plus,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/contexts/SettingsContext';
import { CurrencyInput } from './CurrencyInput';

const LOCAL_STORAGE_KEY = 'sproutlyfi-onboarding';

type StepId =
  | 'welcome'
  | 'life'
  | 'income'
  | 'expenses'
  | 'liabilities'
  | 'assets'
  | 'goals'
  | 'summary';

interface AdditionalSource {
  enabled: boolean;
  amount: number;
}

interface LiabilityItem {
  id: string;
  type: string;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate?: number | null;
  endDate?: string;
}

interface PropertyItem {
  id: string;
  name: string;
  value: number;
}

interface GoalItem {
  id: string;
  name: string;
  type: 'short' | 'medium' | 'long';
  targetAmount: number;
  targetDate?: string;
  priority: number;
}

export interface OnboardingData {
  life: {
    maritalStatus: 'single' | 'relationship' | 'married' | '';
    includePartnerFinances: boolean;
    childrenCount: number;
    housingType: 'rent' | 'mortgage' | 'owned' | '';
    employmentStatus: 'employee' | 'business' | 'freelancer' | 'unemployed' | '';
    taxForm: '' | 'scale' | 'linear' | 'lumpsum' | 'card';
    householdCost: number;
  };
  income: {
    salaryNet: number;
    additionalSources: {
      rental: AdditionalSource;
      bonuses: AdditionalSource;
      freelance: AdditionalSource;
      benefits: AdditionalSource;
      childBenefit: AdditionalSource;
    };
    irregularIncomeAnnual: number;
  };
  expenses: {
    housing: number;
    utilities: number;
    transport: number;
    food: number;
    entertainment: number;
    other: number;
  };
  liabilities: LiabilityItem[];
  assets: {
    savings: number;
    emergencyFundMonths: number;
    investments: {
      categories: string[];
      totalValue: number;
    };
    properties: PropertyItem[];
    vehicles: PropertyItem[];
  };
  goals: GoalItem[];
}

const TAX_FORM_LABELS: Record<OnboardingData['life']['taxForm'], string> = {
  '': '',
  scale: 'Skala podatkowa',
  linear: 'Podatek liniowy',
  lumpsum: 'Ryczałt ewidencjonowany',
  card: 'Karta podatkowa',
};

const defaultData: OnboardingData = {
  life: {
    maritalStatus: '',
    includePartnerFinances: false,
    childrenCount: 0,
    housingType: '',
    employmentStatus: '',
    taxForm: '',
    householdCost: 0,
  },
  income: {
    salaryNet: 0,
    additionalSources: {
      rental: { enabled: false, amount: 0 },
      bonuses: { enabled: false, amount: 0 },
      freelance: { enabled: false, amount: 0 },
      benefits: { enabled: false, amount: 0 },
      childBenefit: { enabled: false, amount: 0 },
    },
    irregularIncomeAnnual: 0,
  },
  expenses: {
    housing: 0,
    utilities: 0,
    transport: 0,
    food: 0,
    entertainment: 0,
    other: 0,
  },
  liabilities: [],
  assets: {
    savings: 0,
    emergencyFundMonths: 0,
    investments: {
      categories: [],
      totalValue: 0,
    },
    properties: [],
    vehicles: [],
  },
  goals: [],
};

interface OnboardingMetrics {
  monthlyIncome: number;
  totalExpenses: number;
  liabilitiesMonthly: number;
  liabilitiesTotal: number;
  assetsTotal: number;
  surplus: number;
  dti: number;
  emergencyCoverage: number;
  netWorth: number;
}

const ensureId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
};

const mergeOnboardingData = (
  current: OnboardingData,
  incoming: OnboardingData
): OnboardingData => {
  const pickString = (currentValue: string, incomingValue?: string) =>
    currentValue || incomingValue || currentValue;

  const pickBoolean = (currentValue: boolean, incomingValue?: boolean) =>
    currentValue || Boolean(incomingValue);

  const pickNumber = (currentValue: number, incomingValue?: number) =>
    currentValue > 0 ? currentValue : incomingValue && incomingValue > 0 ? incomingValue : currentValue;

  const mergedLife = {
    maritalStatus: pickString(current.life.maritalStatus, incoming.life?.maritalStatus),
    includePartnerFinances: pickBoolean(
      current.life.includePartnerFinances,
      incoming.life?.includePartnerFinances
    ),
    childrenCount:
      current.life.childrenCount > 0
        ? current.life.childrenCount
        : incoming.life?.childrenCount ?? current.life.childrenCount,
    housingType: pickString(current.life.housingType, incoming.life?.housingType),
    employmentStatus: pickString(current.life.employmentStatus, incoming.life?.employmentStatus),
    taxForm: pickString(current.life.taxForm, incoming.life?.taxForm),
    householdCost: pickNumber(current.life.householdCost, incoming.life?.householdCost),
  };

  const mergedAdditionalSources = Object.keys(current.income.additionalSources).reduce(
    (acc, key) => {
      const typedKey = key as keyof OnboardingData['income']['additionalSources'];
      const currentSource = current.income.additionalSources[typedKey];
      const incomingSource = incoming.income?.additionalSources?.[typedKey];

      const enabled =
        currentSource.enabled || Boolean(incomingSource?.enabled);
      const amount = enabled
        ? (currentSource.amount > 0
            ? currentSource.amount
            : incomingSource?.amount ?? currentSource.amount)
        : 0;

      acc[typedKey] = {
        enabled,
        amount,
      };

      return acc;
    },
    {} as OnboardingData['income']['additionalSources']
  );

  const childBenefitSource = mergedAdditionalSources.childBenefit;
  if (childBenefitSource) {
    if (mergedLife.childrenCount <= 0) {
      childBenefitSource.enabled = false;
      childBenefitSource.amount = 0;
    } else {
      const maxBenefit = mergedLife.childrenCount * 800;
      childBenefitSource.amount = Math.min(childBenefitSource.amount || maxBenefit, maxBenefit);
      childBenefitSource.enabled = childBenefitSource.enabled;
    }
  }

  const mergedIncome: OnboardingData['income'] = {
    salaryNet: pickNumber(current.income.salaryNet, incoming.income?.salaryNet),
    additionalSources: mergedAdditionalSources,
    irregularIncomeAnnual: pickNumber(
      current.income.irregularIncomeAnnual,
      incoming.income?.irregularIncomeAnnual
    ),
  };

  const mergedExpenses = Object.keys(current.expenses).reduce(
    (acc, key) => {
      const typedKey = key as keyof OnboardingData['expenses'];
      acc[typedKey] = pickNumber(
        current.expenses[typedKey],
        incoming.expenses?.[typedKey]
      );
      return acc;
    },
    {} as OnboardingData['expenses']
  );

  const mergedLiabilities =
    current.liabilities.length > 0
      ? current.liabilities.map((item) => ({ ...item }))
      : (incoming.liabilities?.map((item) => ({
          ...item,
          id: item.id || ensureId('liability'),
        })) ?? []);

  const mergedAssets: OnboardingData['assets'] = {
    savings: pickNumber(current.assets.savings, incoming.assets?.savings),
    emergencyFundMonths: pickNumber(
      current.assets.emergencyFundMonths,
      incoming.assets?.emergencyFundMonths
    ),
    investments: {
      categories:
        current.assets.investments.categories.length > 0
          ? current.assets.investments.categories
          : incoming.assets?.investments?.categories ?? [],
      totalValue: pickNumber(
        current.assets.investments.totalValue,
        incoming.assets?.investments?.totalValue
      ),
    },
    properties:
      current.assets.properties.length > 0
        ? current.assets.properties.map((property) => ({ ...property }))
        : (incoming.assets?.properties?.map((property) => ({
            ...property,
            id: property.id || ensureId('property'),
          })) ?? []),
    vehicles:
      current.assets.vehicles.length > 0
        ? current.assets.vehicles.map((vehicle) => ({ ...vehicle }))
        : (incoming.assets?.vehicles?.map((vehicle) => ({
            ...vehicle,
            id: vehicle.id || ensureId('vehicle'),
          })) ?? []),
  };

  const mergedGoals =
    current.goals.length > 0
      ? current.goals.map((goal) => ({ ...goal }))
      : (incoming.goals?.map((goal) => ({
          ...goal,
          id: goal.id || ensureId('goal'),
        })) ?? []);

  return {
    life: mergedLife,
    income: mergedIncome,
    expenses: mergedExpenses,
    liabilities: mergedLiabilities,
    assets: mergedAssets,
    goals: mergedGoals,
  };
};

const hasMeaningfulData = (data: OnboardingData): boolean => {
  if (!data) return false;

  const { life, income, expenses, liabilities, assets, goals } = data;

  const lifeHasValues =
    Boolean(life.maritalStatus) ||
    Boolean(life.housingType) ||
    Boolean(life.employmentStatus) ||
    Boolean(life.taxForm) ||
    life.childrenCount > 0 ||
    life.householdCost > 0;

  const incomeHasValues =
    income.salaryNet > 0 ||
    income.irregularIncomeAnnual > 0 ||
    Object.values(income.additionalSources).some(
      (src) => src.enabled && src.amount > 0
    );

  const expensesHasValues = Object.values(expenses).some((value) => value > 0);

  const liabilitiesHasValues = liabilities.length > 0;

  const assetsHasValues =
    assets.savings > 0 ||
    assets.emergencyFundMonths > 0 ||
    assets.investments.totalValue > 0 ||
    assets.properties.length > 0 ||
    assets.vehicles.length > 0;

  const goalsHasValues = goals.length > 0;

  return (
    lifeHasValues ||
    incomeHasValues ||
    expensesHasValues ||
    liabilitiesHasValues ||
    assetsHasValues ||
    goalsHasValues
  );
};

const TAX_FORM_OPTIONS = ['scale', 'linear', 'lumpsum', 'card'] as const;

const lifeSchema = z
  .object({
    maritalStatus: z.enum(['single', 'relationship', 'married']),
    includePartnerFinances: z.boolean(),
    childrenCount: z
      .number()
      .min(0, 'Liczba dzieci nie może być ujemna')
      .max(10, 'Podaj liczbę od 0 do 10'),
    housingType: z.enum(['rent', 'mortgage', 'owned']),
    employmentStatus: z.enum(['employee', 'business', 'freelancer', 'unemployed']),
    taxForm: z.enum(TAX_FORM_OPTIONS).or(z.literal('')),
    householdCost: z
      .number({ invalid_type_error: 'Podaj miesięczny koszt życia' })
      .min(0, 'Kwota nie może być ujemna'),
  })
  .superRefine((value, ctx) => {
    if (value.employmentStatus === 'business' && !value.taxForm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxForm'],
        message: 'Wybierz formę opodatkowania',
      });
    }
  });

const incomeSchema = z.object({
  salaryNet: z.number().min(0, 'Podaj dodatnią kwotę wynagrodzenia'),
  additionalSources: z.object({
    rental: z.object({
      enabled: z.boolean(),
      amount: z.number().min(0),
    }),
    bonuses: z.object({
      enabled: z.boolean(),
      amount: z.number().min(0),
    }),
    freelance: z.object({
      enabled: z.boolean(),
      amount: z.number().min(0),
    }),
    benefits: z.object({
      enabled: z.boolean(),
      amount: z.number().min(0),
    }),
    childBenefit: z.object({
      enabled: z.boolean(),
      amount: z.number().min(0),
    }),
  }),
  irregularIncomeAnnual: z.number().min(0, 'Kwota nie może być ujemna'),
});

const expensesSchema = z.object({
  housing: z.number().min(0),
  utilities: z.number().min(0),
  transport: z.number().min(0),
  food: z.number().min(0),
  entertainment: z.number().min(0),
  other: z.number().min(0),
});

const liabilitySchema = z.object({
  id: z.string(),
  type: z.string().min(1, 'Podaj rodzaj zobowiązania'),
  remainingAmount: z.number().min(0),
  monthlyPayment: z.number().min(0),
  interestRate: z.number().min(0).max(100).nullable().optional(),
  endDate: z.string().optional(),
});

const assetsSchema = z.object({
  savings: z.number().min(0),
  emergencyFundMonths: z.number().min(0).max(24),
  investments: z.object({
    categories: z.array(z.string()),
    totalValue: z.number().min(0),
  }),
  properties: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Podaj nazwę'),
      value: z.number().min(0),
    })
  ),
  vehicles: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Podaj nazwę'),
      value: z.number().min(0),
    })
  ),
});

const goalSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Podaj nazwę celu'),
  type: z.enum(['short', 'medium', 'long']),
  targetAmount: z.number().min(0, 'Kwota musi być dodatnia'),
  targetDate: z.string().optional(),
  priority: z.number().min(1).max(5),
});

interface StepDefinition {
  id: StepId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  validate?: (data: OnboardingData) => z.ZodIssue[] | null;
}

const steps: StepDefinition[] = [
  {
    id: 'welcome',
    label: 'Powitanie',
    description: 'Wprowadzenie do procesu onboardingu',
    icon: Smile,
  },
  {
    id: 'life',
    label: 'Sytuacja życiowa',
    description: 'Poznaj swój kontekst finansowy',
    icon: User,
    validate: (data) => {
      const result = lifeSchema.safeParse(data.life);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'income',
    label: 'Przychody',
    description: 'Źródła i poziom dochodów',
    icon: Wallet,
    validate: (data) => {
      const result = incomeSchema.safeParse(data.income);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'expenses',
    label: 'Wydatki',
    description: 'Powtarzalne koszty miesięczne',
    icon: Home,
    validate: (data) => {
      const result = expensesSchema.safeParse(data.expenses);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'liabilities',
    label: 'Zobowiązania',
    description: 'Kredyty i pożyczki',
    icon: TrendingDown,
    validate: (data) => {
      if (data.liabilities.length === 0) return null;
      const result = z.array(liabilitySchema).safeParse(data.liabilities);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'assets',
    label: 'Majątek i inwestycje',
    description: 'Aktywa finansowe i rzeczowe',
    icon: TrendingUp,
    validate: (data) => {
      const result = assetsSchema.safeParse(data.assets);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'goals',
    label: 'Cele finansowe',
    description: 'Plany i priorytety',
    icon: Target,
    validate: (data) => {
      if (data.goals.length === 0) {
        return [
          {
            code: z.ZodIssueCode.custom,
            message: 'Dodaj przynajmniej jeden cel lub pomiń krok',
            path: ['goals'],
          },
        ];
      }
      const result = z.array(goalSchema).safeParse(data.goals);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'summary',
    label: 'Podsumowanie',
    description: 'Sprawdź, co udało się zebrać',
    icon: FileSpreadsheet,
  },
];

type StepErrors = Record<string, string>;

export default function OnboardingWizard() {
  const router = useRouter();
  const { formatCurrency: formatCurrencySetting } = useSettings();
  const formatMoney = useCallback(
    (amount: number) => formatCurrencySetting(amount || 0),
    [formatCurrencySetting]
  );
  const [data, setData] = useState<OnboardingData>(defaultData);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errors, setErrors] = useState<StepErrors>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isMounted = true;

    const loadInitialData = async () => {
      let workingData = defaultData;

      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (stored) {
          const parsed = JSON.parse(stored) as OnboardingData;
          workingData = mergeOnboardingData(defaultData, parsed);
          if (isMounted) {
            setData(workingData);
          }
        }
      } catch (error) {
        console.warn(
          'Failed to read onboarding data from localStorage',
          error
        );
      }

      try {
        const response = await fetch('/api/onboarding', {
          cache: 'no-store',
        });

        if (response.ok) {
          const submissions = (await response.json()) as Array<{
            data?: OnboardingData;
          }>;

          if (Array.isArray(submissions) && submissions.length > 0) {
            const lastSubmission = submissions[submissions.length - 1];
            if (lastSubmission?.data && isMounted) {
              setData((prev) =>
                mergeOnboardingData(prev, lastSubmission.data as OnboardingData)
              );
            }
          }
        }
      } catch (prefillError) {
        console.warn('[onboarding] Failed to load previous submission', prefillError);
      } finally {
        if (isMounted) {
          hasHydrated.current = true;
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated.current || typeof window === 'undefined') return;
    setSaveStatus('saving');
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        setSaveStatus('saved');
        setLastSavedAt(
          new Intl.DateTimeFormat('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date())
        );
      } catch (error) {
        console.warn('Failed to save onboarding draft', error);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [data]);

  const handleNext = useCallback(
    (options?: { skipValidation?: boolean }) => {
      const step = steps[currentStepIndex];
      if (!options?.skipValidation && step.validate) {
        const issues = step.validate(data);
        if (issues && issues.length > 0) {
          const mapped: StepErrors = {};
          issues.forEach((issue) => {
            const pathKey = issue.path.join('.') || 'form';
            mapped[pathKey] = issue.message;
          });
          setErrors(mapped);
          return;
        }
      }
      setErrors({});
      setCurrentStepIndex((prev) =>
        Math.min(prev + 1, steps.length - 1)
      );
    },
    [currentStepIndex, data]
  );

  const handleBack = useCallback(() => {
    setErrors({});
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkipStep = useCallback(() => {
    handleNext({ skipValidation: true });
  }, [handleNext]);

  const handleSkipAll = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    router.push('/');
  }, [router]);

  const handleReset = useCallback(() => {
    setData(defaultData);
    setErrors({});
    setCurrentStepIndex(0);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, []);

  const handleComplete = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to persist onboarding data');
      }

      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setSaveStatus('saved');
      router.push('/');
    } catch (error) {
      console.error(error);
      setSaveStatus('idle');
      alert('Nie udało się zapisać danych. Spróbuj ponownie.');
    }
  }, [data, router]);

  const setLife = (updates: Partial<OnboardingData['life']>) =>
    setData((prev) => {
      const nextLife = { ...prev.life, ...updates };
      let nextIncome = prev.income;

      if (updates.childrenCount !== undefined) {
        const count = Math.max(0, updates.childrenCount);
        const maxBenefit = count * 800;
        const previous = prev.income.additionalSources.childBenefit;
        nextIncome = {
          ...prev.income,
          additionalSources: {
            ...prev.income.additionalSources,
            childBenefit: {
              enabled: count > 0 ? previous.enabled : false,
              amount:
                count > 0
                  ? Math.min(previous.amount, maxBenefit)
                  : 0,
            },
          },
        };
      }

      if (updates.employmentStatus && updates.employmentStatus !== 'business') {
        nextLife.taxForm = '';
      }

      return {
        ...prev,
        life: nextLife,
        income: nextIncome,
      };
    });

  const setIncome = (
    updates: Partial<OnboardingData['income']>,
    nested?: keyof OnboardingData['income']['additionalSources'],
    nestedUpdates?: Partial<AdditionalSource>
  ) =>
    setData((prev) => {
      if (nested && nestedUpdates) {
        return {
          ...prev,
          income: {
            ...prev.income,
            additionalSources: {
              ...prev.income.additionalSources,
              [nested]: {
                ...prev.income.additionalSources[nested],
                ...nestedUpdates,
              },
            },
          },
        };
      }

      return {
        ...prev,
        income: { ...prev.income, ...updates },
      };
    });

  const setExpense = (key: keyof OnboardingData['expenses'], value: number) =>
    setData((prev) => ({
      ...prev,
      expenses: {
        ...prev.expenses,
        [key]: value,
      },
    }));

  const addLiability = () =>
    setData((prev) => ({
      ...prev,
      liabilities: [
        ...prev.liabilities,
        {
          id: crypto.randomUUID(),
          type: '',
          remainingAmount: 0,
          monthlyPayment: 0,
          interestRate: null,
          endDate: '',
        },
      ],
    }));

  const updateLiability = (id: string, updates: Partial<LiabilityItem>) =>
    setData((prev) => ({
      ...prev,
      liabilities: prev.liabilities.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));

  const removeLiability = (id: string) =>
    setData((prev) => ({
      ...prev,
      liabilities: prev.liabilities.filter((item) => item.id !== id),
    }));

  const addProperty = (collection: 'properties' | 'vehicles') =>
    setData((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        [collection]: [
          ...prev.assets[collection],
          {
            id: crypto.randomUUID(),
            name: '',
            value: 0,
          },
        ],
      },
    }));

  const updateProperty = (
    collection: 'properties' | 'vehicles',
    id: string,
    updates: Partial<PropertyItem>
  ) =>
    setData((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        [collection]: prev.assets[collection].map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      },
    }));

  const removeProperty = (collection: 'properties' | 'vehicles', id: string) =>
    setData((prev) => ({
      ...prev,
      assets: {
        ...prev.assets,
        [collection]: prev.assets[collection].filter((item) => item.id !== id),
      },
    }));

  const addGoal = () =>
    setData((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          id: crypto.randomUUID(),
          name: '',
          type: 'short',
          targetAmount: 0,
          targetDate: '',
          priority: 3,
        },
      ],
    }));

  const updateGoal = (id: string, updates: Partial<GoalItem>) =>
    setData((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) =>
        goal.id === id ? { ...goal, ...updates } : goal
      ),
    }));

  const removeGoal = (id: string) =>
    setData((prev) => ({
      ...prev,
      goals: prev.goals.filter((goal) => goal.id !== id),
    }));

  const metrics = useMemo<OnboardingMetrics>(() => {
    const additionalMonthly = Object.values(data.income.additionalSources)
      .filter((src) => src.enabled)
      .reduce((sum, src) => sum + src.amount, 0);

    const monthlyIncome =
      data.income.salaryNet +
      additionalMonthly +
      data.income.irregularIncomeAnnual / 12;

    const totalExpenses =
      data.expenses.housing +
      data.expenses.utilities +
      data.expenses.transport +
      data.expenses.food +
      data.expenses.entertainment +
      data.expenses.other;

    const liabilitiesMonthly = data.liabilities.reduce(
      (sum, item) => sum + item.monthlyPayment,
      0
    );

    const liabilitiesTotal = data.liabilities.reduce(
      (sum, item) => sum + item.remainingAmount,
      0
    );

    const assetsTotal =
      data.assets.savings +
      data.assets.investments.totalValue +
      data.assets.properties.reduce((sum, item) => sum + item.value, 0) +
      data.assets.vehicles.reduce((sum, item) => sum + item.value, 0);

    const surplus = monthlyIncome - (totalExpenses + liabilitiesMonthly);
    const dti = monthlyIncome
      ? (liabilitiesMonthly / monthlyIncome) * 100
      : 0;
    const emergencyCoverage = totalExpenses
      ? data.assets.savings / totalExpenses
      : 0;
    const netWorth = assetsTotal - liabilitiesTotal;

    return {
      monthlyIncome,
      totalExpenses,
      liabilitiesMonthly,
      liabilitiesTotal,
      assetsTotal,
      surplus,
      dti,
      emergencyCoverage,
      netWorth,
    };
  }, [data]);

  const currentStep = steps[currentStepIndex];
  const stepsWithoutEdges = steps.length - 2;
  const progress =
    currentStepIndex === 0
      ? 0
      : currentStepIndex >= steps.length - 1
      ? 100
      : Math.min(
          100,
          Math.round((currentStepIndex / stepsWithoutEdges) * 100)
        );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-primary">
              Start finansowego profilu
            </h1>
            <p className="text-secondary">
              Przejdź przez serię kroków, aby zbudować swój finansowy punkt
              startowy.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {saveStatus === 'saving' && <span>Zapisywanie danych...</span>}
            {saveStatus === 'saved' && lastSavedAt && (
              <span>Zapisano o {lastSavedAt}</span>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-secondary">
            <span>
              Krok {Math.min(Math.max(currentStepIndex, 1), stepsWithoutEdges)} z{' '}
              {stepsWithoutEdges}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <Card className="border-default bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <currentStep.icon className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">{`${
                currentStepIndex === 0
                  ? 'Witaj w Twoim Finansowym Centrum!'
                  : currentStep.label
              }`}</CardTitle>
              <CardDescription className="text-secondary">
                {currentStep.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {currentStep.id === 'welcome' && (
            <WelcomeStep onStart={() => handleNext()} onSkip={handleSkipAll} />
          )}

          {currentStep.id === 'life' && (
            <LifeStep
              data={data.life}
              errors={errors}
              onChange={setLife}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
            />
          )}

          {currentStep.id === 'income' && (
            <IncomeStep
              data={data.income}
              errors={errors}
              onChange={setIncome}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
              monthlyIncome={metrics.monthlyIncome}
              formatMoney={formatMoney}
              childrenCount={data.life.childrenCount}
            />
          )}

          {currentStep.id === 'expenses' && (
            <ExpensesStep
              data={data.expenses}
              errors={errors}
              onChange={setExpense}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
              formatMoney={formatMoney}
            />
          )}

          {currentStep.id === 'liabilities' && (
            <LiabilitiesStep
              items={data.liabilities}
              errors={errors}
              onAdd={addLiability}
              onUpdate={updateLiability}
              onRemove={removeLiability}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
            />
          )}

          {currentStep.id === 'assets' && (
            <AssetsStep
              data={data.assets}
              errors={errors}
              onChange={(updates) =>
                setData((prev) => ({
                  ...prev,
                  assets: { ...prev.assets, ...updates },
                }))
              }
              onAddProperty={addProperty}
              onUpdateProperty={updateProperty}
              onRemoveProperty={removeProperty}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
            />
          )}

          {currentStep.id === 'goals' && (
            <GoalsStep
              goals={data.goals}
              errors={errors}
              onAdd={addGoal}
              onUpdate={updateGoal}
              onRemove={removeGoal}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
            />
          )}

          {currentStep.id === 'summary' && (
            <SummaryStep
              data={data}
              metrics={metrics}
              onBack={handleBack}
              onReset={handleReset}
              onFinish={handleComplete}
              formatMoney={formatMoney}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StepBaseProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  errors: StepErrors;
}

function WelcomeStep({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-lg text-primary">
        W kilka minut pomożemy Ci odkryć, jak wygląda Twoja sytuacja finansowa.
        Przejdziemy przez sześć krótkich kroków – od dochodów i wydatków po cele
        finansowe.
      </p>
      <div className="rounded-lg border border-dashed border-muted p-4 text-sm text-secondary">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            Onboarding to jednorazowe wprowadzenie danych. Wszystko zapisujemy
            automatycznie – możesz wrócić i edytować informacje w dowolnym
            momencie.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onStart}>Zaczynamy</Button>
        <Button variant="outline" onClick={onSkip}>
          Pomiń onboarding
        </Button>
      </div>
    </div>
  );
}

function FormFooter({
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Dalej',
  isLast = false,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  nextLabel?: string;
  isLast?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4" />
        <span>Dlaczego to ważne? Dzięki tym danym spersonalizujemy Twoje cele.</span>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Pomiń krok
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Wstecz
        </Button>
        <Button type="button" onClick={onNext}>
          {isLast ? 'Zakończ' : nextLabel}
        </Button>
      </div>
    </div>
  );
}

function LifeStep({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
  errors,
}: StepBaseProps & {
  data: OnboardingData['life'];
  onChange: (updates: Partial<OnboardingData['life']>) => void;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <FieldGroup
        label="Stan cywilny"
        error={errors['maritalStatus']}
        required
      >
        <Select
          value={data.maritalStatus}
          onValueChange={(value) =>
            onChange({
              maritalStatus: value as OnboardingData['life']['maritalStatus'],
              includePartnerFinances:
                value === 'married' ? data.includePartnerFinances : false,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Wybierz..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Singiel / singielka</SelectItem>
            <SelectItem value="relationship">W związku</SelectItem>
            <SelectItem value="married">Małżeństwo</SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      {data.maritalStatus === 'married' && (
        <div className="flex items-center justify-between rounded-lg border border-muted/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">
              Uwzględnić finanse partnera?
            </p>
            <p className="text-xs text-secondary">
              Dzięki temu zobaczysz pełny obraz budżetu domowego.
            </p>
          </div>
          <Switch
            checked={data.includePartnerFinances}
            onCheckedChange={(checked) =>
              onChange({ includePartnerFinances: checked })
            }
          />
        </div>
      )}

      <FieldGroup label="Liczba dzieci" error={errors['childrenCount']}>
        <Input
          type="number"
          min={0}
          max={10}
          value={data.childrenCount}
          onChange={(event) =>
            onChange({ childrenCount: Number(event.target.value) || 0 })
          }
          placeholder="np. 2"
        />
      </FieldGroup>

      <FieldGroup
        label="Typ zamieszkania"
        hint="Wynajem i kredyt mają wpływ na strukturę Twoich wydatków."
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
            <SelectValue placeholder="Wybierz..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rent">Wynajem</SelectItem>
            <SelectItem value="mortgage">Własne (z kredytem)</SelectItem>
            <SelectItem value="owned">Własne (bez kredytu)</SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      <FieldGroup
        label="Status zawodowy"
        error={errors['employmentStatus']}
        required
      >
        <Select
          value={data.employmentStatus}
          onValueChange={(value) =>
            onChange({
              employmentStatus:
                value as OnboardingData['life']['employmentStatus'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Wybierz..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Etat</SelectItem>
            <SelectItem value="business">Działalność</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
            <SelectItem value="unemployed">Bez zatrudnienia</SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      {data.employmentStatus === 'business' && (
        <FieldGroup
          label="Forma opodatkowania"
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
              <SelectValue placeholder="Wybierz formę opodatkowania" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scale">Skala podatkowa</SelectItem>
              <SelectItem value="linear">Podatek liniowy</SelectItem>
              <SelectItem value="lumpsum">Ryczałt ewidencjonowany</SelectItem>
              <SelectItem value="card">Karta podatkowa</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      )}

      <FieldGroup
        label="Miesięczny koszt życia gospodarstwa (PLN)"
        error={errors['householdCost']}
        required
        hint="Szacuj średnią z ostatnich 3 miesięcy."
      >
        <CurrencyInput
          value={data.householdCost}
          onValueChange={(amount) => onChange({ householdCost: amount })}
          placeholder="np. 4 800"
        />
      </FieldGroup>

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </form>
  );
}

function IncomeStep({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
  errors,
  monthlyIncome,
  formatMoney,
  childrenCount,
}: StepBaseProps & {
  data: OnboardingData['income'];
  onChange: (
    updates: Partial<OnboardingData['income']>,
    nested?: keyof OnboardingData['income']['additionalSources'],
    nestedUpdates?: Partial<AdditionalSource>
  ) => void;
  monthlyIncome: number;
  formatMoney: (value: number) => string;
  childrenCount: number;
}) {
  const toggleSource = (
    key: keyof OnboardingData['income']['additionalSources'],
    enabled: boolean
  ) => {
    const source = data.additionalSources[key];
    if (key === 'childBenefit') {
      const maxBenefit = Math.max(0, childrenCount * 800);
      onChange(
        {},
        key,
        {
          enabled: enabled && childrenCount > 0,
          amount: enabled ? Math.min(source.amount || maxBenefit, maxBenefit) : 0,
        }
      );
      return;
    }

    onChange(
      {},
      key,
      {
        enabled,
        amount: enabled ? source.amount : 0,
      }
    );
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <FieldGroup
        label="Wynagrodzenie miesięczne (netto)"
        error={errors['salaryNet']}
        required
      >
        <CurrencyInput
          value={data.salaryNet}
          onValueChange={(amount) => onChange({ salaryNet: amount })}
          placeholder="np. 7 500"
        />
      </FieldGroup>

      <div className="rounded-lg border border-muted/50 p-4">
        <p className="mb-2 text-sm font-medium text-primary">Dodatkowe źródła</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['rental', 'Najem'],
              ['bonuses', 'Premie'],
              ['freelance', 'Zlecenia'],
              ['benefits', 'Świadczenia'],
              ...(childrenCount > 0
                ? ([
                    [
                      'childBenefit',
                      `Świadczenia 800+ (max ${formatMoney(childrenCount * 800)})`,
                    ],
                  ] as Array<[keyof OnboardingData['income']['additionalSources'], string]>)
                : []),
            ] as Array<[keyof OnboardingData['income']['additionalSources'], string]>
          ).map(([key, label]) => {
            const source = data.additionalSources[key];
            const isChildBenefit = key === 'childBenefit';
            const maxBenefit = Math.max(0, childrenCount * 800);

            if (isChildBenefit && childrenCount === 0) {
              return null;
            }

            return (
              <div
                key={key}
                className="flex flex-col gap-2 rounded-md border border-muted/50 bg-muted/40 p-3"
              >
                <label className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Checkbox
                    checked={source.enabled && (!isChildBenefit || childrenCount > 0)}
                    onCheckedChange={(checked) =>
                      toggleSource(key, Boolean(checked))
                    }
                    id={`source-${key}`}
                    disabled={isChildBenefit && childrenCount === 0}
                  />
                  <span>{label}</span>
                </label>
                {isChildBenefit && (
                  <p className="text-xs text-secondary">
                    Limit: {formatMoney(maxBenefit)} (800 zł x liczba dzieci)
                  </p>
                )}
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
                    placeholder={isChildBenefit ? formatMoney(maxBenefit) : 'np. 1 200'}
                    className="h-9"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <FieldGroup
        label="Dochody nieregularne (rocznie)"
        error={errors['irregularIncomeAnnual']}
        hint="Podaj kwoty netto – to, co realnie trafia na konto."
      >
        <CurrencyInput
          value={data.irregularIncomeAnnual}
          onValueChange={(amount) =>
            onChange({
              irregularIncomeAnnual: amount,
            })
          }
          placeholder="np. 6 000"
        />
      </FieldGroup>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-sm font-medium text-primary">
          Łączny miesięczny dochód
        </p>
        <p className="text-2xl font-semibold text-primary">
          {formatMoney(Math.round(monthlyIncome))}
        </p>
      </div>

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </form>
  );
}

function ExpensesStep({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
  errors,
  formatMoney,
}: StepBaseProps & {
  data: OnboardingData['expenses'];
  onChange: (key: keyof OnboardingData['expenses'], value: number) => void;
  formatMoney: (value: number) => string;
}) {
  const fields: Array<{
    key: keyof OnboardingData['expenses'];
    label: string;
    placeholder: string;
  }> = [
    { key: 'housing', label: 'Mieszkanie i media', placeholder: 'np. 2500' },
    { key: 'utilities', label: 'Media', placeholder: 'np. 400' },
    { key: 'transport', label: 'Transport', placeholder: 'np. 600' },
    { key: 'food', label: 'Żywność', placeholder: 'np. 1500' },
    { key: 'entertainment', label: 'Rozrywka / dzieci', placeholder: 'np. 400' },
    { key: 'other', label: 'Inne', placeholder: 'np. 300' },
  ];

  const total = Object.values(data).reduce((sum, value) => sum + (value || 0), 0);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      {fields.map((field) => (
        <FieldGroup
          key={field.key}
          label={field.label}
          error={errors[`expenses.${field.key}`]}
        >
          <CurrencyInput
            value={data[field.key]}
            onValueChange={(amount) => onChange(field.key, amount)}
            placeholder={field.placeholder}
          />
        </FieldGroup>
      ))}

      <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
        Twoje miesięczne wydatki:{' '}
        <strong>{formatMoney(total)}</strong>
      </div>

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </form>
  );
}

function LiabilitiesStep({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
  onBack,
  onSkip,
  errors,
}: StepBaseProps & {
  items: LiabilityItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<LiabilityItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-secondary">
        Wprowadź informacje o kredytach i pożyczkach. Po zakończeniu pokażemy
        sumę i wskaźnik DTI.
      </p>

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-4 rounded-lg border border-muted/60 bg-muted/30 p-4 md:grid-cols-2"
          >
            <FieldGroup label="Rodzaj zobowiązania" error={errors['type']}>
              <Select
                value={item.type}
                onValueChange={(value) =>
                  onUpdate(item.id, { type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="np. kredyt hipoteczny" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mortgage">Kredyt hipoteczny</SelectItem>
                  <SelectItem value="car">Kredyt samochodowy</SelectItem>
                  <SelectItem value="consumer">Pożyczka konsumpcyjna</SelectItem>
                  <SelectItem value="card">Karta kredytowa</SelectItem>
                  <SelectItem value="other">Inne</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>

            <FieldGroup label="Kwota pozostała do spłaty (PLN)">
              <CurrencyInput
                value={item.remainingAmount}
                onValueChange={(amount) =>
                  onUpdate(item.id, {
                    remainingAmount: amount,
                  })
                }
                placeholder="np. 180 000"
              />
            </FieldGroup>

            <FieldGroup label="Rata miesięczna (PLN)">
              <CurrencyInput
                value={item.monthlyPayment}
                onValueChange={(amount) =>
                  onUpdate(item.id, {
                    monthlyPayment: amount,
                  })
                }
                placeholder="np. 1 800"
              />
            </FieldGroup>

            <FieldGroup label="Oprocentowanie (%)" hint="(opcjonalnie)">
              <Input
                type="number"
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
                placeholder="np. 6.2"
              />
            </FieldGroup>

            <FieldGroup
              label="Termin zakończenia"
              hint="(opcjonalnie)"
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

            <Button
              type="button"
              variant="ghost"
              className="justify-start text-destructive"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-4 w-4" />
              Usuń zobowiązanie
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="inline-flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Dodaj kolejne zobowiązanie
      </Button>

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </div>
  );
}

function AssetsStep({
  data,
  onChange,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onNext,
  onBack,
  onSkip,
  errors,
}: StepBaseProps & {
  data: OnboardingData['assets'];
  onChange: (updates: Partial<OnboardingData['assets']>) => void;
  onAddProperty: (collection: 'properties' | 'vehicles') => void;
  onUpdateProperty: (
    collection: 'properties' | 'vehicles',
    id: string,
    updates: Partial<PropertyItem>
  ) => void;
  onRemoveProperty: (collection: 'properties' | 'vehicles', id: string) => void;
}) {
  const investmentOptions = [
    { value: 'stocks', label: 'Akcje' },
    { value: 'etf', label: 'ETF' },
    { value: 'funds', label: 'Fundusze' },
    { value: 'bonds', label: 'Obligacje' },
    { value: 'crypto', label: 'Kryptowaluty' },
  ];

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
      <FieldGroup label="Oszczędności i gotówka (PLN)" error={errors['savings']}>
        <CurrencyInput
          value={data.savings}
          onValueChange={(amount) => onChange({ savings: amount })}
          placeholder="np. 20 000"
        />
      </FieldGroup>

      <div>
        <label className="mb-2 block text-sm font-medium text-primary">
          Fundusz awaryjny – na ile miesięcy wystarczy?
        </label>
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
            {data.emergencyFundMonths} mies.
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-muted/60 bg-muted/30 p-4">
        <p className="mb-2 text-sm font-medium text-primary">
          Inwestycje (zaznacz co pasuje)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {investmentOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-muted/60 bg-card px-3 py-2 text-sm"
            >
              <Checkbox
                checked={data.investments.categories.includes(option.value)}
                onCheckedChange={(checked) =>
                  toggleInvestment(option.value, Boolean(checked))
                }
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="mt-3">
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
            placeholder="Łączna wartość (PLN)"
          />
        </div>
      </div>

      <PropertySection
        title="Nieruchomości"
        items={data.properties}
        onAdd={() => onAddProperty('properties')}
        onUpdate={(id, updates) =>
          onUpdateProperty('properties', id, updates)
        }
        onRemove={(id) => onRemoveProperty('properties', id)}
      />

      <PropertySection
        title="Pojazdy"
        items={data.vehicles}
        onAdd={() => onAddProperty('vehicles')}
        onUpdate={(id, updates) => onUpdateProperty('vehicles', id, updates)}
        onRemove={(id) => onRemoveProperty('vehicles', id)}
      />

      <FormFooter onNext={onNext} onBack={onBack} onSkip={onSkip} />
    </div>
  );
}

function PropertySection({
  title,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  items: PropertyItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<PropertyItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-muted/60 bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-primary">{title}</p>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Dodaj
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-secondary">
          Brak danych – możesz dodać pozycję, ale to krok opcjonalny.
        </p>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-md border border-muted bg-card p-3 sm:flex-row"
          >
            <Input
              value={item.name}
              onChange={(event) =>
                onUpdate(item.id, { name: event.target.value })
              }
              placeholder="Nazwa / opis"
            />
            <CurrencyInput
              value={item.value}
              onValueChange={(amount) =>
                onUpdate(item.id, { value: amount })
              }
              placeholder="Wartość (PLN)"
            />
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsStep({
  goals,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
  onBack,
  onSkip,
  errors,
}: StepBaseProps & {
  goals: GoalItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<GoalItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-secondary">
        Określ swoje cele finansowe – nawet jeden cel pomoże zbudować jasny plan
        działania.
      </p>

      {errors['goals'] && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {errors['goals']}
        </div>
      )}

      <div className="space-y-4">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className="space-y-3 rounded-lg border border-muted/60 bg-muted/30 p-4"
          >
            <FieldGroup label="Nazwa celu" error={errors[`goals.${goal.id}.name`]}>
              <Input
                value={goal.name}
                onChange={(event) =>
                  onUpdate(goal.id, { name: event.target.value })
                }
                placeholder="np. Poduszka bezpieczeństwa"
              />
            </FieldGroup>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup label="Typ celu">
                <Select
                  value={goal.type}
                  onValueChange={(value) =>
                    onUpdate(goal.id, {
                      type: value as GoalItem['type'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Krótki (do 12 miesięcy)</SelectItem>
                    <SelectItem value="medium">
                      Średni (1–3 lata)
                    </SelectItem>
                    <SelectItem value="long">Długi (&gt; 3 lata)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>

              <FieldGroup label="Kwota docelowa (PLN)">
                <CurrencyInput
                  value={goal.targetAmount}
                  onValueChange={(amount) =>
                    onUpdate(goal.id, {
                      targetAmount: amount,
                    })
                  }
                  placeholder="np. 30 000"
                />
              </FieldGroup>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup label="Termin realizacji">
                <Input
                  type="date"
                  value={goal.targetDate ?? ''}
                  onChange={(event) =>
                    onUpdate(goal.id, { targetDate: event.target.value })
                  }
                />
              </FieldGroup>
              <FieldGroup label="Priorytet (1–5)">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={goal.priority}
                  onChange={(event) =>
                    onUpdate(goal.id, {
                      priority: Number(event.target.value) || 1,
                    })
                  }
                />
              </FieldGroup>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => onRemove(goal.id)}
            >
              <Trash2 className="h-4 w-4" />
              Usuń cel
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="inline-flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Dodaj kolejny cel
      </Button>

      <FormFooter
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        nextLabel="Przejdź do podsumowania"
      />
    </div>
  );
}

function SummaryStep({
  data,
  metrics,
  onBack,
  onReset,
  onFinish,
  formatMoney,
}: {
  data: OnboardingData;
  metrics: OnboardingMetrics;
  onBack: () => void;
  onReset: () => void;
  onFinish: () => void;
  formatMoney: (value: number) => string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Miesięczny dochód"
          value={formatMoney(metrics.monthlyIncome)}
          tone="positive"
        />
        <SummaryCard
          title="Miesięczne wydatki"
          value={formatMoney(metrics.totalExpenses)}
          tone="neutral"
        />
        <SummaryCard
          title="Nadwyżka miesięczna"
          value={formatMoney(metrics.surplus)}
          tone={metrics.surplus >= 0 ? 'positive' : 'warning'}
        />
        <SummaryCard
          title="Wartość netto"
          value={formatMoney(metrics.netWorth)}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoPanel
          title="Dochody"
          items={[
            ['Wynagrodzenie', formatMoney(data.income.salaryNet)],
            [
              'Źródła dodatkowe',
              formatMoney(
                Object.values(data.income.additionalSources).reduce(
                  (sum, src) => sum + (src.enabled ? src.amount : 0),
                  0
                )
              ),
            ],
            [
              'Dochody nieregularne',
              formatMoney(data.income.irregularIncomeAnnual / 12),
            ],
            ...(data.life.taxForm
              ? ([
                  ['Forma opodatkowania', TAX_FORM_LABELS[data.life.taxForm]],
                ] as Array<[string, string]>)
              : []),
          ]}
        />
        <InfoPanel
          title="Wydatki i zobowiązania"
          items={[
            [
              'Koszty stałe',
              formatMoney(
                data.expenses.housing +
                  data.expenses.utilities +
                  data.expenses.transport +
                  data.expenses.food +
                  data.expenses.entertainment +
                  data.expenses.other
              ),
            ],
            [
              'Raty miesięczne',
              formatMoney(metrics.liabilitiesMonthly),
            ],
            ['DTI', `${metrics.dti.toFixed(0)}%`],
          ]}
        />
        <InfoPanel
          title="Aktywa"
          items={[
            ['Oszczędności', formatMoney(data.assets.savings)],
            [
              'Inwestycje',
              formatMoney(data.assets.investments.totalValue),
            ],
            [
              'Wartość nieruchomości',
              formatMoney(
                data.assets.properties.reduce(
                  (sum, item) => sum + item.value,
                  0
                )
              ),
            ],
            [
              'Pokrycie poduszką',
              `${metrics.emergencyCoverage.toFixed(1)} mies.`,
            ],
          ]}
        />
        <InfoPanel
          title="Cele"
          items={
            data.goals.length === 0
              ? [['Brak zdefiniowanych celów', '—']]
              : data.goals.map((goal) => [
                  goal.name,
                  `${formatMoney(goal.targetAmount)} • priorytet ${goal.priority}`,
                ])
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onReset}>
          Zacznij od nowa
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack}>
            Wstecz
          </Button>
          <Button onClick={onFinish}>Zakończ i przejdź do aplikacji</Button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  children,
  error,
  hint,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-primary">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {hint && <p className="mb-2 text-xs text-secondary">{hint}</p>}
      <div>{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone = 'neutral',
}: {
  title: string;
  value: string;
  tone?: 'positive' | 'neutral' | 'warning';
}) {
  const toneClasses =
    tone === 'positive'
      ? 'bg-success/15 text-success'
      : tone === 'warning'
      ? 'bg-warning/15 text-warning-foreground'
      : 'bg-muted';

  return (
    <div className={`rounded-lg border border-muted/60 p-4 ${toneClasses}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function InfoPanel({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="rounded-lg border border-muted/60 bg-card p-4">
      <p className="mb-3 text-sm font-semibold text-primary">{title}</p>
      <dl className="space-y-2 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="text-secondary">{label}</dt>
            <dd className="font-medium text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
