"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Filter,
  Pencil,
  PiggyBank,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { Saving, SavingCategory, SavingType, SavingsSummary } from "@/types/financial-freedom";
import { CrudDialog, type FormFieldConfig } from "@/components/crud/CrudDialog";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import Tooltip from "@/components/Tooltip";
import {
  parseNumber,
  validateAmountPositive,
  validateAmountNonNegative,
  validateDateString,
} from "@/lib/validation";
import { cn } from "@/lib/utils";

type SavingsDateRangePreset =
  | "all"
  | "current_month"
  | "last_month"
  | "last_quarter"
  | "last_half"
  | "last_year";

interface SavingsFilters {
  category?: SavingCategory;
  dateRange?: SavingsDateRangePreset;
  savingType?: SavingType;
}

const savingTypeOptions = [
  { value: SavingType.DEPOSIT, labelId: "savings.types.deposit" },
  { value: SavingType.WITHDRAWAL, labelId: "savings.types.withdrawal" },
];

const dateRangeOptions: { value: SavingsDateRangePreset; labelId: string }[] = [
  { value: "current_month", labelId: "savings.filters.dateRange.currentMonth" },
  { value: "last_month", labelId: "savings.filters.dateRange.lastMonth" },
  { value: "last_quarter", labelId: "savings.filters.dateRange.lastQuarter" },
  { value: "last_half", labelId: "savings.filters.dateRange.lastHalf" },
  { value: "last_year", labelId: "savings.filters.dateRange.lastYear" },
  { value: "all", labelId: "savings.filters.dateRange.all" },
];

const categoryOptions = Object.values(SavingCategory).map((category) => ({
  value: category,
  labelId: `savings.categories.${category}`,
}));

const savingSchema = z
  .object({
    category: z.string().min(1, "validation.categoryRequired"),
    description: z
      .string()
      .trim()
      .max(200, {
        message: "validation.description.tooLong",
      })
      .optional()
      .transform((value) => value ?? ""),
    amount: z
      .preprocess((value) => {
        if (typeof value === "number") {
          return value.toString();
        }
        if (typeof value === "string") {
          return value.trim();
        }
        return value;
      }, z.string().min(1, "validation.required"))
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
      .min(1, "validation.required"),
    saving_type: z.string().min(1, "validation.categoryRequired"),
    is_recurring: z.boolean().default(false),
    target_amount: z
      .preprocess((value) => {
        if (value === null || value === undefined) {
          return undefined;
        }
        if (typeof value === "number") {
          return value.toString();
        }
        if (typeof value === "string") {
          const trimmed = value.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        }
        return value;
      }, z.string().optional())
      .transform((value, ctx) => {
        if (!value) return undefined;
        const error = validateAmountNonNegative(value);
        if (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error.messageId,
          });
        }
        return parseNumber(value) ?? undefined;
      }),
  })
  .superRefine((data, ctx) => {
    const dateIssue = validateDateString(data.date);
    if (dateIssue) {
      ctx.addIssue({
        path: ["date"],
        code: z.ZodIssueCode.custom,
        message: dateIssue.messageId,
      });
    }
  });

type SavingFormValues = z.infer<typeof savingSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const savingDefaultValues: SavingFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  saving_type: SavingType.DEPOSIT,
  is_recurring: false,
  target_amount: undefined,
};

const formatDateForApi = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveDateRange = (
  preset?: SavingsDateRangePreset,
): { startDate?: string; endDate?: string } => {
  if (!preset || preset === "all") {
    return {};
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case "current_month": {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        startDate: formatDateForApi(start),
        endDate: formatDateForApi(end),
      };
    }
    case "last_month": {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        startDate: formatDateForApi(start),
        endDate: formatDateForApi(end),
      };
    }
    case "last_quarter": {
      const currentQuarter = Math.floor(month / 3);
      const previousQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
      const quarterYear = currentQuarter === 0 ? year - 1 : year;
      const startMonth = previousQuarter * 3;
      const start = new Date(quarterYear, startMonth, 1);
      const end = new Date(quarterYear, startMonth + 3, 0);
      return {
        startDate: formatDateForApi(start),
        endDate: formatDateForApi(end),
      };
    }
    case "last_half": {
      const currentHalf = month < 6 ? 0 : 1;
      const previousHalf = currentHalf === 0 ? 1 : 0;
      const halfYear = currentHalf === 0 ? year - 1 : year;
      const startMonth = previousHalf === 0 ? 0 : 6;
      const start = new Date(halfYear, startMonth, 1);
      const end = new Date(halfYear, startMonth + 6, 0);
      return {
        startDate: formatDateForApi(start),
        endDate: formatDateForApi(end),
      };
    }
    case "last_year": {
      const previousYear = year - 1;
      const start = new Date(previousYear, 0, 1);
      const end = new Date(previousYear, 12, 0);
      return {
        startDate: formatDateForApi(start),
        endDate: formatDateForApi(end),
      };
    }
    default:
      return {};
  }
};

const mapSavingToFormValues = (saving: Saving): SavingFormValues => ({
  category: saving.category,
  description: saving.description ?? "",
  amount: saving.amount,
  date: saving.date.slice(0, 10),
  saving_type: saving.saving_type,
  is_recurring: saving.is_recurring,
  target_amount: saving.target_amount ?? undefined,
});

const formatSavingAmount = (saving: Saving, formatCurrency: (value: number) => string) => {
  const amount = formatCurrency(saving.amount);
  return saving.saving_type === SavingType.WITHDRAWAL ? `- ${amount}` : `+ ${amount}`;
};

export const SavingsManager = () => {
  const intl = useIntl();
  const session = useSession();
  const { formatCurrency } = useSettings();
  const { toast } = useToast();

  const [savings, setSavings] = useState<Saving[]>([]);
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [filters, setFilters] = useState<SavingsFilters>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeSaving, setActiveSaving] = useState<Saving | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogInitialValues, setDialogInitialValues] = useState<Partial<SavingFormValues> | undefined>(undefined);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Saving | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<"date" | "amount" | "category" | "type">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const userEmail = session.data?.user?.email ?? null;
  const tableRef = useRef<HTMLDivElement | null>(null);
  const sparklineGradientId = useId();

  const categoryTargetDefaults = useMemo(() => {
    const latest = new Map<SavingCategory, { amount: number; timestamp: number }>();

    savings.forEach((saving) => {
      if (saving.target_amount === null || saving.target_amount === undefined) {
        return;
      }

      const timestampSource =
        saving.updated_at ?? saving.created_at ?? saving.date;
      const timestamp = new Date(timestampSource).getTime();
      if (Number.isNaN(timestamp)) {
        return;
      }

      const existing = latest.get(saving.category);
      if (!existing || timestamp >= existing.timestamp) {
        latest.set(saving.category, {
          amount: saving.target_amount,
          timestamp,
        });
      }
    });

    return new Map<SavingCategory, number>(
      Array.from(latest.entries()).map(([category, data]) => [
        category,
        data.amount,
      ]),
    );
  }, [savings]);

  const savingFieldConfig = useMemo<FormFieldConfig<SavingFormValues>[]>(() => {
    return [
      {
        name: "amount",
        labelId: "savings.form.amount",
        component: "number",
        step: "0.01",
        min: 0,
        autoFocus: true,
      },
      {
        name: "category",
        labelId: "savings.form.category",
        component: "select",
        placeholderId: "savings.form.category.select",
        options: categoryOptions,
        onValueChange: (value, formInstance) => {
          if (dialogMode !== "create") {
            return;
          }

          const categoryValue = value as SavingCategory | undefined;
          if (!categoryValue) {
            return;
          }

          const defaultTarget = categoryTargetDefaults.get(categoryValue);
          if (defaultTarget === undefined) {
            return;
          }

          formInstance.setValue("target_amount", defaultTarget, {
            shouldDirty: false,
            shouldTouch: false,
            shouldValidate: false,
          });
        },
      },
      {
        name: "description",
        labelId: "savings.form.description",
        component: "text",
      },
      {
        name: "date",
        labelId: "savings.form.date",
        component: "date",
      },
      {
        name: "saving_type",
        labelId: "savings.form.savingType",
        component: "select",
        options: savingTypeOptions,
      },
      {
        name: "is_recurring",
        labelId: "savings.form.isRecurring",
        component: "switch",
      },
      {
        name: "target_amount",
        labelId: "savings.form.targetAmount",
        component: "number",
        step: "0.01",
        min: 0,
      },
    ];
  }, [categoryTargetDefaults, dialogMode]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/savings/summary");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data: SavingsSummary = await response.json();
      setSummary(data);
    } catch (error) {
      console.error("[Savings] Failed to fetch summary", error);
    }
  }, []);

  const fetchSavings = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);

      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      const { startDate, endDate } = resolveDateRange(filters.dateRange);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const query = params.toString();
      const response = await fetch(`/api/savings${query ? `?${query}` : ""}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data: Saving[] = await response.json();
      setSavings(data);
    } catch (error) {
      console.error("[Savings] Failed to fetch savings", error);
      setApiError(intl.formatMessage({ id: "savings.loadError" }));
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.dateRange, intl]);

  useEffect(() => {
    void fetchSavings();
  }, [fetchSavings]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleOpenCreate = () => {
    setActiveSaving(null);
    setDialogMode("create");
    setDialogInitialValues(undefined);
    setDialogOpen(true);
  };

  const handleOpenWithdraw = () => {
    setActiveSaving(null);
    setDialogMode("create");
    setDialogInitialValues({
      saving_type: SavingType.WITHDRAWAL,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (saving: Saving) => {
    setActiveSaving(saving);
    setDialogMode("edit");
    setDialogInitialValues(undefined);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveSaving(null);
      setDialogInitialValues(undefined);
    }
  };

  const showErrorToast = (messageId: string) => {
    toast({
      title: intl.formatMessage({ id: messageId }),
      variant: "destructive",
    });
  };

  const handleSubmit = async (values: SavingFormValues) => {
    if (!userEmail) {
      showErrorToast("common.mustBeLoggedIn");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        target_amount: values.target_amount ?? null,
      };

      if (dialogMode === "create") {
        const response = await fetch("/api/savings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const created: Saving = await response.json();
        setSavings((prev) => [...prev, created]);
        void fetchSummary();

        toast({
          title: intl.formatMessage({ id: "savings.toast.createSuccess" }),
        });
      } else if (activeSaving) {
        const response = await fetch(`/api/savings/${activeSaving.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const updated: Saving = await response.json();
        setSavings((prev) =>
          prev.map((saving) => (saving.id === updated.id ? updated : saving)),
        );
        void fetchSummary();

        toast({
          title: intl.formatMessage({ id: "savings.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      console.error("[Savings] Failed to submit form", error);
      showErrorToast("savings.toast.genericError");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      setConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/savings/${pendingDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setSavings((prev) =>
        prev.filter((saving) => saving.id !== pendingDelete.id),
      );
      void fetchSummary();

      toast({
        title: intl.formatMessage({ id: "savings.toast.deleteSuccess" }),
      });
    } catch (error) {
      console.error("[Savings] Failed to delete saving", error);
      showErrorToast("savings.toast.genericError");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const filteredSavings = useMemo(() => {
    if (!filters.savingType) {
      return savings;
    }
    return savings.filter((saving) => saving.saving_type === filters.savingType);
  }, [savings, filters.savingType]);

  const monthlyTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        total: number;
        date: Date;
      }
    >();

    savings.forEach((saving) => {
      const date = new Date(saving.date);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const key = `${normalizedDate.getFullYear()}-${String(normalizedDate.getMonth() + 1).padStart(2, "0")}`;
      const direction = saving.saving_type === SavingType.DEPOSIT ? 1 : -1;

      const existing = map.get(key) ?? { key, total: 0, date: normalizedDate };
      existing.total += direction * saving.amount;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [savings]);

  const sortedSavings = useMemo(() => {
    const collator = new Intl.Collator(intl.locale, { sensitivity: "base" });
    return [...filteredSavings].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "amount") {
        return direction * (a.amount - b.amount);
      }
      if (sortKey === "category") {
        return direction * collator.compare(a.category, b.category);
      }
      if (sortKey === "type") {
        return direction * collator.compare(a.saving_type, b.saving_type);
      }
      const dateDiff =
        new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) {
        return direction * dateDiff;
      }
      const createdDiff =
        new Date(a.created_at ?? a.date).getTime() -
        new Date(b.created_at ?? b.date).getTime();
      if (createdDiff !== 0) {
        return direction * createdDiff;
      }
      return direction * (a.id - b.id);
    });
  }, [filteredSavings, sortDirection, sortKey, intl.locale]);

  const latestMonth = monthlyTotals.length > 0 ? monthlyTotals[monthlyTotals.length - 1] : undefined;
  const previousMonth = monthlyTotals.length > 1 ? monthlyTotals[monthlyTotals.length - 2] : null;
  const changeAmount = latestMonth?.total ?? 0;
  const previousMonthLabel = previousMonth
    ? intl.formatDate(previousMonth.date, { month: "long" })
    : undefined;

  let changeMessageId: string;
  let changeMessageValues: Record<string, string> = {};

  if (!latestMonth) {
    changeMessageId = "savings.summary.changeNoData";
  } else if (!previousMonth) {
    changeMessageId = "savings.summary.changeFirst";
    changeMessageValues = { amount: formatCurrency(Math.abs(changeAmount)) };
  } else if (changeAmount > 0) {
    changeMessageId = "savings.summary.changePositive";
    changeMessageValues = {
      amount: formatCurrency(Math.abs(changeAmount)),
      previousMonth: previousMonthLabel ?? "",
    };
  } else if (changeAmount < 0) {
    changeMessageId = "savings.summary.changeNegative";
    changeMessageValues = {
      amount: formatCurrency(Math.abs(changeAmount)),
      previousMonth: previousMonthLabel ?? "",
    };
  } else {
    changeMessageId = "savings.summary.changeNeutral";
    changeMessageValues = {
      previousMonth: previousMonthLabel ?? "",
    };
  }

  const changeToneClass = !latestMonth
    ? "bg-muted/70 text-muted-foreground"
    : changeAmount > 0
      ? "bg-emerald-100 text-emerald-700"
      : changeAmount < 0
        ? "bg-rose-100 text-rose-700"
        : "bg-muted/70 text-muted-foreground";

  const changeSymbol =
    !latestMonth ? "•" : changeAmount > 0 ? "↑" : changeAmount < 0 ? "↓" : "•";

  const topCategory = useMemo(() => {
    if (!summary) {
      return null;
    }

    const entries = Object.entries(summary.category_totals ?? {});
    if (entries.length === 0) {
      return null;
    }

    const [category, amount] = entries.reduce(
      (acc, curr) => (curr[1] > acc[1] ? curr : acc),
      entries[0] as [string, number],
    );

    return { category, amount };
  }, [summary]);

  const displayedRecentTransactions = useMemo(() => {
    if (!summary) {
      return [];
    }

    return recentExpanded
      ? summary.recent_transactions.slice(0, 6)
      : summary.recent_transactions.slice(0, 3);
  }, [recentExpanded, summary]);

  const canExpandRecent = Boolean(
    summary && summary.recent_transactions.length > 3,
  );

  const handleScrollToTable = useCallback(() => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const sparkline = useMemo(() => {
    if (monthlyTotals.length < 2) {
      return null;
    }

    const data = monthlyTotals.slice(-6);
    const width = 120;
    const height = 32;
    const totals = data.map((entry) => entry.total);
    const minValue = Math.min(...totals, 0);
    const maxValue = Math.max(...totals, 0);
    const range = maxValue - minValue || 1;

    const points = data.map((entry, index) => {
      const x =
        data.length === 1
          ? width / 2
          : (index / (data.length - 1)) * width;
      const y =
        height - ((entry.total - minValue) / range) * height;
      return { x, y };
    });

    const strokePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ");
    const areaPath = `${strokePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

    const startLabel = intl.formatDate(data[0].date, { month: "short" });
    const endLabel = intl.formatDate(
      data[data.length - 1].date,
      { month: "short" },
    );

    return {
      width,
      height,
      strokePath,
      areaPath,
      startLabel,
      endLabel,
    };
  }, [monthlyTotals, intl]);

  const balanceById = useMemo(() => {
    const chronological = [...savings].sort((a, b) => {
      const dateDiff =
        new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }
      const createdDiff =
        new Date(a.created_at ?? a.date).getTime() -
        new Date(b.created_at ?? b.date).getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return a.id - b.id;
    });

    const map = new Map<number, number>();
    let running = 0;
    chronological.forEach((saving) => {
      const delta =
        saving.saving_type === SavingType.DEPOSIT
          ? saving.amount
          : -saving.amount;
      running += delta;
      map.set(saving.id, running);
    });
    return map;
  }, [savings]);

  const totals = useMemo(() => {
    return filteredSavings.reduce(
      (acc, saving) => {
        if (saving.saving_type === SavingType.DEPOSIT) {
          acc.deposits += saving.amount;
        } else {
          acc.withdrawals += saving.amount;
        }
        acc.net = acc.deposits - acc.withdrawals;
        return acc;
      },
      { deposits: 0, withdrawals: 0, net: 0 },
    );
  }, [filteredSavings]);

  const handleSort = useCallback(
    (key: typeof sortKey) => {
      setSortDirection((prevDirection) => {
        if (sortKey === key) {
          return prevDirection === "asc" ? "desc" : "asc";
        }
        return key === "date" ? "desc" : "asc";
      });
      setSortKey(key);
    },
    [sortKey],
  );

  const renderSortableHead = useCallback(
    (key: typeof sortKey, labelId: string, align: "left" | "right" = "left") => {
      const isActive = sortKey === key;
      const indicator = isActive ? (sortDirection === "asc" ? "↑" : "↓") : "";

      return (
        <button
          type="button"
          onClick={() => handleSort(key)}
          className={cn(
            "flex w-full items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary",
            align === "right" ? "justify-end text-right" : "justify-start text-left",
          )}
        >
          <FormattedMessage id={labelId} />
          <span aria-hidden="true" className="text-muted-foreground">
            {indicator}
          </span>
        </button>
      );
    },
    [handleSort, sortDirection, sortKey],
  );

  if (loading && savings.length === 0) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            <FormattedMessage id="savings.title" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="savings.subtitle" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleOpenWithdraw}>
            <ArrowDownRight className="mr-2 h-4 w-4" />
            <FormattedMessage id="savings.actions.withdraw" />
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="savings.actions.add" />
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-100 via-white to-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg md:col-span-2">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200 text-emerald-800">
                    <PiggyBank className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-800/80">
                      <FormattedMessage id="savings.summary.totalSavings" />
                    </p>
                    {topCategory && (
                      <p className="text-xs text-emerald-800/70">
                        <FormattedMessage
                          id="savings.summary.topCategory"
                          values={{
                            category: (
                              <span className="font-medium text-emerald-900">
                                <FormattedMessage id={`savings.categories.${topCategory.category}`} />
                              </span>
                            ),
                          }}
                        />
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-5xl font-semibold text-emerald-900 transition-all duration-300">
                    {formatCurrency(summary.total_savings)}
                  </p>
                  <p
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                      changeToneClass,
                    )}
                  >
                    <span aria-hidden="true">{changeSymbol}</span>
                    <FormattedMessage id={changeMessageId} values={changeMessageValues} />
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-emerald-900/80">
                <p>
                  <FormattedMessage
                    id="savings.summary.monthlyContributionHint"
                    values={{ amount: formatCurrency(summary.monthly_contribution) }}
                  />
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-emerald-200 bg-white/80 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => void fetchSummary()}
                >
                  <FormattedMessage id="common.refresh" defaultMessage="Odśwież" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col justify-between rounded-3xl border border-muted/60 bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="savings.summary.monthlyContribution" />
                </p>
                <p className="text-3xl font-semibold text-emerald-800 transition-all duration-300">
                  {formatCurrency(summary.monthly_contribution)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              <FormattedMessage id="savings.summary.monthlyContributionDescription" />
            </p>
          </Card>

          <Card className="flex flex-col rounded-3xl border border-muted/60 bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="savings.summary.recentTransactions" />
                </p>
                <p className="text-sm text-muted-foreground">
                  <FormattedMessage id="savings.summary.recentHint" />
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {displayedRecentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-xl border border-muted/40 bg-muted/40 px-3 py-2"
                >
                  <span className="font-medium text-slate-700">
                    <FormattedMessage id={`savings.categories.${transaction.category}`} />
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      transaction.saving_type === SavingType.DEPOSIT
                        ? "text-emerald-700"
                        : "text-rose-600",
                    )}
                  >
                    {formatSavingAmount(transaction, formatCurrency)}
                  </span>
                </div>
              ))}
              {summary.recent_transactions.length === 0 && (
                <span className="block rounded-xl border border-dashed border-muted/40 bg-muted/20 px-3 py-2 text-center text-muted-foreground">
                  <FormattedMessage id="savings.summary.noRecent" />
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {canExpandRecent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary"
                  onClick={() => setRecentExpanded((prev) => !prev)}
                  aria-expanded={recentExpanded}
                >
                  <FormattedMessage
                    id={
                      recentExpanded
                        ? "savings.summary.recentToggle.collapse"
                        : "savings.summary.recentToggle.expand"
                    }
                  />
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      recentExpanded ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-muted/60"
                onClick={handleScrollToTable}
              >
                <FormattedMessage id="savings.summary.viewAll" />
              </Button>
            </div>
            {sparkline && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="savings.summary.trendLabel" />
                </p>
                <svg
                  viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                  className="mt-2 h-16 w-full text-emerald-500"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id={sparklineGradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
                      <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d={sparkline.areaPath}
                    fill={`url(#${sparklineGradientId})`}
                  />
                  <path
                    d={sparkline.strokePath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{sparkline.startLabel}</span>
                  <span>{sparkline.endLabel}</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="flex flex-col justify-between rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="savings.summary.emergencyFund" />
                </p>
                <p className="text-lg font-semibold text-emerald-800">
                  {formatCurrency(summary.emergency_fund)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {formatCurrency(summary.emergency_fund_target)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  <FormattedMessage id="savings.summary.emergencyProgress" />
                </span>
                <span className="font-medium text-emerald-700">
                  {Math.round(summary.emergency_fund_progress)}%
                </span>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-emerald-100" aria-hidden="true">
                <div
                  className="h-3 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(summary.emergency_fund_progress, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                <FormattedMessage id="savings.summary.emergencyHint" />
              </p>
            </div>
          </Card>
        </div>
      )}

      <Card ref={tableRef} className="rounded-3xl border border-muted/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-medium">
            <FormattedMessage id="savings.transactions" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-muted/50 bg-muted/20 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={filters.category ?? "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    category: value === "all" ? undefined : (value as SavingCategory),
                  }))
                }
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue
                    placeholder={intl.formatMessage({ id: "savings.filters.category" })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {intl.formatMessage({ id: "savings.filters.category" })}
                  </SelectItem>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {intl.formatMessage({ id: option.labelId })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.dateRange ?? "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: value as SavingsDateRangePreset,
                  }))
                }
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue
                    placeholder={intl.formatMessage({ id: "savings.filters.dateRange" })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {intl.formatMessage({ id: option.labelId })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.savingType ?? "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    savingType:
                      value === "all" ? undefined : (value as SavingType),
                  }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue
                    placeholder={intl.formatMessage({ id: "savings.filters.typeLabel" })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {intl.formatMessage({ id: "savings.filters.type.all" })}
                  </SelectItem>
                  <SelectItem value={SavingType.DEPOSIT}>
                    {intl.formatMessage({ id: "savings.filters.type.deposit" })}
                  </SelectItem>
                  <SelectItem value={SavingType.WITHDRAWAL}>
                    {intl.formatMessage({ id: "savings.filters.type.withdrawal" })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFilters({})}>
                <FormattedMessage id="savings.filters.clear" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => void fetchSavings()}
              >
                <Filter className="mr-2 h-4 w-4" />
                <FormattedMessage id="savings.filters.apply" />
              </Button>
            </div>
          </div>

          {apiError && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {apiError}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{renderSortableHead("category", "savings.table.category")}</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="savings.table.description" />
                </TableHead>
                <TableHead className="text-right">
                  {renderSortableHead("amount", "savings.table.amount", "right")}
                </TableHead>
                <TableHead>
                  {renderSortableHead("date", "savings.table.date")}
                </TableHead>
                <TableHead>
                  {renderSortableHead("type", "savings.table.type")}
                </TableHead>
                <TableHead>
                  <FormattedMessage id="savings.table.recurring" />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage id="savings.table.targetAmount" />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage id="savings.table.balanceAfter" />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage id="savings.table.actions" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSavings.map((saving) => {
                const isDeposit = saving.saving_type === SavingType.DEPOSIT;
                const amountClass = isDeposit ? "text-emerald-600" : "text-rose-600";
                const amountIcon = isDeposit ? (
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                );
                const balanceAfter = balanceById.get(saving.id) ?? saving.amount;

                return (
                  <TableRow
                    key={saving.id}
                    className="border-b border-muted/30 text-sm leading-relaxed odd:bg-[#faf9f7] even:bg-white transition-colors hover:bg-emerald-50 focus-within:bg-emerald-50"
                  >
                    <TableCell className="text-sm font-medium text-slate-700">
                      <FormattedMessage id={`savings.categories.${saving.category}`} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{saving.description}</TableCell>
                    <TableCell className={cn("text-right text-base font-semibold", amountClass)}>
                      <span className="inline-flex items-center justify-end gap-2">
                        {amountIcon}
                        {formatSavingAmount(saving, formatCurrency)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        {intl.formatDate(new Date(saving.date), {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      <FormattedMessage id={`savings.types.${saving.saving_type}`} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {saving.is_recurring ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <FormattedMessage id="common.yes" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                          <FormattedMessage id="common.no" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-600">
                      {saving.target_amount ? formatCurrency(saving.target_amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-700">
                      {formatCurrency(balanceAfter)}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(saving)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">
                            {intl.formatMessage({ id: "common.edit" })}
                          </span>
                        </Button>
                      </Tooltip>
                      <Tooltip content={intl.formatMessage({ id: "common.delete" })}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPendingDelete(saving);
                            setConfirmOpen(true);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">
                            {intl.formatMessage({ id: "common.delete" })}
                          </span>
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedSavings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    <FormattedMessage id="savings.noEntries" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="grid gap-3 rounded-2xl border border-muted/60 bg-muted/20 px-4 py-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <FormattedMessage id="savings.summaryTotals.deposits" />
              </p>
              <p className="text-lg font-semibold text-emerald-700">
                {formatCurrency(totals.deposits)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <FormattedMessage id="savings.summaryTotals.withdrawals" />
              </p>
              <p className="text-lg font-semibold text-rose-600">
                {formatCurrency(totals.withdrawals)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <FormattedMessage id="savings.summaryTotals.net" />
              </p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  totals.net >= 0 ? "text-emerald-700" : "text-rose-600",
                )}
              >
                {formatCurrency(totals.net)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-emerald-200 bg-emerald-50/60 px-6 py-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200 text-emerald-700">
            <Target className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-emerald-900">
              <FormattedMessage id="savings.cta.title" />
            </p>
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="savings.cta.description" />
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <FormattedMessage id="savings.cta.button" />
        </Button>
      </div>

      <div className="sm:hidden">
        <Button
          onClick={handleOpenCreate}
          className="fixed bottom-6 right-6 shadow-lg"
          variant="default"
          size="lg"
          aria-label={intl.formatMessage({ id: "savings.actions.add" })}
        >
          <Plus className="mr-2 h-5 w-5" />
          <FormattedMessage id="savings.actions.add" />
        </Button>
        <Button
          onClick={handleOpenWithdraw}
          className="fixed bottom-20 right-6 shadow-lg"
          variant="outline"
          size="lg"
          aria-label={intl.formatMessage({ id: "savings.actions.withdraw" })}
        >
          <ArrowDownRight className="mr-2 h-5 w-5" />
          <FormattedMessage id="savings.actions.withdraw" />
        </Button>
      </div>

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={handleDialogClose}
        titleId={
          dialogMode === "create"
            ? "savings.dialog.createTitle"
            : "savings.dialog.editTitle"
        }
        submitLabelId={
          dialogMode === "create"
            ? "savings.dialog.createSubmit"
            : "savings.dialog.editSubmit"
        }
        schema={savingSchema}
        defaultValues={savingDefaultValues}
        initialValues={
          dialogMode === "edit" && activeSaving
            ? mapSavingToFormValues(activeSaving)
            : dialogMode === "create"
              ? dialogInitialValues
              : undefined
        }
        fields={savingFieldConfig}
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
        titleId="savings.deleteDialog.title"
        descriptionId="savings.deleteDialog.description"
        confirmLabelId="savings.deleteDialog.confirm"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};
