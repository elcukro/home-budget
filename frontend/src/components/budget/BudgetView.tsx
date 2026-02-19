"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Wallet,
  TrendingUp,
  CreditCard,
  Home,
  Car,
  UtensilsCrossed,
  Zap,
  ShieldCheck,
  HeartPulse,
  Sparkles,
  Landmark,
  CircleDot,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrudDialog, type FormFieldConfig } from "@/components/crud/CrudDialog";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import MonthBar from "./MonthBar";
import {
  parseNumber,
  validateAmountPositive,
} from "@/lib/validation";

// ─── Types ───────────────────────────────────────────────
interface BudgetYear {
  id: number;
  year: number;
  status: string;
  source: string;
  monthly_summaries?: MonthSummary[] | null;
}

interface MonthSummary {
  month: number;
  planned_income: number;
  planned_expenses: number;
  planned_loan_payments: number;
  actual_income: number;
  actual_expenses: number;
  actual_loan_payments: number;
  entry_count: number;
}

interface BudgetEntry {
  id: number;
  budget_year_id: number;
  user_id: string;
  month: number;
  entry_type: string; // income, expense, loan_payment
  category: string;
  description: string;
  planned_amount: number;
  actual_amount: number | null;
  is_recurring: boolean;
}

// ─── Schemas ─────────────────────────────────────────────
const addEntrySchema = z.object({
  entry_type: z.string().min(1, "validation.required"),
  category: z.string().min(1, "validation.categoryRequired"),
  description: z
    .string()
    .trim()
    .min(1, "validation.description.required")
    .max(100, { message: "validation.description.tooLong" }),
  planned_amount: z
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
  is_recurring: z.boolean().default(false),
});

type AddEntryFormValues = z.infer<typeof addEntrySchema>;

const addEntryDefaults: AddEntryFormValues = {
  entry_type: "expense",
  category: "",
  description: "",
  planned_amount: 0,
  is_recurring: false,
};

const ENTRY_TYPE_OPTIONS = [
  { value: "income", labelId: "budget.income" },
  { value: "expense", labelId: "budget.expenses" },
  { value: "loan_payment", labelId: "budget.loanPayments" },
];

// Map entry_type to the correct i18n namespace for categories
const CATEGORY_I18N_PREFIX: Record<string, string> = {
  income: "income.categories",
  expense: "expenses.categories",
  loan_payment: "loans.types",
};

// Visual config for expense category grouping
const EXPENSE_CATEGORY_META: Record<string, { icon: React.ReactNode; borderColor: string; bgColor: string }> = {
  housing:        { icon: <Home className="h-4 w-4" />,              borderColor: "border-l-blue-500",    bgColor: "bg-blue-50/50" },
  transportation: { icon: <Car className="h-4 w-4" />,               borderColor: "border-l-orange-500",  bgColor: "bg-orange-50/50" },
  food:           { icon: <UtensilsCrossed className="h-4 w-4" />,   borderColor: "border-l-amber-500",   bgColor: "bg-amber-50/50" },
  utilities:      { icon: <Zap className="h-4 w-4" />,               borderColor: "border-l-yellow-500",  bgColor: "bg-yellow-50/50" },
  insurance:      { icon: <ShieldCheck className="h-4 w-4" />,       borderColor: "border-l-indigo-500",  bgColor: "bg-indigo-50/50" },
  healthcare:     { icon: <HeartPulse className="h-4 w-4" />,        borderColor: "border-l-rose-500",    bgColor: "bg-rose-50/50" },
  entertainment:  { icon: <Sparkles className="h-4 w-4" />,          borderColor: "border-l-purple-500",  bgColor: "bg-purple-50/50" },
  obligations:    { icon: <Landmark className="h-4 w-4" />,          borderColor: "border-l-violet-500",  bgColor: "bg-violet-50/50" },
  other:          { icon: <CircleDot className="h-4 w-4" />,         borderColor: "border-l-gray-400",    bgColor: "bg-gray-50/50" },
};
const DEFAULT_CATEGORY_META = { icon: <CircleDot className="h-4 w-4" />, borderColor: "border-l-gray-400", bgColor: "bg-gray-50/50" };

// All loan_payment categories get violet styling (they're all obligations)
const LOAN_CATEGORY_META = { icon: <Landmark className="h-4 w-4" />, borderColor: "border-l-violet-500", bgColor: "bg-violet-50/50" };

const ENTRY_TYPE_META: Record<string, { icon: React.ReactNode; labelId: string; colorClass: string }> = {
  income: {
    icon: <TrendingUp className="h-5 w-5" />,
    labelId: "budget.income",
    colorClass: "text-emerald-600",
  },
  expense: {
    icon: <Wallet className="h-5 w-5" />,
    labelId: "budget.expenses",
    colorClass: "text-rose-600",
  },
  loan_payment: {
    icon: <CreditCard className="h-5 w-5" />,
    labelId: "budget.loanPayments",
    colorClass: "text-amber-600",
  },
};

// ─── Component ───────────────────────────────────────────
interface BudgetViewProps {
  month?: number;                    // Controlled month (1-12)
  onMonthChange?: (m: number) => void; // Called when month changes
  defaultCollapsed?: boolean;        // Start with all sections collapsed
  showTypes?: string[];              // Filter which entry types to show (default: all)
}

export default function BudgetView({ month, onMonthChange, defaultCollapsed = false, showTypes }: BudgetViewProps = {}) {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency } = useSettings();

  const userEmail = session?.user?.email ?? null;

  // State
  const [loading, setLoading] = useState(true);
  const [budgetYear, setBudgetYear] = useState<BudgetYear | null>(null);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [internalMonth, setInternalMonth] = useState<number>(new Date().getMonth() + 1);

  // Support controlled and uncontrolled modes
  const selectedMonth = month ?? internalMonth;
  const setSelectedMonth = (m: number | ((prev: number) => number)) => {
    const newMonth = typeof m === "function" ? m(selectedMonth) : m;
    setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  };
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(defaultCollapsed ? new Set() : new Set(["income", "expense", "loan_payment"]));
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Sync internal state when controlled prop changes
  useEffect(() => {
    if (month != null) setInternalMonth(month);
  }, [month]);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Delete
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<BudgetEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Fetch budget year ─────────────────────────────────
  const fetchBudgetYear = useCallback(async () => {
    if (!userEmail) return;
    try {
      setLoading(true);
      const yearsRes = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/years`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!yearsRes.ok) throw new Error("Failed to fetch budget years");

      const years: BudgetYear[] = await yearsRes.json();
      const activeYear = years.find((y) => y.status === "active") ?? years[0];
      if (!activeYear) {
        setBudgetYear(null);
        setLoading(false);
        return;
      }

      // Fetch year with summaries
      const yearRes = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/years/${activeYear.year}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!yearRes.ok) throw new Error("Failed to fetch budget year details");

      const yearData: BudgetYear = await yearRes.json();
      setBudgetYear(yearData);
    } catch (error) {
      logger.error("[BudgetView] Failed to load budget year", error);
      toast({ title: intl.formatMessage({ id: "budget.loadError" }), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userEmail, intl, toast]);

  // ─── Fetch month entries ───────────────────────────────
  const fetchMonthEntries = useCallback(async () => {
    if (!userEmail || !budgetYear) return;
    try {
      const res = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/years/${budgetYear.year}/months/${selectedMonth}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to fetch month entries");
      const data: BudgetEntry[] = await res.json();
      setEntries(data);
    } catch (error) {
      logger.error("[BudgetView] Failed to load month entries", error);
    }
  }, [userEmail, budgetYear, selectedMonth]);

  useEffect(() => {
    void fetchBudgetYear();
  }, [fetchBudgetYear]);

  useEffect(() => {
    void fetchMonthEntries();
  }, [fetchMonthEntries]);

  // ─── Month summary for current month ──────────────────
  const monthSummary = useMemo(() => {
    if (!budgetYear?.monthly_summaries) return null;
    return budgetYear.monthly_summaries.find((s) => s.month === selectedMonth) ?? null;
  }, [budgetYear, selectedMonth]);

  // ─── Group entries by type, then by category ──────────
  const groupedEntries = useMemo(() => {
    const groups: Record<string, Record<string, BudgetEntry[]>> = {
      income: {},
      expense: {},
      loan_payment: {},
    };

    for (const entry of entries) {
      const type = entry.entry_type;
      if (!groups[type]) groups[type] = {};
      if (!groups[type][entry.category]) groups[type][entry.category] = [];
      groups[type][entry.category].push(entry);
    }

    return groups;
  }, [entries]);

  // ─── Toggle section expanded ──────────────────────────
  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Categories start collapsed — user expands as needed

  // ─── Inline edit handlers ─────────────────────────────
  const startEdit = (entry: BudgetEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.planned_amount.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (entry: BudgetEntry) => {
    if (!userEmail) return;
    const newAmount = parseNumber(editValue);
    if (newAmount === null || newAmount < 0) {
      toast({ title: intl.formatMessage({ id: "validation.amountPositive" }), variant: "destructive" });
      return;
    }

    const prevAmount = entry.planned_amount;
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, planned_amount: newAmount } : e)),
    );
    setEditingId(null);

    try {
      const res = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/entries/${entry.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ planned_amount: newAmount }),
        },
      );
      if (!res.ok) throw new Error("Failed to update entry");
      toast({ title: intl.formatMessage({ id: "budget.saved" }) });
      // Refresh year summary
      void fetchBudgetYear();
    } catch (error) {
      logger.error("[BudgetView] Failed to save edit", error);
      // Rollback
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, planned_amount: prevAmount } : e)),
      );
      toast({ title: intl.formatMessage({ id: "budget.saveError" }), variant: "destructive" });
    }
  };

  // ─── Add entry ────────────────────────────────────────
  const addEntryFieldConfig: FormFieldConfig<AddEntryFormValues>[] = useMemo(
    () => [
      {
        name: "entry_type",
        labelId: "budget.entryType",
        component: "select",
        options: ENTRY_TYPE_OPTIONS.map((o) => ({
          value: o.value,
          labelId: o.labelId,
        })),
      },
      {
        name: "category",
        labelId: "expenses.form.category",
        component: "text",
      },
      {
        name: "description",
        labelId: "expenses.form.description",
        component: "text",
      },
      {
        name: "planned_amount",
        labelId: "budget.planned",
        component: "currency",
      },
      {
        name: "is_recurring",
        labelId: "budget.recurring",
        component: "switch",
      },
    ],
    [],
  );

  const handleAddEntry = async (values: AddEntryFormValues) => {
    if (!userEmail || !budgetYear) return;
    setIsAdding(true);
    try {
      const res = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ...values,
            month: selectedMonth,
            budget_year_id: budgetYear.id,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to add entry");
      const created: BudgetEntry = await res.json();
      setEntries((prev) => [...prev, created]);
      setAddDialogOpen(false);
      toast({ title: intl.formatMessage({ id: "budget.saved" }) });
      void fetchBudgetYear();
    } catch (error) {
      logger.error("[BudgetView] Failed to add entry", error);
      toast({ title: intl.formatMessage({ id: "budget.saveError" }), variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  // ─── Delete entry ─────────────────────────────────────
  const handleDelete = async () => {
    if (!userEmail || !pendingDeleteEntry) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/budget/entries/${pendingDeleteEntry.id}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("Failed to delete entry");
      setEntries((prev) => prev.filter((e) => e.id !== pendingDeleteEntry.id));
      toast({ title: intl.formatMessage({ id: "budget.deleted" }) });
      void fetchBudgetYear();
    } catch (error) {
      logger.error("[BudgetView] Failed to delete entry", error);
      toast({ title: intl.formatMessage({ id: "budget.deleteError" }), variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setConfirmDeleteOpen(false);
      setPendingDeleteEntry(null);
    }
  };

  const selectedMonthLong = useMemo(() => {
    const d = new Date(2026, selectedMonth - 1, 1);
    return intl.formatDate(d, { month: "long" });
  }, [intl, selectedMonth]);

  // ─── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!budgetYear) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            <FormattedMessage id="budget.noData" />
          </p>
        </CardContent>
      </Card>
    );
  }

  const _showIncome = !showTypes || showTypes.includes("income");
  const _showExpenses = !showTypes || showTypes.includes("expense") || showTypes.includes("loan_payment");
  const totalPlannedIncome = monthSummary?.planned_income ?? 0;
  const totalPlannedExpenses = (monthSummary?.planned_expenses ?? 0) + (monthSummary?.planned_loan_payments ?? 0);
  const balance = totalPlannedIncome - totalPlannedExpenses;

  return (
    <div className="space-y-6">
      {/* Year title + month navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          <FormattedMessage id="budget.title" values={{ year: budgetYear.year, month: selectedMonthLong }} />
        </h2>
        <MonthBar selectedMonth={selectedMonth} onMonthSelect={setSelectedMonth} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-1.5 px-3">
            <p className="text-[10px] uppercase tracking-wide text-emerald-700">
              <FormattedMessage id="budget.income" />
            </p>
            <p className="text-sm font-bold text-emerald-700">
              {formatCurrency(totalPlannedIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="py-1.5 px-3">
            <p className="text-[10px] uppercase tracking-wide text-rose-700">
              <FormattedMessage id="budget.expenses" />
            </p>
            <p className="text-sm font-bold text-rose-700">
              {formatCurrency(totalPlannedExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card className={cn(
          "border-2",
          balance >= 0 ? "border-emerald-300 bg-emerald-50/30" : "border-rose-300 bg-rose-50/30",
        )}>
          <CardContent className="py-1.5 px-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <FormattedMessage id="budget.balance" />
            </p>
            <p className={cn(
              "text-sm font-bold",
              balance >= 0 ? "text-emerald-700" : "text-rose-700",
            )}>
              {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entry groups */}
      {(["income", "expense", "loan_payment"] as const).filter((type) => !showTypes || showTypes.includes(type)).map((type) => {
        const meta = ENTRY_TYPE_META[type];
        const categories = groupedEntries[type] ?? {};
        const allEntries = Object.values(categories).flat();
        const typeTotal = allEntries.reduce((sum, e) => sum + e.planned_amount, 0);
        const isExpanded = expandedTypes.has(type);

        return (
          <Card key={type}>
            <button
              type="button"
              onClick={() => toggleType(type)}
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
            >
              <div className="flex items-center gap-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-muted", meta.colorClass)}>
                  {meta.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    <FormattedMessage id={meta.labelId} />
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({allEntries.length})
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-semibold", meta.colorClass)}>
                  {formatCurrency(typeTotal)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    !isExpanded && "-rotate-90",
                  )}
                />
              </div>
            </button>

            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-6">
                {allEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    <FormattedMessage id="budget.noEntries" />
                  </p>
                ) : (
                  <div className={cn((type === "expense" || type === "loan_payment") ? "space-y-1" : "divide-y divide-muted/40")}>
                    {Object.entries(categories).map(([category, catEntries]) => {
                      const catMeta = type === "expense"
                        ? (EXPENSE_CATEGORY_META[category.toLowerCase()] ?? DEFAULT_CATEGORY_META)
                        : type === "loan_payment"
                          ? LOAN_CATEGORY_META
                          : null;
                      const catTotal = catEntries.reduce((sum, e) => sum + e.planned_amount, 0);
                      const catKey = `${type}:${category}`;
                      const isCatExpanded = expandedCategories.has(catKey);
                      const hasMultipleCategories = (type === "expense" || type === "loan_payment") && Object.keys(categories).length > 1;

                      return (
                        <div
                          key={category}
                          className={cn(
                            (type === "expense" || type === "loan_payment") && catMeta
                              ? `rounded-lg ${catMeta.bgColor} px-4 py-1`
                              : undefined,
                          )}
                        >
                          {/* Category header for expenses — clickable to fold/unfold */}
                          {hasMultipleCategories && catMeta && (
                            <button
                              type="button"
                              onClick={() => toggleCategory(catKey)}
                              className="flex w-full items-center justify-between pt-1.5 pb-1 hover:opacity-80 transition-opacity"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{catMeta.icon}</span>
                                <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                                  {intl.formatMessage({
                                    id: `${CATEGORY_I18N_PREFIX[type] ?? "expenses.categories"}.${category.toLowerCase()}`,
                                    defaultMessage: category,
                                  })}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({catEntries.length})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                  {formatCurrency(catTotal)}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                    !isCatExpanded && "-rotate-90",
                                  )}
                                />
                              </div>
                            </button>
                          )}
                          {(!hasMultipleCategories || isCatExpanded) && catEntries.map((entry) => {
                            // Hide category label when it matches description (e.g. loan entries)
                            const categoryLabel = type !== "expense"
                              ? intl.formatMessage({
                                  id: `${CATEGORY_I18N_PREFIX[type] ?? "expenses.categories"}.${entry.category.toLowerCase()}`,
                                  defaultMessage: entry.category,
                                })
                              : null;
                            const showCategoryLabel = categoryLabel && !entry.description.toLowerCase().includes(categoryLabel.toLowerCase());

                            return (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between py-2.5 group"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground truncate flex items-center gap-1.5">
                                    {entry.is_recurring && (
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 shrink-0">
                                        <FormattedMessage id="budget.recurring" />
                                      </span>
                                    )}
                                    {entry.description}
                                  </p>
                                  {showCategoryLabel && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {categoryLabel}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  {editingId === entry.id ? (
                                    <>
                                      <Input
                                        autoFocus
                                        className="h-8 w-28 text-right text-sm"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") void saveEdit(entry);
                                          if (e.key === "Escape") cancelEdit();
                                        }}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                        onClick={() => void saveEdit(entry)}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground"
                                        onClick={cancelEdit}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className={cn("text-sm font-semibold tabular-nums", meta.colorClass)}>
                                        {formatCurrency(entry.planned_amount)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => startEdit(entry)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                                        onClick={() => {
                                          setPendingDeleteEntry(entry);
                                          setConfirmDeleteOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add entry button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setAddDialogOpen(true)} className="px-6">
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="budget.addEntry" />
        </Button>
      </div>

      {/* Add entry dialog */}
      <CrudDialog
        open={addDialogOpen}
        mode="create"
        onOpenChange={setAddDialogOpen}
        titleId="budget.addEntry"
        submitLabelId="common.save"
        schema={addEntrySchema}
        defaultValues={addEntryDefaults}
        fields={addEntryFieldConfig}
        onSubmit={handleAddEntry}
        isSubmitting={isAdding}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setPendingDeleteEntry(null);
        }}
        titleId="budget.deleteEntry"
        descriptionId="common.confirmDelete"
        confirmLabelId="common.delete"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
