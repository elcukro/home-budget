"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Home,
  LineChart,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
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
import IncomeChart from "@/components/charts/IncomeChart";
import { CrudDialog, type FormFieldConfig } from "@/components/crud/CrudDialog";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import {
  parseNumber,
  validateAmountPositive,
  validateDateString,
} from "@/lib/validation";
import { logActivity } from "@/utils/activityLogger";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useAnalytics } from "@/hooks/useAnalytics";
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import _Tooltip from "@/components/Tooltip";

// Polish employment types for tax calculation
enum EmploymentType {
  UOP = "uop",       // Umowa o pracę (employment contract)
  B2B = "b2b",       // Business-to-business
  ZLECENIE = "zlecenie", // Umowa zlecenie (civil law contract)
  DZIELO = "dzielo",  // Umowa o dzieło (contract for specific work)
  OTHER = "other"
}

interface Income {
  id: number | string;
  category: string;
  description: string;
  amount: number;  // Net amount (netto)
  date: string;  // Start date for recurring, occurrence date for one-off
  end_date: string | null;  // Optional end date for recurring items
  is_recurring: boolean;
  // Polish employment type and tax calculation fields
  employment_type?: EmploymentType | null;
  gross_amount?: number | null;  // Brutto (before tax)
  is_gross?: boolean;  // Whether entered amount was gross
  created_at: string;
}

// Use Next.js API proxy for all backend calls (adds auth headers automatically)

const incomeSchema = z.object({
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
  // Polish employment type for tax calculation
  employment_type: z.string().nullable().optional(),
  gross_amount: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const raw = typeof value === "number" ? value.toString() : value.trim();
      if (!raw) return null;
      return parseNumber(raw) ?? null;
    }),
  is_gross: z.boolean().default(false),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const incomeDefaultValues: IncomeFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  end_date: null,
  is_recurring: false,
  employment_type: null,
  gross_amount: null,
  is_gross: false,
};

const employmentTypeOptions = [
  { value: EmploymentType.UOP, labelId: "income.employmentTypes.uop" },
  { value: EmploymentType.B2B, labelId: "income.employmentTypes.b2b" },
  { value: EmploymentType.ZLECENIE, labelId: "income.employmentTypes.zlecenie" },
  { value: EmploymentType.DZIELO, labelId: "income.employmentTypes.dzielo" },
  { value: EmploymentType.OTHER, labelId: "income.employmentTypes.other" },
];

const categoryOptions = [
  { value: "salary", labelId: "income.categories.salary", icon: <Briefcase className="h-5 w-5" /> },
  { value: "freelance", labelId: "income.categories.freelance", icon: <ArrowUpRight className="h-5 w-5" /> },
  { value: "investments", labelId: "income.categories.investments", icon: <LineChart className="h-5 w-5" /> },
  { value: "rental", labelId: "income.categories.rental", icon: <Home className="h-5 w-5" /> },
  { value: "other", labelId: "income.categories.other", icon: <ArrowDownRight className="h-5 w-5" /> },
];

const incomeFieldConfig: FormFieldConfig<IncomeFormValues>[] = [
  {
    name: "category",
    labelId: "income.form.category",
    component: "icon-select",
    options: categoryOptions,
  },
  {
    name: "description",
    labelId: "income.form.description",
    component: "text",
  },
  {
    name: "amount",
    labelId: "income.form.amount",
    descriptionId: "income.form.amountHint",
    component: "currency",
  },
  {
    name: "is_gross",
    labelId: "income.form.isGross",
    descriptionId: "income.form.isGrossHint",
    component: "switch",
  },
  {
    name: "employment_type",
    labelId: "income.form.employmentType",
    descriptionId: "income.form.employmentTypeHint",
    component: "select",
    options: employmentTypeOptions,
  },
  {
    name: "date",
    labelId: "income.form.startDate",
    component: "date",
  },
  {
    name: "is_recurring",
    labelId: "income.form.recurring",
    component: "switch",
  },
  {
    name: "end_date",
    labelId: "income.form.endDate",
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

const mapIncomeToFormValues = (income: Income): IncomeFormValues => ({
  category: income.category,
  description: income.description,
  amount: income.amount,
  date: income.date.slice(0, 10),
  end_date: income.end_date ? income.end_date.slice(0, 10) : null,
  is_recurring: income.is_recurring,
  employment_type: income.employment_type || null,
  gross_amount: income.gross_amount || null,
  is_gross: income.is_gross || false,
});

export default function IncomePage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency } = useSettings();
  const { trackIncome } = useAnalytics();

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeIncome, setActiveIncome] = useState<Income | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Income | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<"date" | "amount" | "category" | "description">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Change rate dialog state
  const [changeRateOpen, setChangeRateOpen] = useState(false);
  const [changeRateItem, setChangeRateItem] = useState<Income | null>(null);
  const [isChangingRate, setIsChangingRate] = useState(false);

  // Expanded groups state (for showing history)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const userEmail = session?.user?.email ?? null;

  useEffect(() => {
    const loadIncomes = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setApiError(null);

        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/income`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to fetch income");
        }

        const data: Income[] = await response.json();
        setIncomes(data);
      } catch (error) {
        logger.error("[Income] Failed to load incomes", error);
        setApiError(intl.formatMessage({ id: "income.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadIncomes();
  }, [userEmail, intl]);

  // Group incomes by category + description, with current and historical items
  interface IncomeGroup {
    key: string;
    category: string;
    description: string;
    current: Income | null;
    historical: Income[];
  }

  const groupedIncomes = useMemo(() => {
    const groups = new Map<string, IncomeGroup>();

    // Group by category + description
    incomes.forEach((income) => {
      const key = `${income.category}::${income.description}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          category: income.category,
          description: income.description,
          current: null,
          historical: [],
        });
      }

      const group = groups.get(key)!;

      if (income.end_date) {
        // Has end_date = historical
        group.historical.push(income);
      } else {
        // No end_date = current (or latest if multiple)
        if (!group.current || new Date(income.date) > new Date(group.current.date)) {
          if (group.current) {
            group.historical.push(group.current);
          }
          group.current = income;
        } else {
          group.historical.push(income);
        }
      }
    });

    // Sort historical by date descending (newest first)
    groups.forEach((group) => {
      group.historical.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    // Convert to array and sort by current amount or date
    const collator = new Intl.Collator(intl.locale, { sensitivity: "base" });
    const groupArray = Array.from(groups.values());

    groupArray.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const aItem = a.current || a.historical[0];
      const bItem = b.current || b.historical[0];

      if (!aItem || !bItem) return 0;

      if (sortKey === "amount") {
        return direction * (aItem.amount - bItem.amount);
      }
      if (sortKey === "category") {
        return direction * collator.compare(a.category, b.category);
      }
      if (sortKey === "description") {
        return direction * collator.compare(a.description, b.description);
      }
      return direction * (new Date(aItem.date).getTime() - new Date(bItem.date).getTime());
    });

    return groupArray;
  }, [incomes, intl.locale, sortDirection, sortKey]);

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

  // Calculate totals by frequency
  const totalsByFrequency = useMemo(
    () =>
      incomes.reduce(
        (acc, income) => {
          if (income.is_recurring) {
            acc.recurring += income.amount;
          } else {
            acc.oneOff += income.amount;
          }
          acc.total += income.amount;
          return acc;
        },
        { recurring: 0, oneOff: 0, total: 0 },
      ),
    [incomes],
  );

  const handleSort = (key: typeof sortKey) => {
    setSortDirection((prev) => {
      if (sortKey === key) {
        return prev === "asc" ? "desc" : "asc";
      }
      return key === "date" ? "desc" : "asc";
    });
    setSortKey(key);
  };

  const renderSortableHead = (
    key: typeof sortKey,
    labelId: string,
    align: "left" | "right" = "left",
  ) => {
    const active = sortKey === key;
    const indicator = active ? (sortDirection === "asc" ? "↑" : "↓") : "";

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
  };

  const handleOpenCreate = () => {
    setActiveIncome(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (income: Income) => {
    setActiveIncome(income);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveIncome(null);
    }
  };

  const showErrorToast = (messageId: string) => {
    toast({
      title: intl.formatMessage({ id: messageId }),
      variant: "destructive",
    });
  };

  const handleSubmit = async (values: IncomeFormValues) => {
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
          `/api/backend/users/${encodeURIComponent(userEmail)}/income`,
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
          throw new Error(errorText || "Failed to create income");
        }

        const created: Income = await response.json();
        setIncomes((prev) => [...prev, created]);

        await logActivity({
          entity_type: "Income",
          operation_type: "create",
          entity_id: Number(created.id),
          new_values: created,
        });

        trackIncome('added', created.amount, created.category);

        toast({
          title: intl.formatMessage({ id: "income.toast.createSuccess" }),
        });
      } else if (activeIncome) {
        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/income/${activeIncome.id}`,
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
          throw new Error(errorText || "Failed to update income");
        }

        const updated: Income = await response.json();

        setIncomes((prev) =>
          prev.map((income) =>
            income.id === updated.id ? updated : income,
          ),
        );

        await logActivity({
          entity_type: "Income",
          operation_type: "update",
          entity_id: Number(updated.id),
          previous_values: activeIncome,
          new_values: updated,
        });

        trackIncome('edited', updated.amount, updated.category);

        toast({
          title: intl.formatMessage({ id: "income.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      logger.error("[Income] Failed to submit form", error);
      showErrorToast("income.toast.genericError");
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
        `/api/backend/users/${encodeURIComponent(userEmail)}/income/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete income");
      }

      setIncomes((prev) =>
        prev.filter((income) => income.id !== pendingDelete.id),
      );

      await logActivity({
        entity_type: "Income",
        operation_type: "delete",
        entity_id: Number(pendingDelete.id),
        previous_values: pendingDelete,
      });

      trackIncome('deleted', pendingDelete.amount, pendingDelete.category);

      toast({
        title: intl.formatMessage({ id: "income.toast.deleteSuccess" }),
      });
    } catch (error) {
      logger.error("[Income] Failed to delete income", error);
      showErrorToast("income.toast.genericError");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const handleOpenChangeRate = (income: Income) => {
    setChangeRateItem(income);
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
      // Parse the effective date string directly to avoid timezone issues
      const [effYear, effMonth] = values.effectiveDate.split("-").map(Number);

      // Calculate the end date for the old item (month before effective date)
      let endYear = effYear;
      let endMonth = effMonth - 1;
      if (endMonth < 1) {
        endMonth = 12;
        endYear -= 1;
      }
      const endDateStr = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      // Step 1: Update the existing item with end_date
      const updateResponse = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/income/${changeRateItem.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...mapIncomeToFormValues(changeRateItem),
            end_date: endDateStr,
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(errorText || "Failed to update income");
      }

      const updatedOld: Income = await updateResponse.json();

      // Step 2: Create a new item with the new amount
      // Use the effective date (first of the month)
      const effectiveDateStr = `${effYear}-${String(effMonth).padStart(2, "0")}-01`;

      console.log("[Income] Creating new income with rate change:", {
        effectiveDate: values.effectiveDate,
        effectiveDateStr,
        originalDate: changeRateItem.date,
      });

      const createResponse = await fetch(
        `/api/backend/users/${encodeURIComponent(userEmail)}/income`,
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
            // Preserve employment details from original income
            employment_type: changeRateItem.employment_type || null,
            gross_amount: changeRateItem.is_gross ? values.newAmount : (changeRateItem.gross_amount || null),
            is_gross: changeRateItem.is_gross || false,
          }),
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(errorText || "Failed to create new income");
      }

      const createdNew: Income = await createResponse.json();

      // Update local state
      setIncomes((prev) =>
        prev.map((income) => (income.id === updatedOld.id ? updatedOld : income)).concat(createdNew),
      );

      await logActivity({
        entity_type: "Income",
        operation_type: "update",
        entity_id: Number(changeRateItem.id),
        previous_values: changeRateItem,
        new_values: { ...updatedOld, rateChangeTo: createdNew.id },
      });

      toast({
        title: intl.formatMessage({ id: "changeRate.toast.success" }),
      });

      handleChangeRateClose(false);
    } catch (error) {
      logger.error("[Income] Failed to change rate", error);
      showErrorToast("changeRate.toast.error");
    } finally {
      setIsChangingRate(false);
    }
  };

  if (loading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold text-emerald-900">
            <FormattedMessage id="income.title" />
          </h1>
          <p className="text-sm text-emerald-700/80">
            <FormattedMessage id="income.subtitle" />
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="income.actions.add" />
        </Button>
      </div>

      {/* Chart */}
      <IncomeChart incomes={incomes} />

      {apiError && (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="py-4">
            <p>{apiError}</p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border border-muted/60 bg-card shadow-sm">
        <CardHeader className="rounded-t-3xl border-b border-muted/40 bg-muted/20 py-5">
          <CardTitle className="text-lg font-semibold text-primary">
            <FormattedMessage id="income.incomeHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedIncomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="income.noEntries" />
            </p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    {renderSortableHead("category", "income.table.category")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    {renderSortableHead("description", "income.table.description")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    {renderSortableHead("amount", "income.table.amount", "right")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    {renderSortableHead("date", "income.table.date")}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <FormattedMessage id="income.table.recurring" />
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                    <FormattedMessage id="income.table.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedIncomes.map((group) => {
                  const mainIncome = group.current || group.historical[0];
                  if (!mainIncome) return null;

                  const hasHistory = group.historical.length > 0;
                  const isExpanded = expandedGroups.has(group.key);

                  const getIcon = (category: string) => {
                    if (category === "salary") return <Briefcase className="h-4 w-4" aria-hidden="true" />;
                    if (category === "freelance") return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
                    if (category === "investments") return <LineChart className="h-4 w-4" aria-hidden="true" />;
                    if (category === "rental") return <Home className="h-4 w-4" aria-hidden="true" />;
                    return <ArrowDownRight className="h-4 w-4" aria-hidden="true" />;
                  };

                  const renderIncomeRow = (income: Income, isMain: boolean) => {
                    const isHistorical = !!income.end_date;
                    return (
                      <TableRow
                        key={income.id}
                        className={cn(
                          "border-b border-muted/30 text-sm leading-relaxed transition-colors hover:bg-[#f7faf8]",
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
                                aria-label={isExpanded ? "Zwiń historię" : "Rozwiń historię"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : isMain ? (
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                                {getIcon(income.category)}
                              </span>
                            ) : (
                              <span className="flex h-9 w-9 items-center justify-center text-slate-400">
                                └─
                              </span>
                            )}
                            <div className="flex flex-col">
                              {isMain ? (
                                <>
                                  <span>
                                    <FormattedMessage id={`income.categories.${income.category}`} />
                                  </span>
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
                                  <FormattedMessage id="common.historical" />
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-sm", isHistorical ? "text-slate-500" : "text-slate-600")}>
                          {income.description}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right text-base font-semibold",
                          isHistorical ? "text-slate-500" : "text-emerald-700"
                        )}>
                          + {formatCurrency(income.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" aria-hidden="true" />
                            <span>
                              <FormattedDate value={new Date(income.date)} year="numeric" month="2-digit" />
                              {" → "}
                              {income.end_date ? (
                                <FormattedDate value={new Date(income.end_date)} year="numeric" month="2-digit" />
                              ) : (
                                <span className="text-emerald-600 font-medium">
                                  {intl.formatMessage({ id: "common.now", defaultMessage: "teraz" })}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {isHistorical ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              📁
                              <FormattedMessage id="common.historical" />
                            </span>
                          ) : income.is_recurring ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              🟢
                              <FormattedMessage id="common.recurring" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              ⚪️
                              <FormattedMessage id="common.oneOff" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {income.is_recurring && !isHistorical && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleOpenChangeRate(income)}
                                className="h-9 w-9 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                                aria-label={intl.formatMessage({ id: "changeRate.button.tooltip" })}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenEdit(income)}
                              className="h-9 w-9 border-primary/10 hover:bg-primary/10 hover:text-primary"
                              aria-label={intl.formatMessage({ id: "common.edit" })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setPendingDelete(income);
                                setConfirmOpen(true);
                              }}
                              className="h-9 w-9 border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                              aria-label={intl.formatMessage({ id: "common.delete" })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  };

                  return (
                    <React.Fragment key={group.key}>
                      {renderIncomeRow(mainIncome, true)}
                      {isExpanded && group.historical.map((histIncome) => (
                        histIncome.id !== mainIncome.id && renderIncomeRow(histIncome, false)
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {groupedIncomes.length > 0 && (
            <div className="grid gap-3 rounded-2xl border border-muted/60 bg-muted/20 px-4 py-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="income.summaryTotals.recurring" />
                </p>
                <p className="text-lg font-semibold text-emerald-700">
                  {formatCurrency(totalsByFrequency.recurring)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="income.summaryTotals.oneOff" />
                </p>
                <p className="text-lg font-semibold text-slate-600">
                  {formatCurrency(totalsByFrequency.oneOff)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="income.summaryTotals.total" />
                </p>
                <p className="text-lg font-semibold text-emerald-800">
                  {formatCurrency(totalsByFrequency.total)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleOpenCreate}
        className="fixed bottom-6 right-6 shadow-lg sm:hidden"
        variant="default"
        size="lg"
        aria-label={intl.formatMessage({ id: "income.actions.add" })}
      >
        <Plus className="mr-2 h-5 w-5" />
        <FormattedMessage id="income.actions.add" />
      </Button>

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={handleDialogClose}
        titleId={
          dialogMode === "create"
            ? "income.dialog.createTitle"
            : "income.dialog.editTitle"
        }
        submitLabelId={
          dialogMode === "create"
            ? "income.dialog.createSubmit"
            : "income.dialog.editSubmit"
        }
        schema={incomeSchema}
        defaultValues={incomeDefaultValues}
        initialValues={
          dialogMode === "edit" && activeIncome
            ? mapIncomeToFormValues(activeIncome)
            : undefined
        }
        fields={incomeFieldConfig}
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
        titleId="income.deleteDialog.title"
        descriptionId="income.deleteDialog.description"
        confirmLabelId="income.deleteDialog.confirm"
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
