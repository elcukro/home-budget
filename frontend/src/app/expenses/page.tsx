"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import {
  Car,
  CircleEllipsis,
  CircleDot,
  HeartPulse,
  Home,
  Pencil,
  Plus,
  CalendarDays,
  ShieldCheck,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Zap,
  ChevronLeft,
  ChevronRight,
  LineChart,
} from "lucide-react";

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
  date: string;
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
    .string()
    .trim()
    .min(1, "validation.required")
    .transform((value, ctx) => {
      const error = validateAmountPositive(value);
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.messageId,
        });
      }
      return parseNumber(value) ?? 0;
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
  is_recurring: z.boolean().default(false),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const expenseDefaultValues: ExpenseFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  is_recurring: false,
};

const expenseCategoryOptions = [
  { value: "housing", labelId: "expenses.categories.housing" },
  { value: "transportation", labelId: "expenses.categories.transportation" },
  { value: "food", labelId: "expenses.categories.food" },
  { value: "utilities", labelId: "expenses.categories.utilities" },
  { value: "insurance", labelId: "expenses.categories.insurance" },
  { value: "healthcare", labelId: "expenses.categories.healthcare" },
  { value: "entertainment", labelId: "expenses.categories.entertainment" },
  { value: "other", labelId: "expenses.categories.other" },
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
    iconClass: "text-emerald-600",
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
    component: "select",
    placeholderId: "expenses.form.category.select",
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
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "date",
    labelId: "expenses.form.date",
    component: "date",
  },
  {
    name: "is_recurring",
    labelId: "expenses.form.recurring",
    component: "switch",
  },
];

const mapExpenseToFormValues = (expense: Expense): ExpenseFormValues => ({
  category: expense.category,
  description: expense.description,
  amount: expense.amount,
  date: expense.date.slice(0, 10),
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

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter((expense) => {
      if (selectedMonth !== "all") {
        const expenseDate = new Date(expense.date);
        if (Number.isNaN(expenseDate.getTime())) {
          return false;
        }
        if (getMonthKey(expenseDate) !== selectedMonth) {
          return false;
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

  const expensesByCategory = useMemo(() => {
    const grouped = filteredExpenses.reduce<Record<string, { items: Expense[]; total: number }>>(
      (acc, expense) => {
        if (!acc[expense.category]) {
          acc[expense.category] = { items: [], total: 0 };
        }
        acc[expense.category].items.push(expense);
        acc[expense.category].total += expense.amount;
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
  }, [filteredExpenses]);

  const groupedCategories = useMemo(() => {
    const entries = Object.entries(expensesByCategory);
    return entries.sort(([categoryA], [categoryB]) => {
      return categoryA.localeCompare(categoryB);
    });
  }, [expensesByCategory]);

  const totalSpend = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [filteredExpenses],
  );

  const topCategories = useMemo(() => {
    const sorted = Object.entries(expensesByCategory)
      .map(([category, group]) => ({ category, total: group.total }))
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-900">
            <FormattedMessage id="expenses.title" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="expenses.subtitle" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {monthlyTotals.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label
                htmlFor="expenses-period"
                className="text-xs uppercase tracking-wide"
              >
                <FormattedMessage id="expenses.filters.periodLabel" />
              </label>
              <select
                id="expenses-period"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="expenses.actions.add" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 rounded-xl border border-muted/60 bg-card/80 p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              <FormattedMessage
                id="expenses.summary.totalLabel"
                values={{ period: currentPeriodLabel }}
              />
            </span>
            {selectedMonth === "all" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <FormattedMessage id="expenses.summary.periodChipAll" />
              </span>
            )}
          </div>
          <p className="text-3xl font-semibold text-emerald-600">
            {formatCurrency(totalSpend)}
          </p>
          <p className="text-xs text-muted-foreground">
            <FormattedMessage
              id={comparisonDescriptor.id}
              values={comparisonDescriptor.values ?? {}}
            />
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              <FormattedMessage id="expenses.summary.topCategories" />
            </span>
            <Tooltip content={intl.formatMessage({ id: "expenses.summary.unitTooltip" })} icon />
          </div>
          <div className="space-y-3">
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <FormattedMessage id="expenses.summary.noData" />
              </p>
            ) : (
              topCategories.map(({ category, total }) => {
                const percent =
                  totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0;
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-emerald-900">
                      <span>
                        <FormattedMessage id={`expenses.categories.${category}`} />
                      </span>
                      <Tooltip content={intl.formatMessage({ id: "expenses.summary.unitTooltip" })}>
                        <span className="text-emerald-600">
                          {formatCurrency(total)}{" "}
                          <span className="text-xs text-muted-foreground">
                            / {unitLabel}
                          </span>
                        </span>
                      </Tooltip>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        <FormattedMessage
                          id="expenses.summary.categoryShare"
                          values={{ percent }}
                        />
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-emerald-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${percent}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-muted/60 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              <FormattedMessage id="expenses.summary.trendTitle" />
            </span>
            <LineChart className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          </div>
          {trendSparkline ? (
            <>
              <svg
                viewBox={`0 0 ${trendSparkline.width} ${trendSparkline.height}`}
                className="h-20 w-full text-emerald-500"
                aria-hidden="true"
              >
                <path
                  d={trendSparkline.areaPath}
                  fill="currentColor"
                  opacity={0.15}
                />
                <path
                  d={trendSparkline.strokePath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{trendSparkline.startLabel}</span>
                <span>{trendSparkline.endLabel}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="expenses.summary.trendNoData" />
            </p>
          )}
        </div>
      </div>
      {monthlyTotals.length > 0 && (
        <div className="space-y-3 rounded-xl border border-muted/60 bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                <FormattedMessage id="expenses.timeline.label" />
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  disabled={!prevMonthKey}
                  aria-label={intl.formatMessage({ id: "expenses.timeline.previous" })}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextMonth}
                  disabled={!nextMonthKey || selectedMonth === "all"}
                  aria-label={intl.formatMessage({ id: "expenses.timeline.next" })}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              <FormattedMessage id="expenses.timeline.hint" />
            </span>
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto">
            <Button
              variant={selectedMonth === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMonth("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                selectedMonth === "all"
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "border-muted/60 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <FormattedMessage id="expenses.timeline.all" />
            </Button>
            {monthlyTotals.map((entry) => {
              const isActive = selectedMonth === entry.key;
              return (
                <Button
                  key={entry.key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMonth(entry.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs capitalize",
                    isActive
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border-muted/60 text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {intl.formatDate(entry.date, { month: "short", year: "2-digit" })}
                </Button>
              );
            })}
          </div>
        </div>
      )}

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
                            <FormattedMessage id={`expenses.categories.${category}`} />
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
                        <p className="text-sm font-semibold text-emerald-600">
                          {formatCurrency(group.total)}
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
                          {group.items.map((expense) => (
                            <TableRow
                              key={expense.id}
                              className="border-b border-muted/20 transition-colors duration-200 hover:bg-emerald-50/70"
                              onDoubleClick={() => handleOpenEdit(expense)}
                            >
                              <TableCell
                                className={cn(
                                  columnClasses.description,
                                  "align-middle py-4 text-sm text-slate-800",
                                )}
                              >
                                {expense.description}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  columnClasses.amount,
                                  "align-middle py-4 text-right text-sm font-semibold text-emerald-600",
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
                                    <FormattedDate value={new Date(expense.date)} />
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  columnClasses.recurring,
                                  "align-middle py-4 text-sm",
                                )}
                              >
                                {expense.is_recurring ? (
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
                          ))}
                          <TableRow className="bg-muted/30">
                            <TableCell className="py-4 text-sm font-medium text-secondary">
                              <FormattedMessage id="expenses.categorySubtotal" defaultMessage="Subtotal" />
                            </TableCell>
                            <TableCell className="py-4 text-right text-sm font-semibold text-emerald-600">
                              {formatCurrency(group.total)}
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
    </div>
  );
}
