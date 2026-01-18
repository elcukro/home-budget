'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FileSpreadsheet,
  Baby,
  Heart,
  CreditCard,
  Tv,
  ShoppingBag,
  PawPrint,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import { useIntl, type IntlShape } from 'react-intl';
import { useSession } from 'next-auth/react';
import { logActivity } from '@/utils/activityLogger';
import { logger } from '@/lib/logger';
import { useAnalytics, AnalyticsEvents } from '@/hooks/useAnalytics';

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
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { type AmountTone } from './common/AnimatedAmount';
import WelcomeStep from './steps/WelcomeStep';
import LifeStep from './steps/LifeStep';
import IncomeStep from './steps/IncomeStep';
import ExpensesStep from './steps/ExpensesStep';
import IrregularExpensesStep from './steps/IrregularExpensesStep';
import LiabilitiesStep from './steps/LiabilitiesStep';
import AssetsStep from './steps/AssetsStep';
import GoalsStep from './steps/GoalsStep';
import SummaryStep from './steps/SummaryStep';

const LOCAL_STORAGE_KEY = 'sproutlyfi-onboarding';

type StepId =
  | 'welcome'
  | 'life'
  | 'income'
  | 'expenses'
  | 'irregularExpenses'
  | 'liabilities'
  | 'assets'
  | 'goals'
  | 'summary';

export interface AdditionalSource {
  enabled: boolean;
  amount: number;
}

type SavingPhase =
  | 'prepare'
  | 'income'
  | 'expenses'
  | 'loans'
  | 'savings'
  | 'finalize';

interface SavingProgressUpdate {
  phase: SavingPhase;
  detail?: string;
}

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

export type ExpenseGroupKey =
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

export interface ExpenseGroupDefinition {
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

export type IrregularExpenses = OnboardingExpenseItem[];

const IRREGULAR_EXPENSE_TEMPLATES: Array<{ id: string; labelId: string }> = [
  { id: 'irregular-home-insurance', labelId: 'onboarding.irregularExpenses.items.homeInsurance' },
  { id: 'irregular-trainings', labelId: 'onboarding.irregularExpenses.items.trainings' },
  { id: 'irregular-car-insurance', labelId: 'onboarding.irregularExpenses.items.carInsurance' },
  { id: 'irregular-car-service', labelId: 'onboarding.irregularExpenses.items.carService' },
  { id: 'irregular-domains', labelId: 'onboarding.irregularExpenses.items.domains' },
  { id: 'irregular-real-estate-agency', labelId: 'onboarding.irregularExpenses.items.realEstateAgency' },
  { id: 'irregular-gifts', labelId: 'onboarding.irregularExpenses.items.gifts' },
  { id: 'irregular-clothing', labelId: 'onboarding.irregularExpenses.items.clothing' },
  { id: 'irregular-property-tax', labelId: 'onboarding.irregularExpenses.items.propertyTax' },
  { id: 'irregular-software-hosting', labelId: 'onboarding.irregularExpenses.items.softwareHosting' },
  { id: 'irregular-vacations', labelId: 'onboarding.irregularExpenses.items.vacations' },
  { id: 'irregular-school-textbooks', labelId: 'onboarding.irregularExpenses.items.schoolTextbooks' },
  { id: 'irregular-school-insurance', labelId: 'onboarding.irregularExpenses.items.schoolInsurance' },
  { id: 'irregular-class-fund', labelId: 'onboarding.irregularExpenses.items.classFund' },
  { id: 'irregular-unplanned', labelId: 'onboarding.irregularExpenses.items.unplanned' },
  { id: 'irregular-new-computer', labelId: 'onboarding.irregularExpenses.items.newComputer' },
  { id: 'irregular-robot-vacuum', labelId: 'onboarding.irregularExpenses.items.robotVacuum' },
];

const ensureId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
};

export interface LiabilityItem {
  id: string;
  type: string;
  remainingAmount: number;
  monthlyPayment: number;
  interestRate?: number | null;
  startDate?: string;
  endDate?: string;
  termMonths?: number | null;
  purpose?: string;
  repaymentType?: 'equal' | 'decreasing' | 'unknown';
  propertyValue?: number | null;
  description?: string;
}

export interface PropertyItem {
  id: string;
  name: string;
  value: number;
}

export interface GoalItem {
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
    title: 'Home and housing',
    description: 'Fixed housing costs including utilities and small maintenance.',
    icon: Home,
    defaultCategory: 'housing',
    items: [
      {
        id: 'home-rental-tax',
        name: 'Rental tax payment',
        category: 'housing',
      },
      {
        id: 'home-mortgage',
        name: 'Mortgage repayment',
        category: 'housing',
      },
      { id: 'home-rent', name: 'Apartment rent', category: 'housing' },
      { id: 'home-electricity', name: 'Electricity', category: 'utilities' },
      { id: 'home-gas', name: 'Gas', category: 'utilities' },
      {
        id: 'home-water',
        name: 'Water (above allowance)',
        category: 'utilities',
      },
      { id: 'home-heating', name: 'Heating', category: 'utilities' },
      { id: 'home-phone', name: 'Phone plan', category: 'utilities' },
      {
        id: 'home-tv',
        name: 'Cable / satellite TV',
        category: 'utilities',
      },
      { id: 'home-internet', name: 'Internet', category: 'utilities' },
      { id: 'home-maintenance', name: 'Furnishings / small repairs' },
    ],
  },
  {
    key: 'transport',
    title: 'Transport and car',
    description: 'Commuting, insurance and keeping vehicles running.',
    icon: Car,
    defaultCategory: 'transportation',
    items: [
      { id: 'transport-fuel', name: 'Fuel' },
      {
        id: 'transport-insurance',
        name: 'Car insurance (liability / collision)',
        category: 'insurance',
      },
      { id: 'transport-service', name: 'Service and inspections' },
      { id: 'transport-leasing', name: 'Lease / installment' },
      { id: 'transport-public', name: 'Public transport passes' },
      { id: 'transport-parking', name: 'Parking fees' },
    ],
  },
  {
    key: 'food',
    title: 'Food and daily shopping',
    description: 'Daily groceries and meals out.',
    icon: ShoppingBag,
    defaultCategory: 'food',
    items: [
      { id: 'food-groceries', name: 'Groceries' },
      { id: 'food-dining', name: 'Meals out' },
      { id: 'food-coffee', name: 'Coffee / snacks' },
    ],
  },
  {
    key: 'family',
    title: 'Family and children',
    description: 'Childcare, schooling and family expenses.',
    icon: Baby,
    defaultCategory: 'other',
    items: [
      { id: 'family-education', name: 'Preschool / school / activities' },
      { id: 'family-clothes', name: 'Clothing' },
      { id: 'family-activities', name: 'Care / trips / gifts' },
      {
        id: 'family-extracurricular-son',
        name: 'Extracurricular classes (son)',
      },
      {
        id: 'family-extracurricular-daughter',
        name: 'Extracurricular classes (daughter)',
      },
      { id: 'family-toys', name: 'Toys and accessories' },
      {
        id: 'family-afterschool',
        name: 'After-school care / day room',
      },
    ],
  },
  {
    key: 'lifestyle',
    title: 'Health and lifestyle',
    description: 'Physical activity and your household\'s health.',
    icon: Heart,
    defaultCategory: 'healthcare',
    items: [
      { id: 'lifestyle-fitness', name: 'Gym / fitness / memberships' },
      { id: 'lifestyle-medicine', name: 'Medicine / doctor visits' },
      { id: 'lifestyle-care', name: 'Cosmetics / hairdresser' },
      { id: 'lifestyle-hygiene', name: 'Personal hygiene' },
      {
        id: 'lifestyle-relax',
        name: 'Relaxation & leisure (pool, bowling, theatre)',
      },
      {
        id: 'lifestyle-education',
        name: 'Personal education',
      },
    ],
  },
  {
    key: 'subscriptions',
    title: 'Subscriptions and memberships',
    description: 'Online services, entertainment and extra insurance.',
    icon: Tv,
    defaultCategory: 'utilities',
    items: [
      { id: 'subscriptions-streaming', name: 'Streaming (Netflix, Spotify, YouTube Premium)' },
      { id: 'subscriptions-apps', name: 'Apps and online tools' },
      {
        id: 'subscriptions-insurance',
        name: 'Supplementary insurance',
        category: 'insurance',
      },
    ],
  },
  {
    key: 'obligations',
    title: 'Financial obligations',
    description: 'Regular loan and installment payments.',
    icon: CreditCard,
    defaultCategory: 'other',
    items: [
      { id: 'obligations-loans', name: 'Loan installments' },
      {
        id: 'obligations-card-fees',
        name: 'Monthly credit card fees',
      },
      { id: 'obligations-bank-fees', name: 'Other banking fees' },
      { id: 'obligations-private', name: 'Private loans' },
    ],
  },
  {
    key: 'pets',
    title: 'Pets and hobbies',
    description: 'Costs of caring for pets and pursuing hobbies.',
    icon: PawPrint,
    defaultCategory: 'other',
    items: [
      { id: 'pets-animals', name: 'Pets (food, vet)' },
      { id: 'pets-hobby', name: 'Hobbies and passions (photography, fishing, games)' },
    ],
  },
  {
    key: 'insurance',
    title: 'Insurance and protection',
    description: 'Protecting health, life and property.',
    icon: ShieldCheck,
    defaultCategory: 'insurance',
    items: [
      { id: 'insurance-health', name: 'Health / life insurance' },
      { id: 'insurance-home', name: 'Home / property insurance' },
      { id: 'insurance-personal', name: 'Individual insurance' },
    ],
  },
  {
    key: 'other',
    title: 'Other / leisure',
    description: 'Treats, gifts and spontaneous expenses.',
    icon: Smile,
    defaultCategory: 'entertainment',
    items: [
      { id: 'other-leisure', name: 'Cinema / restaurants / trips' },
      { id: 'other-gifts', name: 'Gifts and occasional shopping' },
      { id: 'other-misc', name: 'Other small expenses' },
      { id: 'other-gambling', name: 'Lottery / gambling' },
      { id: 'other-donations', name: 'Donations and charity' },
    ],
  },
];

const getExpenseTemplateLabel = (
  intl: IntlShape,
  groupKey: ExpenseGroupKey,
  itemId: string,
  fallback: string
) =>
  intl.formatMessage({
    id: `onboarding.expenses.groups.${groupKey}.items.${itemId}`,
    defaultMessage: fallback,
  });

const getCustomExpenseLabel = (intl: IntlShape) =>
  intl.formatMessage({
    id: 'onboarding.expenses.customItem.defaultName',
    defaultMessage: 'New expense',
  });

const getGenericExpenseLabel = (intl: IntlShape) =>
  intl.formatMessage({
    id: 'onboarding.expenses.fallback.genericName',
    defaultMessage: 'Expense',
  });

const createDefaultExpenses = (intl: IntlShape): OnboardingExpenses => {
  const result = {} as OnboardingExpenses;
  for (const group of EXPENSE_GROUPS) {
    result[group.key] = group.items.map((item) => ({
      id: item.id,
      templateId: item.id,
      name: getExpenseTemplateLabel(intl, group.key, item.id, item.name),
      amount: 0,
      category: item.category ?? group.defaultCategory,
      isCustom: false,
    }));
  }
  return result;
};

const EXPENSE_GROUP_HINTS: Record<ExpenseGroupKey, string> = {
  home: 'Knowing your housing costs helps us plan your safety net.',
  transport: 'Tracking transport costs shows whether your car or commute is optimal.',
  food: 'Food spending highlights habits and potential savings.',
  family: 'Family spending helps us tailor education-focused goals.',
  lifestyle: 'Investments in health and lifestyle influence your financial fitness.',
  subscriptions: 'Subscriptions often slip by – log them to stay in control.',
  obligations: 'Tracking obligations makes it easier to manage cash flow.',
  pets: 'Pet and hobby costs show how much you really spend on fun and passions.',
  insurance: 'Understanding your insurance helps assess your coverage.',
  other: 'Small expenses add up – total them so nothing slips through.',
};

// Map onboarding expense groups to backend expense categories
// Backend categories: housing, transportation, food, utilities, insurance, healthcare, entertainment, other
const EXPENSE_CATEGORY_MAP: Record<ExpenseGroupKey, string> = {
  home: 'housing',         // Rent, mortgage, repairs
  transport: 'transportation', // Car, fuel, public transport
  food: 'food',            // Groceries, dining out
  family: 'other',         // Childcare, education, toys (no dedicated category)
  lifestyle: 'entertainment',  // Fitness, beauty, hobbies
  subscriptions: 'entertainment', // Streaming, apps, memberships
  obligations: 'other',    // Alimony, regular payments
  pets: 'other',           // Pet food, vet (no dedicated category)
  insurance: 'insurance',  // All insurance types
  other: 'other',          // Miscellaneous expenses
};

const ADDITIONAL_SOURCE_META: Record<
  keyof OnboardingData['income']['additionalSources'],
  { category: string; labelId: string }
> = {
  rental: {
    category: 'rental',
    labelId: 'onboarding.income.additionalSources.rental',
  },
  bonuses: {
    category: 'other',
    labelId: 'onboarding.income.additionalSources.bonuses',
  },
  freelance: {
    category: 'freelance',
    labelId: 'onboarding.income.additionalSources.freelance',
  },
  benefits: {
    category: 'other',
    labelId: 'onboarding.income.additionalSources.benefits',
  },
  childBenefit: {
    category: 'other',
    labelId: 'onboarding.income.additionalSources.childBenefit',
  },
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const toISODate = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().split('T')[0]
    : date.toISOString().split('T')[0];
};

const differenceInMonths = (start: Date, end: Date) => {
  const startCopy = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCopy = new Date(end.getFullYear(), end.getMonth(), 1);
  const years = endCopy.getFullYear() - startCopy.getFullYear();
  const months = endCopy.getMonth() - startCopy.getMonth();
  const total = years * 12 + months;
  return total > 0 ? total : 1;
};

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

const convertLegacyExpenses = (
  legacy: LegacyExpenses,
  intl: IntlShape
): OnboardingExpenses => {
  const result = createDefaultExpenses(intl);
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
          name: getExpenseTemplateLabel(intl, group, itemId, itemId),
          amount,
          category: EXPENSE_GROUPS.find((g) => g.key === group)?.defaultCategory ?? 'other',
          isCustom: true,
        });
      }
    }
  }

  return result;
};

const normalizeExpenses = (value: unknown, intl: IntlShape): OnboardingExpenses => {
  if (!value || typeof value !== 'object') {
    return createDefaultExpenses(intl);
  }

  const legacyCandidate = value as LegacyExpenses;
  if (Object.prototype.hasOwnProperty.call(legacyCandidate, 'housing')) {
    return convertLegacyExpenses(legacyCandidate, intl);
  }

  const base = createDefaultExpenses(intl);
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
          name: rawName ?? getCustomExpenseLabel(intl),
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
  incoming: unknown,
  intl: IntlShape
): OnboardingExpenses => {
  const normalizedCurrent = normalizeExpenses(current, intl);
  if (!incoming) {
    return normalizedCurrent;
  }
  const normalizedIncoming = normalizeExpenses(incoming, intl);
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
        const fallbackName =
          item.templateId && typeof item.templateId === 'string'
            ? getExpenseTemplateLabel(
                intl,
                group.key,
                item.templateId,
                getGenericExpenseLabel(intl)
              )
            : getGenericExpenseLabel(intl);
        const incomingName =
          typeof item.name === 'string' && item.name.trim().length > 0
            ? item.name
            : fallbackName;
        map.set(item.id || ensureId(`${group.key}-expense`), {
          ...item,
          id: item.id || ensureId(`${group.key}-expense`),
          name: incomingName,
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

const createDefaultIrregularExpenses = (intl: IntlShape): IrregularExpenses =>
  IRREGULAR_EXPENSE_TEMPLATES.map((template) => ({
    id: template.id,
    templateId: template.id,
    name: intl.formatMessage({ id: template.labelId }),
    amount: 0,
    category: 'other',
    isCustom: false,
  }));

const normalizeIrregularExpenses = (
  value: unknown,
  intl: IntlShape
): IrregularExpenses => {
  const defaults = createDefaultIrregularExpenses(intl);
  const defaultsMap = new Map<string, OnboardingExpenseItem>(
    defaults.map((item) => [item.id, item])
  );
  const customItems: IrregularExpenses = [];

  if (Array.isArray(value)) {
    for (const raw of value as Array<Record<string, unknown>>) {
      if (!raw || typeof raw !== 'object') continue;
      const rawId =
        typeof raw.id === 'string' && raw.id.trim().length > 0
          ? raw.id.trim()
          : ensureId('irregular');
      const amount = sanitizeAmount(raw.amount);
      const nameValue =
        typeof raw.name === 'string' && raw.name.trim().length > 0
          ? raw.name.trim()
          : null;
      const isCustom = Boolean(raw.isCustom);

      if (defaultsMap.has(rawId) && !isCustom) {
        const existing = defaultsMap.get(rawId)!;
        defaultsMap.set(rawId, {
          ...existing,
          amount,
          name: nameValue ?? existing.name,
          isCustom: false,
        });
        continue;
      }

      customItems.push({
        id: rawId,
        templateId:
          typeof raw.templateId === 'string' && raw.templateId.trim().length > 0
            ? raw.templateId.trim()
            : rawId,
        name:
          nameValue ??
          intl.formatMessage({
            id: 'onboarding.irregularExpenses.custom.defaultName',
          }),
        amount,
        category: 'other',
        isCustom: true,
      });
    }
  }

  return [...defaultsMap.values(), ...customItems];
};

const mergeIrregularExpenses = (
  current: IrregularExpenses | undefined,
  incoming: unknown,
  intl: IntlShape
): IrregularExpenses => {
  const normalizedCurrent = normalizeIrregularExpenses(current, intl);
  const normalizedIncoming = normalizeIrregularExpenses(incoming, intl);

  const hasMeaningfulValues = (items: IrregularExpenses) =>
    items.some((item) => item.amount > 0 || (item.isCustom && item.name.trim().length > 0));

  if (hasMeaningfulValues(normalizedCurrent)) {
    return normalizedCurrent;
  }

  if (hasMeaningfulValues(normalizedIncoming)) {
    return normalizedIncoming;
  }

  return normalizedCurrent;
};

const sumIrregularExpenses = (expenses: IrregularExpenses): number =>
  expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

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
    employmentStatus: 'employee' | 'b2b' | 'business' | 'contract' | 'freelancer' | 'unemployed' | '';
    taxForm: '' | 'scale' | 'linear' | 'lumpsum' | 'card';
    householdCost: number;
    // Polish tax-specific fields
    birthYear?: number;  // For youth tax relief (ulga dla młodych < 26)
    useAuthorsCosts?: boolean;  // KUP 50% for creators
    ppkEnrolled?: boolean;  // PPK enrollment status (for employees)
    ppkEmployeeRate?: number;  // PPK employee contribution rate (0.5% - 4%)
    ppkEmployerRate?: number;  // PPK employer contribution rate (1.5% - 4%)
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
  irregularExpenses: IrregularExpenses;
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

const createDefaultOnboardingData = (intl: IntlShape): OnboardingData => ({
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
    birthYear: undefined,
    useAuthorsCosts: false,
    ppkEnrolled: undefined,
    ppkEmployeeRate: 0.02,  // 2% default
    ppkEmployerRate: 0.015,  // 1.5% minimum
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
  expenses: createDefaultExpenses(intl),
  irregularExpenses: createDefaultIrregularExpenses(intl),
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
});

export interface OnboardingMetrics {
  monthlyIncome: number;
  regularMonthlyExpenses: number;
  irregularAnnualExpenses: number;
  irregularMonthlyExpenses: number;
  liabilitiesMonthly: number;
  liabilitiesTotal: number;
  assetsTotal: number;
  surplus: number;
  dti: number;
  emergencyCoverage: number;
  netWorth: number;
}

const mergeOnboardingData = (
  current: OnboardingData,
  incoming: OnboardingData,
  intl: IntlShape
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

  const mergedExpenses = mergeExpensesData(
    current.expenses,
    incoming.expenses,
    intl
  );

  const mergedIrregularExpenses = mergeIrregularExpenses(
    current.irregularExpenses,
    incoming.irregularExpenses,
    intl
  );

  const mergedLiabilities =
    current.liabilities.length > 0
      ? current.liabilities.map((item) => ({
          ...item,
          purpose: item.purpose ?? '',
          repaymentType: item.repaymentType ?? 'unknown',
          propertyValue: item.propertyValue ?? null,
        }))
      : (incoming.liabilities?.map((item) => ({
          ...item,
          id: item.id || ensureId('liability'),
          purpose: item.purpose ?? '',
          repaymentType: item.repaymentType ?? 'unknown',
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
    irregularExpenses: mergedIrregularExpenses,
    liabilities: mergedLiabilities,
    assets: mergedAssets,
    goals: mergedGoals,
  };
};

const hasMeaningfulData = (data: OnboardingData): boolean => {
  if (!data) return false;

  const { life, income, expenses, irregularExpenses, liabilities, assets, goals } = data;

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
  const irregularHasValues =
    Array.isArray(irregularExpenses) && irregularExpenses.some((item) => item.amount > 0);

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
    irregularHasValues ||
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

const irregularExpenseSchema = z.object({
  id: z.string(),
  templateId: z.string().optional(),
  name: z.string().min(1, 'Podaj nazwę wydatku'),
  amount: z.number().min(0, 'Kwota nie może być ujemna'),
  isCustom: z.boolean().optional(),
});

const irregularExpensesSchema = z.array(irregularExpenseSchema);

const liabilitySchema = z.object({
  id: z.string(),
  type: z.string().min(1, 'Podaj rodzaj zobowiązania'),
  remainingAmount: z.number().min(0, 'Podaj orientacyjną kwotę pozostałą do spłaty'),
  monthlyPayment: z.number().min(0, 'Podaj miesięczną ratę'),
  interestRate: z.number().min(0).max(100).nullable().optional(),
  endDate: z.string().optional(),
  purpose: z.string().optional(),
  repaymentType: z.enum(['equal', 'decreasing', 'unknown']).default('unknown'),
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
  labelId: string;
  descriptionId: string;
  icon: React.ComponentType<{ className?: string }>;
  validate?: (data: OnboardingData) => z.ZodIssue[] | null;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: 'welcome',
    labelId: 'onboarding.steps.welcome.label',
    descriptionId: 'onboarding.steps.welcome.description',
    icon: Smile,
  },
  {
    id: 'life',
    labelId: 'onboarding.steps.life.label',
    descriptionId: 'onboarding.steps.life.description',
    icon: User,
    validate: (data) => {
      const result = lifeSchema.safeParse(data.life);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'income',
    labelId: 'onboarding.steps.income.label',
    descriptionId: 'onboarding.steps.income.description',
    icon: Wallet,
    validate: (data) => {
      const result = incomeSchema.safeParse(data.income);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'expenses',
    labelId: 'onboarding.steps.expenses.label',
    descriptionId: 'onboarding.steps.expenses.description',
    icon: Home,
    validate: (data) => {
      const result = expensesSchema.safeParse(data.expenses);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'irregularExpenses',
    labelId: 'onboarding.steps.irregularExpenses.label',
    descriptionId: 'onboarding.steps.irregularExpenses.description',
    icon: CalendarClock,
    validate: (data) => {
      const result = irregularExpensesSchema.safeParse(data.irregularExpenses);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'liabilities',
    labelId: 'onboarding.steps.liabilities.label',
    descriptionId: 'onboarding.steps.liabilities.description',
    icon: TrendingDown,
    validate: (data) => {
      if (data.liabilities.length === 0) return null;
      const result = z.array(liabilitySchema).safeParse(data.liabilities);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'assets',
    labelId: 'onboarding.steps.assets.label',
    descriptionId: 'onboarding.steps.assets.description',
    icon: TrendingUp,
    validate: (data) => {
      const result = assetsSchema.safeParse(data.assets);
      return result.success ? null : result.error.issues;
    },
  },
  {
    id: 'goals',
    labelId: 'onboarding.steps.goals.label',
    descriptionId: 'onboarding.steps.goals.description',
    icon: Target,
    validate: (data) => {
      if (data.goals.length === 0) {
        return [
          {
            code: z.ZodIssueCode.custom,
            message: 'onboarding.validation.goalRequired',
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
    labelId: 'onboarding.steps.summary.label',
    descriptionId: 'onboarding.steps.summary.description',
    icon: FileSpreadsheet,
  },
];

type StepErrors = Record<string, string>;

interface OnboardingWizardProps {
  fromPayment?: boolean;
}

export default function OnboardingWizard({ fromPayment = false }: OnboardingWizardProps) {
  const router = useRouter();
  const intl = useIntl();
  const { data: session } = useSession();
  const { track, trackOnboardingStep } = useAnalytics();
  const { formatCurrency: formatCurrencySetting } = useSettings();
  const formatMoney = useCallback(
    (amount: number) => formatCurrencySetting(amount || 0),
    [formatCurrencySetting]
  );
  const taxFormLabels = useMemo(
    () => ({
      '': '',
      scale: intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.scale' }),
      linear: intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.linear' }),
      lumpsum: intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.lumpsum' }),
      card: intl.formatMessage({ id: 'onboarding.life.fields.taxForm.options.card' }),
    }),
    [intl]
  );

  const steps = useMemo(
    () =>
      STEP_DEFINITIONS.map((step) => ({
        ...step,
        label: intl.formatMessage({ id: step.labelId }),
        description: intl.formatMessage({ id: step.descriptionId }),
      })),
    [intl]
  );
  const t = useCallback(
    (id: string, values?: Record<string, string | number>) =>
      intl.formatMessage({ id }, values),
    [intl]
  );
  const [data, setData] = useState<OnboardingData>(() =>
    createDefaultOnboardingData(intl)
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errors, setErrors] = useState<StepErrors>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const hasHydrated = useRef(false);
  const [stepVisible, setStepVisible] = useState(true);
  const [showSavingDialog, setShowSavingDialog] = useState(false);
  const [activeSavingPhase, setActiveSavingPhase] =
    useState<SavingPhase>('prepare');
  const [savingDetail, setSavingDetail] = useState<string | null>(null);
  const savingPhases = useMemo(
    () => [
      { id: 'prepare' as const, label: t('onboarding.savingProgress.steps.prepare') },
      { id: 'income' as const, label: t('onboarding.savingProgress.steps.income') },
      { id: 'expenses' as const, label: t('onboarding.savingProgress.steps.expenses') },
      { id: 'loans' as const, label: t('onboarding.savingProgress.steps.loans') },
      { id: 'savings' as const, label: t('onboarding.savingProgress.steps.savings') },
      { id: 'finalize' as const, label: t('onboarding.savingProgress.steps.finalize') },
    ],
    [t]
  );
  const activeSavingPhaseIndex = Math.max(
    0,
    savingPhases.findIndex((phase) => phase.id === activeSavingPhase)
  );
  const savingProgressPercent =
    savingPhases.length <= 1
      ? 100
      : Math.round(
          (activeSavingPhaseIndex / (savingPhases.length - 1)) * 100
        );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isMounted = true;

    const loadInitialData = async () => {
      let workingData = createDefaultOnboardingData(intl);

      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (stored) {
          const parsed = JSON.parse(stored) as OnboardingData;
          workingData = mergeOnboardingData(
            createDefaultOnboardingData(intl),
            parsed,
            intl
          );
          if (isMounted) {
            setData(workingData);
          }
        }
      } catch (error) {
        logger.warn(
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
                mergeOnboardingData(
                  prev,
                  lastSubmission.data as OnboardingData,
                  intl
                )
              );
            }
          }
        }
      } catch (prefillError) {
        logger.warn('[onboarding] Failed to load previous submission', prefillError);
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
  }, [intl]);

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
        logger.warn('Failed to save onboarding draft', error);
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
      // Track step completion
      trackOnboardingStep(currentStepIndex + 1, step.id);
      setCurrentStepIndex((prev) =>
        Math.min(prev + 1, steps.length - 1)
      );
    },
    [currentStepIndex, data, trackOnboardingStep, steps]
  );

  const handleBack = useCallback(() => {
    setErrors({});
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkipStep = useCallback(() => {
    handleNext({ skipValidation: true });
  }, [handleNext]);

  const handleSkipAll = useCallback(() => {
    track(AnalyticsEvents.ONBOARDING_SKIPPED, { step_reached: currentStepIndex + 1 });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    router.push('/');
  }, [router, track, currentStepIndex]);

  const handleReset = useCallback(() => {
    setData(createDefaultOnboardingData(intl));
    setErrors({});
    setCurrentStepIndex(0);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }, [intl]);

  const syncFinancialData = useCallback(
    async (reportProgress?: (update: SavingProgressUpdate) => void) => {
    const userEmail = session?.user?.email;
    if (!userEmail) {
      logger.warn('[Onboarding] No authenticated user – skipping financial sync');
      return;
    }

    const notify = (phase: SavingPhase, detail?: string) => {
      reportProgress?.({ phase, detail });
    };

    const todayISO = new Date().toISOString().split('T')[0];
    const jsonHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const assertOk = async (response: Response, context: string) => {
      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail =
            body?.detail ||
            body?.error ||
            body?.message ||
            JSON.stringify(body);
        } catch {
          detail = '';
        }
        throw new Error(
          `[Onboarding] ${context} failed: ${
            detail || `${response.status} ${response.statusText}`
          }`
        );
      }
    };

    notify('prepare', t('onboarding.savingProgress.detail.clearing'));

    // --- Income sync ---
    try {
      const existingIncomeRes = await fetch('/api/income');
      if (existingIncomeRes.ok) {
        const existingIncome: Array<Record<string, unknown>> =
          (await existingIncomeRes.json()) ?? [];
        for (const income of existingIncome) {
          const incomeId = Number(income.id);
          if (Number.isFinite(incomeId)) {
            await logActivity({
              entity_type: 'Income',
              operation_type: 'delete',
              entity_id: incomeId,
              previous_values: income,
            });
            await assertOk(
              await fetch(`/api/income/${incomeId}`, { method: 'DELETE' }),
              `delete income ${incomeId}`
            );
          }
        }
      }

      const incomePayloads: Array<{
        category: string;
        description: string;
        amount: number;
        is_recurring: boolean;
        date: string;
        employment_type?: string | null;
      }> = [];

      // Map life step employment status to income employment_type
      const employmentTypeMap: Record<string, string | null> = {
        employee: 'uop',
        b2b: 'b2b',
        business: 'b2b',
        contract: 'zlecenie',
        freelancer: 'other',
        unemployed: null,
      };
      const employmentType = employmentTypeMap[data.life.employmentStatus] ?? null;

      if (data.income.salaryNet > 0) {
        incomePayloads.push({
          category: 'salary',
          description: intl.formatMessage({
            id: 'onboarding.income.fields.salaryNet.label',
          }),
          amount: data.income.salaryNet,
          is_recurring: true,
          date: todayISO,
          employment_type: employmentType,
        });
      }

      (Object.entries(data.income.additionalSources) as Array<
        [
          keyof OnboardingData['income']['additionalSources'],
          AdditionalSource
        ]
      >).forEach(([key, source]) => {
        if (!source.enabled || source.amount <= 0) {
          return;
        }
        const meta = ADDITIONAL_SOURCE_META[key];
        incomePayloads.push({
          category: meta.category,
          description: intl.formatMessage({ id: meta.labelId }),
          amount: source.amount,
          is_recurring: true,
          date: todayISO,
        });
      });

      const irregularMonthly = data.income.irregularIncomeAnnual / 12;
      if (irregularMonthly > 0) {
        incomePayloads.push({
          category: 'other',
          description: intl.formatMessage({
            id: 'onboarding.income.fields.irregularIncome.label',
          }),
          amount: irregularMonthly,
          is_recurring: false,
          date: todayISO,
        });
      }

      const incomeTotal = incomePayloads.length;
      if (incomeTotal > 0) {
        notify(
          'income',
          t('onboarding.savingProgress.detail.count', {
            current: 0,
            total: incomeTotal,
          })
        );
      } else {
        notify('income');
      }

      for (let index = 0; index < incomePayloads.length; index += 1) {
        const payload = incomePayloads[index];
        const response = await fetch('/api/income', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        });
        await assertOk(response, `create income (${payload.description})`);
        const createdIncome = await response.json();
        if (createdIncome?.id !== undefined) {
          await logActivity({
            entity_type: 'Income',
            operation_type: 'create',
            entity_id: Number(createdIncome.id),
            new_values: createdIncome,
          });
        }
        notify(
          'income',
          t('onboarding.savingProgress.detail.count', {
            current: index + 1,
            total: incomeTotal || index + 1,
          })
        );
      }
    } catch (error) {
      logger.error('[Onboarding] Failed to sync income', error);
      throw error;
    }

    // --- Expenses sync ---
    try {
      const expensesEndpoint = `${API_BASE_URL}/users/${encodeURIComponent(
        userEmail
      )}/expenses`;

      const existingExpensesRes = await fetch(expensesEndpoint);
      if (existingExpensesRes.ok) {
        const existingExpenses: Array<Record<string, unknown>> =
          (await existingExpensesRes.json()) ?? [];
        for (const expense of existingExpenses) {
          const expenseId = Number(expense.id);
          if (!Number.isFinite(expenseId)) continue;
          await logActivity({
            entity_type: 'Expense',
            operation_type: 'delete',
            entity_id: expenseId,
            previous_values: expense,
          });
          await assertOk(
            await fetch(`${expensesEndpoint}/${expenseId}`, {
              method: 'DELETE',
              headers: jsonHeaders,
            }),
            `delete expense ${expenseId}`
          );
        }
      }

      const irregularItems = data.irregularExpenses ?? [];
      const totalExpenseCreates =
        Object.values(data.expenses).reduce(
          (acc, items) =>
            acc +
            (items?.filter((item) => (item?.amount ?? 0) > 0).length ?? 0),
          0
        ) +
        irregularItems.filter((item) => sanitizeAmount(item.amount) > 0)
          .length;
      let expenseCreatedCount = 0;
      if (totalExpenseCreates > 0) {
        notify(
          'expenses',
          t('onboarding.savingProgress.detail.count', {
            current: 0,
            total: totalExpenseCreates,
          })
        );
      } else {
        notify('expenses');
      }

      for (const group of Object.keys(data.expenses) as ExpenseGroupKey[]) {
        const groupCategory = EXPENSE_CATEGORY_MAP[group] ?? 'other';
        const items = data.expenses[group] ?? [];
        for (const item of items) {
          if (!item.amount || item.amount <= 0) {
            continue;
          }
          // Use item-level category if set, otherwise fall back to group category
          const category = item.category && isValidExpenseCategory(item.category)
            ? item.category
            : groupCategory;

          const translationKey = `onboarding.expenses.groups.${group}.items.${
            item.templateId ?? item.id
          }`;
          const description = item.name
            ? item.name
            : intl.messages[translationKey]
              ? intl.formatMessage({ id: translationKey })
              : intl.formatMessage({
                  id: `onboarding.expenses.groups.${group}.title`,
                });

          const response = await fetch(expensesEndpoint, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              category,
              description,
              amount: item.amount,
              is_recurring: true,
              date: todayISO,
            }),
          });
          await assertOk(response, `create expense (${description})`);
          const createdExpense = await response.json();
          if (createdExpense?.id !== undefined) {
            await logActivity({
              entity_type: 'Expense',
              operation_type: 'create',
              entity_id: Number(createdExpense.id),
              new_values: createdExpense,
            });
          }
          expenseCreatedCount += 1;
          notify(
            'expenses',
            t('onboarding.savingProgress.detail.count', {
              current: expenseCreatedCount,
              total: totalExpenseCreates || expenseCreatedCount,
            })
          );
        }
      }

      for (const item of irregularItems) {
        const amount = sanitizeAmount(item.amount);
        if (amount <= 0) continue;

        const description =
          (typeof item.name === 'string' && item.name.trim().length > 0
            ? item.name.trim()
            : intl.formatMessage({
                id: 'onboarding.irregularExpenses.custom.defaultName',
              }));

        const response = await fetch(expensesEndpoint, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            category: item.category ?? 'other',
            description,
            amount,
            is_recurring: false,
            date: todayISO,
          }),
        });
        await assertOk(response, `create irregular expense (${description})`);
        const createdExpense = await response.json();
        if (createdExpense?.id !== undefined) {
          await logActivity({
            entity_type: 'Expense',
            operation_type: 'create',
            entity_id: Number(createdExpense.id),
            new_values: createdExpense,
          });
        }
        expenseCreatedCount += 1;
        notify(
          'expenses',
          t('onboarding.savingProgress.detail.count', {
            current: expenseCreatedCount,
            total: totalExpenseCreates || expenseCreatedCount,
          })
        );
      }
    } catch (error) {
      logger.error('[Onboarding] Failed to sync expenses', error);
      throw error;
    }

    // --- Loans sync ---
    try {
      const loansQuery = `${API_BASE_URL}/loans?user_id=${encodeURIComponent(
        userEmail
      )}`;
      const existingLoansRes = await fetch(loansQuery);
      if (existingLoansRes.ok) {
        const existingLoans: Array<Record<string, unknown>> =
          (await existingLoansRes.json()) ?? [];
        for (const loan of existingLoans) {
          const loanId = Number(loan.id);
          if (!Number.isFinite(loanId)) continue;
          await logActivity({
            entity_type: 'Loan',
            operation_type: 'delete',
            entity_id: loanId,
            previous_values: loan,
          });
          await assertOk(
            await fetch(
              `${API_BASE_URL}/users/${encodeURIComponent(
                userEmail
              )}/loans/${loanId}`,
              {
                method: 'DELETE',
                headers: jsonHeaders,
              }
            ),
            `delete loan ${loanId}`
          );
        }
      }

      const relevantLiabilities = data.liabilities.filter(
        (liability) =>
          (liability.remainingAmount ?? 0) > 0 ||
          (liability.monthlyPayment ?? 0) > 0
      );
      let loansCreated = 0;
      const loanTotal = relevantLiabilities.length;
      if (loanTotal > 0) {
        notify(
          'loans',
          t('onboarding.savingProgress.detail.count', {
            current: 0,
            total: loanTotal,
          })
        );
      } else {
        notify('loans');
      }

      for (const liability of data.liabilities) {
        const hasAmount =
          (liability.remainingAmount ?? 0) > 0 ||
          (liability.monthlyPayment ?? 0) > 0;
        if (!hasAmount) continue;

        const fallbackLoanLabel = intl.formatMessage({
          id: 'onboarding.liabilities.types.default.cardTitle',
        });
        const labelKey = `onboarding.liabilities.types.${liability.type || 'default'}.cardTitle`;
        const description = intl.messages[labelKey]
          ? intl.formatMessage({ id: labelKey })
          : fallbackLoanLabel;

        const startDate = liability.startDate ? new Date(liability.startDate) : new Date();
        const endDate = liability.endDate ? new Date(liability.endDate) : null;
        const termMonths = liability.termMonths ?? (endDate
          ? differenceInMonths(startDate, endDate)
          : 12);

        // Special handling for different loan types
        const isLeasing = liability.type === 'leasing';
        const isRevolvingCredit = ['credit_card', 'overdraft'].includes(liability.type);

        let principalAmount: number;
        let interestRate = liability.interestRate ?? 0;

        if (isLeasing) {
          // Leasing: calculate total from monthly × term
          principalAmount = liability.monthlyPayment * Math.max(termMonths, 1);
          interestRate = 0; // Interest is built into the rate for leasing
        } else if (liability.propertyValue && liability.propertyValue > 0) {
          // Mortgage: use property value as principal
          principalAmount = liability.propertyValue;
        } else {
          principalAmount = liability.remainingAmount;
        }

        // For revolving credit, remaining balance is the current usage, principal is the limit
        const remainingBalance = isRevolvingCredit
          ? liability.remainingAmount
          : liability.remainingAmount || principalAmount;

        const response = await fetch(
          `${API_BASE_URL}/loans?user_id=${encodeURIComponent(userEmail)}`,
          {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              loan_type: liability.type || 'other',
              description,
              principal_amount: principalAmount,
              remaining_balance: remainingBalance,
              interest_rate: interestRate,
              monthly_payment: liability.monthlyPayment,
              start_date: toISODate(startDate),
              term_months: Math.max(termMonths, 1),
            }),
          }
        );
        await assertOk(response, `create loan (${description})`);
        const createdLoan = await response.json();
        if (createdLoan?.id !== undefined) {
          await logActivity({
            entity_type: 'Loan',
            operation_type: 'create',
            entity_id: Number(createdLoan.id),
            new_values: createdLoan,
          });
        }
        loansCreated += 1;
        notify(
          'loans',
          t('onboarding.savingProgress.detail.count', {
            current: loansCreated,
            total: loanTotal || loansCreated,
          })
        );
      }
    } catch (error) {
      logger.error('[Onboarding] Failed to sync loans', error);
      throw error;
    }

    // --- Savings sync ---
    try {
      const existingSavingsRes = await fetch('/api/savings');
      if (existingSavingsRes.ok) {
        const existingSavings: Array<Record<string, unknown>> =
          (await existingSavingsRes.json()) ?? [];
        for (const saving of existingSavings) {
          const savingId = Number(saving.id);
          if (!Number.isFinite(savingId)) continue;
          await logActivity({
            entity_type: 'Saving',
            operation_type: 'delete',
            entity_id: savingId,
            previous_values: saving,
          });
          await assertOk(
            await fetch(`/api/savings/${savingId}`, { method: 'DELETE' }),
            `delete saving ${savingId}`
          );
        }
      }

      const savingsPayloads: Array<{
        category: string;
        description: string;
        amount: number;
        date: string;
        is_recurring: boolean;
        saving_type: 'deposit' | 'withdrawal';
      }> = [];

      if (data.assets.savings > 0) {
        savingsPayloads.push({
          category: 'emergency_fund',
          description: intl.formatMessage({
            id: 'onboarding.assets.fields.cash.label',
          }),
          amount: data.assets.savings,
          date: todayISO,
          is_recurring: false,
          saving_type: 'deposit',
        });
      }

      if (data.assets.investments.totalValue > 0) {
        savingsPayloads.push({
          category: 'investment',
          description: intl.formatMessage({
            id: 'onboarding.assets.investments.title',
          }),
          amount: data.assets.investments.totalValue,
          date: todayISO,
          is_recurring: false,
          saving_type: 'deposit',
        });
      }

      data.assets.properties.forEach((property) => {
        if (property.value > 0) {
          savingsPayloads.push({
            category: 'real_estate',
            description:
              property.name ||
              intl.formatMessage({
                id: 'onboarding.assets.sections.properties',
              }),
            amount: property.value,
            date: todayISO,
            is_recurring: false,
            saving_type: 'deposit',
          });
        }
      });

      data.assets.vehicles.forEach((vehicle) => {
        if (vehicle.value > 0) {
          savingsPayloads.push({
            category: 'other',
            description:
              vehicle.name ||
              intl.formatMessage({
                id: 'onboarding.assets.sections.vehicles',
              }),
            amount: vehicle.value,
            date: todayISO,
            is_recurring: false,
            saving_type: 'deposit',
          });
        }
      });

      const savingsTotal = savingsPayloads.length;
      if (savingsTotal > 0) {
        notify(
          'savings',
          t('onboarding.savingProgress.detail.count', {
            current: 0,
            total: savingsTotal,
          })
        );
      } else {
        notify('savings');
      }

      for (let index = 0; index < savingsPayloads.length; index += 1) {
        const payload = savingsPayloads[index];
        const response = await fetch('/api/savings', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(payload),
        });
        await assertOk(response, `create saving (${payload.description})`);
        const createdSaving = await response.json();
        if (createdSaving?.id !== undefined) {
          await logActivity({
            entity_type: 'Saving',
            operation_type: 'create',
            entity_id: Number(createdSaving.id),
            new_values: createdSaving,
          });
        }
        notify(
          'savings',
          t('onboarding.savingProgress.detail.count', {
            current: index + 1,
            total: savingsTotal || index + 1,
          })
        );
      }

      // --- Sync tax-specific settings from life data ---
      try {
        const settingsResponse = await fetch(`/api/users/${encodeURIComponent(userEmail)}/settings`);
        if (settingsResponse.ok) {
          const currentSettings = await settingsResponse.json();
          const updatedSettings = {
            ...currentSettings,
            employment_status: data.life.employmentStatus || null,
            tax_form: data.life.taxForm || null,
            birth_year: data.life.birthYear || null,
            use_authors_costs: data.life.useAuthorsCosts ?? false,
            ppk_enrolled: data.life.ppkEnrolled ?? null,
            ppk_employee_rate: data.life.ppkEmployeeRate ?? null,
            ppk_employer_rate: data.life.ppkEmployerRate ?? null,
            children_count: data.life.childrenCount ?? 0,
          };

          const updateResponse = await fetch(`/api/users/${encodeURIComponent(userEmail)}/settings`, {
            method: 'PUT',
            headers: jsonHeaders,
            body: JSON.stringify(updatedSettings),
          });
          await assertOk(updateResponse, 'sync tax settings');
          logger.debug('[Onboarding] Synced tax settings to backend');
        }
      } catch (settingsError) {
        logger.warn('[Onboarding] Failed to sync tax settings (non-fatal)', settingsError);
        // Don't throw - this is non-critical
      }
    } catch (error) {
      logger.error('[Onboarding] Failed to sync savings', error);
      throw error;
    }
  },
    [data, intl, session?.user?.email, t]
  );

  const handleComplete = useCallback(async () => {
    setShowSavingDialog(true);
    setActiveSavingPhase('prepare');
    setSavingDetail(t('onboarding.savingProgress.detail.clearing'));
    setSaveStatus('saving');
    try {
      await syncFinancialData((update) => {
        setActiveSavingPhase(update.phase);
        setSavingDetail(update.detail ?? null);
      });

      setActiveSavingPhase('finalize');
      setSavingDetail(t('onboarding.savingProgress.detail.finalize'));

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
      setShowSavingDialog(false);
      setSavingDetail(null);
      track(AnalyticsEvents.ONBOARDING_COMPLETED, { steps_completed: steps.length });
      router.push('/');
    } catch (error) {
      logger.error(error);
      setSaveStatus('idle');
      setShowSavingDialog(false);
      setSavingDetail(null);
      setActiveSavingPhase('prepare');
      alert('Nie udało się zapisać danych. Spróbuj ponownie.');
    }
  }, [data, router, syncFinancialData, t, track, steps.length]);

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

      if (updates.employmentStatus && updates.employmentStatus !== 'business' && updates.employmentStatus !== 'b2b') {
        nextLife.taxForm = '';
      }

      // Reset PPK when not employee
      if (updates.employmentStatus && updates.employmentStatus !== 'employee') {
        nextLife.ppkEnrolled = undefined;
        nextLife.ppkEmployeeRate = undefined;
        nextLife.ppkEmployerRate = undefined;
      }

      // Reset author's costs when not applicable
      if (updates.employmentStatus && !['employee', 'contract', 'freelancer'].includes(updates.employmentStatus)) {
        nextLife.useAuthorsCosts = false;
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

  const updateIrregularExpenses = (updater: (prev: IrregularExpenses) => IrregularExpenses) =>
    setData((prev) => ({
      ...prev,
      irregularExpenses: updater(prev.irregularExpenses),
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
          repaymentType: 'unknown',
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

    const regularMonthlyExpenses = sumExpenses(data.expenses);
    const irregularAnnualExpenses = sumIrregularExpenses(data.irregularExpenses);
    const irregularMonthlyExpenses = irregularAnnualExpenses / 12;

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

    const surplus =
      monthlyIncome - (regularMonthlyExpenses + irregularMonthlyExpenses + liabilitiesMonthly);
    const dti = monthlyIncome
      ? (liabilitiesMonthly / monthlyIncome) * 100
      : 0;
    const emergencyCoverage = regularMonthlyExpenses + irregularMonthlyExpenses
      ? data.assets.savings / (regularMonthlyExpenses + irregularMonthlyExpenses)
      : 0;
    const netWorth = assetsTotal - liabilitiesTotal;

    return {
      monthlyIncome,
      regularMonthlyExpenses,
      irregularAnnualExpenses,
      irregularMonthlyExpenses,
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
  const nextButtonLabel = nextStepLabel
    ? t('onboarding.navigation.nextWithStep', { step: nextStepLabel })
    : t('onboarding.navigation.nextDefault');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-primary">
              {t('onboarding.header.title')}
            </h1>
            <p className="text-secondary">
              {t('onboarding.header.subtitle')}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {saveStatus === 'saving' && (
              <span>{t('onboarding.header.saving')}</span>
            )}
            {saveStatus === 'saved' && lastSavedAt && (
              <span>{t('onboarding.header.savedAt', { time: lastSavedAt })}</span>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-secondary">
            <span>
              {t('onboarding.header.stepIndicator', {
                current: displayStepNumber,
                total: stepsWithoutEdges,
              })}
              :{' '}
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
              <CardTitle className="text-2xl">
                {currentStepIndex === 0
                  ? t('onboarding.header.welcomeGreeting')
                  : currentStep.label}
              </CardTitle>
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
            <WelcomeStep
              onStart={() => handleNext()}
              onSkip={handleSkipAll}
              fromPayment={fromPayment}
            />
          )}

          {currentStep.id === 'life' && (
            <LifeStep
              data={data.life}
              errors={errors}
              onChange={setLife}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
              nextLabel={nextButtonLabel}
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
              nextLabel={nextButtonLabel}
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
              expenseGroups={EXPENSE_GROUPS}
              expenseGroupHints={EXPENSE_GROUP_HINTS}
              generateId={ensureId}
              getTotalTone={getTotalTone}
            />
          )}

          {currentStep.id === 'irregularExpenses' && (
            <IrregularExpensesStep
              data={data.irregularExpenses}
              errors={errors}
              onUpdate={updateIrregularExpenses}
              onNext={() => handleNext()}
              onBack={handleBack}
              onSkip={handleSkipStep}
              formatMoney={formatMoney}
              generateId={ensureId}
              nextLabel={nextButtonLabel}
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
              taxFormLabels={taxFormLabels}
              onBack={handleBack}
              onReset={handleReset}
              onFinish={handleComplete}
              formatMoney={formatMoney}
            />
          )}
        </CardContent>
      </Card>

      {showSavingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-default bg-card p-6 shadow-lg">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mint/30">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  {t('onboarding.savingProgress.title')}
                </h2>
                <p className="mt-1 text-sm text-secondary">
                  {t('onboarding.savingProgress.description')}
                </p>
              </div>
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-secondary">
                  <span>
                    {savingPhases[activeSavingPhaseIndex]?.label ?? ''}
                  </span>
                  <span>{savingProgressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${savingProgressPercent}%` }}
                  />
                </div>
              </div>
              {savingDetail && (
                <p className="text-xs text-secondary">{savingDetail}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
