"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Filter,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { Saving, SavingCategory, SavingType, SavingsSummary, AccountType } from "@/types/financial-freedom";
import RetirementLimitsCard, { QuickAddSavingParams } from "./RetirementLimitsCard";
import { SavingsGoalsSection } from "./SavingsGoalsSection";
import { CrudDialog, type FormFieldConfig } from "@/components/crud/CrudDialog";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
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
import { logger } from "@/lib/logger";

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

const _savingTypeOptions = [
  { value: SavingType.DEPOSIT, labelId: "savings.types.deposit" },
  { value: SavingType.WITHDRAWAL, labelId: "savings.types.withdrawal" },
];

// Visual saving type options with icons for better UX
const savingTypeIconOptions = [
  {
    value: SavingType.DEPOSIT,
    labelId: "savings.types.deposit",
    icon: <ArrowUpRight className="h-5 w-5 text-emerald-600" />
  },
  {
    value: SavingType.WITHDRAWAL,
    labelId: "savings.types.withdrawal",
    icon: <ArrowDownRight className="h-5 w-5 text-rose-600" />
  },
];

const dateRangeOptions: { value: SavingsDateRangePreset; labelId: string }[] = [
  { value: "current_month", labelId: "savings.filters.dateRangeOptions.currentMonth" },
  { value: "last_month", labelId: "savings.filters.dateRangeOptions.lastMonth" },
  { value: "last_quarter", labelId: "savings.filters.dateRangeOptions.lastQuarter" },
  { value: "last_half", labelId: "savings.filters.dateRangeOptions.lastHalf" },
  { value: "last_year", labelId: "savings.filters.dateRangeOptions.lastYear" },
  { value: "all", labelId: "savings.filters.dateRangeOptions.all" },
];

const categoryOptions = Object.values(SavingCategory).map((category) => ({
  value: category,
  labelId: `savings.categories.${category}`,
}));

// Category icons for visual selection
const categoryIcons: Record<SavingCategory, React.ReactNode> = {
  [SavingCategory.EMERGENCY_FUND]: <ShieldCheck className="h-5 w-5" />,
  [SavingCategory.SIX_MONTH_FUND]: <CalendarClock className="h-5 w-5" />,
  [SavingCategory.RETIREMENT]: <TrendingUp className="h-5 w-5" />,
  [SavingCategory.COLLEGE]: <Target className="h-5 w-5" />,
  [SavingCategory.GENERAL]: <PiggyBank className="h-5 w-5" />,
  [SavingCategory.INVESTMENT]: <TrendingUp className="h-5 w-5" />,
  [SavingCategory.REAL_ESTATE]: <Target className="h-5 w-5" />,
  [SavingCategory.OTHER]: <RefreshCw className="h-5 w-5" />,
};

const categoryIconOptions = Object.values(SavingCategory).map((category) => ({
  value: category,
  labelId: `savings.categories.${category}`,
  icon: categoryIcons[category],
}));

const accountTypeOptions = Object.values(AccountType).map((type) => ({
  value: type,
  labelId: `savings.accountTypes.${type}`,
}));

// Badge styling for III Pillar account types (IKE, IKZE, OIPE, PPK)
const accountTypeBadgeStyles: Record<AccountType, { bg: string; text: string; icon: string }> = {
  [AccountType.STANDARD]: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '💰' },
  [AccountType.IKE]: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '🏦' },
  [AccountType.IKZE]: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '📊' },
  [AccountType.PPK]: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🏢' },
  [AccountType.OIPE]: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🇪🇺' },
};

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
    end_date: z
      .preprocess(
        (value) => (value === null || value === undefined ? "" : value),
        z.string().trim()
      )
      .optional()
      .transform((value) => value || null),
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
    account_type: z.string().default(AccountType.STANDARD),
    annual_return_rate: z
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
      .transform((value) => {
        if (!value) return undefined;
        const num = parseNumber(value);
        if (num === undefined || num === null) return undefined;
        // Convert percentage to decimal if needed (e.g., 5 -> 0.05)
        if (num > 1) {
          return num / 100;
        }
        return num;
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
    // Validate end_date if provided
    if (data.end_date) {
      const endDateIssue = validateDateString(data.end_date);
      if (endDateIssue) {
        ctx.addIssue({
          path: ["end_date"],
          code: z.ZodIssueCode.custom,
          message: endDateIssue.messageId,
        });
      }
      // Check that end_date is after date
      if (data.date && data.end_date < data.date) {
        ctx.addIssue({
          path: ["end_date"],
          code: z.ZodIssueCode.custom,
          message: "validation.endDateAfterStartDate",
        });
      }
    }
  });

// Schema for changing rate of recurring savings
const changeRateSchema = z.object({
  newAmount: z
    .preprocess((value) => {
      if (typeof value === "number") return value.toString();
      if (typeof value === "string") return value.trim();
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
  effectiveDate: z.string().trim().min(1, "validation.required"),
});

type ChangeRateFormValues = z.infer<typeof changeRateSchema>;

type SavingFormValues = z.infer<typeof savingSchema>;

interface SavingGroup {
  key: string;
  category: SavingCategory;
  description?: string;
  saving_type: SavingType;
  current: Saving | null;
  historical: Saving[];
}

const todayISO = new Date().toISOString().split("T")[0];

const savingDefaultValues: SavingFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  end_date: null,
  saving_type: SavingType.DEPOSIT,
  is_recurring: false,
  target_amount: undefined,
  account_type: AccountType.STANDARD,
  annual_return_rate: undefined,
};

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
  end_date: saving.end_date?.slice(0, 10) ?? null,
  saving_type: saving.saving_type,
  is_recurring: saving.is_recurring,
  target_amount: saving.target_amount ?? undefined,
  account_type: saving.account_type ?? AccountType.STANDARD,
  annual_return_rate: saving.annual_return_rate ?? undefined,
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
  const [recentExpanded, _setRecentExpanded] = useState(false);

  // Change rate dialog state
  const [changeRateOpen, setChangeRateOpen] = useState(false);
  const [changeRateItem, setChangeRateItem] = useState<Saving | null>(null);
  const [isChangingRate, setIsChangingRate] = useState(false);

  // Expanded groups state (for showing history)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"date" | "amount" | "category" | "type">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Key to trigger retirement limits card refresh
  const [retirementLimitsRefreshKey, setRetirementLimitsRefreshKey] = useState(0);

  const userEmail = session.data?.user?.email ?? null;

  // Toggle group expanded state
  const toggleGroupExpanded = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const _sparklineGradientId = useId();

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
      // 1. Type selection - compact horizontal buttons (deposit/withdrawal)
      {
        name: "saving_type",
        labelId: "savings.form.savingType",
        component: "icon-select",
        options: savingTypeIconOptions,
        columns: 2,
        compact: true,
      },
      // 2. Amount - most important field
      {
        name: "amount",
        labelId: "savings.form.amount",
        component: "currency",
        autoFocus: true,
        rowGroup: "amountRow",
        rowWidth: "1/2",
      },
      // 3. Date - same row as amount
      {
        name: "date",
        labelId: "savings.form.date",
        component: "date",
        rowGroup: "amountRow",
        rowWidth: "1/2",
      },
      // 4. Category - compact visual selection
      {
        name: "category",
        labelId: "savings.form.category",
        component: "icon-select",
        options: categoryIconOptions,
        columns: 3,
        compact: true,
        onValueChange: (value, formInstance) => {
          if (dialogMode !== "create") {
            return;
          }

          const categoryValue = value as SavingCategory | undefined;
          if (!categoryValue) {
            return;
          }

          // Auto-set account type for retirement category
          if (categoryValue === SavingCategory.RETIREMENT) {
            formInstance.setValue("account_type", AccountType.IKE, {
              shouldDirty: false,
              shouldTouch: false,
              shouldValidate: false,
            });
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
      // 5. Recurring toggle + Description in same row
      {
        name: "is_recurring",
        labelId: "savings.form.isRecurring",
        component: "switch",
        rowGroup: "recurringRow",
        rowWidth: "auto",
      },
      {
        name: "description",
        labelId: "savings.form.description",
        component: "text",
        rowGroup: "recurringRow",
        rowWidth: "2/3",
      },
      // 6. End date - only for recurring
      {
        name: "end_date",
        labelId: "savings.form.endDate",
        component: "date",
        showWhen: (values) => values.is_recurring === true,
      },
      // 7. Target amount + Account type side by side
      {
        name: "target_amount",
        labelId: "savings.form.targetAmount",
        component: "currency",
        showWhen: (values) => values.saving_type === SavingType.DEPOSIT,
        rowGroup: "targetRow",
        rowWidth: "1/2",
      },
      {
        name: "account_type",
        labelId: "savings.form.accountType",
        component: "select",
        options: accountTypeOptions,
        showWhen: (values) =>
          values.category === SavingCategory.RETIREMENT ||
          values.category === SavingCategory.INVESTMENT,
        rowGroup: "targetRow",
        rowWidth: "1/2",
      },
      // 8. Annual return rate - only when non-standard account type
      {
        name: "annual_return_rate",
        labelId: "savings.form.annualReturnRate",
        component: "number",
        step: "0.1",
        min: 0,
        max: 100,
        placeholderId: "savings.form.annualReturnRate.placeholder",
        showWhen: (values) =>
          values.account_type !== AccountType.STANDARD &&
          values.account_type !== undefined,
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
      logger.error("[Savings] Failed to fetch summary", error);
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
      logger.error("[Savings] Failed to fetch savings", error);
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

  const handleQuickAddRetirement = (params: QuickAddSavingParams) => {
    setActiveSaving(null);
    setDialogMode("create");
    setDialogInitialValues({
      saving_type: SavingType.DEPOSIT,
      category: params.category,
      account_type: params.accountType,
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
        // Refresh retirement limits if relevant account type
        if (created.account_type && created.account_type !== AccountType.STANDARD) {
          setRetirementLimitsRefreshKey((k) => k + 1);
        }

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
        // Refresh retirement limits if relevant account type
        if (updated.account_type && updated.account_type !== AccountType.STANDARD) {
          setRetirementLimitsRefreshKey((k) => k + 1);
        }

        toast({
          title: intl.formatMessage({ id: "savings.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      logger.error("[Savings] Failed to submit form", error);
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

      // Check if it was a retirement account type before removing from state
      const wasRetirementAccount = pendingDelete.account_type && pendingDelete.account_type !== AccountType.STANDARD;

      setSavings((prev) =>
        prev.filter((saving) => saving.id !== pendingDelete.id),
      );
      void fetchSummary();

      // Refresh retirement limits if relevant account type was deleted
      if (wasRetirementAccount) {
        setRetirementLimitsRefreshKey((k) => k + 1);
      }

      toast({
        title: intl.formatMessage({ id: "savings.toast.deleteSuccess" }),
      });
    } catch (error) {
      logger.error("[Savings] Failed to delete saving", error);
      showErrorToast("savings.toast.genericError");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  // Change rate handlers
  const handleOpenChangeRate = (saving: Saving) => {
    setChangeRateItem(saving);
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
      const updatePayload = {
        ...mapSavingToFormValues(changeRateItem),
        end_date: endDateStr,
      };

      const updateResponse = await fetch(`/api/savings/${changeRateItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        throw new Error(await updateResponse.text());
      }

      const updatedOld: Saving = await updateResponse.json();

      // Step 2: Create a new item with the new amount
      const effectiveDateStr = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-01`;
      const createPayload = {
        category: changeRateItem.category,
        description: changeRateItem.description ?? "",
        amount: values.newAmount,
        date: effectiveDateStr,
        end_date: null,
        saving_type: changeRateItem.saving_type,
        is_recurring: true,
        target_amount: changeRateItem.target_amount ?? null,
      };

      const createResponse = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      if (!createResponse.ok) {
        throw new Error(await createResponse.text());
      }

      const createdNew: Saving = await createResponse.json();

      // Update local state
      setSavings((prev) =>
        prev.map((saving) => (saving.id === updatedOld.id ? updatedOld : saving)).concat(createdNew),
      );

      void fetchSummary();

      toast({
        title: intl.formatMessage({ id: "changeRate.toast.success" }),
      });

      handleChangeRateClose(false);
    } catch (error) {
      logger.error("[Savings] Failed to change rate", error);
      showErrorToast("changeRate.toast.error");
    } finally {
      setIsChangingRate(false);
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

  // Group recurring savings by category + description + type for history tracking
  const groupedRecurringSavings = useMemo(() => {
    const groups = new Map<string, SavingGroup>();

    // Only group recurring deposits (withdrawals are one-off events)
    const recurringSavings = savings.filter((s) => s.is_recurring && s.saving_type === SavingType.DEPOSIT);

    recurringSavings.forEach((saving) => {
      const key = `${saving.category}::${saving.description ?? ""}::${saving.saving_type}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          category: saving.category,
          description: saving.description,
          saving_type: saving.saving_type,
          current: null,
          historical: [],
        });
      }

      const group = groups.get(key)!;

      if (saving.end_date) {
        // Has end_date = historical
        group.historical.push(saving);
      } else {
        // No end_date = current (or latest if multiple)
        if (!group.current || new Date(saving.date) > new Date(group.current.date)) {
          if (group.current) {
            group.historical.push(group.current);
          }
          group.current = saving;
        } else {
          group.historical.push(saving);
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
  }, [savings]);

  // Get grouped item IDs for filtering in table
  const groupedItemIds = useMemo(() => {
    const ids = new Set<number>();
    groupedRecurringSavings.forEach((group) => {
      if (group.current) ids.add(group.current.id);
      group.historical.forEach((h) => ids.add(h.id));
    });
    return ids;
  }, [groupedRecurringSavings]);

  // Savings that are not part of any group (one-off or non-grouped)
  const ungroupedSavings = useMemo(() => {
    return sortedSavings.filter((s) => !groupedItemIds.has(s.id));
  }, [sortedSavings, groupedItemIds]);

  // Calculate average annual return rate from savings with return rates
  const averageReturnRate = useMemo(() => {
    const savingsWithRate = savings.filter((s) => s.annual_return_rate !== undefined && s.annual_return_rate !== null);
    if (savingsWithRate.length === 0) {
      return 0.05; // Default 5% if no rates specified
    }
    const totalRate = savingsWithRate.reduce((sum, s) => sum + (s.annual_return_rate ?? 0), 0);
    return totalRate / savingsWithRate.length;
  }, [savings]);

  // Goal projection calculation using COMPOUND INTEREST
  // Formula: n = log((FV * r + PMT) / (PV * r + PMT)) / log(1 + r)
  // Where: FV = target, PV = current, r = monthly rate, PMT = monthly contribution
  const goalProjection = useMemo(() => {
    if (!summary || summary.monthly_contribution <= 0) {
      return null;
    }

    const currentTotal = summary.total_savings;
    const monthlyContribution = summary.monthly_contribution;
    const emergencyTarget = summary.emergency_fund_target;
    const emergencyCurrent = summary.emergency_fund;

    // Monthly return rate from annual rate
    const monthlyReturnRate = averageReturnRate / 12;

    // Helper function: calculate months to reach target with compound interest
    const calculateMonthsWithCompoundInterest = (
      presentValue: number,
      futureValue: number,
      monthlyPMT: number,
      monthlyRate: number
    ): number | null => {
      if (presentValue >= futureValue) return 0;
      if (monthlyPMT <= 0) return null;

      // If no return rate, use simple linear calculation
      if (monthlyRate <= 0 || monthlyRate < 0.0001) {
        return Math.ceil((futureValue - presentValue) / monthlyPMT);
      }

      // Compound interest formula solving for n
      // FV = PV * (1 + r)^n + PMT * [((1 + r)^n - 1) / r]
      // Solving: n = log((FV * r + PMT) / (PV * r + PMT)) / log(1 + r)
      const numerator = futureValue * monthlyRate + monthlyPMT;
      const denominator = presentValue * monthlyRate + monthlyPMT;

      if (denominator <= 0 || numerator <= 0) {
        return Math.ceil((futureValue - presentValue) / monthlyPMT);
      }

      const n = Math.log(numerator / denominator) / Math.log(1 + monthlyRate);
      return Math.ceil(Math.max(0, n));
    };

    // Calculate months to reach emergency fund target
    const monthsToEmergency = calculateMonthsWithCompoundInterest(
      emergencyCurrent,
      emergencyTarget,
      monthlyContribution,
      monthlyReturnRate
    );
    const emergencyTargetDate = monthsToEmergency !== null && monthsToEmergency > 0
      ? new Date(Date.now() + monthsToEmergency * 30 * 24 * 60 * 60 * 1000)
      : null;

    // Calculate when they'll reach various milestones
    const milestones = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    const nextMilestone = milestones.find((m) => m > currentTotal);
    const monthsToNextMilestone = nextMilestone
      ? calculateMonthsWithCompoundInterest(currentTotal, nextMilestone, monthlyContribution, monthlyReturnRate)
      : null;
    const nextMilestoneDate = monthsToNextMilestone !== null && monthsToNextMilestone > 0
      ? new Date(Date.now() + monthsToNextMilestone * 30 * 24 * 60 * 60 * 1000)
      : null;

    // Calculate projected value in 10 years with compound interest
    // FV = PV * (1 + r)^n + PMT * [((1 + r)^n - 1) / r]
    const yearsProjection = 10;
    const monthsProjection = yearsProjection * 12;
    let projectedValue10Years: number;

    if (monthlyReturnRate > 0.0001) {
      const compoundFactor = Math.pow(1 + monthlyReturnRate, monthsProjection);
      projectedValue10Years = currentTotal * compoundFactor +
        monthlyContribution * ((compoundFactor - 1) / monthlyReturnRate);
    } else {
      projectedValue10Years = currentTotal + monthlyContribution * monthsProjection;
    }

    return {
      monthlyRate: monthlyContribution,
      annualReturnRate: averageReturnRate,
      monthsToEmergency,
      emergencyTargetDate,
      nextMilestone,
      monthsToNextMilestone,
      nextMilestoneDate,
      emergencyComplete: emergencyCurrent >= emergencyTarget,
      projectedValue10Years: Math.round(projectedValue10Years),
      useCompoundInterest: averageReturnRate > 0,
    };
  }, [summary, averageReturnRate]);

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

  const _displayedRecentTransactions = useMemo(() => {
    if (!summary) {
      return [];
    }

    return recentExpanded
      ? summary.recent_transactions.slice(0, 6)
      : summary.recent_transactions.slice(0, 3);
  }, [recentExpanded, summary]);

  const _canExpandRecent = Boolean(
    summary && summary.recent_transactions.length > 3,
  );

  const _handleScrollToTable = useCallback(() => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const _sparkline = useMemo(() => {
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                              <span key="category" className="font-medium text-emerald-900">
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
        </div>
      )}

      {/* Goal Projection Card (Compound Interest) */}
      {goalProjection && (
        <Card className="rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <Target className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-sky-900">
                  <FormattedMessage id="savings.goalProjection.title" defaultMessage="Goal Projection (Compound Interest)" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  {goalProjection.useCompoundInterest ? (
                    <FormattedMessage
                      id="savings.goalProjection.monthlyRate"
                      defaultMessage="At {amount}/month and {rate}% annual return"
                      values={{
                        amount: formatCurrency(goalProjection.monthlyRate),
                        rate: (goalProjection.annualReturnRate * 100).toFixed(1),
                      }}
                    />
                  ) : (
                    <FormattedMessage
                      id="savings.goalProjection.monthlyRateSimple"
                      defaultMessage="At your current rate of {amount}/month"
                      values={{ amount: formatCurrency(goalProjection.monthlyRate) }}
                    />
                  )}
                </p>
                {goalProjection.useCompoundInterest && (
                  <p className="mt-1 text-xs text-sky-600">
                    📈 <FormattedMessage id="savings.goalProjection.compoundInterestNote" defaultMessage="Calculation includes compound interest" />
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Emergency Fund Projection */}
                {!goalProjection.emergencyComplete && goalProjection.emergencyTargetDate && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">
                      <FormattedMessage id="savings.goalProjection.emergencyFund" defaultMessage="Emergency Fund Complete" />
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-800">
                      {intl.formatDate(goalProjection.emergencyTargetDate, {
                        year: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-xs text-emerald-600">
                      <FormattedMessage
                        id="savings.goalProjection.inMonths"
                        defaultMessage="In {months} months"
                        values={{ months: goalProjection.monthsToEmergency }}
                      />
                    </p>
                  </div>
                )}
                {goalProjection.emergencyComplete && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-100/50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">
                      <FormattedMessage id="savings.goalProjection.emergencyFund" defaultMessage="Emergency Fund" />
                    </p>
                    <p className="mt-1 text-lg font-semibold text-emerald-800">
                      ✓ <FormattedMessage id="savings.goalProjection.complete" defaultMessage="Complete!" />
                    </p>
                  </div>
                )}
                {/* Next Milestone Projection */}
                {goalProjection.nextMilestone && goalProjection.nextMilestoneDate && (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-sky-700">
                      <FormattedMessage
                        id="savings.goalProjection.nextMilestone"
                        defaultMessage="Reach {amount}"
                        values={{ amount: formatCurrency(goalProjection.nextMilestone) }}
                      />
                    </p>
                    <p className="mt-1 text-lg font-semibold text-sky-800">
                      {intl.formatDate(goalProjection.nextMilestoneDate, {
                        year: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-xs text-sky-600">
                      <FormattedMessage
                        id="savings.goalProjection.inMonths"
                        defaultMessage="In {months} months"
                        values={{ months: goalProjection.monthsToNextMilestone }}
                      />
                    </p>
                  </div>
                )}
                {/* 10-Year Projection */}
                {goalProjection.projectedValue10Years > 0 && (
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-purple-700">
                      <FormattedMessage id="savings.goalProjection.projectedIn10Years" defaultMessage="In 10 years" />
                    </p>
                    <p className="mt-1 text-lg font-semibold text-purple-800">
                      {formatCurrency(goalProjection.projectedValue10Years)}
                    </p>
                    <p className="text-xs text-purple-600">
                      {goalProjection.useCompoundInterest ? "📊 " : ""}
                      {(goalProjection.annualReturnRate * 100).toFixed(1)}% p.a.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Savings Goals */}
      <SavingsGoalsSection />

      {/* Retirement Account Limits (IKE/IKZE/OIPE) */}
      <RetirementLimitsCard
        className="rounded-3xl"
        onQuickAddSaving={handleQuickAddRetirement}
        refreshKey={retirementLimitsRefreshKey}
      />

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
              {/* Grouped recurring savings */}
              {groupedRecurringSavings.map((group) => {
                const mainSaving = group.current || group.historical[0];
                if (!mainSaving) return null;

                const hasHistory = group.historical.length > 0;
                const isExpanded = expandedGroups.has(group.key);

                const renderSavingRow = (saving: Saving, isMain: boolean) => {
                  const isDeposit = saving.saving_type === SavingType.DEPOSIT;
                  const isHistorical = !!saving.end_date;
                  const amountClass = isHistorical
                    ? "text-slate-500"
                    : isDeposit ? "text-emerald-600" : "text-rose-600";
                  const amountIcon = isDeposit ? (
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                  );
                  const balanceAfter = balanceById.get(saving.id) ?? saving.amount;

                  return (
                    <TableRow
                      key={saving.id}
                      className={cn(
                        "border-b border-muted/30 text-sm leading-relaxed transition-colors hover:bg-emerald-50",
                        isHistorical && "bg-slate-50/70 opacity-70",
                        !isMain && "bg-amber-50/30"
                      )}
                    >
                      <TableCell className="text-sm font-medium text-slate-700">
                        <div className="flex items-center gap-3">
                          {isMain && hasHistory ? (
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(group.key)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                              aria-label={isExpanded ? "Collapse history" : "Expand history"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          ) : isMain ? (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                              <PiggyBank className="h-4 w-4" aria-hidden="true" />
                            </span>
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center text-slate-400">
                              └─
                            </span>
                          )}
                          <div className="flex flex-col">
                            {isMain ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <span>
                                    <FormattedMessage id={`savings.categories.${saving.category}`} />
                                  </span>
                                  {/* Show account type badge for III Pillar accounts */}
                                  {saving.account_type && saving.account_type !== AccountType.STANDARD && (
                                    <span className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                      accountTypeBadgeStyles[saving.account_type as AccountType]?.bg,
                                      accountTypeBadgeStyles[saving.account_type as AccountType]?.text
                                    )}>
                                      {accountTypeBadgeStyles[saving.account_type as AccountType]?.icon}
                                      {saving.account_type.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                {hasHistory && (
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupExpanded(group.key)}
                                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                                  >
                                    📜 {group.historical.length} {intl.formatMessage({
                                      id: group.historical.length === 1 ? "common.historyCount.one" : "common.historyCount.many",
                                      defaultMessage: group.historical.length === 1 ? "change" : "changes"
                                    })}
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-500 text-xs">
                                <FormattedMessage id="common.historical" defaultMessage="Historical" />
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-sm", isHistorical ? "text-slate-500" : "text-slate-600")}>
                        {saving.description}
                      </TableCell>
                      <TableCell className={cn("text-right text-base font-semibold", amountClass)}>
                        <span className="inline-flex items-center justify-end gap-2">
                          {amountIcon}
                          {formatSavingAmount(saving, formatCurrency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          <span>
                            {intl.formatDate(new Date(saving.date), { year: "numeric", month: "2-digit" })}
                            {" → "}
                            {saving.end_date ? (
                              intl.formatDate(new Date(saving.end_date), { year: "numeric", month: "2-digit" })
                            ) : (
                              <span className="text-emerald-600 font-medium">
                                {intl.formatMessage({ id: "common.now", defaultMessage: "now" })}
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        <FormattedMessage id={`savings.types.${saving.saving_type}`} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {isHistorical ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                            📁
                            <FormattedMessage id="common.historical" defaultMessage="Historical" />
                          </span>
                        ) : saving.is_recurring ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            🟢
                            <FormattedMessage id="common.recurring" defaultMessage="Recurring" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                            <FormattedMessage id="common.oneOff" defaultMessage="One-off" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {saving.target_amount ? formatCurrency(saving.target_amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-slate-700">
                        {formatCurrency(balanceAfter)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {saving.is_recurring && !isHistorical && (
                            <Tooltip content={intl.formatMessage({ id: "changeRate.button.tooltip" })}>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleOpenChangeRate(saving)}
                                className="h-9 w-9 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(saving)}
                            >
                              <Pencil className="h-4 w-4" />
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
                            </Button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                };

                return (
                  <React.Fragment key={group.key}>
                    {renderSavingRow(mainSaving, true)}
                    {isExpanded && group.historical.map((histSaving) => (
                      histSaving.id !== mainSaving.id && renderSavingRow(histSaving, false)
                    ))}
                  </React.Fragment>
                );
              })}
              {/* Ungrouped savings (one-off or non-recurring) */}
              {ungroupedSavings.map((saving) => {
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
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full",
                          isDeposit ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {isDeposit ? (
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <FormattedMessage id={`savings.categories.${saving.category}`} />
                          {/* Show account type badge for III Pillar accounts */}
                          {saving.account_type && saving.account_type !== AccountType.STANDARD && (
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              accountTypeBadgeStyles[saving.account_type as AccountType]?.bg,
                              accountTypeBadgeStyles[saving.account_type as AccountType]?.text
                            )}>
                              {accountTypeBadgeStyles[saving.account_type as AccountType]?.icon}
                              {saving.account_type.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
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
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {saving.is_recurring && (
                          <Tooltip content={intl.formatMessage({ id: "changeRate.button.tooltip" })}>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenChangeRate(saving)}
                              className="h-9 w-9 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(saving)}
                          >
                            <Pencil className="h-4 w-4" />
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
                          </Button>
                        </Tooltip>
                      </div>
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
          }}
          fields={changeRateFieldConfig}
          onSubmit={handleChangeRate}
          isSubmitting={isChangingRate}
        />
      )}
    </div>
  );
};
