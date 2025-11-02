"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Car,
  CreditCard,
  GraduationCap,
  Home,
  Info,
  Pencil,
  PiggyBank,
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
import { CrudDialog, type FormFieldConfig } from "@/components/crud/CrudDialog";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseNumber,
  validateAmountPositive,
  validateAmountNonNegative,
  validateDateString,
  validateInterestRate,
  validateMonthlyPayment,
  validateRemainingBalance,
} from "@/lib/validation";
import { logActivity } from "@/utils/activityLogger";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import Tooltip from "@/components/Tooltip";

interface Loan {
  id: number | string;
  loan_type: string;
  description: string;
  principal_amount: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  term_months: number;
  created_at: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const loanTypeOptions = [
  { value: "mortgage", labelId: "loans.types.mortgage" },
  { value: "car", labelId: "loans.types.car" },
  { value: "personal", labelId: "loans.types.personal" },
  { value: "student", labelId: "loans.types.student" },
  { value: "other", labelId: "loans.types.other" },
];

type LoanType = (typeof loanTypeOptions)[number]["value"];
type LoanSortKey =
  | "start_date"
  | "remaining_balance"
  | "principal_amount"
  | "monthly_payment";

const LOAN_TYPE_META: Record<
  string,
  {
    Icon: LucideIcon;
    toneClass: string;
    accentClass: string;
  }
> = {
  mortgage: {
    Icon: Home,
    toneClass: "bg-emerald-100 text-emerald-700",
    accentClass: "text-emerald-600",
  },
  car: {
    Icon: Car,
    toneClass: "bg-sky-100 text-sky-700",
    accentClass: "text-sky-600",
  },
  personal: {
    Icon: PiggyBank,
    toneClass: "bg-amber-100 text-amber-700",
    accentClass: "text-amber-600",
  },
  student: {
    Icon: GraduationCap,
    toneClass: "bg-purple-100 text-purple-700",
    accentClass: "text-purple-600",
  },
  other: {
    Icon: CreditCard,
    toneClass: "bg-slate-100 text-slate-700",
    accentClass: "text-slate-600",
  },
};

const DEFAULT_LOAN_META = {
  Icon: CreditCard,
  toneClass: "bg-slate-100 text-slate-700",
  accentClass: "text-slate-600",
};

const addMonths = (source: Date, months: number): Date => {
  const date = new Date(source.getTime());
  const desiredMonth = date.getMonth() + months;
  date.setMonth(desiredMonth);
  return date;
};

const loanSchema = z
  .object({
    loan_type: z.string().min(1, "validation.categoryRequired"),
    description: z
      .string()
      .trim()
      .min(1, "validation.description.required")
      .max(100, { message: "validation.description.tooLong" }),
    principal_amount: z.preprocess(
      (value) => (typeof value === "number" ? value.toString() : value),
      z
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
        })
    ),
    remaining_balance: z.preprocess(
      (value) => (typeof value === "number" ? value.toString() : value),
      z
        .string()
        .trim()
        .min(1, "validation.required")
        .transform((value, ctx) => {
          const error = validateAmountNonNegative(value);
          if (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: error.messageId,
            });
          }
          return parseNumber(value) ?? 0;
        })
    ),
    interest_rate: z.preprocess(
      (value) => (typeof value === "number" ? value.toString() : value),
      z
        .string()
        .trim()
        .min(1, "validation.required")
        .transform((value, ctx) => {
          const parsed = parseNumber(value);
          if (parsed === null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "validation.required",
            });
            return 0;
          }
          const error = validateInterestRate(parsed);
          if (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: error.messageId,
            });
          }
          return parsed;
        })
    ),
    monthly_payment: z.preprocess(
      (value) => (typeof value === "number" ? value.toString() : value),
      z
        .string()
        .trim()
        .min(1, "validation.required")
        .transform((value, ctx) => {
          const error = validateAmountNonNegative(value);
          if (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: error.messageId,
            });
          }
          return parseNumber(value) ?? 0;
        })
    ),
    start_date: z.string().trim().min(1, "validation.required"),
    term_months: z.preprocess(
      (value) => (typeof value === "number" ? value.toString() : value),
      z
        .string()
        .trim()
        .min(1, "validation.required")
        .transform((value, ctx) => {
          const parsed = parseNumber(value);
          if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "validation.termMonths.min",
            });
            return 0;
          }
          return parsed;
        })
    ),
  })
  .superRefine((data, ctx) => {
    const balanceIssue = validateRemainingBalance(
      data.remaining_balance,
      data.principal_amount,
    );
    if (balanceIssue) {
      ctx.addIssue({
        path: ["remaining_balance"],
        code: z.ZodIssueCode.custom,
        message: balanceIssue.messageId,
      });
    }

    const paymentIssue = validateMonthlyPayment(
      data.monthly_payment,
      data.principal_amount,
    );
    if (paymentIssue) {
      ctx.addIssue({
        path: ["monthly_payment"],
        code: z.ZodIssueCode.custom,
        message: paymentIssue.messageId,
      });
    }

    const dateIssue = validateDateString(data.start_date);
    if (dateIssue) {
      ctx.addIssue({
        path: ["start_date"],
        code: z.ZodIssueCode.custom,
        message: dateIssue.messageId,
      });
    }
  });

type LoanFormValues = z.infer<typeof loanSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const loanDefaultValues: LoanFormValues = {
  loan_type: "",
  description: "",
  principal_amount: 0,
  remaining_balance: 0,
  interest_rate: 0,
  monthly_payment: 0,
  start_date: todayISO,
  term_months: 1,
};

const loanFieldConfig: FormFieldConfig<LoanFormValues>[] = [
  {
    name: "loan_type",
    labelId: "loans.form.type",
    component: "select",
    placeholderId: "loans.form.type.select",
    options: loanTypeOptions,
  },
  {
    name: "description",
    labelId: "loans.form.description",
    component: "text",
  },
  {
    name: "principal_amount",
    labelId: "loans.form.principalAmount",
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "remaining_balance",
    labelId: "loans.form.remainingBalance",
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "interest_rate",
    labelId: "loans.form.interestRate",
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "monthly_payment",
    labelId: "loans.form.monthlyPayment",
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "term_months",
    labelId: "loans.form.termMonths",
    component: "number",
    step: "1",
    min: 1,
  },
  {
    name: "start_date",
    labelId: "loans.form.startDate",
    component: "date",
  },
];

const mapLoanToFormValues = (loan: Loan): LoanFormValues => ({
  loan_type: loan.loan_type,
  description: loan.description,
  principal_amount: loan.principal_amount,
  remaining_balance: loan.remaining_balance,
  interest_rate: loan.interest_rate,
  monthly_payment: loan.monthly_payment,
  start_date: loan.start_date.slice(0, 10),
  term_months: loan.term_months,
});

export default function LoansPage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency } = useSettings();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Loan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loanTypeFilter, setLoanTypeFilter] = useState<LoanType | "all">("all");
  const [sortKey, setSortKey] = useState<LoanSortKey>("start_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [scheduleLoan, setScheduleLoan] = useState<Loan | null>(null);

  const userEmail = session?.user?.email ?? null;

  useEffect(() => {
    const loadLoans = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setApiError(null);

        const response = await fetch(
          `${API_BASE_URL}/loans?user_id=${encodeURIComponent(userEmail)}`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to fetch loans");
        }

        const data: Loan[] = await response.json();
        setLoans(data);
      } catch (error) {
        logger.error("[Loans] Failed to load loans", error);
        setApiError(intl.formatMessage({ id: "loans.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadLoans();
  }, [userEmail, intl]);

  const loanMetrics = useMemo(() => {
    return loans.reduce<Record<string, {
      principalAmount: number;
      remainingBalance: number;
      amountPaid: number;
      monthlyPayment: number;
      termMonths: number;
      monthsRemaining: number;
      progress: number;
      nextPaymentDate: Date | null;
    }>>((acc, loan) => {
      const principalAmount = Math.max(loan.principal_amount ?? 0, 0);
      const remainingBalance = Math.max(loan.remaining_balance ?? 0, 0);
      const monthlyPayment = Math.max(loan.monthly_payment ?? 0, 0);
      const amountPaid = Math.max(principalAmount - remainingBalance, 0);
      const progress =
        principalAmount > 0
          ? Math.min(Math.max(amountPaid / principalAmount, 0), 1)
          : 0;
      const termMonths = Math.max(loan.term_months ?? 0, 0);
      const monthsRemaining =
        monthlyPayment > 0
          ? Math.max(Math.ceil(remainingBalance / monthlyPayment), 0)
          : termMonths;

      let nextPaymentDate: Date | null = null;
      if (monthlyPayment > 0 && monthsRemaining > 0) {
        const startDate = new Date(loan.start_date);
        if (!Number.isNaN(startDate.getTime())) {
          const monthsPaidEstimate = Math.max(termMonths - monthsRemaining, 0);
          const baseCandidate = addMonths(startDate, monthsPaidEstimate);
          const initialCandidate =
            monthsPaidEstimate > 0 ? baseCandidate : addMonths(startDate, 1);
          const today = new Date();
          let candidate = new Date(initialCandidate);
          const finalLimit =
            termMonths > 0 ? addMonths(startDate, termMonths) : null;

          while (candidate < today && (!finalLimit || candidate <= finalLimit)) {
            candidate = addMonths(candidate, 1);
          }

          nextPaymentDate =
            finalLimit && candidate > finalLimit ? null : candidate;
        }
      }

      acc[String(loan.id)] = {
        principalAmount,
        remainingBalance,
        amountPaid,
        monthlyPayment,
        termMonths,
        monthsRemaining,
        progress,
        nextPaymentDate,
      };
      return acc;
    }, {});
  }, [loans]);

  const totalMonthlyPayments = useMemo(
    () =>
      loans.reduce(
        (sum, loan) => sum + Math.max(loan.monthly_payment ?? 0, 0),
        0,
      ),
    [loans],
  );

  const totalRemainingBalance = useMemo(
    () =>
      loans.reduce(
        (sum, loan) => sum + Math.max(loan.remaining_balance ?? 0, 0),
        0,
      ),
    [loans],
  );

  const upcomingPayment = useMemo(() => {
    const upcoming = loans
      .map((loan) => {
        const metrics = loanMetrics[String(loan.id)];
        if (!metrics || !metrics.nextPaymentDate || metrics.monthsRemaining <= 0) {
          return null;
        }

        return {
          loan,
          date: metrics.nextPaymentDate,
          amount: metrics.monthlyPayment,
        };
      })
      .filter(
        (value): value is { loan: Loan; date: Date; amount: number } =>
          value !== null,
      );

    if (upcoming.length === 0) {
      return null;
    }

    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcoming[0];
  }, [loans, loanMetrics]);

  const filteredLoans = useMemo(
    () =>
      loans.filter((loan) =>
        loanTypeFilter === "all" ? true : loan.loan_type === loanTypeFilter,
      ),
    [loans, loanTypeFilter],
  );

  const sortedLoans = useMemo(() => {
    const sorted = [...filteredLoans].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      const metricsA = loanMetrics[String(a.id)];
      const metricsB = loanMetrics[String(b.id)];

      if (sortKey === "start_date") {
        return (
          direction *
          (new Date(a.start_date).getTime() -
            new Date(b.start_date).getTime())
        );
      }

      if (sortKey === "remaining_balance") {
        return (
          direction *
          ((metricsA?.remainingBalance ?? 0) -
            (metricsB?.remainingBalance ?? 0))
        );
      }

      if (sortKey === "principal_amount") {
        return (
          direction *
          ((metricsA?.principalAmount ?? 0) -
            (metricsB?.principalAmount ?? 0))
        );
      }

      if (sortKey === "monthly_payment") {
        return (
          direction *
          ((metricsA?.monthlyPayment ?? 0) -
            (metricsB?.monthlyPayment ?? 0))
        );
      }

      return 0;
    });

    return sorted;
  }, [filteredLoans, loanMetrics, sortDirection, sortKey]);

  const scheduleEntries = useMemo(() => {
    if (!scheduleLoan) {
      return [];
    }

    const metrics = loanMetrics[String(scheduleLoan.id)];
    if (!metrics || metrics.monthlyPayment <= 0 || metrics.monthsRemaining <= 0) {
      return [];
    }

    const previewCount = Math.min(metrics.monthsRemaining, 12);
    const startCandidate =
      metrics.nextPaymentDate ??
      addMonths(new Date(scheduleLoan.start_date), 1);
    if (Number.isNaN(startCandidate.getTime())) {
      return [];
    }

    const schedule: Array<{
      date: Date;
      amount: number;
      balanceAfter: number;
    }> = [];
    let runningBalance = metrics.remainingBalance;

    for (let index = 0; index < previewCount; index += 1) {
      const paymentDate = addMonths(startCandidate, index);
      runningBalance = Math.max(runningBalance - metrics.monthlyPayment, 0);
      schedule.push({
        date: paymentDate,
        amount: metrics.monthlyPayment,
        balanceAfter: runningBalance,
      });
    }

    return schedule;
  }, [loanMetrics, scheduleLoan]);


  const sortOptions: Array<{ value: LoanSortKey; labelId: string }> = [
    { value: "start_date", labelId: "loans.filters.sort.startDate" },
    {
      value: "remaining_balance",
      labelId: "loans.filters.sort.remainingBalance",
    },
    {
      value: "principal_amount",
      labelId: "loans.filters.sort.principalAmount",
    },
    {
      value: "monthly_payment",
      labelId: "loans.filters.sort.monthlyPayment",
    },
  ];

  const directionOptions: Array<{ value: "asc" | "desc"; labelId: string }> = [
    { value: "desc", labelId: "loans.filters.direction.desc" },
    { value: "asc", labelId: "loans.filters.direction.asc" },
  ];

  const hasLoans = loans.length > 0;
  const hasVisibleLoans = sortedLoans.length > 0;

  const handleOpenCreate = () => {
    setActiveLoan(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (loan: Loan) => {
    setActiveLoan(loan);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveLoan(null);
    }
  };

  const showErrorToast = (messageId: string) => {
    toast({
      title: intl.formatMessage({ id: messageId }),
      variant: "destructive",
    });
  };

  const handleSubmit = async (values: LoanFormValues) => {
    if (!userEmail) {
      showErrorToast("common.mustBeLoggedIn");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...values };

      if (dialogMode === "create") {
        const response = await fetch(
          `${API_BASE_URL}/loans?user_id=${encodeURIComponent(userEmail)}`,
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
          throw new Error(errorText || "Failed to create loan");
        }

        const created: Loan = await response.json();
        setLoans((prev) => [...prev, created]);

        await logActivity({
          entity_type: "Loan",
          operation_type: "create",
          entity_id: Number(created.id),
          new_values: created,
        });

        toast({
          title: intl.formatMessage({ id: "loans.toast.createSuccess" }),
        });
      } else if (activeLoan) {
        const response = await fetch(
          `${API_BASE_URL}/loans/${activeLoan.id}?user_id=${encodeURIComponent(userEmail)}`,
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
          throw new Error(errorText || "Failed to update loan");
        }

        const updated: Loan = await response.json();

        setLoans((prev) =>
          prev.map((loan) => (loan.id === updated.id ? updated : loan)),
        );

        await logActivity({
          entity_type: "Loan",
          operation_type: "update",
          entity_id: Number(updated.id),
          previous_values: activeLoan,
          new_values: updated,
        });

        toast({
          title: intl.formatMessage({ id: "loans.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      logger.error("[Loans] Failed to submit form", error);
      showErrorToast("loans.toast.genericError");
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
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/loans/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete loan");
      }

      setLoans((prev) =>
        prev.filter((loan) => loan.id !== pendingDelete.id),
      );

      await logActivity({
        entity_type: "Loan",
        operation_type: "delete",
        entity_id: Number(pendingDelete.id),
        previous_values: pendingDelete,
      });

      toast({
        title: intl.formatMessage({ id: "loans.toast.deleteSuccess" }),
      });
    } catch (error) {
      logger.error("[Loans] Failed to delete loan", error);
      showErrorToast("loans.toast.genericError");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            <FormattedMessage id="loans.title" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="loans.subtitle" />
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="loans.actions.add" />
        </Button>
      </div>

      {apiError && (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="py-4">
            <p>{apiError}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 rounded-3xl border border-muted/60 bg-card/90 p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <FormattedMessage id="loans.summaryPanel.totalMonthlyLabel" />
          </p>
          <p className="text-2xl font-semibold text-emerald-700">
            {formatCurrency(totalMonthlyPayments)}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <FormattedMessage id="loans.summaryPanel.totalMonthlyDescription" />
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <FormattedMessage id="loans.summaryPanel.totalBalanceLabel" />
          </p>
          <p className="text-2xl font-semibold text-emerald-700">
            {formatCurrency(totalRemainingBalance)}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <FormattedMessage id="loans.summaryPanel.totalBalanceDescription" />
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <FormattedMessage id="loans.summaryPanel.nextPaymentLabel" />
          </p>
          {upcomingPayment ? (
            <p className="text-base font-semibold text-emerald-900">
              {intl.formatDate(upcomingPayment.date, { dateStyle: "medium" })} ·{" "}
              {formatCurrency(upcomingPayment.amount)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="loans.summaryPanel.noUpcomingPayment" />
            </p>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            <FormattedMessage id="loans.summaryPanel.nextPaymentDescription" />
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-muted/60 bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label
            htmlFor="loan-type-filter"
            className="text-xs uppercase tracking-wide"
          >
            <FormattedMessage id="loans.filters.typeLabel" />
          </label>
          <select
            id="loan-type-filter"
            value={loanTypeFilter}
            onChange={(event) =>
              setLoanTypeFilter(event.target.value as LoanType | "all")
            }
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">
              {intl.formatMessage({ id: "loans.filters.type.all" })}
            </option>
            {loanTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {intl.formatMessage({ id: option.labelId })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label
            htmlFor="loan-sort-key"
            className="text-xs uppercase tracking-wide"
          >
            <FormattedMessage id="loans.filters.sortLabel" />
          </label>
          <select
            id="loan-sort-key"
            value={sortKey}
            onChange={(event) =>
              setSortKey(event.target.value as LoanSortKey)
            }
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {intl.formatMessage({ id: option.labelId })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label
            htmlFor="loan-sort-direction"
            className="text-xs uppercase tracking-wide"
          >
            <FormattedMessage id="loans.filters.directionLabel" />
          </label>
          <select
            id="loan-sort-direction"
            value={sortDirection}
            onChange={(event) =>
              setSortDirection(event.target.value as "asc" | "desc")
            }
            className="rounded-md border border-muted bg-card px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {directionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {intl.formatMessage({ id: option.labelId })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasVisibleLoans && (
        <div className="space-y-6">
          {sortedLoans.map((loan) => {
            const meta = LOAN_TYPE_META[loan.loan_type] ?? DEFAULT_LOAN_META;
            const Icon = meta.Icon;
            const fallbackMonthlyPayment = Math.max(loan.monthly_payment ?? 0, 0);
            const fallbackPrincipal = Math.max(loan.principal_amount ?? 0, 0);
            const fallbackRemaining = Math.max(loan.remaining_balance ?? 0, 0);
            const fallbackMonths =
              fallbackMonthlyPayment > 0
                ? Math.max(
                    Math.ceil(fallbackRemaining / fallbackMonthlyPayment),
                    0,
                  )
                : Math.max(loan.term_months ?? 0, 0);
            const metrics =
              loanMetrics[String(loan.id)] ?? {
                principalAmount: fallbackPrincipal,
                remainingBalance: fallbackRemaining,
                amountPaid: Math.max(fallbackPrincipal - fallbackRemaining, 0),
                monthlyPayment: fallbackMonthlyPayment,
                termMonths: Math.max(loan.term_months ?? 0, 0),
                monthsRemaining: fallbackMonths,
                progress:
                  fallbackPrincipal > 0
                    ? Math.min(
                        Math.max(
                          (fallbackPrincipal - fallbackRemaining) /
                            fallbackPrincipal,
                          0,
                        ),
                        1,
                      )
                    : 0,
                nextPaymentDate: null,
              };
            const progressPercent = Math.round(metrics.progress * 100);
            const progressLabel = intl.formatNumber(metrics.progress, {
              style: "percent",
              maximumFractionDigits: metrics.progress >= 0.1 ? 0 : 1,
            });
            const interestRateFormatted = intl.formatNumber(
              (loan.interest_rate ?? 0) / 100,
              {
                style: "percent",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            );

            return (
              <div
                key={loan.id}
                className="group rounded-3xl border border-muted/50 bg-gradient-to-r from-emerald-50/70 via-white to-white p-6 shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full text-lg",
                        meta.toneClass,
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        <FormattedMessage id={`loans.types.${loan.loan_type}`} />
                      </p>
                      <h2 className="text-xl font-semibold text-emerald-900">
                        {loan.description}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          <FormattedMessage
                            id="loans.summary.started"
                            values={{
                              date: (
                                <span className="font-medium text-slate-700">
                                  <FormattedDate value={new Date(loan.start_date)} />
                                </span>
                              ),
                            }}
                          />
                        </div>
                        {metrics.nextPaymentDate && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                            <FormattedMessage
                              id="loans.summary.nextPayment"
                              values={{
                                date: (
                                  <span className="font-medium text-slate-700">
                                    <FormattedDate value={metrics.nextPaymentDate} />
                                  </span>
                                ),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setScheduleLoan(loan)}
                      disabled={metrics.monthlyPayment <= 0}
                      className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-muted/40 disabled:bg-muted/20 disabled:text-muted-foreground"
                    >
                      <FormattedMessage id="loans.schedule.view" />
                    </Button>
                    <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleOpenEdit(loan)}
                        className="h-10 w-10 rounded-full border-primary/10 hover:bg-primary/10 hover:text-primary"
                        aria-label={intl.formatMessage({ id: "common.edit" })}
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
                        size="icon"
                        onClick={() => {
                          setPendingDelete(loan);
                          setConfirmOpen(true);
                        }}
                        className="h-10 w-10 rounded-full border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                        aria-label={intl.formatMessage({ id: "common.delete" })}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">
                          {intl.formatMessage({ id: "common.delete" })}
                        </span>
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.remaining" />
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700">
                      {formatCurrency(metrics.remainingBalance)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.monthlyPayment" />
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700">
                      {formatCurrency(metrics.monthlyPayment)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.interestRate" />
                    </p>
                    <p className={cn("mt-2 text-2xl font-semibold", meta.accentClass)}>
                      {interestRateFormatted}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.term" />
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-900">
                      {metrics.termMonths}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        <FormattedMessage id="loans.summary.monthsSuffix" />
                      </span>
                    </p>
                    {metrics.monthsRemaining > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <FormattedMessage
                          id="loans.summary.monthsRemaining"
                          values={{ months: metrics.monthsRemaining }}
                        />
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-emerald-900">
                      <FormattedMessage
                        id="loans.summary.progressLabel"
                        values={{ percentage: progressLabel }}
                      />
                    </span>
                    <span>
                      <FormattedMessage
                        id="loans.summary.progressDescription"
                        values={{
                          paid: (
                            <span className="font-medium text-emerald-700">
                              {formatCurrency(metrics.amountPaid)}
                            </span>
                          ),
                          principal: (
                            <span className="font-medium text-slate-600">
                              {formatCurrency(metrics.principalAmount)}
                            </span>
                          ),
                        }}
                      />
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full rounded-full bg-emerald-100" aria-hidden="true">
                    <div
                      className="h-2.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasVisibleLoans && hasLoans && (
        <Card className="border border-muted/60 bg-muted/20">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            <FormattedMessage id="loans.filters.noResults" />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border border-muted/60 bg-card shadow-sm">
        <CardHeader className="rounded-t-3xl border-b border-emerald-100/60 bg-emerald-50/70 py-5 shadow-sm">
          <CardTitle className="text-lg font-semibold text-emerald-900">
            <FormattedMessage id="loans.loanHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="w-full overflow-hidden rounded-b-3xl">
            <TableHeader className="bg-emerald-50/80 text-emerald-900 shadow-sm">
              <TableRow>
                <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.type" />
                </TableHead>
                <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.description" />
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.principalAmount" />
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.remainingBalance" />
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <div className="flex items-center justify-end gap-1.5">
                    <FormattedMessage id="loans.table.interestRate" />
                    <Tooltip
                      content={intl.formatMessage({
                        id: "loans.table.interestTooltip",
                      })}
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground">
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">
                          {intl.formatMessage({
                            id: "loans.table.interestTooltip",
                          })}
                        </span>
                      </span>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.monthlyPayment" />
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.termMonths" />
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.startDate" />
                </TableHead>
                <TableHead className="py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <FormattedMessage id="loans.table.actions" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasVisibleLoans ? (
                sortedLoans.map((loan) => {
                  const metrics = loanMetrics[String(loan.id)];
                  const principal =
                    metrics?.principalAmount ?? Math.max(loan.principal_amount ?? 0, 0);
                  const remaining =
                    metrics?.remainingBalance ??
                    Math.max(loan.remaining_balance ?? 0, 0);
                  const monthlyPayment =
                    metrics?.monthlyPayment ?? Math.max(loan.monthly_payment ?? 0, 0);
                  const interestRate = intl.formatNumber(
                    (loan.interest_rate ?? 0) / 100,
                    {
                      style: "percent",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  );

                  return (
                    <TableRow
                      key={loan.id}
                      className="border-b border-muted/30 text-sm leading-relaxed odd:bg-white even:bg-emerald-50/40 transition-colors hover:bg-emerald-100/50 focus-within:bg-emerald-100/50"
                    >
                      <TableCell className="py-4 text-sm font-medium text-slate-700">
                        <FormattedMessage id={`loans.types.${loan.loan_type}`} />
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">
                        {loan.description}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base font-semibold text-emerald-700">
                        {formatCurrency(principal)}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base font-semibold text-emerald-700">
                        {formatCurrency(remaining)}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base text-slate-600">
                        {interestRate}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base text-slate-600">
                        {formatCurrency(monthlyPayment)}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base text-slate-600">
                        {loan.term_months}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2 rounded-full bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          <FormattedDate value={new Date(loan.start_date)} />
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex justify-end gap-2">
                          <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleOpenEdit(loan)}
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
                              size="icon"
                              onClick={() => {
                                setPendingDelete(loan);
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
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    <FormattedMessage
                      id={hasLoans ? "loans.filters.noResults" : "loans.noEntries"}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={handleDialogClose}
        titleId={
          dialogMode === "create"
            ? "loans.dialog.createTitle"
            : "loans.dialog.editTitle"
        }
        submitLabelId={
          dialogMode === "create"
            ? "loans.dialog.createSubmit"
            : "loans.dialog.editSubmit"
        }
        schema={loanSchema}
        defaultValues={loanDefaultValues}
        initialValues={
          dialogMode === "edit" && activeLoan
            ? mapLoanToFormValues(activeLoan)
            : undefined
        }
        fields={loanFieldConfig}
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
        titleId="loans.deleteDialog.title"
        descriptionId="loans.deleteDialog.description"
        confirmLabelId="loans.deleteDialog.confirm"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      <Dialog
        open={Boolean(scheduleLoan)}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleLoan(null);
          }
        }}
      >
        <DialogContent className="max-w-xl space-y-4">
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage
                id="loans.schedule.dialogTitle"
                values={{ loan: scheduleLoan?.description ?? "" }}
              />
            </DialogTitle>
            <DialogDescription>
              <FormattedMessage
                id="loans.schedule.dialogDescription"
                values={{ count: scheduleEntries.length }}
              />
            </DialogDescription>
          </DialogHeader>
          {scheduleEntries.length > 0 ? (
            <div className="space-y-2">
              {scheduleEntries.map((entry) => (
                <div
                  key={entry.date.toISOString()}
                  className="flex items-center justify-between rounded-xl border border-muted/50 bg-muted/20 px-4 py-3 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-800">
                    {intl.formatDate(entry.date, { dateStyle: "medium" })}
                  </span>
                  <span className="text-sm font-semibold text-emerald-700">
                    {formatCurrency(entry.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <FormattedMessage
                      id="loans.schedule.remaining"
                      values={{ amount: formatCurrency(entry.balanceAfter) }}
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="loans.schedule.empty" />
            </p>
          )}
          <p className="text-xs text-muted-foreground leading-relaxed">
            <FormattedMessage id="loans.schedule.note" />
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
