'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  Smile,
  User,
  Wallet,
  Home,
  Car,
  TrendingDown,
  TrendingUp,
  Target,
  Info,
  Plus,
  Trash2,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Baby,
  Heart,
  CreditCard,
  Tv,
  ShoppingBag,
  PawPrint,
  ShieldCheck,
  Lightbulb,
  X,
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
import { cn } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
  BarElement,
} from 'chart.js';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, ChartTooltip);

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

const ADDITIONAL_SOURCE_TOOLTIPS: Partial<
  Record<keyof OnboardingData['income']['additionalSources'], string>
> = {
  rental: 'Podaj kwotę, którą faktycznie otrzymujesz co miesiąc po odjęciu kosztów.',
  bonuses: 'Średnia miesięczna wysokość premii lub nagród z ostatnich 12 miesięcy.',
  freelance: 'Oszacuj przeciętną miesięczną wartość zleceń lub umów o dzieło.',
  benefits: 'Świadczenia socjalne, emerytura, renta – wskaż, co wpływa regularnie.',
  childBenefit: 'Kwota naliczana na podstawie liczby dzieci (maks. 800 zł na dziecko).',
};

const EXPENSE_CATEGORY_VALUES = [
  'housing',
  'transportation',
  'food',
  'utilities',
  'insurance',
  'healthcare',
  'entertainment',
  'other',
] as const;

type ExpenseBackendCategory = typeof EXPENSE_CATEGORY_VALUES[number];

type ExpenseGroupKey =
  | 'home'
  | 'transport'
  | 'food'
  | 'family'
  | 'lifestyle'
  | 'subscriptions'
  | 'obligations'
  | 'pets'
  | 'insurance'
  | 'other';

interface ExpenseTemplateItem {
  id: string;
  name: string;
  category?: ExpenseBackendCategory;
}

interface ExpenseGroupDefinition {
  key: ExpenseGroupKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultCategory: ExpenseBackendCategory;
  items: ExpenseTemplateItem[];
}

export interface OnboardingExpenseItem {
  id: string;
  templateId?: string;
  name: string;
  amount: number;
  category: ExpenseBackendCategory;
  isCustom?: boolean;
}

export type OnboardingExpenses = Record<ExpenseGroupKey, OnboardingExpenseItem[]>;

interface LiabilityItem {
  id: string;
  type: string;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate?: number | null;
  endDate?: string;
  purpose?: string;
  repaymentType?: 'equal' | 'decreasing' | '';
  propertyValue?: number | null;
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

const EXPENSE_GROUPS: ExpenseGroupDefinition[] = [
  {
    key: 'home',
    title: 'Dom i mieszkanie',
    description: 'Stałe koszty utrzymania mieszkania wraz z mediami i drobnymi naprawami.',
    icon: Home,
    defaultCategory: 'housing',
    items: [
      { id: 'home-rent', name: 'Czynsz / kredyt hipoteczny' },
      {
        id: 'home-utilities',
        name: 'Media (prąd, gaz, woda, ogrzewanie)',
        category: 'utilities',
      },
      {
        id: 'home-internet',
        name: 'Internet, telefon, telewizja',
        category: 'utilities',
      },
      { id: 'home-maintenance', name: 'Wyposażenie / drobne naprawy' },
    ],
  },
  {
    key: 'transport',
    title: 'Transport i samochód',
    description: 'Dojeżdżanie, ubezpieczenia oraz utrzymanie pojazdów.',
    icon: Car,
    defaultCategory: 'transportation',
    items: [
      { id: 'transport-fuel', name: 'Paliwo' },
      {
        id: 'transport-insurance',
        name: 'Ubezpieczenie OC/AC',
        category: 'insurance',
      },
      { id: 'transport-service', name: 'Serwis i przeglądy' },
      { id: 'transport-leasing', name: 'Leasing / rata' },
      { id: 'transport-public', name: 'Bilety komunikacji miejskiej' },
    ],
  },
  {
    key: 'food',
    title: 'Żywność i zakupy codzienne',
    description: 'Codzienne zakupy i posiłki na mieście.',
    icon: ShoppingBag,
    defaultCategory: 'food',
    items: [
      { id: 'food-groceries', name: 'Zakupy spożywcze' },
      { id: 'food-dining', name: 'Obiady / jedzenie na mieście' },
      { id: 'food-coffee', name: 'Kawa / przekąski' },
    ],
  },
  {
    key: 'family',
    title: 'Rodzina i dzieci',
    description: 'Opieka nad dziećmi, szkoła oraz rodzinne wydatki.',
    icon: Baby,
    defaultCategory: 'other',
    items: [
      { id: 'family-education', name: 'Przedszkole / szkoła / zajęcia' },
      { id: 'family-clothes', name: 'Ubrania' },
      { id: 'family-activities', name: 'Opieka / wyjazdy / prezenty' },
    ],
  },
  {
    key: 'lifestyle',
    title: 'Zdrowie i styl życia',
    description: 'Aktywność fizyczna oraz zdrowie Twojej rodziny.',
    icon: Heart,
    defaultCategory: 'healthcare',
    items: [
      { id: 'lifestyle-fitness', name: 'Siłownia / fitness / karnety' },
      { id: 'lifestyle-medicine', name: 'Leki / wizyty lekarskie' },
      { id: 'lifestyle-care', name: 'Kosmetyki / fryzjer' },
    ],
  },
  {
    key: 'subscriptions',
    title: 'Abonamenty i subskrypcje',
    description: 'Usługi online, rozrywka oraz dodatkowe ubezpieczenia.',
    icon: Tv,
    defaultCategory: 'utilities',
    items: [
      { id: 'subscriptions-streaming', name: 'Netflix / Spotify / YouTube Premium' },
      { id: 'subscriptions-apps', name: 'Aplikacje i narzędzia online' },
      {
        id: 'subscriptions-insurance',
        name: 'Ubezpieczenia dodatkowe',
        category: 'insurance',
      },
    ],
  },
  {
    key: 'obligations',
    title: 'Zobowiązania finansowe',
    description: 'Regularne płatności kredytowe i pożyczki.',
    icon: CreditCard,
    defaultCategory: 'other',
    items: [
      { id: 'obligations-loans', name: 'Raty kredytów' },
      { id: 'obligations-cards', name: 'Karty kredytowe' },
      { id: 'obligations-private', name: 'Pożyczki prywatne' },
    ],
  },
  {
    key: 'pets',
    title: 'Zwierzęta i hobby',
    description: 'Koszty opieki nad zwierzętami oraz rozwijania pasji i zainteresowań.',
    icon: PawPrint,
    defaultCategory: 'other',
    items: [
      { id: 'pets-animals', name: 'Zwierzęta domowe (karma, weterynarz)' },
      { id: 'pets-hobby', name: 'Hobby i pasje (fotografia, wędkarstwo, gry)' },
    ],
  },
  {
    key: 'insurance',
    title: 'Ubezpieczenia i ochrona',
    description: 'Zabezpieczenie zdrowia, życia oraz majątku.',
    icon: ShieldCheck,
    defaultCategory: 'insurance',
    items: [
      { id: 'insurance-health', name: 'Ubezpieczenie zdrowotne / na życie' },
      { id: 'insurance-home', name: 'Ubezpieczenie domu / sprzętu' },
    ],
  },
  {
    key: 'other',
    title: 'Inne / rozrywka',
    description: 'Pozostałe przyjemności, prezenty i spontaniczne wydatki.',
    icon: Smile,
    defaultCategory: 'entertainment',
    items: [
      { id: 'other-leisure', name: 'Kino / restauracje / wyjazdy' },
      { id: 'other-gifts', name: 'Prezenty i okazjonalne zakupy' },
      { id: 'other-misc', name: 'Inne drobne wydatki' },
    ],
  },
];

const createDefaultExpenses = (): OnboardingExpenses => {
  const result = {} as OnboardingExpenses;
  for (const group of EXPENSE_GROUPS) {
    result[group.key] = group.items.map((item) => ({
      id: item.id,
      templateId: item.id,
      name: item.name,
      amount: 0,
      category: item.category ?? group.defaultCategory,
      isCustom: false,
    }));
  }
  return result;
};

const EXPENSE_GROUP_HINTS: Record<ExpenseGroupKey, string> = {
  home: 'Znając koszty mieszkania, możemy lepiej zaplanować Twoją poduszkę finansową.',
  transport: 'Stałe koszty transportu pomagają ocenić, czy samochód lub dojazdy są optymalne.',
  food: 'Budżet na żywność pokazuje największe nawyki zakupowe i możliwości oszczędności.',
  family: 'Wydatki rodzinne i dziecięce pozwolą nam zaproponować lepiej dopasowane cele edukacyjne.',
  lifestyle: 'Inwestycje w zdrowie i styl życia wpływają na Twoją kondycję finansową.',
  subscriptions: 'Subskrypcje często umykają z pola widzenia – zapisz je, aby mieć nad nimi kontrolę.',
  obligations: 'Śledzenie zobowiązań ułatwia zarządzanie płynnością i minimalizuje ryzyko zadłużenia.',
  pets: 'Koszty zwierzaków i hobby pokażą, ile faktycznie przeznaczasz na przyjemności i pasje.',
  insurance: 'Znając Twoje ubezpieczenia, możemy ocenić, czy korzystasz z odpowiedniej ochrony.',
  other: 'Drobne wydatki również potrafią rosnąć – zsumuj je, aby nic nie umknęło uwadze.',
};

const createFlagState = (initial: boolean) =>
  EXPENSE_GROUPS.reduce(
    (acc, group) => {
      acc[group.key] = initial;
      return acc;
    },
    {} as Record<ExpenseGroupKey, boolean>
  );

type LegacyExpenses = {
  housing?: number;
  utilities?: number;
  transport?: number;
  food?: number;
  entertainment?: number;
  other?: number;
};

const sanitizeAmount = (value: unknown): number => {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value)
      : 0;
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const isValidExpenseCategory = (value: unknown): value is ExpenseBackendCategory =>
  typeof value === 'string' &&
  EXPENSE_CATEGORY_VALUES.includes(value as ExpenseBackendCategory);

const convertLegacyExpenses = (legacy: LegacyExpenses): OnboardingExpenses => {
  const result = createDefaultExpenses();
  const mapping: Array<{ legacyKey: keyof LegacyExpenses; group: ExpenseGroupKey; itemId: string }> = [
    { legacyKey: 'housing', group: 'home', itemId: 'home-rent' },
    { legacyKey: 'utilities', group: 'home', itemId: 'home-utilities' },
    { legacyKey: 'transport', group: 'transport', itemId: 'transport-fuel' },
    { legacyKey: 'food', group: 'food', itemId: 'food-groceries' },
    { legacyKey: 'entertainment', group: 'other', itemId: 'other-leisure' },
    { legacyKey: 'other', group: 'other', itemId: 'other-misc' },
  ];

  for (const { legacyKey, group, itemId } of mapping) {
    const amount = sanitizeAmount(legacy[legacyKey]);
    if (amount > 0) {
      const target = result[group].find((item) => item.id === itemId);
      if (target) {
        target.amount = amount;
      } else {
        result[group].push({
          id: ensureId(`${group}-legacy`),
          templateId: itemId,
          name: itemId,
          amount,
          category: EXPENSE_GROUPS.find((g) => g.key === group)?.defaultCategory ?? 'other',
          isCustom: true,
        });
      }
    }
  }

  return result;
};

const normalizeExpenses = (value: unknown): OnboardingExpenses => {
  if (!value || typeof value !== 'object') {
    return createDefaultExpenses();
  }

  const legacyCandidate = value as LegacyExpenses;
  if (Object.prototype.hasOwnProperty.call(legacyCandidate, 'housing')) {
    return convertLegacyExpenses(legacyCandidate);
  }

  const base = createDefaultExpenses();
  const record = value as Record<string, unknown>;

  for (const group of EXPENSE_GROUPS) {
    const incomingItems = Array.isArray(record[group.key])
      ? (record[group.key] as Array<Record<string, unknown>>)
      : [];

    const defaults = base[group.key];
    const customItems: OnboardingExpenseItem[] = [];

    incomingItems.forEach((raw) => {
      if (!raw || typeof raw !== 'object') return;
      const rawId = typeof raw.id === 'string' ? raw.id : undefined;
      const rawTemplateId = typeof raw.templateId === 'string' ? raw.templateId : rawId;
      const targetIndex = defaults.findIndex((item) => item.id === rawTemplateId);
      const amount = sanitizeAmount(raw.amount);
      const categoryCandidate = raw.category;
      const category = isValidExpenseCategory(categoryCandidate)
        ? categoryCandidate
        : group.defaultCategory;
      const rawName =
        typeof raw.name === 'string' && raw.name.trim().length > 0
          ? raw.name.trim()
          : undefined;

      if (targetIndex >= 0) {
        defaults[targetIndex] = {
          ...defaults[targetIndex],
          amount,
        };
      } else {
        customItems.push({
          id: rawId ?? ensureId(`${group.key}-custom`),
          templateId: rawTemplateId,
          name: rawName ?? 'Własny wydatek',
          amount,
          category,
          isCustom: true,
        });
      }
    });

    base[group.key] = [...defaults, ...customItems];
  }

  return base;
};

const mergeExpensesData = (
  current: OnboardingExpenses,
  incoming?: unknown
): OnboardingExpenses => {
  const normalizedCurrent = normalizeExpenses(current);
  if (!incoming) {
    return normalizedCurrent;
  }
  const normalizedIncoming = normalizeExpenses(incoming);
  const result = {} as OnboardingExpenses;

  for (const group of EXPENSE_GROUPS) {
    const defaultsOrder = group.items.map((item) => item.id);
    const currentItems = normalizedCurrent[group.key] ?? [];
    const incomingItems = normalizedIncoming[group.key] ?? [];
    const map = new Map<string, OnboardingExpenseItem>();

    currentItems.forEach((item) => {
      map.set(item.id, { ...item });
    });

    incomingItems.forEach((item) => {
      const existing = map.get(item.id);
      if (existing) {
        map.set(item.id, {
          ...existing,
          amount:
            existing.amount > 0
              ? existing.amount
              : sanitizeAmount(item.amount),
          category: isValidExpenseCategory(item.category)
            ? item.category
            : existing.category,
          name:
            existing.isCustom && item.name
              ? item.name
              : existing.name,
        });
      } else {
        map.set(item.id || ensureId(`${group.key}-expense`), {
          ...item,
          id: item.id || ensureId(`${group.key}-expense`),
          name: item.name || 'Wydatek',
          amount: sanitizeAmount(item.amount),
          category: isValidExpenseCategory(item.category)
            ? item.category
            : group.defaultCategory,
          isCustom: item.isCustom ?? !defaultsOrder.includes(item.id || ''),
        });
      }
    });

    const ordered: OnboardingExpenseItem[] = [];
    defaultsOrder.forEach((id) => {
      const item = map.get(id);
      if (item) {
        ordered.push({
          ...item,
          amount: sanitizeAmount(item.amount),
          isCustom: item.isCustom ?? false,
        });
        map.delete(id);
      }
    });

    map.forEach((item) => {
      ordered.push({
        ...item,
        amount: sanitizeAmount(item.amount),
        category: isValidExpenseCategory(item.category)
          ? item.category
          : group.defaultCategory,
        isCustom: item.isCustom ?? true,
      });
    });

    result[group.key] = ordered;
  }

  return result;
};

const flattenExpenses = (expenses: OnboardingExpenses): OnboardingExpenseItem[] =>
  Object.values(expenses).flatMap((items) => items ?? []);

const sumExpenses = (expenses: OnboardingExpenses): number =>
  flattenExpenses(expenses).reduce((sum, item) => sum + (item.amount || 0), 0);

const expensesHaveValues = (expenses: OnboardingExpenses): boolean =>
  flattenExpenses(expenses).some((item) => item.amount > 0);

const expenseGroupTotals = (
  expenses: OnboardingExpenses
): Array<{ key: ExpenseGroupKey; title: string; total: number }> =>
  EXPENSE_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    total: (expenses[group.key] ?? []).reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    ),
  }));

type AmountTone = 'low' | 'medium' | 'high';

const toneClassMap: Record<AmountTone, string> = {
  low: 'text-success',
  medium: 'text-warning',
  high: 'text-destructive',
};

const getShareTone = (share: number): AmountTone => {
  if (share <= 0.2) return 'low';
  if (share <= 0.35) return 'medium';
  return 'high';
};

const getTotalTone = (total: number, monthlyIncome?: number): AmountTone => {
  if (monthlyIncome && monthlyIncome > 0) {
    const ratio = total / monthlyIncome;
    if (ratio <= 0.4) return 'low';
    if (ratio <= 0.7) return 'medium';
    return 'high';
  }
  if (total <= 2000) return 'low';
  if (total <= 4000) return 'medium';
  return 'high';
};

const flattenTotals = (expenses: OnboardingExpenses) =>
  EXPENSE_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    total: (expenses[group.key] ?? []).reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    ),
  }));

const flattenExpenseItems = flattenExpenses;
export interface OnboardingData {
  life: {
    maritalStatus: 'single' | 'relationship' | 'married' | '';
    includePartnerFinances: boolean;
    childrenCount: number;
    childrenAgeRange?: '0-6' | '7-12' | '13+' | 'mixed' | '';
    housingType: 'rent' | 'mortgage' | 'owned' | '';
    hasMortgage?: boolean;
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
  expenses: OnboardingExpenses;
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
    childrenAgeRange: '',
    housingType: '',
    hasMortgage: false,
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
  expenses: createDefaultExpenses(),
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

const SALARY_DISTRIBUTION_POINTS: Array<{ income: number; percentile: number }> = [
  { income: 0, percentile: 2 },
  { income: 2000, percentile: 12 },
  { income: 3000, percentile: 27 },
  { income: 4000, percentile: 41 },
  { income: 5000, percentile: 55 },
  { income: 6000, percentile: 66 },
  { income: 7000, percentile: 75 },
  { income: 9000, percentile: 85 },
  { income: 11000, percentile: 91 },
  { income: 13000, percentile: 95 },
  { income: 16000, percentile: 97 },
  { income: 20000, percentile: 99 },
  { income: 25000, percentile: 99.5 },
  { income: 30000, percentile: 99.8 },
];
const MIN_SALARY_IN_CHART = SALARY_DISTRIBUTION_POINTS[0].income;
const MAX_SALARY_IN_CHART =
  SALARY_DISTRIBUTION_POINTS[SALARY_DISTRIBUTION_POINTS.length - 1].income;

const mergeOnboardingData = (
  current: OnboardingData,
  incoming: OnboardingData
): OnboardingData => {
  const pickString = <T extends string>(currentValue: T, incomingValue?: T): T =>
    (currentValue && currentValue.length > 0 ? currentValue : incomingValue ?? currentValue);

  const pickBoolean = (currentValue: boolean, incomingValue?: boolean): boolean =>
    typeof incomingValue === 'boolean' ? incomingValue : currentValue;

  const pickNumber = (currentValue: number, incomingValue?: number): number =>
    currentValue > 0 ? currentValue : incomingValue && incomingValue > 0 ? incomingValue : currentValue;

  const mergedLife: OnboardingData['life'] = {
    maritalStatus: pickString(current.life.maritalStatus, incoming.life?.maritalStatus),
    includePartnerFinances: pickBoolean(
      current.life.includePartnerFinances,
      incoming.life?.includePartnerFinances
    ),
    childrenCount:
      current.life.childrenCount > 0
        ? current.life.childrenCount
        : incoming.life?.childrenCount ?? current.life.childrenCount,
    childrenAgeRange: pickString(
      current.life.childrenAgeRange ?? '',
      incoming.life?.childrenAgeRange
    ),
    housingType: pickString(current.life.housingType, incoming.life?.housingType),
    hasMortgage: pickBoolean(current.life.hasMortgage ?? false, incoming.life?.hasMortgage),
    employmentStatus: pickString(current.life.employmentStatus, incoming.life?.employmentStatus),
    taxForm: pickString(current.life.taxForm, incoming.life?.taxForm),
    householdCost: pickNumber(current.life.householdCost, incoming.life?.householdCost),
  };

  if (mergedLife.childrenCount <= 0) {
    mergedLife.childrenAgeRange = '';
  }
  if (mergedLife.maritalStatus === 'single') {
    mergedLife.includePartnerFinances = false;
  }
  if (mergedLife.housingType !== 'mortgage') {
    mergedLife.hasMortgage = false;
  }
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

  const mergedExpenses = mergeExpensesData(current.expenses, incoming.expenses);

  const mergedLiabilities =
    current.liabilities.length > 0
      ? current.liabilities.map((item) => ({
          ...item,
          purpose: item.purpose ?? '',
          repaymentType: item.repaymentType ?? '',
          propertyValue: item.propertyValue ?? null,
        }))
      : (incoming.liabilities?.map((item) => ({
          ...item,
          id: item.id || ensureId('liability'),
          purpose: item.purpose ?? '',
          repaymentType: item.repaymentType ?? '',
          propertyValue: item.propertyValue ?? null,
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
    life.householdCost > 0 ||
    Boolean(life.childrenAgeRange) ||
    Boolean(life.hasMortgage);

  const incomeHasValues =
    income.salaryNet > 0 ||
    income.irregularIncomeAnnual > 0 ||
    Object.values(income.additionalSources).some(
      (src) => src.enabled && src.amount > 0
    );

  const expensesHasValues = expensesHaveValues(expenses);

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
    childrenAgeRange: z.enum(['0-6', '7-12', '13+', 'mixed']).optional().or(z.literal('')),
    housingType: z.enum(['rent', 'mortgage', 'owned']),
    hasMortgage: z.boolean().optional(),
    employmentStatus: z.enum(['employee', 'business', 'freelancer', 'unemployed']),
    taxForm: z.enum(TAX_FORM_OPTIONS).or(z.literal('')),
    householdCost: z.number().min(0, 'Kwota nie może być ujemna'),
  })
  .superRefine((value, ctx) => {
    if (value.employmentStatus === 'business' && !value.taxForm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxForm'],
        message: 'Wybierz formę opodatkowania',
      });
    }
    if (value.childrenCount > 0 && !value.childrenAgeRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['childrenAgeRange'],
        message: 'Wybierz przedział wiekowy dzieci',
      });
    }
    if (value.maritalStatus === 'single' && value.includePartnerFinances) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['includePartnerFinances'],
        message: 'Dla singla nie uwzględniamy finansów partnera',
      });
    }
    if (value.housingType !== 'mortgage' && value.hasMortgage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hasMortgage'],
        message: 'Zaznacz kredyt hipoteczny tylko gdy mieszkasz we własnym domu z kredytem',
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

const expenseItemSchema = z.object({
  id: z.string(),
  templateId: z.string().optional(),
  name: z.string().min(1, 'Podaj nazwę wydatku'),
  amount: z.number().min(0, 'Kwota nie może być ujemna'),
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  isCustom: z.boolean().optional(),
});

const expensesSchemaShape = EXPENSE_GROUPS.reduce(
  (shape, group) => {
    shape[group.key] = z.array(expenseItemSchema);
    return shape;
  },
  {} as Record<ExpenseGroupKey, z.ZodTypeAny>
);

const expensesSchema = z.object(expensesSchemaShape);

const liabilitySchema = z.object({
  id: z.string(),
  type: z.string().min(1, 'Podaj rodzaj zobowiązania'),
  remainingAmount: z.number().min(0, 'Podaj orientacyjną kwotę pozostałą do spłaty'),
  monthlyPayment: z.number().min(0, 'Podaj miesięczną ratę'),
  interestRate: z.number().min(0).max(100).nullable().optional(),
  endDate: z.string().optional(),
  purpose: z.string().optional(),
  repaymentType: z.enum(['equal', 'decreasing', '']).default(''),
  propertyValue: z.number().min(0).nullable().optional(),
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
    description: 'Sprawdźmy Twoje kredyty i pożyczki',
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
  const [stepVisible, setStepVisible] = useState(true);

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

  useEffect(() => {
    setStepVisible(false);
    const timeout = window.setTimeout(() => {
      setStepVisible(true);
    }, 40);
    return () => window.clearTimeout(timeout);
  }, [currentStepIndex]);

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
      const nextLife: OnboardingData['life'] = {
        ...prev.life,
        ...updates,
      };
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
        if (count === 0) {
          nextLife.childrenAgeRange = '';
        }
      }

      if ((updates.childrenAgeRange && (nextLife.childrenCount ?? 0) <= 0) || nextLife.childrenCount <= 0) {
        nextLife.childrenAgeRange = '';
      }

      if (updates.maritalStatus === 'single') {
        nextLife.includePartnerFinances = false;
      }

      if (updates.housingType && updates.housingType !== 'mortgage') {
        nextLife.hasMortgage = false;
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

  const updateExpenses = (updater: (prev: OnboardingExpenses) => OnboardingExpenses) =>
    setData((prev) => ({
      ...prev,
      expenses: updater(prev.expenses),
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
          purpose: '',
          repaymentType: '',
          propertyValue: null,
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

    const totalExpenses = sumExpenses(data.expenses);

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

  const displayStepNumber = Math.min(Math.max(currentStepIndex, 1), stepsWithoutEdges);
  const nextStepLabel =
    currentStepIndex >= steps.length - 1
      ? null
      : steps[Math.min(currentStepIndex + 1, steps.length - 1)]?.label;

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
              Krok {displayStepNumber} z {stepsWithoutEdges}:{' '}
              <span className="text-primary">{currentStep.label}</span>
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
              <CardDescription
                className={cn(
                  'text-secondary',
                  currentStep.id === 'life' && 'text-primary'
                )}
              >
                {currentStep.id === 'life' ? (
                  <span className="inline-flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    {currentStep.description}
                  </span>
                ) : (
                  currentStep.description
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            'space-y-6 transition-all duration-300',
            stepVisible ? 'opacity-100 translate-y-0' : 'translate-y-2 opacity-0'
          )}
        >
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
              nextLabel={nextStepLabel ? `Dalej → ${nextStepLabel}` : 'Dalej'}
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
              nextLabel={nextStepLabel ? `Dalej → ${nextStepLabel}` : 'Dalej'}
            />
          )}

          {currentStep.id === 'expenses' && (
            <ExpensesStep
              data={data.expenses}
              errors={errors}
              onUpdate={updateExpenses}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
              formatMoney={formatMoney}
              monthlyIncome={metrics.monthlyIncome}
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
              monthlyIncome={metrics.monthlyIncome}
              formatMoney={formatMoney}
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
        <Button type="button" variant="link" onClick={onSkip} className="text-muted-foreground hover:text-primary">
          Pomiń krok
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Wstecz
        </Button>
        <Button type="button" onClick={onNext} className="transition-transform hover:translate-y-[-1px]">
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
  nextLabel,
}: StepBaseProps & {
  data: OnboardingData['life'];
  onChange: (updates: Partial<OnboardingData['life']>) => void;
  nextLabel?: string;
}) {
  const shouldAskPartnerBudget =
    data.maritalStatus === 'relationship' || data.maritalStatus === 'married';

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
          Zrozumiemy Twoją sytuację życiową, aby zaproponować dopasowany plan finansowy.
        </p>
        <p className="mt-1 text-xs text-secondary">
          Kilka spokojnych pytań pozwoli nam przygotować Twój spersonalizowany punkt startowy.
        </p>
      </div>

      <FieldGroup
        label={
          <>
            Stan cywilny{' '}
            <TooltipTrigger text="Dzięki temu dopasujemy pytania do Twojej sytuacji rodzinnej.">
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

      {shouldAskPartnerBudget && (
        <div className="flex items-center justify-between rounded-lg border border-muted/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">
              Czy prowadzicie wspólny budżet?
            </p>
            <p className="text-xs text-secondary">
              Dzięki temu zobaczysz pełny obraz Waszego gospodarstwa domowego.
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

      <FieldGroup
        label={
          <>
            Liczba dzieci{' '}
            <TooltipTrigger text="Uwzględnimy edukację, ubrania i zajęcia dodatkowe w dalszym planie.">
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
          placeholder="np. 2"
        />
      </FieldGroup>

      {data.childrenCount > 0 && (
        <FieldGroup
          label="W jakim wieku są dzieci?"
          error={errors['childrenAgeRange']}
          hint="Dzięki temu dopasujemy rekomendacje oszczędzania i edukacji."
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
              <SelectValue placeholder="Wybierz przedział wiekowy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0-6">0 – 6 lat</SelectItem>
              <SelectItem value="7-12">7 – 12 lat</SelectItem>
              <SelectItem value="13+">13 lat i więcej</SelectItem>
              <SelectItem value="mixed">Różne przedziały wiekowe</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      )}

      <FieldGroup
        label={
          <>
            Typ zamieszkania{' '}
            <TooltipTrigger text="Rata kredytu lub czynsz to często największy stały koszt – warto być precyzyjnym.">
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
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

      {data.housingType === 'mortgage' && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-primary">Masz aktywny kredyt hipoteczny?</p>
            <p className="text-xs text-secondary">
              Dzięki temu dopasujemy rekomendacje dotyczące zadłużenia i poduszki bezpieczeństwa.
            </p>
          </div>
          <Switch
            checked={data.hasMortgage ?? false}
            onCheckedChange={(checked) => onChange({ hasMortgage: checked })}
          />
        </div>
      )}

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
        className="pt-2"
      >
        <CurrencyInput
          value={data.householdCost}
          onValueChange={(amount) => onChange({ householdCost: amount })}
          placeholder="np. 4 800"
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
  nextLabel,
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
  nextLabel?: string;
}) {
  const irregularMonthly = data.irregularIncomeAnnual / 12;
  const additionalEntries: Array<
    [keyof OnboardingData['income']['additionalSources'], string]
  > = [
    ['rental', 'Najem'],
    ['bonuses', 'Premie'],
    ['freelance', 'Zlecenia'],
  ];

  if (childrenCount > 0) {
    additionalEntries.push([
      'childBenefit',
      `Świadczenia 800+ (limit ${formatMoney(childrenCount * 800)})`,
    ]);
  }

  additionalEntries.push(['benefits', 'Pozostałe świadczenia']);

  const activeAdditionalSources = additionalEntries
    .map(([key, label]) => ({ key, label, source: data.additionalSources[key] }))
    .filter(({ source }) => source.enabled);

  const additionalTotal = activeAdditionalSources.reduce(
    (sum, entry) => sum + entry.source.amount,
    0
  );

  const toggleSource = (
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
        amount: enabled ? (source.amount || 0) : 0,
      }
    );
  };

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
          Zobaczmy, z jakich źródeł pochodzą Twoje dochody – to pomoże oszacować potencjał oszczędności i inwestycji.
        </p>
        <p className="mt-1 text-xs text-secondary">
          Im dokładniej określisz wpływy, tym trafniejsze będą kolejne rekomendacje.
        </p>
      </div>

      <FieldGroup
        label={
          <>
            Wynagrodzenie miesięczne (netto){' '}
            <TooltipTrigger text="Kwota, która realnie trafia co miesiąc na Twoje konto po opodatkowaniu.">
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
          placeholder="np. 7 500"
        />
      </FieldGroup>

      <div className="rounded-lg border border-muted/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              Dodatkowe źródła
            </p>
            <p className="text-xs text-secondary">
              Włącz źródła, które regularnie zasilają Twój domowy budżet.
            </p>
          </div>
          {childrenCount > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Masz {childrenCount} {childrenCount === 1 ? 'dziecko' : 'dzieci'} – limit 800+ to {formatMoney(childrenCount * 800)}
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
            const tooltip = ADDITIONAL_SOURCE_TOOLTIPS[key];

            return (
              <div
                key={key}
                className={cn(
                  'flex flex-col gap-2 rounded-md border p-3 transition-colors',
                  source.enabled
                    ? 'border-success/40 bg-success/10 shadow-sm'
                    : 'border-muted/60 bg-muted/40'
                )}
              >
                <label className="flex items-start gap-2 text-sm font-medium text-primary">
                  <Checkbox
                    checked={source.enabled && (!isChildBenefit || childrenCount > 0)}
                    onCheckedChange={(checked) => toggleSource(key, Boolean(checked))}
                    id={`source-${key}`}
                    disabled={isChildBenefit && childrenCount === 0}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      {label}
                      {tooltip && (
                        <TooltipTrigger text={tooltip}>
                          <Info className="h-4 w-4 text-primary" />
                        </TooltipTrigger>
                      )}
                    </span>
                    {isChildBenefit && (
                      <span className="text-xs text-secondary">
                        Limit: {formatMoney(maxBenefit)} (800 zł × liczba dzieci)
                      </span>
                    )}
                  </span>
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
                    placeholder={isChildBenefit ? formatMoney(maxBenefit) : 'np. 1 200'}
                    className="h-9"
                  />
                )}
              </div>
            );
          })}
        </div>

        {activeAdditionalSources.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            <span className="font-medium">Aktywne źródła:</span>
            {activeAdditionalSources.map(({ key, label }) => (
              <span
                key={key}
                className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                {label}
              </span>
            ))}
            <span className="ml-auto font-medium">
              Razem: {formatMoney(additionalTotal)}
            </span>
          </div>
        )}
      </div>

      <FieldGroup
        label={
          <>
            Dochody nieregularne (rocznie){' '}
            <TooltipTrigger text="Przeliczamy roczne premie lub zwroty podatku na miesięczny ekwiwalent.">
              <Info className="h-4 w-4 text-primary" />
            </TooltipTrigger>
          </>
        }
        error={errors['irregularIncomeAnnual']}
        hint="Podaj kwoty netto – to, co realnie trafia na konto."
      >
        <div className="space-y-2">
          <CurrencyInput
            value={data.irregularIncomeAnnual}
            onValueChange={(amount) =>
              onChange({
                irregularIncomeAnnual: amount,
              })
            }
            placeholder="np. 6 000"
          />
          <p className="text-xs text-secondary">
            To odpowiada około{' '}
            <span className="font-medium text-primary">
              {formatMoney(Math.round(irregularMonthly))}
            </span>{' '}
            miesięcznie.
          </p>
        </div>
      </FieldGroup>

      <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            <p className="text-sm font-medium">Łączny miesięczny dochód</p>
          </div>
          <AnimatedAmount
            value={Math.round(monthlyIncome)}
            formatMoney={formatMoney}
            tone="low"
            className="text-xl font-semibold"
          />
        </div>
        <p className="text-xs text-secondary">
          Na podstawie Twoich danych miesięczny dochód netto wynosi{' '}
          <span className="font-medium text-primary">
            {formatMoney(Math.round(monthlyIncome))}
          </span>
          . W kolejnym kroku zobaczymy, jak rozkładają się Twoje wydatki.
        </p>
      </div>

      <SalaryDistributionChart salary={data.salaryNet} formatMoney={formatMoney} />

      <FormFooter
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        nextLabel={nextLabel}
      />
    </form>
  );
}

function ExpensesStep({
  data,
  onUpdate,
  onNext,
  onBack,
  onSkip,
  errors,
  formatMoney,
  monthlyIncome,
}: StepBaseProps & {
  data: OnboardingExpenses;
  onUpdate: (updater: (prev: OnboardingExpenses) => OnboardingExpenses) => void;
  formatMoney: (value: number) => string;
  monthlyIncome: number;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<ExpenseGroupKey, boolean>>(
    () => createFlagState(true)
  );

  const totals = useMemo(() => expenseGroupTotals(data), [data]);
  const totalExpenses = useMemo(() => sumExpenses(data), [data]);
  const totalsByGroup = useMemo(
    () =>
      totals.reduce(
        (acc, entry) => {
          acc[entry.key] = entry.total;
          return acc;
        },
        {} as Record<ExpenseGroupKey, number>
      ),
    [totals]
  );

  const toggleGroup = useCallback((groupKey: ExpenseGroupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

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
      const groupDefinition = EXPENSE_GROUPS.find((group) => group.key === groupKey);
      const newId = ensureId(`${groupKey}-custom`);
      const newItem: OnboardingExpenseItem = {
        id: newId,
        templateId: undefined,
        name: 'Nowy wydatek',
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
    [onUpdate]
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

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
    >
      <div className="rounded-lg border border-muted/50 bg-muted/30 px-4 py-3 text-sm text-secondary">
        Zapisz koszty według kategorii. Możesz dodać własne pozycje w każdej sekcji,
        aby uchwycić wszystkie stałe wydatki.
      </div>

      <div className="space-y-4">
        {EXPENSE_GROUPS.map((group) => {
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

          return (
            <div
              key={group.key}
              className={cn(
                'rounded-xl border border-muted/60 bg-card shadow-sm transition-colors',
                groupHasError && 'border-destructive/50'
              )}
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
                  <p className="text-sm font-semibold text-primary">{group.title}</p>
                  <p className="text-xs text-secondary">{group.description}</p>
                  <p className="text-xs text-secondary/80">
                    {EXPENSE_GROUP_HINTS[group.key]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <AnimatedAmount
                    value={groupTotal}
                    tone={tone}
                    formatMoney={formatMoney}
                    className="text-base font-semibold"
                  />
                  {totalExpenses > 0 && (
                    <span className="text-xs text-secondary">{share}% budżetu</span>
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
                                placeholder="Nazwa wydatku"
                                className="h-9"
                              />
                            ) : (
                              <p className="text-sm font-medium text-primary">{item.name}</p>
                            )}
                            {item.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(group.key, item.id)}
                                className="rounded-full p-1 text-secondary transition-colors hover:text-destructive"
                                aria-label="Usuń wydatek"
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
                              placeholder="np. 400"
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
                    Dodaj własny wydatek
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <span>Łączne miesięczne wydatki</span>
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

function LiabilitiesStep({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onNext,
  onBack,
  onSkip,
  errors,
  monthlyIncome,
  formatMoney,
}: StepBaseProps & {
  items: LiabilityItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<LiabilityItem>) => void;
  onRemove: (id: string) => void;
  monthlyIncome: number;
  formatMoney: (value: number) => string;
}) {
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

  const getCardTitle = (type: string) => {
    switch (type) {
      case 'mortgage':
        return 'Kredyt hipoteczny';
      case 'car':
        return 'Kredyt samochodowy';
      case 'consumer':
        return 'Pożyczka konsumpcyjna';
      case 'card':
        return 'Karta kredytowa / limit';
      case 'line':
        return 'Linia kredytowa';
      case 'leasing':
        return 'Leasing';
      case 'nonbank':
        return 'Pożyczka pozabankowa';
      default:
        return 'Zobowiązanie finansowe';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mortgage':
        return Home;
      case 'car':
        return Car;
      case 'card':
        return Wallet;
      case 'leasing':
        return TrendingDown;
      default:
        return Target;
    }
  };

  const handleTypeChange = (id: string, value: string) => {
    const currentItem = items.find((liability) => liability.id === id);
    onUpdate(id, {
      type: value,
      repaymentType: ['card', 'line'].includes(value) ? '' : (currentItem?.repaymentType || 'equal'),
      propertyValue: value === 'mortgage' ? currentItem?.propertyValue ?? null : null,
    });
  };

  const shouldShowEndDate = (type: string) =>
    !['card', 'line'].includes(type);

  const shouldShowRepaymentType = (type: string) =>
    !['card', 'line', 'nonbank'].includes(type);

  const shouldShowPropertyValue = (type: string) => type === 'mortgage';

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
        <p className="text-sm font-semibold text-primary">
          Zobaczmy, jakie masz kredyty i pożyczki – obliczymy Twój wskaźnik
          zadłużenia (DTI) i pomożemy zaplanować bezpieczną spłatę.
        </p>
        <p className="mt-1 text-xs text-secondary">
          Podaj wartości orientacyjne – liczy się obraz Twojego zadłużenia, nie
          perfekcyjna dokładność.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const Icon = getTypeIcon(item.type);
          const remainingLabel = item.type === 'leasing'
            ? 'Kwota wykupu pozostała (PLN)'
            : 'Kwota pozostała do spłaty (PLN)';
          return (
            <div
              key={item.id}
              className="space-y-4 rounded-xl border border-muted/60 bg-[#fafaf9] p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <Icon className="h-5 w-5" />
                  <p className="text-sm font-semibold">
                    {getCardTitle(item.type)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-full p-1 text-secondary transition-colors hover:text-destructive"
                  aria-label="Usuń zobowiązanie"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup
                  label="Rodzaj zobowiązania"
                  error={errors['type']}
                  required
                >
                  <Select
                    value={item.type}
                    onValueChange={(value) => handleTypeChange(item.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="np. kredyt hipoteczny" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mortgage">Kredyt hipoteczny</SelectItem>
                      <SelectItem value="car">Kredyt samochodowy</SelectItem>
                      <SelectItem value="consumer">
                        Pożyczka konsumpcyjna
                      </SelectItem>
                      <SelectItem value="card">
                        Karta kredytowa / limit
                      </SelectItem>
                      <SelectItem value="line">Linia kredytowa</SelectItem>
                      <SelectItem value="leasing">Leasing</SelectItem>
                      <SelectItem value="nonbank">Pożyczka pozabankowa</SelectItem>
                      <SelectItem value="other">Inne</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup
                  label={
                    <span className="inline-flex items-center gap-1">
                      {remainingLabel}
                      <TooltipTrigger text="Podaj orientacyjną kwotę – wystarczy ostatnia wartość z wyciągu bankowego.">
                        <Info className="h-3.5 w-3.5 text-primary" />
                      </TooltipTrigger>
                    </span>
                  }
                  required
                >
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

                <FieldGroup
                  label={
                    <span className="inline-flex items-center gap-1">
                      Rata miesięczna (PLN)
                      <TooltipTrigger text="Uwzględnij pełną miesięczną ratę – wlicz odsetki i kapitał.">
                        <Info className="h-3.5 w-3.5 text-primary" />
                      </TooltipTrigger>
                    </span>
                  }
                  required
                >
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

                <FieldGroup
                  label="Cel zobowiązania"
                  hint="(opcjonalnie) np. mieszkanie, samochód, sprzęt."
                >
                  <Input
                    value={item.purpose ?? ''}
                    onChange={(event) =>
                      onUpdate(item.id, { purpose: event.target.value })
                    }
                    placeholder="np. zakup mieszkania"
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

                {shouldShowRepaymentType(item.type) && (
                  <FieldGroup
                    label="Forma spłaty"
                    hint="(opcjonalnie)"
                  >
                    <Select
                      value={item.repaymentType || ''}
                      onValueChange={(value) =>
                        onUpdate(item.id, {
                          repaymentType: value as LiabilityItem['repaymentType'],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equal">Raty równe</SelectItem>
                        <SelectItem value="decreasing">Raty malejące</SelectItem>
                        <SelectItem value="">
                          Nie mam pewności / inne
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                )}

                {shouldShowPropertyValue(item.type) && (
                  <FieldGroup
                    label="Wartość nieruchomości (PLN)"
                    hint="(opcjonalnie) pozwoli policzyć wskaźnik LTV."
                  >
                    <CurrencyInput
                      value={item.propertyValue ?? 0}
                      onValueChange={(amount) =>
                        onUpdate(item.id, { propertyValue: amount })
                      }
                      placeholder="np. 520 000"
                    />
                  </FieldGroup>
                )}

                {shouldShowEndDate(item.type) && (
                  <FieldGroup
                    label="Termin zakończenia"
                    hint="(opcjonalnie) data ostatniej raty."
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
          Dodaj kolejne zobowiązanie
        </Button>

        <div className="rounded-lg border border-muted/50 bg-card px-4 py-3 text-xs text-secondary">
          <p>
            Suma miesięcznych rat:{' '}
            <span className="font-semibold text-primary">
              {formatMoney(totals.totalMonthly)}
            </span>
          </p>
          <p>
            Łączne zadłużenie:{' '}
            <span className="font-semibold text-primary">
              {formatMoney(totals.totalRemaining)}
            </span>
          </p>
          <p>
            Twój wskaźnik DTI wynosi{' '}
            <span className="font-semibold text-primary">
              {totals.dti.toFixed(1)}%
            </span>
            . Oznacza to, że{' '}
            <span className="font-semibold text-primary">
              {totals.dti.toFixed(1)}%
            </span>{' '}
            dochodu przeznaczasz na spłatę zobowiązań.
          </p>
        </div>
      </div>

      <FormFooter
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        nextLabel="Dalej → Oszczędności"
      />
    </div>
  );
}


function AnimatedAmount({
  value,
  formatMoney,
  tone = 'low',
  className,
}: {
  value: number;
  formatMoney: (value: number) => string;
  tone?: AmountTone;
  className?: string;
}) {
  const animatedValue = useAnimatedNumber(value);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setBump(true);
    const timeout = window.setTimeout(() => setBump(false), 220);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <span
      className={cn(
        'inline-flex min-w-[4.5rem] justify-end tabular-nums transition-transform duration-200',
        toneClassMap[tone],
        bump && 'scale-[1.04]',
        className
      )}
    >
      {formatMoney(animatedValue)}
    </span>
  );
}

function useAnimatedNumber(value: number, duration = 260) {
  const [display, setDisplay] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const initial = previousValue.current;
    const delta = value - initial;

    if (Math.abs(delta) < 0.01) {
      setDisplay(value);
      previousValue.current = value;
      return;
    }

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      setDisplay(initial + delta * progress);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        previousValue.current = value;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  useEffect(() => {
    previousValue.current = value;
    setDisplay(value);
  }, []);

  return display;
}

function TooltipTrigger({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full p-0 text-primary transition-colors hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="Więcej informacji"
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-md border border-muted/60 bg-card px-3 py-2 text-left text-xs text-secondary shadow-lg transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      >
        {text}
      </span>
    </span>
  );
}

function SalaryDistributionChart({
  salary,
  formatMoney,
}: {
  salary: number;
  formatMoney: (value: number) => string;
}) {
  const { chartData, chartOptions, summaryText } = useMemo(() => {
    const labels = SALARY_DISTRIBUTION_POINTS.map((point) =>
      point.income >= 1000 ? `${Math.round(point.income / 1000)}k` : `${point.income}`
    );

    const clampedSalary = salary > 0
      ? Math.min(Math.max(salary, MIN_SALARY_IN_CHART), MAX_SALARY_IN_CHART)
      : 0;

    let lower = SALARY_DISTRIBUTION_POINTS[0];
    let upper = SALARY_DISTRIBUTION_POINTS[SALARY_DISTRIBUTION_POINTS.length - 1];
    let rangeIndex = SALARY_DISTRIBUTION_POINTS.length - 1;

    if (clampedSalary > 0) {
      for (let i = 0; i < SALARY_DISTRIBUTION_POINTS.length - 1; i += 1) {
        const current = SALARY_DISTRIBUTION_POINTS[i];
        const next = SALARY_DISTRIBUTION_POINTS[i + 1];
        if (clampedSalary >= current.income && clampedSalary <= next.income) {
          lower = current;
          upper = next;
          rangeIndex = Math.min(i + 1, SALARY_DISTRIBUTION_POINTS.length - 1);
          break;
        }
      }
    }

    const baseColors = SALARY_DISTRIBUTION_POINTS.map(() => 'rgba(37, 99, 235, 0.45)');
    const borderColors = SALARY_DISTRIBUTION_POINTS.map(() => 'rgba(37, 99, 235, 0.6)');

    let highlightPercentile = lower.percentile;
    if (clampedSalary > 0) {
      const range = upper.income - lower.income || 1;
      const ratio = (clampedSalary - lower.income) / range;
      highlightPercentile =
        lower.percentile + ratio * (upper.percentile - lower.percentile);
      baseColors[rangeIndex] = 'rgba(22, 163, 74, 0.9)';
      borderColors[rangeIndex] = 'rgba(22, 163, 74, 1)';
    }

    const barDataset = {
      type: 'bar' as const,
      label: 'Procent gospodarstw domowych',
      data: SALARY_DISTRIBUTION_POINTS.map((point) => point.percentile),
      backgroundColor: baseColors,
      borderColor: borderColors,
      borderWidth: 1,
      borderRadius: 6,
      maxBarThickness: 22,
    };

    const chartOptions: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: TooltipItem<'bar'>) =>
              `Percentyl: ${context.parsed.y?.toFixed(0)}%`,
          },
        },
      },
      interaction: { intersect: false, mode: 'nearest' },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 6, color: '#6b7280', font: { size: 10 } },
        },
        y: {
          grid: { display: false },
          ticks: {
            callback: (value: string | number) => (typeof value === 'number' ? `${value}%` : value),
            color: '#6b7280',
            font: { size: 10 },
          },
          min: 0,
          max: 100,
        },
      },
    };

    const chartData: ChartData<'bar'> = {
      labels,
      datasets: [barDataset],
    };

    const percentileRounded = Math.round(highlightPercentile);
    const aboveShare = Math.max(0, 100 - percentileRounded);
    const summaryText =
      salary > 0
        ? `Twój dochód ${formatMoney(salary)} przewyższa około ${aboveShare}% gospodarstw domowych (skala do 30 000 zł netto).`
        : 'Wpisz swoje wynagrodzenie, aby zobaczyć, jak wypadasz na tle innych (wykres pokazuje kwoty do 30 000 zł netto).';

    return { chartData, chartOptions, summaryText };
  }, [salary, formatMoney]);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-muted/50 bg-card px-2 py-2">
        <div style={{ height: 140 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      <p className="text-xs text-secondary">{summaryText}</p>
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
              formatMoney(metrics.totalExpenses),
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
  label: ReactNode;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-primary">
        <span className="inline-flex items-center gap-2">
          {label}
          {required && <span className="text-destructive">*</span>}
        </span>
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
