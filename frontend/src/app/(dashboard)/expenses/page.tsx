"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import {
  Car,
  ChevronDown,
  ChevronRight,
  CircleEllipsis,
  CircleDot,
  HeartPulse,
  Home,
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
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import Tooltip from "@/components/Tooltip";

interface Expense {
  id: number | string;
  category: string;
  description: string;
  amount: number;
  date: string;  // Start date for recurring, occurrence date for one-off
  end_date: string | null;  // Optional end date for recurring items
  is_recurring: boolean;
  created_at: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

const expenseFieldConfig: FormFieldConfig<ExpenseFormValues>[] = [
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
});

type ChangeRateFormValues = z.infer<typeof changeRateSchema>;

const changeRateDefaultValues: ChangeRateFormValues = {
  newAmount: 0,
  effectiveDate: todayISO,
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
];

const mapExpenseToFormValues = (expense: Expense): ExpenseFormValues => ({
  category: expense.category,
  description: expense.description,
  amount: expense.amount,
  date: expense.date.slice(0, 10),
  end_date: expense.end_date ? expense.end_date.slice(0, 10) : null,
  is_recurring: expense.is_recurring,
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
  const { formatCurrency } = useSettings();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

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

  const userEmail = session?.user?.email ?? null;

  const [sortKey, setSortKey] = useState<"date" | "amount" | "description">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [recurringFilter, setRecurringFilter] = useState<"all" | "recurring" | "oneoff">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const monthlyTotals = useMemo(() => {
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
    });

    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [expenses]);

  const monthOptions = useMemo(() => {
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
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses`,
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

  // Filter expenses based on selected month
  // - Recurring items: show if start_date <= selected_month <= end_date (or forever if no end_date)
  // - One-off items: show only if date matches selected month
  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter((expense) => {
      if (selectedMonth !== "all") {
        const expenseDate = new Date(expense.date);
        if (Number.isNaN(expenseDate.getTime())) {
          return false;
        }

        const [filterYear, filterMonth] = selectedMonth.split("-").map(Number);
        const filterDate = new Date(filterYear, filterMonth - 1, 1);

        if (expense.is_recurring) {
          // Recurring: check if filter month is between start_date and end_date
          const startDate = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), 1);

          // Filter month must be >= start month
          if (filterDate < startDate) {
            return false;
          }

          // If there's an end_date, filter month must be <= end month
          if (expense.end_date) {
            const endDate = new Date(expense.end_date);
            const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            if (filterDate > endMonth) {
              return false;
            }
          }
        } else {
          // One-off: check if date matches the selected month
          if (getMonthKey(expenseDate) !== selectedMonth) {
            return false;
          }
        }
      }

      if (recurringFilter === "recurring") return expense.is_recurring;
      if (recurringFilter === "oneoff") return !expense.is_recurring;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "amount") {
        return direction * (a.amount - b.amount);
      }
      if (sortKey === "description") {
        return direction * a.description.localeCompare(b.description, intl.locale, { sensitivity: "base" });
      }

      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return direction * (timeA - timeB);
    });

    return sorted;
  }, [expenses, recurringFilter, sortDirection, sortKey, intl.locale, selectedMonth]);

  // Helper to check if expense is active in selected month
  const isExpenseActiveInMonth = (expense: Expense, monthKey: string): boolean => {
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

  // Filter expenses only by recurring filter (not by month - we want to show all items for grouping)
  const expensesForDisplay = useMemo(() => {
    return expenses.filter((expense) => {
      if (recurringFilter === "recurring") return expense.is_recurring;
      if (recurringFilter === "oneoff") return !expense.is_recurring;
      return true;
    });
  }, [expenses, recurringFilter]);

  const expensesByCategory = useMemo(() => {
    const grouped = expensesForDisplay.reduce<Record<string, { items: Expense[]; total: number; activeTotal: number }>>(
      (acc, expense) => {
        if (!acc[expense.category]) {
          acc[expense.category] = { items: [], total: 0, activeTotal: 0 };
        }
        acc[expense.category].items.push(expense);
        acc[expense.category].total += expense.amount;
        // Only add to activeTotal if expense is active in selected month
        if (isExpenseActiveInMonth(expense, selectedMonth)) {
          acc[expense.category].activeTotal += expense.amount;
        }
        return acc;
      },
      {},
    );

    Object.values(grouped).forEach((group) => {
      group.items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    });

    return grouped;
  }, [expensesForDisplay, selectedMonth]);

  const groupedCategories = useMemo(() => {
    const entries = Object.entries(expensesByCategory);
    return entries.sort(([categoryA], [categoryB]) => {
      return categoryA.localeCompare(categoryB);
    });
  }, [expensesByCategory]);

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
      const key = expense.description;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          description: expense.description,
          current: null,
          historical: [],
        });
      }

      const group = groups.get(key)!;

      if (expense.end_date) {
        // Has end_date = historical
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

  const totalSpend = useMemo(
    () => Object.values(expensesByCategory).reduce((sum, group) => sum + group.activeTotal, 0),
    [expensesByCategory],
  );

  const topCategories = useMemo(() => {
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

  const currentPeriodLabel = useMemo(() => {
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
  }, [selectedMonth, selectedMonthEntry, intl]);

  const comparisonDescriptor = useMemo(() => {
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

  const unitKey = selectedMonth === "all" ? "period" : "month";
  const unitLabel = intl.formatMessage({
    id: `expenses.summary.unit.${unitKey}`,
  });

  const trendSparkline = useMemo(() => {
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

  const handlePrevMonth = () => {
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

  const handleNextMonth = () => {
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
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses`,
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

        toast({
          title: intl.formatMessage({ id: "expenses.toast.createSuccess" }),
        });
      } else if (activeExpense) {
        const response = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses/${activeExpense.id}`,
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
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses/${pendingDelete.id}`,
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
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses/${changeRateItem.id}`,
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
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses`,
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
            end_date: null,
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
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="expenses.actions.add" />
        </Button>
      </div>

      {/* Chart */}
      <ExpenseChart expenses={expenses} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-muted/60 bg-muted/20 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="expenses-sort-by" className="text-xs uppercase tracking-wide">
            <FormattedMessage id="expenses.filters.sortLabel" defaultMessage="Sort by" />
          </label>
          <select
            id="expenses-sort-by"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="date">
              {intl.formatMessage({ id: "expenses.filters.sort.date", defaultMessage: "Date" })}
            </option>
            <option value="amount">
              {intl.formatMessage({ id: "expenses.filters.sort.amount", defaultMessage: "Amount" })}
            </option>
            <option value="description">
              {intl.formatMessage({ id: "expenses.filters.sort.description", defaultMessage: "Description" })}
            </option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="expenses-sort-direction" className="text-xs uppercase tracking-wide">
            <FormattedMessage id="expenses.filters.directionLabel" defaultMessage="Direction" />
          </label>
          <select
            id="expenses-sort-direction"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as typeof sortDirection)}
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="desc">
              {intl.formatMessage({ id: "expenses.filters.direction.desc", defaultMessage: "Newest first" })}
            </option>
            <option value="asc">
              {intl.formatMessage({ id: "expenses.filters.direction.asc", defaultMessage: "Oldest first" })}
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
      </div>

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
            <FormattedMessage id="expenses.expenseHistory" />
          </CardTitle>
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
                return (
                  <div
                    key={category}
                    className="group rounded-3xl border border-muted/50 bg-card shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100/60 bg-gradient-to-r from-emerald-50/80 via-white to-white px-6 py-5 shadow-sm">
                      <div className="flex items-center gap-3">
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
                            <FormattedMessage id={meta.descriptionId} defaultMessage="" />
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
                    </div>

                    <div className="max-h-[280px] px-6 pb-6 pt-4 overflow-x-hidden">
                      <div className="max-h-[280px] overflow-y-auto overflow-x-hidden pr-2">
                        <Table className="w-full table-auto">
                          <TableHeader className="bg-card">
                            <TableRow className="border-b border-muted/40">
                              <TableHead
                                className={cn(
                                  columnClasses.description,
                                  "sticky top-0 z-10 bg-card text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.description" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.amount,
                                  "sticky top-0 z-10 bg-card text-right text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.amount" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.date,
                                  "sticky top-0 z-10 bg-card text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.date" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.recurring,
                                  "sticky top-0 z-10 bg-card text-xs uppercase tracking-wide text-muted-foreground",
                                )}
                              >
                                <FormattedMessage id="expenses.table.recurring" />
                              </TableHead>
                              <TableHead
                                className={cn(
                                  columnClasses.actions,
                                  "sticky top-0 z-10 bg-card text-right text-xs uppercase tracking-wide text-muted-foreground",
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
                            const hasHistory = descGroup.historical.length > 0;
                            const isExpanded = expandedGroups.has(groupKey);

                            const renderExpenseRow = (expense: Expense, isMain: boolean) => {
                              const isHistorical = !!expense.end_date;
                              return (
                                <TableRow
                                  key={expense.id}
                                  className={cn(
                                    "border-b border-muted/20 transition-colors duration-200 hover:bg-emerald-50/70",
                                    isHistorical && "bg-slate-50/50 opacity-70",
                                    !isMain && "bg-amber-50/30"
                                  )}
                                  onDoubleClick={() => handleOpenEdit(expense)}
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
                                      <div className="flex flex-col">
                                        <span className={cn(!isMain && "text-slate-500 text-xs")}>
                                          {isMain ? expense.description : intl.formatMessage({ id: "common.historical" })}
                                        </span>
                                        {isMain && hasHistory && (
                                          <button
                                            type="button"
                                            onClick={() => toggleGroupExpanded(groupKey)}
                                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                                          >
                                            📜 {descGroup.historical.length} {intl.formatMessage({
                                              id: descGroup.historical.length === 1 ? "common.historyCount.one" : "common.historyCount.many",
                                              defaultMessage: descGroup.historical.length === 1 ? "change" : "changes"
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
                                      "align-middle py-4 text-sm",
                                    )}
                                  >
                                    {isHistorical ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                                        📁
                                        <FormattedMessage id="common.historical" defaultMessage="Historyczny" />
                                      </span>
                                    ) : expense.is_recurring ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                        <span className="text-emerald-500">●</span>
                                        <FormattedMessage id="expenses.recurring.yes" defaultMessage="Recurring" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                        <span className="text-slate-400">○</span>
                                        <FormattedMessage id="expenses.recurring.no" defaultMessage="One-off" />
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
                                      {expense.is_recurring && !isHistorical && (
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
                                        className="h-9 w-9 border-primary/10 hover:bg-primary/10 hover:text-primary"
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
                                        className="h-9 w-9 border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
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
                                {isExpanded && descGroup.historical.map((histExpense) => (
                                  histExpense.id !== mainExpense.id && renderExpenseRow(histExpense, false)
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {hasExpenses && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleOpenCreate} className="px-6">
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="expenses.actions.add" />
          </Button>
        </div>
      )}

      <Button
        onClick={handleOpenCreate}
        className="fixed bottom-6 right-6 shadow-lg sm:hidden"
        variant="default"
        size="lg"
        aria-label={intl.formatMessage({ id: "expenses.actions.add" })}
      >
        <Plus className="mr-2 h-5 w-5" />
        <FormattedMessage id="expenses.actions.add" />
      </Button>

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

      <CrudDialog
        open={changeRateOpen}
        mode="create"
        onOpenChange={handleChangeRateClose}
        titleId="changeRate.dialog.title"
        descriptionId="changeRate.dialog.description"
        submitLabelId="changeRate.dialog.submit"
        schema={changeRateSchema}
        defaultValues={changeRateDefaultValues}
        initialValues={
          changeRateItem
            ? { newAmount: changeRateItem.amount, effectiveDate: todayISO }
            : undefined
        }
        fields={changeRateFieldConfig}
        onSubmit={handleChangeRate}
        isSubmitting={isChangingRate}
      />
    </div>
  );
}
