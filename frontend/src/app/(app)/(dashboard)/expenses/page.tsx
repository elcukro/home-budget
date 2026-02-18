"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  AlertCircle,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CircleEllipsis,
  CircleDot,
  HeartPulse,
  Home,
  Landmark,
  Minus,
  Pencil,
  Plus,
  CalendarDays,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import ExpenseChart from "@/components/charts/ExpenseChart";
import BudgetChart from "@/components/budget/BudgetChart";
import MonthBar from "@/components/budget/MonthBar";
import BudgetView from "@/components/budget/BudgetView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CrudDialog, type FormFieldConfig } from "@/components/crud/CrudDialog";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import {
  parseNumber,
  validateAmountPositive,
  validateDateString,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import { logActivity } from "@/utils/activityLogger";
import { logger } from "@/lib/logger";
import { useAnalytics } from "@/hooks/useAnalytics";
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import _Tooltip from "@/components/Tooltip";

interface Expense {
  id: number | string;
  category: string;
  description: string;
  amount: number;
  date: string;  // Start date for recurring, occurrence date for one-off
  end_date: string | null;  // Optional end date for recurring items
  is_recurring: boolean;
  owner?: string | null;  // "self", "partner"
  created_at: string;
  // Reconciliation fields
  source?: "manual" | "bank_import";
  bank_transaction_id?: number | null;
  reconciliation_status?: "unreviewed" | "bank_backed" | "manual_confirmed" | "duplicate_of_bank" | "pre_bank_era";
  reconciliation_note?: string | null;
  reconciliation_reviewed_at?: string | null;
}

// Use Next.js API proxy for all backend calls (adds auth headers automatically)

const expenseToActivityValues = (
  expense: Expense | null | undefined,
): Record<string, unknown> | undefined => (expense ? { ...expense } : undefined);

const expenseSchema = z.object({
  category: z.string().min(1, "validation.categoryRequired"),
  description: z
    .string()
    .trim()
    .min(1, "validation.description.required")
    .max(100, { message: "validation.description.tooLong" }),
  amount: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const raw =
        typeof value === "number" ? value.toString() : value.trim();

      if (!raw) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.required",
        });
        return 0;
      }

      const error = validateAmountPositive(raw);
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.messageId,
        });
      }

      return parseNumber(raw) ?? 0;
    }),
  date: z
    .string()
    .trim()
    .min(1, "validation.required")
    .superRefine((value, ctx) => {
      const error = validateDateString(value);
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.messageId,
        });
      }
    }),
  end_date: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value || null),
  is_recurring: z.boolean().default(false),
  owner: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const expenseDefaultValues: ExpenseFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  end_date: null,
  is_recurring: false,
};

const expenseCategoryOptions = [
  { value: "housing", labelId: "expenses.categories.housing", icon: <Home className="h-5 w-5" /> },
  { value: "transportation", labelId: "expenses.categories.transportation", icon: <Car className="h-5 w-5" /> },
  { value: "food", labelId: "expenses.categories.food", icon: <UtensilsCrossed className="h-5 w-5" /> },
  { value: "utilities", labelId: "expenses.categories.utilities", icon: <Zap className="h-5 w-5" /> },
  { value: "insurance", labelId: "expenses.categories.insurance", icon: <ShieldCheck className="h-5 w-5" /> },
  { value: "healthcare", labelId: "expenses.categories.healthcare", icon: <HeartPulse className="h-5 w-5" /> },
  { value: "entertainment", labelId: "expenses.categories.entertainment", icon: <Sparkles className="h-5 w-5" /> },
  { value: "other", labelId: "expenses.categories.other", icon: <CircleDot className="h-5 w-5" /> },
];

const CATEGORY_META: Record<
  string,
  {
    Icon: LucideIcon;
    badgeClass: string;
    iconClass: string;
    descriptionId: string;
  }
> = {
  housing: {
    Icon: Home,
    badgeClass: "bg-emerald-100 text-emerald-700",
    iconClass: "text-rose-600",
    descriptionId: "expenses.hints.housing",
  },
  transportation: {
    Icon: Car,
    badgeClass: "bg-sky-100 text-sky-700",
    iconClass: "text-sky-600",
    descriptionId: "expenses.hints.transportation",
  },
  food: {
    Icon: UtensilsCrossed,
    badgeClass: "bg-amber-100 text-amber-700",
    iconClass: "text-amber-600",
    descriptionId: "expenses.hints.food",
  },
  utilities: {
    Icon: Zap,
    badgeClass: "bg-purple-100 text-purple-700",
    iconClass: "text-purple-600",
    descriptionId: "expenses.hints.utilities",
  },
  insurance: {
    Icon: ShieldCheck,
    badgeClass: "bg-blue-100 text-blue-700",
    iconClass: "text-blue-600",
    descriptionId: "expenses.hints.insurance",
  },
  healthcare: {
    Icon: HeartPulse,
    badgeClass: "bg-rose-100 text-rose-700",
    iconClass: "text-rose-600",
    descriptionId: "expenses.hints.healthcare",
  },
  entertainment: {
    Icon: Sparkles,
    badgeClass: "bg-pink-100 text-pink-700",
    iconClass: "text-pink-600",
    descriptionId: "expenses.hints.entertainment",
  },
  other: {
    Icon: CircleDot,
    badgeClass: "bg-slate-100 text-slate-700",
    iconClass: "text-slate-600",
    descriptionId: "expenses.hints.other",
  },
};

const DEFAULT_CATEGORY_META: {
  Icon: LucideIcon;
  badgeClass: string;
  iconClass: string;
  descriptionId: string;
} = {
  Icon: CircleEllipsis,
  badgeClass: "bg-muted text-muted-foreground",
  iconClass: "text-muted-foreground",
  descriptionId: "expenses.hints.other",
};

// SourceBadge component - shows if expense is from bank or manual
interface SourceBadgeProps {
  expense: Expense;
}

function SourceBadge({ expense }: SourceBadgeProps) {
  // Bank-backed expense (created from bank transaction)
  if (expense.bank_transaction_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <Landmark className="h-3 w-3" />
        Bank
      </span>
    );
  }

  // Manual expense that needs review
  if (expense.reconciliation_status === "unreviewed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Needs Review
      </span>
    );
  }

  // Manual expense (confirmed or pre-bank era)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
      <Pencil className="h-3 w-3" />
      Manual
    </span>
  );
}

const baseExpenseFieldConfig: FormFieldConfig<ExpenseFormValues>[] = [
  {
    name: "category",
    labelId: "expenses.form.category",
    component: "icon-select",
    options: expenseCategoryOptions,
  },
  {
    name: "description",
    labelId: "expenses.form.description",
    component: "text",
  },
  {
    name: "amount",
    labelId: "expenses.form.amount",
    component: "currency",
  },
  {
    name: "date",
    labelId: "expenses.form.startDate",
    component: "date",
  },
  {
    name: "is_recurring",
    labelId: "expenses.form.recurring",
    component: "switch",
  },
  {
    name: "end_date",
    labelId: "expenses.form.endDate",
    component: "date",
    showWhen: (values) => values.is_recurring === true,
  },
];

// Change rate schema and config
const changeRateSchema = z.object({
  newAmount: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const raw = typeof value === "number" ? value.toString() : value.trim();
      if (!raw) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "validation.required" });
        return 0;
      }
      const error = validateAmountPositive(raw);
      if (error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.messageId });
      }
      return parseNumber(raw) ?? 0;
    }),
  effectiveDate: z
    .string()
    .trim()
    .min(1, "validation.required")
    .superRefine((value, ctx) => {
      const error = validateDateString(value);
      if (error) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.messageId });
      }
    }),
  hasEndDate: z.boolean().optional(),
  endDate: z.string().nullable().optional(),
});

type ChangeRateFormValues = z.infer<typeof changeRateSchema>;

const _changeRateDefaultValues: ChangeRateFormValues = {
  newAmount: 0,
  effectiveDate: todayISO,
  hasEndDate: false,
  endDate: null,
};

const changeRateFieldConfig: FormFieldConfig<ChangeRateFormValues>[] = [
  {
    name: "newAmount",
    labelId: "changeRate.form.newAmount",
    component: "currency",
    autoFocus: true,
  },
  {
    name: "effectiveDate",
    labelId: "changeRate.form.effectiveDate",
    component: "date",
  },
  {
    name: "hasEndDate",
    labelId: "changeRate.form.hasEndDate",
    component: "switch",
    descriptionId: "changeRate.form.hasEndDateHint",
  },
  {
    name: "endDate",
    labelId: "changeRate.form.endDate",
    component: "date",
    showWhen: (values) => values.hasEndDate === true,
  },
];

const mapExpenseToFormValues = (expense: Expense): ExpenseFormValues => ({
  category: expense.category,
  description: expense.description,
  amount: expense.amount,
  date: expense.date.slice(0, 10),
  end_date: expense.end_date ? expense.end_date.slice(0, 10) : null,
  is_recurring: expense.is_recurring,
  owner: expense.owner ?? undefined,
});

const getMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthKeyToDate = (key: string): Date => {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  return new Date(year, month, 1);
};

export default function ExpensesPage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency, settings } = useSettings();
  const { trackExpense } = useAnalytics();
  const searchParams = useSearchParams();

  const ownerOptions = useMemo(() => [
    { value: "self", labelId: "expenses.form.ownerOptions.self", label: intl.formatMessage({ id: "expenses.form.ownerOptions.self" }) },
    {
      value: "partner",
      labelId: "expenses.form.ownerOptions.partnerDefault",
      label: settings?.partner_name || intl.formatMessage({ id: "expenses.form.ownerOptions.partnerDefault" }),
    },
  ], [settings?.partner_name, intl]);

  const expenseFieldConfig = useMemo<FormFieldConfig<ExpenseFormValues>[]>(() => {
    const fields = [...baseExpenseFieldConfig];
    if (settings?.include_partner_finances) {
      // Insert owner field after description (index 1)
      fields.splice(2, 0, {
        name: "owner" as const,
        labelId: "expenses.form.owner",
        component: "select" as const,
        options: ownerOptions,
      });
    }
    return fields;
  }, [settings?.include_partner_finances, ownerOptions]);

  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
    return tabFromUrl === "budget" ? "budget" : "transactions";
  });

  // Sync tab with URL
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl === "budget" || tabFromUrl === "transactions") {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Monthly totals breakdown (bank + manual)
  interface MonthlyTotalsBreakdown {
    month: string;
    total: number;
    from_bank: number;
    from_manual: number;
    breakdown: {
      bank_count: number;
      manual_count: number;
      duplicate_count: number;
      unreviewed_count: number;
    };
  }
  const [monthlyTotalsBreakdown, setMonthlyTotalsBreakdown] = useState<MonthlyTotalsBreakdown | null>(null);

  // One-time bank integration notice (dismissed state)
  const [bankNoticeDismissed, setBankNoticeDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('expense-bank-notice-dismissed') === 'true';
    }
    return false;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeExpense, setActiveExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Change rate dialog state
  const [changeRateOpen, setChangeRateOpen] = useState(false);
  const [changeRateItem, setChangeRateItem] = useState<Expense | null>(null);
  const [isChangingRate, setIsChangingRate] = useState(false);

  // Expanded groups state (for showing history within category)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // Expanded categories state (foldable categories)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const userEmail = session?.user?.email ?? null;

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [recurringFilter, setRecurringFilter] = useState<"all" | "recurring" | "oneoff">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "bank" | "manual" | "needs_review">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Budget tab: month for BudgetView (1-12), synced from ExpenseChart clicks
  const [budgetMonth, setBudgetMonth] = useState<number>(new Date().getMonth() + 1);

  const handleBudgetChartMonthSelect = (monthKey: string) => {
    if (monthKey === "all") return;
    const m = parseInt(monthKey.split("-")[1], 10);
    if (!Number.isNaN(m)) setBudgetMonth(m);
  };

  const monthlyTotals = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const map = new Map<
      string,
      {
        key: string;
        date: Date;
        total: number;
      }
    >();

    expenses.forEach((expense) => {
      const parsed = new Date(expense.date);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      const key = getMonthKey(parsed);
      const monthDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      const existing = map.get(key) ?? { key, date: monthDate, total: 0 };
      existing.total += expense.amount;
      map.set(key, existing);

      // For recurring expenses, also generate entries through end of current year
      if (expense.is_recurring) {
        const endDate = expense.end_date ? new Date(expense.end_date) : null;
        const endYear = endDate ? endDate.getFullYear() : curYear;
        const endMonth = endDate ? endDate.getMonth() : 11;
        const limitYear = Math.min(endYear, curYear);
        const limitMonth = limitYear < curYear ? endMonth : (endYear > curYear ? 11 : Math.min(endMonth, 11));

        let y = parsed.getFullYear();
        let m = parsed.getMonth();
        while (y < limitYear || (y === limitYear && m <= limitMonth)) {
          const rKey = getMonthKey(new Date(y, m, 1));
          if (!map.has(rKey)) {
            map.set(rKey, { key: rKey, date: new Date(y, m, 1), total: expense.amount });
          }
          m++;
          if (m > 11) { m = 0; y++; }
        }
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [expenses]);

  const _monthOptions = useMemo(() => {
    const formatted = monthlyTotals.map((entry) => ({
      value: entry.key,
      label: intl.formatDate(entry.date, { month: "long", year: "numeric" }),
    }));

    return [
      {
        value: "all",
        label: intl.formatMessage({ id: "expenses.summary.periodAll" }),
      },
      ...formatted,
    ];
  }, [monthlyTotals, intl]);

  useEffect(() => {
    if (monthlyTotals.length === 0) {
      setSelectedMonth("all");
      return;
    }

    setSelectedMonth((prev) => {
      if (prev !== "all" && monthlyTotals.some((entry) => entry.key === prev)) {
        return prev;
      }
      // Default to current month if available, otherwise latest month with data
      const now = new Date();
      const currentKey = getMonthKey(now);
      if (monthlyTotals.some((entry) => entry.key === currentKey)) {
        return currentKey;
      }
      return monthlyTotals[monthlyTotals.length - 1]?.key ?? "all";
    });
  }, [monthlyTotals]);

  useEffect(() => {
    const loadExpenses = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setApiError(null);

        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/expenses`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to fetch expenses");
        }

        const data: Expense[] = await response.json();
        setExpenses(data);
      } catch (error) {
        logger.error("[Expenses] Failed to load expenses", error);
        setApiError(intl.formatMessage({ id: "expenses.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadExpenses();
  }, [userEmail, intl]);

  // Load monthly totals breakdown when selectedMonth changes
  useEffect(() => {
    const loadMonthlyTotals = async () => {
      if (!userEmail || selectedMonth === "all") {
        setMonthlyTotalsBreakdown(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/expenses/monthly?month=${selectedMonth}&include_bank=true`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          // If endpoint doesn't exist yet, silently fail (backward compatibility)
          setMonthlyTotalsBreakdown(null);
          return;
        }

        const data: MonthlyTotalsBreakdown = await response.json();
        setMonthlyTotalsBreakdown(data);
      } catch (error) {
        logger.error("[Expenses] Failed to load monthly totals", error);
        setMonthlyTotalsBreakdown(null);
      }
    };

    void loadMonthlyTotals();
  }, [userEmail, selectedMonth]);

  // Helper to check if expense is active in selected month
  const isExpenseActiveInMonth = (expense: Expense, monthKey: string): boolean => {
    // CRITICAL: Exclude historical expenses (end_date in the past) from totals
    // This prevents duplicate counting when showing historical versions in the UI
    if (expense.end_date) {
      const endDate = new Date(expense.end_date);
      if (endDate < new Date()) {
        return false;  // Historical expense - don't count in totals
      }
    }

    if (monthKey === "all") return true;

    const expenseDate = new Date(expense.date);
    if (Number.isNaN(expenseDate.getTime())) return false;

    const [filterYear, filterMonth] = monthKey.split("-").map(Number);
    const filterDate = new Date(filterYear, filterMonth - 1, 1);

    if (expense.is_recurring) {
      const startDate = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1);
      if (filterDate < startDate) return false;

      if (expense.end_date) {
        const endDate = new Date(expense.end_date);
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        if (filterDate > endMonth) return false;
      }
      return true;
    } else {
      return getMonthKey(expenseDate) === monthKey;
    }
  };

  // Filter expenses by selected month, recurring filter, and source filter
  const expensesForDisplay = useMemo(() => {
    return expenses.filter((expense) => {
      // Month filter
      if (!isExpenseActiveInMonth(expense, selectedMonth)) return false;

      // Recurring filter
      if (recurringFilter === "recurring") {
        if (!expense.is_recurring) return false;
      } else if (recurringFilter === "oneoff") {
        if (expense.is_recurring) return false;
      }

      // Source filter
      if (sourceFilter === "bank") {
        if (!expense.bank_transaction_id) return false;
      } else if (sourceFilter === "manual") {
        if (expense.bank_transaction_id) return false;
      } else if (sourceFilter === "needs_review") {
        if (expense.bank_transaction_id || expense.reconciliation_status !== "unreviewed") return false;
      }

      return true;
    });
  }, [expenses, recurringFilter, sourceFilter, selectedMonth]);

  const expensesByCategory = useMemo(() => {
    const grouped = expensesForDisplay.reduce<Record<string, { items: Expense[]; total: number; activeTotal: number }>>(
      (acc, expense) => {
        if (!acc[expense.category]) {
          acc[expense.category] = { items: [], total: 0, activeTotal: 0 };
        }
        acc[expense.category].items.push(expense);
        acc[expense.category].total += expense.amount;
        return acc;
      },
      {},
    );

    // Compute activeTotal with deduplication for recurring expenses:
    // When multiple recurring rows share the same description and all have end_date=null,
    // only the newest one is counted (prevents double-counting after an edit that creates a new row).
    Object.values(grouped).forEach((group) => {
      group.items.sort((a, b) => b.amount - a.amount);

      const countedRecurring = new Set<string>();
      // Sort by date desc so newest is processed first
      const byDate = [...group.items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      for (const expense of byDate) {
        if (!isExpenseActiveInMonth(expense, selectedMonth)) continue;
        if (expense.is_recurring && !expense.end_date) {
          // Recurring without end_date: only count once per description (newest wins)
          if (!countedRecurring.has(expense.description)) {
            group.activeTotal += expense.amount;
            countedRecurring.add(expense.description);
          }
          // Older duplicates are skipped — they still appear in the list for deletion
        } else {
          // Non-recurring or has explicit end_date: always count
          group.activeTotal += expense.amount;
        }
      }
    });

    return grouped;
  }, [expensesForDisplay, selectedMonth]);

  const groupedCategories = useMemo(() => {
    const entries = Object.entries(expensesByCategory);
    const dir = sortDirection === "asc" ? 1 : -1;
    return entries.sort(([, a], [, b]) => dir * (a.activeTotal - b.activeTotal));
  }, [expensesByCategory, sortDirection]);

  // Group expenses within each category by description
  interface ExpenseDescriptionGroup {
    key: string;
    description: string;
    current: Expense | null;
    historical: Expense[];
  }

  const getGroupedByDescription = (items: Expense[]): ExpenseDescriptionGroup[] => {
    const groups = new Map<string, ExpenseDescriptionGroup>();

    items.forEach((expense) => {
      // Non-recurring expenses are each unique transactions — never group them as "historical"
      // Only recurring expenses with the same description can have current/historical versions
      const key = expense.is_recurring ? expense.description : `${expense.description}__${expense.id}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          description: expense.description,
          current: null,
          historical: [],
        });
      }

      const group = groups.get(key)!;

      const isPast = expense.end_date && new Date(expense.end_date) < new Date();
      if (isPast) {
        // end_date in the past = historical
        group.historical.push(expense);
      } else {
        // No end_date = current (or latest if multiple)
        if (!group.current || new Date(expense.date) > new Date(group.current.date)) {
          if (group.current) {
            group.historical.push(group.current);
          }
          group.current = expense;
        } else {
          group.historical.push(expense);
        }
      }
    });

    // Sort historical by date descending (newest first)
    groups.forEach((group) => {
      group.historical.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    return Array.from(groups.values());
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const _totalSpend = useMemo(
    () => Object.values(expensesByCategory).reduce((sum, group) => sum + group.activeTotal, 0),
    [expensesByCategory],
  );

  const _topCategories = useMemo(() => {
    const sorted = Object.entries(expensesByCategory)
      .map(([category, group]) => ({ category, total: group.activeTotal }))
      .sort((a, b) => b.total - a.total);
    return sorted.slice(0, 3);
  }, [expensesByCategory]);

  const effectiveMonthKey =
    selectedMonth === "all"
      ? monthlyTotals[monthlyTotals.length - 1]?.key
      : selectedMonth;
  const selectedMonthEntry = effectiveMonthKey
    ? monthlyTotals.find((entry) => entry.key === effectiveMonthKey)
    : undefined;
  const selectedMonthIndex = selectedMonthEntry
    ? monthlyTotals.findIndex((entry) => entry.key === selectedMonthEntry.key)
    : -1;
  const previousMonthEntry =
    selectedMonthIndex > 0 ? monthlyTotals[selectedMonthIndex - 1] : undefined;

  const _currentPeriodLabel = useMemo(() => {
    if (selectedMonth === "all") {
      return intl.formatMessage({ id: "expenses.summary.periodAll" });
    }
    if (!selectedMonth) {
      return intl.formatMessage({ id: "expenses.summary.periodAll" });
    }
    return intl.formatDate(monthKeyToDate(selectedMonth), {
      month: "long",
      year: "numeric",
    });
  }, [selectedMonth, intl]);

  const _comparisonDescriptor = useMemo(() => {
    if (!selectedMonthEntry) {
      if (selectedMonth === "all") {
        return {
          id: "expenses.summary.comparisonUnavailable",
        };
      }
      return {
        id: "expenses.summary.changeNoData",
        values: { previousPeriod: "" },
      };
    }

    if (!previousMonthEntry || previousMonthEntry.total <= 0) {
      return {
        id: "expenses.summary.changeNoData",
        values: {
          previousPeriod: intl.formatDate(selectedMonthEntry.date, {
            month: "long",
            year: "numeric",
          }),
        },
      };
    }

    const diff = selectedMonthEntry.total - previousMonthEntry.total;
    const percent = Math.abs(diff) / previousMonthEntry.total * 100;
    const previousPeriodLabel = intl.formatDate(previousMonthEntry.date, {
      month: "long",
      year: "numeric",
    });

    if (Math.abs(diff) < 0.01) {
      return {
        id: "expenses.summary.changeNeutral",
        values: { previousPeriod: previousPeriodLabel },
      };
    }

    const percentFormatted = intl.formatNumber(percent, {
      maximumFractionDigits: 1,
      minimumFractionDigits: percent >= 100 ? 0 : 1,
    });

    if (diff > 0) {
      return {
        id: "expenses.summary.changePositive",
        values: {
          percent: percentFormatted,
          previousPeriod: previousPeriodLabel,
        },
      };
    }

    return {
      id: "expenses.summary.changeNegative",
      values: {
        percent: percentFormatted,
        previousPeriod: previousPeriodLabel,
      },
    };
  }, [selectedMonthEntry, previousMonthEntry, intl, selectedMonth]);

  const currentMonthKey = getMonthKey(new Date());
  const isCurrentMonth = selectedMonth === "all" || selectedMonth === currentMonthKey;
  const isFutureMonth = !isCurrentMonth && selectedMonth > currentMonthKey;

  // MonthBar bridging: derive numeric month from YYYY-MM string
  const selectedMonthNum = useMemo(() => {
    if (selectedMonth === "all") return new Date().getMonth() + 1;
    return parseInt(selectedMonth.split("-")[1], 10);
  }, [selectedMonth]);

  const handleMonthBarSelect = (m: number) => {
    const y = new Date().getFullYear();
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  const futureDisabledMonths = useMemo(() => {
    const now = new Date();
    const cm = now.getMonth() + 1;
    const disabled = new Set<number>();
    for (let m = cm + 1; m <= 12; m++) disabled.add(m);
    return disabled;
  }, []);

  const unitKey = selectedMonth === "all" ? "period" : "month";
  const _unitLabel = intl.formatMessage({
    id: `expenses.summary.unit.${unitKey}`,
  });

  const _trendSparkline = useMemo(() => {
    if (monthlyTotals.length < 2) {
      return null;
    }

    const data = monthlyTotals.slice(-6);
    const width = 150;
    const height = 40;
    const totals = data.map((entry) => entry.total);
    const minValue = Math.min(...totals, 0);
    const maxValue = Math.max(...totals, 0);
    const range = maxValue - minValue || 1;

    const points = data.map((entry, index) => {
      const x =
        data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y =
        height - ((entry.total - minValue) / range) * height;
      return { x, y };
    });

    const strokePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ");
    const areaPath = `${strokePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

    return {
      width,
      height,
      strokePath,
      areaPath,
      startLabel: intl.formatDate(data[0].date, { month: "short" }),
      endLabel: intl.formatDate(
        data[data.length - 1].date,
        { month: "short" },
      ),
    };
  }, [monthlyTotals, intl]);

  const latestMonthKey = monthlyTotals[monthlyTotals.length - 1]?.key;
  const currentKeyForNavigation =
    selectedMonth === "all" ? latestMonthKey : selectedMonth;
  const currentIndexForNavigation =
    currentKeyForNavigation && monthlyTotals.length > 0
      ? monthlyTotals.findIndex((entry) => entry.key === currentKeyForNavigation)
      : -1;
  const prevMonthKey =
    currentIndexForNavigation > 0
      ? monthlyTotals[currentIndexForNavigation - 1].key
      : undefined;
  const nextMonthKey =
    currentIndexForNavigation >= 0 &&
    currentIndexForNavigation < monthlyTotals.length - 1
      ? monthlyTotals[currentIndexForNavigation + 1].key
      : undefined;

  const _handlePrevMonth = () => {
    if (selectedMonth === "all") {
      if (prevMonthKey) {
        setSelectedMonth(prevMonthKey);
      }
      return;
    }
    if (prevMonthKey) {
      setSelectedMonth(prevMonthKey);
    }
  };

  const _handleNextMonth = () => {
    if (selectedMonth === "all") {
      return;
    }
    if (nextMonthKey) {
      setSelectedMonth(nextMonthKey);
    } else if (selectedMonth !== "all" && latestMonthKey) {
      setSelectedMonth(latestMonthKey);
    }
  };

  const handleOpenCreate = () => {
    setActiveExpense(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setActiveExpense(expense);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveExpense(null);
    }
  };

  const showErrorToast = (messageId: string) => {
    toast({
      title: intl.formatMessage({ id: messageId }),
      variant: "destructive",
    });
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
    if (!userEmail) {
      showErrorToast("common.mustBeLoggedIn");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        amount: values.amount,
      };

      if (dialogMode === "create") {
        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/expenses`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to create expense");
        }

        const created: Expense = await response.json();
        setExpenses((prev) => [...prev, created]);

        await logActivity({
          entity_type: "Expense",
          operation_type: "create",
          entity_id: Number(created.id),
          new_values: expenseToActivityValues(created),
        });

        trackExpense('added', created.amount, created.category);

        toast({
          title: intl.formatMessage({ id: "expenses.toast.createSuccess" }),
        });
      } else if (activeExpense) {
        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/expenses/${activeExpense.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to update expense");
        }

        const updated: Expense = await response.json();

        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === updated.id ? updated : expense,
          ),
        );

        await logActivity({
          entity_type: "Expense",
          operation_type: "update",
          entity_id: Number(updated.id),
          previous_values: expenseToActivityValues(activeExpense),
          new_values: expenseToActivityValues(updated),
        });

        trackExpense('edited', updated.amount, updated.category);

        toast({
          title: intl.formatMessage({ id: "expenses.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      logger.error("[Expenses] Failed to submit form", error);
      showErrorToast("expenses.toast.genericError");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userEmail || !pendingDelete) {
      setConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/expenses/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete expense");
      }

      setExpenses((prev) =>
        prev.filter((expense) => expense.id !== pendingDelete.id),
      );

      await logActivity({
        entity_type: "Expense",
        operation_type: "delete",
        entity_id: Number(pendingDelete.id),
        previous_values: expenseToActivityValues(pendingDelete),
      });

      trackExpense('deleted', pendingDelete.amount, pendingDelete.category);

      toast({
        title: intl.formatMessage({ id: "expenses.toast.deleteSuccess" }),
      });
    } catch (error) {
      logger.error("[Expenses] Failed to delete expense", error);
      showErrorToast("expenses.toast.genericError");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const handleOpenChangeRate = (expense: Expense) => {
    setChangeRateItem(expense);
    setChangeRateOpen(true);
  };

  const handleChangeRateClose = (open: boolean) => {
    setChangeRateOpen(open);
    if (!open) {
      setChangeRateItem(null);
    }
  };

  const handleChangeRate = async (values: ChangeRateFormValues) => {
    if (!userEmail || !changeRateItem) {
      showErrorToast("common.mustBeLoggedIn");
      return;
    }

    setIsChangingRate(true);
    try {
      // Calculate the end date for the old item (month before effective date)
      const effectiveDate = new Date(values.effectiveDate);
      const endDate = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth() - 1, 1);
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;

      // Step 1: Update the existing item with end_date
      const updateResponse = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/expenses/${changeRateItem.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...mapExpenseToFormValues(changeRateItem),
            end_date: endDateStr,
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(errorText || "Failed to update expense");
      }

      const updatedOld: Expense = await updateResponse.json();

      // Step 2: Create a new item with the new amount
      const effectiveDateStr = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-01`;
      const createResponse = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/expenses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            category: changeRateItem.category,
            description: changeRateItem.description,
            amount: values.newAmount,
            date: effectiveDateStr,
            end_date: values.hasEndDate ? (values.endDate || null) : null,
            is_recurring: true,
          }),
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(errorText || "Failed to create new expense");
      }

      const createdNew: Expense = await createResponse.json();

      // Update local state
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === updatedOld.id ? updatedOld : expense)).concat(createdNew),
      );

      await logActivity({
        entity_type: "Expense",
        operation_type: "update",
        entity_id: Number(changeRateItem.id),
        previous_values: expenseToActivityValues(changeRateItem),
        new_values: { ...expenseToActivityValues(updatedOld), rateChangeTo: createdNew.id },
      });

      toast({
        title: intl.formatMessage({ id: "changeRate.toast.success" }),
      });

      handleChangeRateClose(false);
    } catch (error) {
      logger.error("[Expenses] Failed to change rate", error);
      showErrorToast("changeRate.toast.error");
    } finally {
      setIsChangingRate(false);
    }
  };

  if (loading) {
    return <TablePageSkeleton />;
  }

  const hasExpenses = groupedCategories.length > 0;
  const columnClasses = {
    description: "w-[40%]",
    amount: "w-[18%]",
    date: "w-[18%]",
    recurring: "w-[12%]",
    actions: "w-[12%]",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-rose-50 via-white to-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold text-rose-900">
            <FormattedMessage id="expenses.title" />
          </h1>
          <p className="text-sm text-rose-700/80">
            <FormattedMessage id="expenses.subtitle" />
          </p>
        </div>
        {activeTab === "transactions" && (
          <Button onClick={handleOpenCreate} disabled={!isCurrentMonth} className={!isCurrentMonth ? "opacity-50" : ""}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="expenses.actions.add" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transactions">
            <FormattedMessage id="expenses.tabs.transactions" />
          </TabsTrigger>
          <TabsTrigger value="budget">
            <FormattedMessage id="expenses.tabs.budget" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">

      {/* Month navigation bar */}
      <div className="flex justify-center mb-4">
        <MonthBar
          selectedMonth={selectedMonthNum}
          onMonthSelect={handleMonthBarSelect}
          disabledMonths={futureDisabledMonths}
        />
      </div>

      {/* Budget vs Actual chart */}
      <BudgetChart expenses={expenses} selectedMonth={selectedMonth} />

      {/* Monthly total summary */}
      {selectedMonth !== "all" && _totalSpend > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted/60 bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              <FormattedMessage id="expenses.monthlyTotal.label" defaultMessage="Suma wydatków" />
            </span>
            <span className="text-lg font-semibold text-foreground">
              {formatCurrency(_totalSpend)}
            </span>
          </div>
          {monthlyTotalsBreakdown && monthlyTotalsBreakdown.from_bank > 0 && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{formatCurrency(monthlyTotalsBreakdown.from_bank)}</span>
                {" "}
                <FormattedMessage id="expenses.monthlyTotal.fromBank" defaultMessage="z banku" />
              </span>
              {(_totalSpend - monthlyTotalsBreakdown.from_bank) > 0 && (
                <span>
                  <span className="font-medium text-foreground">{formatCurrency(_totalSpend - monthlyTotalsBreakdown.from_bank)}</span>
                  {" "}
                  <FormattedMessage id="expenses.monthlyTotal.fromManual" defaultMessage="ręcznych" />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-muted/60 bg-muted/20 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="expenses-sort-direction" className="text-xs uppercase tracking-wide">
            <FormattedMessage id="expenses.filters.categorySortLabel" defaultMessage="Categories" />
          </label>
          <select
            id="expenses-sort-direction"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as typeof sortDirection)}
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="desc">
              {intl.formatMessage({ id: "expenses.filters.categorySort.desc", defaultMessage: "Highest first" })}
            </option>
            <option value="asc">
              {intl.formatMessage({ id: "expenses.filters.categorySort.asc", defaultMessage: "Lowest first" })}
            </option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="expenses-filter-recurring" className="text-xs uppercase tracking-wide">
            <FormattedMessage id="expenses.filters.recurringLabel" defaultMessage="Type" />
          </label>
          <select
            id="expenses-filter-recurring"
            value={recurringFilter}
            onChange={(event) => setRecurringFilter(event.target.value as typeof recurringFilter)}
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">
              {intl.formatMessage({ id: "expenses.filters.recurring.all", defaultMessage: "All" })}
            </option>
            <option value="recurring">
              {intl.formatMessage({ id: "expenses.filters.recurring.recurring", defaultMessage: "Recurring" })}
            </option>
            <option value="oneoff">
              {intl.formatMessage({ id: "expenses.filters.recurring.oneoff", defaultMessage: "One-off" })}
            </option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="expenses-filter-source" className="text-xs uppercase tracking-wide">
            Source
          </label>
          <select
            id="expenses-filter-source"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">
              {intl.formatMessage({ id: "expenses.filters.source.all" })}
            </option>
            <option value="bank">
              {intl.formatMessage({ id: "expenses.filters.source.bank" })}
            </option>
            <option value="manual">
              {intl.formatMessage({ id: "expenses.filters.source.manual" })}
            </option>
            <option value="needs_review">
              {intl.formatMessage({ id: "expenses.filters.source.needs_review" })}
            </option>
          </select>
        </div>
      </div>

      {/* One-time Bank Integration Notice */}
      {monthlyTotalsBreakdown && monthlyTotalsBreakdown.breakdown.unreviewed_count > 0 && !bankNoticeDismissed && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  {intl.formatMessage({ id: "expenses.bankNotice.title" })}
                </p>
                <p className="text-sm text-blue-800 mb-3 leading-relaxed">
                  {intl.formatMessage({ id: "expenses.bankNotice.message" })}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    localStorage.setItem('expense-bank-notice-dismissed', 'true');
                    setBankNoticeDismissed(true);
                  }}
                  className="bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {intl.formatMessage({ id: "expenses.bankNotice.dismiss" })}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {apiError && (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="py-4">
            <p>{apiError}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">
            {isCurrentMonth
              ? intl.formatMessage({ id: "expenses.expenseHistory.current" })
              : intl.formatMessage(
                  { id: isFutureMonth ? "expenses.expenseHistory.predicted" : "expenses.expenseHistory.month" },
                  { month: intl.formatDate(monthKeyToDate(selectedMonth), { month: "long", year: "numeric" }) }
                )
            }
          </CardTitle>
          {!isCurrentMonth && (
            <p className="text-xs text-muted-foreground mt-1">
              {intl.formatMessage({ id: isFutureMonth ? "expenses.expenseHistory.readOnlyFuture" : "expenses.expenseHistory.readOnly" })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!hasExpenses ? (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="expenses.noEntries" />
            </p>
          ) : (
            <div className="space-y-8">
              {groupedCategories.map(([category, group]) => {
                const meta = CATEGORY_META[category] ?? DEFAULT_CATEGORY_META;
                const Icon = meta.Icon;
                const isCategoryExpanded = expandedCategories.has(category);
                return (
                  <div
                    key={category}
                    className="group rounded-3xl border border-muted/50 bg-card shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategoryExpanded(category)}
                      className="flex w-full flex-wrap items-center justify-between gap-4 rounded-t-3xl border-b border-emerald-100/60 bg-gradient-to-r from-emerald-50/80 via-white to-white px-6 py-5 shadow-sm text-left cursor-pointer transition-colors hover:from-emerald-100/80"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                          {isCategoryExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full text-base transition-transform duration-300 group-hover:scale-105",
                            meta.badgeClass,
                          )}
                          aria-hidden="true"
                        >
                          <Icon className={cn("h-5 w-5", meta.iconClass)} />
                        </span>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-emerald-900">
                            <FormattedMessage
                              id={`expenses.categories.${category.toLowerCase()}`}
                              defaultMessage={category}
                            />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {group.items.length} {group.items.length === 1 ? "item" : "items"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          <FormattedMessage id="expenses.categoryTotal" />
                        </p>
                        <p className="text-sm font-semibold text-rose-600">
                          {formatCurrency(group.activeTotal)}
                        </p>
                      </div>
                    </button>

                    {isCategoryExpanded && (
                    <div className="px-6 pb-6 pt-4">
                        <Table className="w-full table-auto">
                          <TableHeader className="bg-card">
                            <TableRow className="border-b border-muted/40">
                              <TableHead
                                className={cn(
                                  columnClasses.description,
                                  "text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.description" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.amount,
                                  "text-right text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.amount" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.date,
                                  "text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.date" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.recurring,
                                  "text-center text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.recurring" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.actions,
                                  "text-right text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.actions" />
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                          {getGroupedByDescription(group.items).map((descGroup) => {
                            const mainExpense = descGroup.current || descGroup.historical[0];
                            if (!mainExpense) return null;

                            const groupKey = `${category}::${descGroup.key}`;
                            const expandableHistory = descGroup.historical.filter(h => h.id !== mainExpense.id);
                            const hasHistory = expandableHistory.length > 0;
                            const isExpanded = expandedGroups.has(groupKey);

                            const renderExpenseRow = (expense: Expense, isMain: boolean) => {
                              const isHistorical = !!expense.end_date && new Date(expense.end_date) < new Date();
                              return (
                                <TableRow
                                  key={expense.id}
                                  className={cn(
                                    "border-b border-muted/20 transition-colors duration-200 hover:bg-emerald-50/70",
                                    isHistorical && "bg-slate-50/50 opacity-70",
                                    !isMain && "bg-amber-50/30"
                                  )}
                                  onDoubleClick={() => isCurrentMonth && handleOpenEdit(expense)}
                                >
                                  <TableCell
                                    className={cn(
                                      columnClasses.description,
                                      "align-middle py-4 text-sm text-slate-800",
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isMain && hasHistory ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleGroupExpanded(groupKey)}
                                          className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                          aria-label={isExpanded ? "Zwiń historię" : "Rozwiń historię"}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </button>
                                      ) : !isMain ? (
                                        <span className="flex h-7 w-7 items-center justify-center text-slate-400 text-xs">
                                          └─
                                        </span>
                                      ) : null}
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                          {settings?.include_partner_finances && isMain && expense.owner === "partner" ? (
                                            <span className="group relative shrink-0">
                                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                                                {(settings?.partner_name || "P")[0].toUpperCase()}
                                              </span>
                                              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                                {settings?.partner_name || intl.formatMessage({ id: "expenses.form.ownerOptions.partnerDefault" })}
                                              </span>
                                            </span>
                                          ) : settings?.include_partner_finances && isMain && (!expense.owner || expense.owner === "self") ? (
                                            <span className="group relative shrink-0">
                                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                                                {(session?.user?.name || "?")[0].toUpperCase()}
                                              </span>
                                              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                                {session?.user?.name || intl.formatMessage({ id: "expenses.form.ownerOptions.self" })}
                                              </span>
                                            </span>
                                          ) : null}
                                          <span className={cn(!isMain && "text-slate-500 text-xs")}>
                                            {isMain ? expense.description : intl.formatMessage({ id: "common.historical" })}
                                          </span>
                                          {isMain && <SourceBadge expense={expense} />}
                                        </div>
                                        {isMain && hasHistory && (
                                          <button
                                            type="button"
                                            onClick={() => toggleGroupExpanded(groupKey)}
                                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                                          >
                                            📜 {expandableHistory.length} {intl.formatMessage({
                                              id: expandableHistory.length === 1 ? "common.historyCount.one" : "common.historyCount.many",
                                              defaultMessage: expandableHistory.length === 1 ? "change" : "changes"
                                            })}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      columnClasses.amount,
                                      "align-middle py-4 text-right text-sm font-semibold",
                                      isHistorical ? "text-slate-500" : "text-rose-600",
                                    )}
                                  >
                                    {formatCurrency(expense.amount)}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      columnClasses.date,
                                      "align-middle py-4 text-sm text-muted-foreground",
                                    )}
                                  >
                                    <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>
                                        <FormattedDate value={new Date(expense.date)} year="numeric" month="2-digit" />
                                        {" → "}
                                        {expense.end_date ? (
                                          <FormattedDate value={new Date(expense.end_date)} year="numeric" month="2-digit" />
                                        ) : (
                                          <span className="text-emerald-600 font-medium">
                                            {intl.formatMessage({ id: "common.now", defaultMessage: "teraz" })}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      columnClasses.recurring,
                                      "align-middle py-4 text-center",
                                    )}
                                  >
                                    {isHistorical ? (
                                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 p-1 text-slate-500">
                                        <Archive className="h-3.5 w-3.5" />
                                      </span>
                                    ) : expense.is_recurring ? (
                                      <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-700">
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 p-1 text-slate-500">
                                        <Minus className="h-3.5 w-3.5" />
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      columnClasses.actions,
                                      "align-middle py-4",
                                    )}
                                  >
                                    <div className="flex justify-end gap-2">
                                      {expense.is_recurring && !isHistorical && isCurrentMonth && (
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          onClick={() => handleOpenChangeRate(expense)}
                                          className="h-9 w-9 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                                          aria-label={intl.formatMessage({ id: "changeRate.button.tooltip" })}
                                        >
                                          <RefreshCw className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleOpenEdit(expense)}
                                        disabled={!isCurrentMonth}
                                        className={`h-9 w-9 border-primary/10 hover:bg-primary/10 hover:text-primary ${!isCurrentMonth ? "opacity-50" : ""}`}
                                        aria-label={intl.formatMessage({ id: "expenses.actions.edit" })}
                                      >
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">
                                          {intl.formatMessage({ id: "expenses.actions.edit" })}
                                        </span>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          setPendingDelete(expense);
                                          setConfirmOpen(true);
                                        }}
                                        disabled={!isCurrentMonth}
                                        className={`h-9 w-9 border-destructive/20 hover:bg-destructive/10 hover:text-destructive ${!isCurrentMonth ? "opacity-50" : ""}`}
                                        aria-label={intl.formatMessage({ id: "expenses.actions.delete" })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">
                                          {intl.formatMessage({ id: "expenses.actions.delete" })}
                                        </span>
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            };

                            return (
                              <React.Fragment key={descGroup.key}>
                                {renderExpenseRow(mainExpense, true)}
                                {isExpanded && expandableHistory.map((histExpense) => (
                                  renderExpenseRow(histExpense, false)
                                ))}
                              </React.Fragment>
                            );
                          })}
                          <TableRow className="bg-muted/30">
                            <TableCell className="py-4 text-sm font-medium text-secondary">
                              <FormattedMessage id="expenses.categorySubtotal" defaultMessage="Subtotal" />
                            </TableCell>
                            <TableCell className="py-4 text-right text-sm font-semibold text-rose-600">
                              {formatCurrency(group.activeTotal)}
                            </TableCell>
                            <TableCell colSpan={3} />
                          </TableRow>
                        </TableBody>
                        </Table>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {hasExpenses && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleOpenCreate} disabled={!isCurrentMonth} className={`px-6 ${!isCurrentMonth ? "opacity-50" : ""}`}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="expenses.actions.add" />
          </Button>
        </div>
      )}

      <Button
        onClick={handleOpenCreate}
        disabled={!isCurrentMonth}
        className={`fixed bottom-6 right-6 shadow-lg sm:hidden ${!isCurrentMonth ? "opacity-50" : ""}`}
        variant="default"
        size="lg"
        aria-label={intl.formatMessage({ id: "expenses.actions.add" })}
      >
        <Plus className="mr-2 h-5 w-5" />
        <FormattedMessage id="expenses.actions.add" />
      </Button>
        </TabsContent>

        <TabsContent value="budget">
          <div className="space-y-6">
            <ExpenseChart
              expenses={expenses}
              selectedMonth={`${new Date().getFullYear()}-${String(budgetMonth).padStart(2, "0")}`}
              onMonthSelect={handleBudgetChartMonthSelect}
              compact
            />
            <BudgetView month={budgetMonth} onMonthChange={setBudgetMonth} showTypes={["expense", "loan_payment"]} />
          </div>
        </TabsContent>
      </Tabs>

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={handleDialogClose}
        titleId={
          dialogMode === "create"
            ? "expenses.dialog.createTitle"
            : "expenses.dialog.editTitle"
        }
        submitLabelId={
          dialogMode === "create"
            ? "expenses.dialog.createSubmit"
            : "expenses.dialog.editSubmit"
        }
        schema={expenseSchema}
        defaultValues={expenseDefaultValues}
        initialValues={
          dialogMode === "edit" && activeExpense
            ? mapExpenseToFormValues(activeExpense)
            : undefined
        }
        fields={expenseFieldConfig}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingDelete(null);
          }
        }}
        titleId="expenses.deleteDialog.title"
        descriptionId="expenses.deleteDialog.description"
        confirmLabelId="expenses.deleteDialog.confirm"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      {changeRateOpen && changeRateItem && (
        <CrudDialog
          key={changeRateItem.id}
          open={changeRateOpen}
          mode="create"
          onOpenChange={handleChangeRateClose}
          titleId="changeRate.dialog.title"
          descriptionId="changeRate.dialog.description"
          submitLabelId="changeRate.dialog.submit"
          schema={changeRateSchema}
          defaultValues={{
            newAmount: changeRateItem.amount,
            effectiveDate: todayISO,
            hasEndDate: !!changeRateItem.end_date,
            endDate: changeRateItem.end_date ? changeRateItem.end_date.slice(0, 10) : null,
          }}
          fields={changeRateFieldConfig}
          onSubmit={handleChangeRate}
          isSubmitting={isChangingRate}
        />
      )}
    </div>
  );
}
