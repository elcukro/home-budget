"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Briefcase,
  CalendarDays,
  Home,
  LineChart,
  Pencil,
  Plus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import Tooltip from "@/components/Tooltip";

interface Income {
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
  is_recurring: z.boolean().default(false),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const incomeDefaultValues: IncomeFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  is_recurring: false,
};

const categoryOptions = [
  { value: "salary", labelId: "income.categories.salary" },
  { value: "freelance", labelId: "income.categories.freelance" },
  { value: "investments", labelId: "income.categories.investments" },
  { value: "rental", labelId: "income.categories.rental" },
  { value: "other", labelId: "income.categories.other" },
];

const incomeFieldConfig: FormFieldConfig<IncomeFormValues>[] = [
  {
    name: "category",
    labelId: "income.form.category",
    component: "select",
    placeholderId: "income.form.category.select",
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
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "date",
    labelId: "income.form.date",
    component: "date",
  },
  {
    name: "is_recurring",
    labelId: "income.form.recurring",
    component: "switch",
  },
];

const mapIncomeToFormValues = (income: Income): IncomeFormValues => ({
  category: income.category,
  description: income.description,
  amount: income.amount,
  date: income.date.slice(0, 10),
  is_recurring: income.is_recurring,
});

export default function IncomePage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency } = useSettings();

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
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"date" | "amount" | "category" | "description">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/income`,
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
        console.error("[Income] Failed to load incomes", error);
        setApiError(intl.formatMessage({ id: "income.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadIncomes();
  }, [userEmail, intl]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, Date>();
    incomes.forEach((income) => {
      const date = new Date(income.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, date);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(([key, date]) => ({
        value: key,
        label: intl.formatDate(date, { month: "long", year: "numeric" }),
      }));
  }, [incomes, intl]);

  const filteredIncomes = useMemo(() => {
    if (monthFilter === "all") {
      return incomes;
    }
    return incomes.filter((income) => income.date.startsWith(monthFilter));
  }, [incomes, monthFilter]);

  const sortedIncomes = useMemo(() => {
    const collator = new Intl.Collator(intl.locale, { sensitivity: "base" });
    return [...filteredIncomes].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "amount") {
        return direction * (a.amount - b.amount);
      }
      if (sortKey === "category") {
        return direction * collator.compare(a.category, b.category);
      }
      if (sortKey === "description") {
        return direction * collator.compare(a.description, b.description);
      }
      return (
        direction * (new Date(a.date).getTime() - new Date(b.date).getTime())
      );
    });
  }, [filteredIncomes, intl.locale, sortDirection, sortKey]);

  const { monthName, yearlyTotals, monthlyAverage, recurringTotal, oneOffTotal } = useMemo(() => {
    if (filteredIncomes.length === 0) {
      return {
        monthName: intl.formatDate(new Date(), { month: "long", year: "numeric" }),
        yearlyTotals: 0,
        monthlyAverage: 0,
        recurringTotal: 0,
        oneOffTotal: 0,
      };
    }

    const latestDate = monthFilter !== "all"
      ? new Date(`${monthFilter}-01`)
      : new Date(filteredIncomes[0].date);
    const monthName = intl.formatDate(latestDate, {
      month: "long",
      year: "numeric",
    });

    const totalsByMonth = filteredIncomes.reduce<Record<string, { date: Date; total: number }>>(
      (acc, income) => {
        const date = new Date(income.date);
        if (Number.isNaN(date.getTime())) {
          return acc;
        }

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = acc[monthKey] ?? { date, total: 0 };
        existing.total += income.amount;
        acc[monthKey] = existing;
        return acc;
      },
      {},
    );

    const monthTotals = Object.values(totalsByMonth).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    const yearlyTotals = monthTotals.reduce((sum, record) => sum + record.total, 0);
    const monthlyAverage = monthTotals.length > 0 ? yearlyTotals / monthTotals.length : 0;
    const recurringTotal = filteredIncomes
      .filter((income) => income.is_recurring)
      .reduce((sum, income) => sum + income.amount, 0);
    const oneOffTotal = yearlyTotals - recurringTotal;

    return {
      monthName,
      yearlyTotals,
      monthlyAverage,
      recurringTotal,
      oneOffTotal,
    };
  }, [filteredIncomes, intl, monthFilter]);

  const totalsByFrequency = useMemo(
    () =>
      filteredIncomes.reduce(
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
    [filteredIncomes],
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
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/income`,
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

        toast({
          title: intl.formatMessage({ id: "income.toast.createSuccess" }),
        });
      } else if (activeIncome) {
        const response = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/income/${activeIncome.id}`,
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

        toast({
          title: intl.formatMessage({ id: "income.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      console.error("[Income] Failed to submit form", error);
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
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/income/${pendingDelete.id}`,
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

      toast({
        title: intl.formatMessage({ id: "income.toast.deleteSuccess" }),
      });
    } catch (error) {
      console.error("[Income] Failed to delete income", error);
      showErrorToast("income.toast.genericError");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  if (loading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold text-emerald-900">
            <FormattedMessage id="income.title" />
          </h1>
          <p className="text-sm text-emerald-700/80">
            <FormattedMessage id="income.subtitle" />
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue
                placeholder={intl.formatMessage({ id: "income.filters.monthLabel" })}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {intl.formatMessage({ id: "income.filters.month.all" })}
              </SelectItem>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="income.actions.add" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-100 via-white to-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-200 text-emerald-800">
              <LineChart className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-emerald-800/80">
                <FormattedMessage id="income.summary.totalLabel" values={{ month: monthName }} />
              </p>
              <p className="text-4xl font-semibold text-emerald-900 transition-all duration-300">
                {formatCurrency(yearlyTotals)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between rounded-3xl border border-muted/60 bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Briefcase className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <FormattedMessage id="income.summary.averageLabel" />
              </p>
              <p className="text-3xl font-semibold text-emerald-800">
                {formatCurrency(monthlyAverage)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            <FormattedMessage id="income.summary.averageHint" />
          </p>
        </Card>

        <Card className="flex flex-col justify-between rounded-3xl border border-muted/60 bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                <FormattedMessage id="income.summary.breakdownLabel" />
              </p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-700">
                    <FormattedMessage id="income.summary.recurring" />
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(recurringTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">
                    <FormattedMessage id="income.summary.oneOff" />
                  </span>
                  <span className="font-semibold text-slate-600">
                    {formatCurrency(oneOffTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            <FormattedMessage id="income.summary.breakdownHint" />
          </p>
        </Card>
      </div>

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
          {sortedIncomes.length === 0 ? (
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
                {sortedIncomes.map((income) => {
                  const icon = (() => {
                    if (income.category === "salary") return <Briefcase className="h-4 w-4" aria-hidden="true" />;
                    if (income.category === "freelance") return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
                    if (income.category === "investments") return <LineChart className="h-4 w-4" aria-hidden="true" />;
                    if (income.category === "rental") return <Home className="h-4 w-4" aria-hidden="true" />;
                    return <ArrowDownRight className="h-4 w-4" aria-hidden="true" />;
                  })();

                  return (
                    <TableRow
                      key={income.id}
                      className="border-b border-muted/30 text-sm leading-relaxed odd:bg-[#faf9f7] even:bg-white transition-colors hover:bg-[#f7faf8] focus-within:bg-[#f7faf8]"
                    >
                      <TableCell className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                          {icon}
                        </span>
                        <div className="flex flex-col">
                          <span>
                            <FormattedMessage id={`income.categories.${income.category}`} />
                          </span>
                          <Tooltip
                            content={intl.formatMessage({
                              id: `income.categoryHints.${income.category}`,
                              defaultMessage: "",
                            })}
                          >
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              ℹ️
                              <span className="underline decoration-dotted decoration-muted-foreground">
                                <FormattedMessage id="income.categoryHints.learnMore" />
                              </span>
                            </span>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {income.description}
                      </TableCell>
                      <TableCell className="text-right text-base font-semibold text-emerald-700">
                      + {formatCurrency(income.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          <FormattedDate value={new Date(income.date)} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {income.is_recurring ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            🟢
                            <FormattedMessage id="common.recurring" defaultMessage="Recurring" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            ⚪️
                            <FormattedMessage id="common.oneOff" defaultMessage="One-off" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => handleOpenEdit(income)}
                            className="h-10 w-10 rounded-full border-primary/10 hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">
                              {intl.formatMessage({ id: "common.edit" })}
                            </span>
                          </Button>
                        </Tooltip>
                        <Tooltip content={intl.formatMessage({ id: "common.delete" })}>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                              setPendingDelete(income);
                              setConfirmOpen(true);
                            }}
                            className="h-10 w-10 rounded-full border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
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
              </TableBody>
            </Table>
          )}
          {sortedIncomes.length > 0 && (
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
    </div>
  );
}
