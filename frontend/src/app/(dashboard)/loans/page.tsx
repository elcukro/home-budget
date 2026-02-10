"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Car,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  History,
  Home,
  Info,
  Landmark,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  Undo2,
  Wallet,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import DebtPayoffStrategy from "@/components/loans/DebtPayoffStrategy";
import QuickAddLoanTiles, { type LoanTemplate } from "@/components/loans/QuickAddLoanTiles";
import CompactLoanCard from "@/components/loans/CompactLoanCard";
import LoanCalculator from "@/components/loans/LoanCalculator";

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
  due_day?: number;  // Day of month when payment is due (1-31)
  // Polish prepayment regulations
  overpayment_fee_percent?: number;  // Fee percentage for prepayment (0-10%)
  overpayment_fee_waived_until?: string;  // Date until prepayment fees are waived
  created_at: string;
}

interface LoanPayment {
  id: number;
  loan_id: number;
  user_id: string;
  amount: number;
  payment_date: string;
  payment_type: "regular" | "overpayment";
  covers_month?: number;
  covers_year?: number;
  notes?: string;
  created_at: string;
}

// Use Next.js API proxy for all backend calls to ensure auth headers are added
const API_BASE_URL = "/api/backend";

const loanTypeOptions = [
  { value: "mortgage", labelId: "loans.types.mortgage" },
  { value: "car", labelId: "loans.types.car" },
  { value: "personal", labelId: "loans.types.personal" },
  { value: "student", labelId: "loans.types.student" },
  { value: "credit_card", labelId: "loans.types.credit_card" },
  { value: "cash_loan", labelId: "loans.types.cash_loan" },
  { value: "installment", labelId: "loans.types.installment" },
  { value: "leasing", labelId: "loans.types.leasing" },
  { value: "overdraft", labelId: "loans.types.overdraft" },
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
  credit_card: {
    Icon: CreditCard,
    toneClass: "bg-rose-100 text-rose-700",
    accentClass: "text-rose-600",
  },
  cash_loan: {
    Icon: Banknote,
    toneClass: "bg-orange-100 text-orange-700",
    accentClass: "text-orange-600",
  },
  installment: {
    Icon: ShoppingCart,
    toneClass: "bg-indigo-100 text-indigo-700",
    accentClass: "text-indigo-600",
  },
  leasing: {
    Icon: Truck,
    toneClass: "bg-teal-100 text-teal-700",
    accentClass: "text-teal-600",
  },
  overdraft: {
    Icon: Wallet,
    toneClass: "bg-red-100 text-red-700",
    accentClass: "text-red-600",
  },
  other: {
    Icon: Landmark,
    toneClass: "bg-slate-100 text-slate-700",
    accentClass: "text-slate-600",
  },
};

const DEFAULT_LOAN_META = {
  Icon: CreditCard,
  toneClass: "bg-slate-100 text-slate-700",
  accentClass: "text-slate-600",
};

/**
 * Safely add months to a date, handling edge cases like month-end dates
 * e.g., Jan 31 + 1 month = Feb 28/29, not Mar 2/3
 */
const addMonths = (source: Date, months: number): Date => {
  const date = new Date(source.getTime());
  const originalDay = date.getDate();

  // Set to first of month to avoid overflow issues
  date.setDate(1);
  date.setMonth(date.getMonth() + months);

  // Get the last day of the target month
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  // Set the day to the original day or last day of month if original was higher
  date.setDate(Math.min(originalDay, lastDayOfMonth));

  return date;
};

/**
 * Calculate months to pay off a loan including compound interest
 * Returns the number of months needed to fully pay off the loan
 * @param balance - Current remaining balance
 * @param monthlyPayment - Monthly payment amount
 * @param annualInterestRate - Annual interest rate as percentage (e.g., 10 for 10%)
 * @param maxMonths - Maximum months to calculate (prevents infinite loops)
 */
const calculateMonthsToPayoff = (
  balance: number,
  monthlyPayment: number,
  annualInterestRate: number,
  maxMonths: number = 360
): number => {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return maxMonths;

  const monthlyRate = annualInterestRate / 100 / 12;

  // If payment doesn't cover monthly interest, loan will never be paid off
  const monthlyInterest = balance * monthlyRate;
  if (monthlyPayment <= monthlyInterest) {
    return maxMonths;
  }

  // Use amortization formula: n = -log(1 - (r * P) / M) / log(1 + r)
  // where P = principal, M = monthly payment, r = monthly rate, n = months
  if (monthlyRate > 0) {
    const months = -Math.log(1 - (monthlyRate * balance) / monthlyPayment) / Math.log(1 + monthlyRate);
    return Math.min(Math.ceil(months), maxMonths);
  }

  // If no interest, simple division
  return Math.ceil(balance / monthlyPayment);
};

/**
 * Generate amortization schedule with interest calculations
 */
const generateAmortizationSchedule = (
  balance: number,
  monthlyPayment: number,
  annualInterestRate: number,
  startDate: Date,
  maxEntries: number = 12
): Array<{
  date: Date;
  payment: number;
  principal: number;
  interest: number;
  balanceAfter: number;
}> => {
  const schedule: Array<{
    date: Date;
    payment: number;
    principal: number;
    interest: number;
    balanceAfter: number;
  }> = [];

  if (balance <= 0 || monthlyPayment <= 0) {
    return schedule;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  let currentBalance = balance;

  for (let i = 0; i < maxEntries && currentBalance > 0; i++) {
    const paymentDate = addMonths(startDate, i);
    const interestCharge = currentBalance * monthlyRate;
    const principalPaid = Math.min(monthlyPayment - interestCharge, currentBalance);
    const actualPayment = Math.min(monthlyPayment, currentBalance + interestCharge);

    currentBalance = Math.max(currentBalance - principalPaid, 0);

    schedule.push({
      date: paymentDate,
      payment: actualPayment,
      principal: principalPaid,
      interest: interestCharge,
      balanceAfter: currentBalance,
    });
  }

  return schedule;
};

const loanSchema = z
  .object({
    loan_type: z.string().min(1, "validation.categoryRequired"),
    description: z
      .string()
      .trim()
      .min(1, "validation.description.required")
      .max(100, { message: "validation.description.tooLong" }),
    principal_amount: z.union([z.string(), z.number()])
      .transform((value, ctx) => {
        const raw = typeof value === "number" ? value.toString() : value.trim();
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
    remaining_balance: z.union([z.string(), z.number()])
      .transform((value, ctx) => {
        const raw = typeof value === "number" ? value.toString() : value.trim();
        if (!raw) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validation.required",
          });
          return 0;
        }
        const error = validateAmountNonNegative(raw);
        if (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error.messageId,
          });
        }
        return parseNumber(raw) ?? 0;
      }),
    interest_rate: z.union([z.string(), z.number()])
      .transform((value, ctx) => {
        const raw = typeof value === "number" ? value.toString() : value.trim();
        if (!raw) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validation.required",
          });
          return 0;
        }
        const parsed = parseNumber(raw);
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
      }),
    monthly_payment: z.union([z.string(), z.number()])
      .transform((value, ctx) => {
        const raw = typeof value === "number" ? value.toString() : value.trim();
        if (!raw) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validation.required",
          });
          return 0;
        }
        const error = validateAmountNonNegative(raw);
        if (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error.messageId,
          });
        }
        return parseNumber(raw) ?? 0;
      }),
    start_date: z.string().trim().min(1, "validation.required"),
    due_day: z.union([z.string(), z.number()])
      .transform((value, ctx) => {
        const raw = typeof value === "number" ? value.toString() : value.trim();
        if (!raw) {
          return 1; // Default to 1st of month
        }
        const parsed = parseNumber(raw);
        if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validation.dueDay.invalid",
          });
          return 1;
        }
        return parsed;
      }),
    term_months: z.union([z.string(), z.number()])
      .transform((value, ctx) => {
        const raw = typeof value === "number" ? value.toString() : value.trim();
        if (!raw) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validation.required",
          });
          return 0;
        }
        const parsed = parseNumber(raw);
        if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "validation.termMonths.min",
          });
          return 0;
        }
        return parsed;
      }),
  })
  .superRefine((data, ctx) => {
    // For leasing, principal and remaining_balance are auto-calculated from monthly_payment * term_months
    // Skip validation that doesn't apply
    const isLeasing = data.loan_type === "leasing";

    if (!isLeasing) {
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
    }

    // Allow future dates for loans (e.g., leasing starts next month)
    const dateIssue = validateDateString(data.start_date, { allowFuture: true });
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
  due_day: 1,
  term_months: 1,
};

// Helper to auto-calculate principal for leasing (total = monthly_payment * term_months)
const autoCalculateLeasingPrincipal = (form: any) => {
  const loanType = form.getValues("loan_type");
  if (loanType === "leasing") {
    const monthlyPayment = parseFloat(form.getValues("monthly_payment")) || 0;
    const termMonths = parseInt(form.getValues("term_months")) || 0;
    if (monthlyPayment > 0 && termMonths > 0) {
      const total = monthlyPayment * termMonths;
      form.setValue("principal_amount", total);
      form.setValue("remaining_balance", total);
    }
  }
};

const loanFieldConfig: FormFieldConfig<LoanFormValues>[] = [
  {
    name: "loan_type",
    labelId: "loans.form.type",
    component: "select",
    placeholderId: "loans.form.type.select",
    options: loanTypeOptions,
    onValueChange: (value, form) => {
      // When switching to leasing, auto-calculate if we have monthly_payment and term
      if (value === "leasing") {
        autoCalculateLeasingPrincipal(form);
      }
    },
  },
  {
    name: "description",
    labelId: "loans.form.description",
    component: "text",
  },
  {
    name: "principal_amount",
    labelId: "loans.form.principalAmount",
    component: "currency",
    step: "0.01",
    min: 0,
    showWhen: (values) => values.loan_type !== "leasing",
  },
  {
    name: "remaining_balance",
    labelId: "loans.form.remainingBalance",
    component: "currency",
    step: "0.01",
    min: 0,
    showWhen: (values) => values.loan_type !== "leasing",
  },
  {
    name: "interest_rate",
    labelId: "loans.form.interestRate",
    component: "number",
    step: "0.01",
    min: 0,
    showWhen: (values) => values.loan_type !== "leasing",
  },
  {
    name: "monthly_payment",
    labelId: "loans.form.monthlyPayment",
    component: "currency",
    step: "0.01",
    min: 0,
    onValueChange: (_value, form) => {
      autoCalculateLeasingPrincipal(form);
    },
  },
  {
    name: "term_months",
    labelId: "loans.form.termMonths",
    component: "number",
    step: "1",
    min: 1,
    onValueChange: (_value, form) => {
      autoCalculateLeasingPrincipal(form);
    },
  },
  {
    name: "start_date",
    labelId: "loans.form.startDate",
    component: "date",
    rowGroup: "dates",
    rowWidth: "1/2",
  },
  {
    name: "due_day",
    labelId: "loans.form.dueDay",
    descriptionId: "loans.form.dueDay.description",
    component: "number",
    step: "1",
    min: 1,
    max: 31,
    rowGroup: "dates",
    rowWidth: "1/2",
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
  due_day: loan.due_day ?? 1,
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
  const [prefilledValues, setPrefilledValues] = useState<Partial<LoanTemplate> | null>(null);
  const [viewMode, setViewMode] = useState<"expanded" | "compact">("expanded");

  // Payment tracking state
  const [loanPayments, setLoanPayments] = useState<Record<number, LoanPayment[]>>({});
  const [loadingPayments, setLoadingPayments] = useState<Record<number, boolean>>({});
  const [overpayLoan, setOverpayLoan] = useState<Loan | null>(null);
  const [overpayAmount, setOverpayAmount] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentHistoryLoan, setPaymentHistoryLoan] = useState<Loan | null>(null);
  const [confirmUndoPayment, setConfirmUndoPayment] = useState<{ loan: Loan; payment: LoanPayment } | null>(null);

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
          `${API_BASE_URL}/loans`,
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
        // Filter out archived loans as a safety check (backend should already exclude them)
        const activeLoans = data.filter(loan => !loan.is_archived);
        setLoans(activeLoans);
      } catch (error) {
        logger.error("[Loans] Failed to load loans", error);
        setApiError(intl.formatMessage({ id: "loans.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadLoans();
  }, [userEmail, intl]);

  // Fetch payments for a specific loan
  const fetchLoanPayments = async (loanId: number) => {
    if (!userEmail) return;

    setLoadingPayments(prev => ({ ...prev, [loanId]: true }));
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/loans/${loanId}/payments`,
        { headers: { Accept: "application/json" } }
      );
      if (response.ok) {
        const payments: LoanPayment[] = await response.json();
        setLoanPayments(prev => ({ ...prev, [loanId]: payments }));
      }
    } catch (error) {
      logger.error(`[Loans] Failed to fetch payments for loan ${loanId}`, error);
    } finally {
      setLoadingPayments(prev => ({ ...prev, [loanId]: false }));
    }
  };

  // Load payments for all loans when loans are loaded
  useEffect(() => {
    if (loans.length > 0 && userEmail) {
      loans.forEach(loan => {
        if (typeof loan.id === 'number') {
          void fetchLoanPayments(loan.id);
        }
      });
    }
  }, [loans, userEmail]);

  // Check if payment for current month exists
  const hasCurrentMonthPayment = (loanId: number): boolean => {
    const payments = loanPayments[loanId] || [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return payments.some(
      p => p.payment_type === "regular" && p.covers_month === currentMonth && p.covers_year === currentYear
    );
  };

  // Get payment status for a loan
  const getPaymentStatus = (loan: Loan): "paid" | "due_soon" | "overdue" | "ok" => {
    const loanId = typeof loan.id === 'number' ? loan.id : parseInt(loan.id as string);
    if (hasCurrentMonthPayment(loanId)) return "paid";

    const now = new Date();
    const dueDay = loan.due_day ?? 1;
    const currentDay = now.getDate();

    if (currentDay > dueDay) return "overdue";
    if (currentDay >= dueDay - 3) return "due_soon";
    return "ok";
  };

  // Create a regular payment
  const handleMarkAsPaid = async (loan: Loan) => {
    if (!userEmail || isProcessingPayment) return;

    const loanId = typeof loan.id === 'number' ? loan.id : parseInt(loan.id as string);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    setIsProcessingPayment(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/loans/${loanId}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            amount: loan.monthly_payment,
            payment_date: now.toISOString().split("T")[0],
            payment_type: "regular",
            covers_month: currentMonth,
            covers_year: currentYear,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to record payment");
      }

      const newPayment: LoanPayment = await response.json();

      // Update local payments state
      setLoanPayments(prev => ({
        ...prev,
        [loanId]: [newPayment, ...(prev[loanId] || [])],
      }));

      // Update loan remaining balance locally
      setLoans(prev =>
        prev.map(l =>
          l.id === loan.id
            ? { ...l, remaining_balance: Math.max(0, l.remaining_balance - loan.monthly_payment) }
            : l
        )
      );

      toast({
        title: intl.formatMessage({ id: "loans.payment.toast.success" }),
      });
    } catch (error) {
      logger.error("[Loans] Failed to record payment", error);
      toast({
        title: intl.formatMessage({ id: "loans.payment.toast.error" }),
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Create an overpayment
  const handleOverpayment = async () => {
    if (!userEmail || !overpayLoan || isProcessingPayment) return;

    const amount = overpayAmount;
    if (!amount || amount <= 0) return;

    const loanId = typeof overpayLoan.id === 'number' ? overpayLoan.id : parseInt(overpayLoan.id as string);
    const now = new Date();

    setIsProcessingPayment(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/loans/${loanId}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            amount,
            payment_date: now.toISOString().split("T")[0],
            payment_type: "overpayment",
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to record overpayment");
      }

      const newPayment: LoanPayment = await response.json();

      // Update local payments state
      setLoanPayments(prev => ({
        ...prev,
        [loanId]: [newPayment, ...(prev[loanId] || [])],
      }));

      // Update loan remaining balance locally
      setLoans(prev =>
        prev.map(l =>
          l.id === overpayLoan.id
            ? { ...l, remaining_balance: Math.max(0, l.remaining_balance - amount) }
            : l
        )
      );

      toast({
        title: intl.formatMessage({ id: "loans.payment.toast.success" }),
      });

      setOverpayLoan(null);
      setOverpayAmount(0);
    } catch (error) {
      logger.error("[Loans] Failed to record overpayment", error);
      toast({
        title: intl.formatMessage({ id: "loans.payment.toast.error" }),
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Undo a payment
  const handleUndoPayment = async () => {
    if (!userEmail || !confirmUndoPayment || isProcessingPayment) return;

    const { loan, payment } = confirmUndoPayment;
    const loanId = typeof loan.id === 'number' ? loan.id : parseInt(loan.id as string);

    setIsProcessingPayment(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/loans/${loanId}/payments/${payment.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to undo payment");
      }

      // Update local payments state
      setLoanPayments(prev => ({
        ...prev,
        [loanId]: (prev[loanId] || []).filter(p => p.id !== payment.id),
      }));

      // Restore loan remaining balance locally
      setLoans(prev =>
        prev.map(l =>
          l.id === loan.id
            ? { ...l, remaining_balance: l.remaining_balance + payment.amount }
            : l
        )
      );

      toast({
        title: intl.formatMessage({ id: "loans.payment.toast.undoSuccess" }),
      });

      setConfirmUndoPayment(null);
    } catch (error) {
      logger.error("[Loans] Failed to undo payment", error);
      toast({
        title: intl.formatMessage({ id: "loans.payment.toast.error" }),
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const loanMetrics = useMemo(() => {
    return loans.reduce<Record<string, {
      principalAmount: number;
      remainingBalance: number;
      amountPaid: number;
      monthlyPayment: number;
      interestRate: number;
      termMonths: number;
      monthsRemaining: number;
      progress: number;
      nextPaymentDate: Date | null;
      paymentCoversInterest: boolean;
    }>>((acc, loan) => {
      const principalAmount = Math.max(loan.principal_amount ?? 0, 0);
      const remainingBalance = Math.max(loan.remaining_balance ?? 0, 0);
      const monthlyPayment = Math.max(loan.monthly_payment ?? 0, 0);
      const interestRate = Math.max(loan.interest_rate ?? 0, 0);
      const amountPaid = Math.max(principalAmount - remainingBalance, 0);
      const progress =
        principalAmount > 0
          ? Math.min(Math.max(amountPaid / principalAmount, 0), 1)
          : 0;
      const termMonths = Math.max(loan.term_months ?? 0, 0);

      // Calculate months remaining using proper amortization formula with interest
      const monthsRemaining = calculateMonthsToPayoff(
        remainingBalance,
        monthlyPayment,
        interestRate,
        termMonths > 0 ? termMonths * 2 : 360 // Allow some buffer beyond original term
      );

      // Check if payment covers at least the monthly interest
      const monthlyInterest = remainingBalance * (interestRate / 100 / 12);
      const paymentCoversInterest = monthlyPayment > monthlyInterest || interestRate === 0;

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
        interestRate,
        termMonths,
        monthsRemaining,
        progress,
        nextPaymentDate,
        paymentCoversInterest,
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

    const startCandidate =
      metrics.nextPaymentDate ??
      addMonths(new Date(scheduleLoan.start_date), 1);
    if (Number.isNaN(startCandidate.getTime())) {
      return [];
    }

    // Use proper amortization schedule with interest calculations
    const previewCount = Math.min(metrics.monthsRemaining, 12);
    return generateAmortizationSchedule(
      metrics.remainingBalance,
      metrics.monthlyPayment,
      metrics.interestRate,
      startCandidate,
      previewCount
    );
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

  const handleOpenCreate = (prefilled?: Partial<LoanTemplate>) => {
    setActiveLoan(null);
    setPrefilledValues(prefilled || null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (loan: Loan) => {
    setActiveLoan(loan);
    setPrefilledValues(null);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveLoan(null);
      setPrefilledValues(null);
    }
  };

  const handleQuickAdd = (template: Partial<LoanTemplate>) => {
    handleOpenCreate(template);
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

      // For leasing, auto-calculate principal and remaining_balance from monthly_payment * term_months
      if (payload.loan_type === "leasing") {
        const totalLeaseValue = payload.monthly_payment * payload.term_months;
        payload.principal_amount = totalLeaseValue;
        payload.remaining_balance = totalLeaseValue;
        payload.interest_rate = 0; // Leasing doesn't show interest rate separately
      }

      if (dialogMode === "create") {
        const response = await fetch(
          `${API_BASE_URL}/loans`,
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
          `${API_BASE_URL}/loans/${activeLoan.id}`,
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-amber-50 via-white to-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold text-amber-900">
            <FormattedMessage id="loans.title" />
          </h1>
          <p className="text-sm text-amber-700/80">
            <FormattedMessage id="loans.subtitle" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LoanCalculator
            onApply={(values) => {
              handleOpenCreate({
                principal_amount: values.principal,
                remaining_balance: values.principal,
                interest_rate: values.interestRate,
                monthly_payment: values.monthlyPayment,
                term_months: values.termMonths,
              });
            }}
          />
          <Button onClick={() => handleOpenCreate()}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="loans.actions.add" />
          </Button>
        </div>
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
          <p className="text-2xl font-semibold text-amber-700">
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
          <p className="text-2xl font-semibold text-amber-700">
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
            <>
              <p className="text-base font-semibold text-amber-900">
                {intl.formatDate(upcomingPayment.date, { dateStyle: "medium" })} · {formatCurrency(upcomingPayment.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {upcomingPayment.loan.description}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="loans.summaryPanel.noUpcomingPayment" />
            </p>
          )}
        </div>
      </div>

      {/* Quick Add Loan Tiles */}
      <QuickAddLoanTiles onQuickAdd={handleQuickAdd} />

      {/* Debt Payoff Strategy */}
      {loans.length > 0 && <DebtPayoffStrategy loans={loans} userEmail={userEmail} />}

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

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-muted bg-card p-1">
          <Tooltip content={intl.formatMessage({ id: "loans.view.expanded" })}>
            <Button
              variant={viewMode === "expanded" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("expanded")}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: "loans.view.compact" })}>
            <Button
              variant={viewMode === "compact" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("compact")}
              className="h-8 w-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {hasVisibleLoans && viewMode === "expanded" && (
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

            // Credit cards and overdrafts are revolving credit
            const isRevolvingCredit = loan.loan_type === 'credit_card' || loan.loan_type === 'overdraft';
            const utilizationPercent = isRevolvingCredit && metrics.principalAmount > 0
              ? Math.round((metrics.remainingBalance / metrics.principalAmount) * 100)
              : 0;

            return (
              <div
                key={loan.id}
                className="group rounded-3xl border border-muted/50 bg-gradient-to-r from-amber-50/70 via-white to-white p-6 shadow-sm transition-shadow hover:shadow-lg"
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
                      <h2 className="text-lg font-semibold text-amber-900">
                        {loan.description}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          <FormattedMessage
                            id="loans.summary.started"
                            values={{
                              date: (
                                <span key="date" className="font-medium text-slate-700">
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
                                  <span key="date" className="font-medium text-slate-700">
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
                  <div className="flex items-center gap-2">
                    {/* Payment status indicator */}
                    {(() => {
                      const status = getPaymentStatus(loan);
                      if (status === "paid") {
                        return (
                          <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <FormattedMessage id="loans.payment.paidThisMonth" />
                          </div>
                        );
                      }
                      if (status === "overdue") {
                        return (
                          <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <FormattedMessage id="loans.payment.overdue" values={{ day: loan.due_day ?? 1 }} />
                          </div>
                        );
                      }
                      if (status === "due_soon") {
                        return (
                          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700">
                            <Clock className="h-3.5 w-3.5" />
                            <FormattedMessage id="loans.payment.dueSoon" values={{ day: loan.due_day ?? 1 }} />
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Mark as paid - primary action */}
                    {!hasCurrentMonthPayment(typeof loan.id === 'number' ? loan.id : parseInt(loan.id as string)) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMarkAsPaid(loan)}
                        disabled={isProcessingPayment}
                        className="rounded-full border border-emerald-200 bg-emerald-100 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        <FormattedMessage id="loans.payment.markAsPaid" />
                      </Button>
                    )}

                    {/* More actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-muted"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {loan.loan_type !== "leasing" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setOverpayLoan(loan);
                              setOverpayAmount(0);
                            }}
                            disabled={isProcessingPayment}
                          >
                            <Wallet className="mr-2 h-4 w-4" />
                            <FormattedMessage id="loans.payment.overpay" />
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setPaymentHistoryLoan(loan)}>
                          <History className="mr-2 h-4 w-4" />
                          <FormattedMessage id="loans.payment.history" />
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setScheduleLoan(loan)}
                          disabled={metrics.monthlyPayment <= 0}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          <FormattedMessage id="loans.schedule.view" />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenEdit(loan)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          <FormattedMessage id="common.edit" />
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setPendingDelete(loan);
                            setConfirmOpen(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <FormattedMessage id="common.delete" />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-muted/40 bg-muted/20 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.remaining" />
                    </p>
                    <p className="mt-1 text-base font-semibold text-amber-700">
                      {formatCurrency(metrics.remainingBalance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-muted/40 bg-muted/20 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.monthlyPayment" />
                    </p>
                    <p className="mt-1 text-base font-semibold text-amber-700">
                      {formatCurrency(metrics.monthlyPayment)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-muted/40 bg-muted/20 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.interestRate" />
                    </p>
                    <p className={cn("mt-1 text-base font-semibold", meta.accentClass)}>
                      {interestRateFormatted}
                    </p>
                  </div>
                  <div className="rounded-xl border border-muted/40 bg-muted/20 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      <FormattedMessage id="loans.summary.term" />
                    </p>
                    <p className="mt-1 text-base font-semibold text-amber-900">
                      {metrics.termMonths}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        <FormattedMessage id="loans.summary.monthsSuffix" />
                      </span>
                    </p>
                    {metrics.monthsRemaining > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <FormattedMessage
                          id="loans.summary.monthsRemaining"
                          values={{ months: metrics.monthsRemaining }}
                        />
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  {isRevolvingCredit ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-amber-900">
                          <FormattedMessage id="loans.creditCard.utilization" />
                        </span>
                        <span className={cn(
                          "font-semibold",
                          utilizationPercent > 80 ? "text-destructive" : utilizationPercent > 50 ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {utilizationPercent}%
                          <span className="ml-2 font-normal text-muted-foreground">
                            <FormattedMessage
                              id="loans.creditCard.limit"
                              values={{ limit: formatCurrency(metrics.principalAmount) }}
                            />
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100" aria-hidden="true">
                        <div
                          className={cn(
                            "h-2.5 rounded-full transition-all",
                            utilizationPercent > 80 ? "bg-destructive" : utilizationPercent > 50 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                      {utilizationPercent > 80 && (
                        <p className="mt-2 text-xs text-amber-600">
                          <FormattedMessage id="loans.creditCard.highUtilization" />
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-amber-900">
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
                                <span key="paid" className="font-medium text-amber-700">
                                  {formatCurrency(metrics.amountPaid)}
                                </span>
                              ),
                              principal: (
                                <span key="principal" className="font-medium text-slate-600">
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
                    </>
                  )}
                </div>

                {/* Warning: payment doesn't cover interest */}
                {!metrics.paymentCoversInterest && metrics.interestRate > 0 && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">
                        <FormattedMessage id="loans.warning.paymentTooLow.title" />
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        <FormattedMessage
                          id="loans.warning.paymentTooLow.description"
                          values={{
                            monthlyInterest: formatCurrency(metrics.remainingBalance * (metrics.interestRate / 100 / 12)),
                            payment: formatCurrency(metrics.monthlyPayment),
                          }}
                        />
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compact view */}
      {hasVisibleLoans && viewMode === "compact" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedLoans.map((loan) => {
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
                interestRate: Math.max(loan.interest_rate ?? 0, 0),
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
                paymentCoversInterest: true,
              };

            return (
              <CompactLoanCard
                key={loan.id}
                loan={loan}
                metrics={metrics}
                formatCurrency={formatCurrency}
                onEdit={handleOpenEdit}
                onDelete={(loan) => {
                  setPendingDelete(loan);
                  setConfirmOpen(true);
                }}
                onViewSchedule={setScheduleLoan}
              />
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
        <CardHeader className="rounded-t-3xl border-b border-muted/40 bg-muted/20 py-5">
          <CardTitle className="text-lg font-semibold text-primary">
            <FormattedMessage id="loans.loanHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="w-full overflow-hidden rounded-b-3xl">
            <TableHeader className="bg-muted/30">
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
                      className="border-b border-muted/30 text-sm leading-relaxed odd:bg-white even:bg-muted/20 transition-colors hover:bg-muted/30 focus-within:bg-muted/30"
                    >
                      <TableCell className="py-4 text-sm font-medium text-slate-700">
                        <FormattedMessage id={`loans.types.${loan.loan_type}`} />
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">
                        {loan.description}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base font-semibold text-amber-700">
                        {formatCurrency(principal)}
                      </TableCell>
                      <TableCell className="py-4 text-right text-base font-semibold text-amber-700">
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
            : prefilledValues
              ? { ...loanDefaultValues, ...prefilledValues }
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
              {/* Header row */}
              <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span><FormattedMessage id="loans.schedule.date" defaultMessage="Date" /></span>
                <span className="text-right"><FormattedMessage id="loans.schedule.payment" defaultMessage="Payment" /></span>
                <span className="text-right"><FormattedMessage id="loans.schedule.principal" defaultMessage="Principal" /></span>
                <span className="text-right"><FormattedMessage id="loans.schedule.interest" defaultMessage="Interest" /></span>
                <span className="text-right"><FormattedMessage id="loans.schedule.balance" defaultMessage="Balance" /></span>
              </div>
              {scheduleEntries.map((entry) => (
                <div
                  key={entry.date.toISOString()}
                  className="grid grid-cols-5 gap-2 items-center rounded-xl border border-muted/50 bg-muted/20 px-4 py-3 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-800">
                    {intl.formatDate(entry.date, { dateStyle: "medium" })}
                  </span>
                  <span className="text-right text-sm font-semibold text-amber-700">
                    {formatCurrency(entry.payment)}
                  </span>
                  <span className="text-right text-sm text-emerald-600">
                    {formatCurrency(entry.principal)}
                  </span>
                  <span className="text-right text-sm text-rose-500">
                    {formatCurrency(entry.interest)}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {formatCurrency(entry.balanceAfter)}
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

      {/* Overpayment Dialog */}
      <Dialog
        open={Boolean(overpayLoan)}
        onOpenChange={(open) => {
          if (!open) {
            setOverpayLoan(null);
            setOverpayAmount(0);
          }
        }}
      >
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage id="loans.payment.overpayDialogTitle" />
            </DialogTitle>
            <DialogDescription>
              <FormattedMessage
                id="loans.payment.overpayDialogDescription"
                values={{ loan: overpayLoan?.description ?? "" }}
              />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="overpay-amount">
                <FormattedMessage id="loans.payment.overpayAmount" />
              </Label>
              <CurrencyInput
                id="overpay-amount"
                value={overpayAmount}
                onValueChange={setOverpayAmount}
                className="text-lg"
              />
            </div>
            {overpayLoan && overpayLoan.remaining_balance > 0 && (
              <p className="text-sm text-muted-foreground">
                <FormattedMessage
                  id="loans.payment.overpayRemainingBalance"
                  values={{ balance: formatCurrency(overpayLoan.remaining_balance) }}
                />
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOverpayLoan(null);
                setOverpayAmount(0);
              }}
            >
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button
              onClick={handleOverpayment}
              disabled={isProcessingPayment || overpayAmount <= 0}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <FormattedMessage id="loans.payment.overpayConfirm" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog
        open={Boolean(paymentHistoryLoan)}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentHistoryLoan(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl space-y-4">
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage
                id="loans.payment.historyDialogTitle"
                values={{ loan: paymentHistoryLoan?.description ?? "" }}
              />
            </DialogTitle>
            <DialogDescription>
              <FormattedMessage id="loans.payment.historyDialogDescription" />
            </DialogDescription>
          </DialogHeader>
          {paymentHistoryLoan && (() => {
            const loanId = typeof paymentHistoryLoan.id === 'number' ? paymentHistoryLoan.id : parseInt(paymentHistoryLoan.id as string);
            const payments = loanPayments[loanId] || [];
            const isLoading = loadingPayments[loanId];

            if (isLoading) {
              return (
                <div className="py-8 text-center text-muted-foreground">
                  <FormattedMessage id="common.loading" />
                </div>
              );
            }

            if (payments.length === 0) {
              return (
                <div className="py-8 text-center text-muted-foreground">
                  <FormattedMessage id="loans.payment.noPayments" />
                </div>
              );
            }

            return (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-xl border border-muted/50 bg-muted/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        payment.payment_type === "regular"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {payment.payment_type === "regular" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Wallet className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {payment.payment_type === "regular" ? (
                            <FormattedMessage
                              id="loans.payment.regularPayment"
                              values={{
                                month: payment.covers_month,
                                year: payment.covers_year,
                              }}
                            />
                          ) : (
                            <FormattedMessage id="loans.payment.overpaymentLabel" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <FormattedDate value={new Date(payment.payment_date)} />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-amber-700">
                        {formatCurrency(payment.amount)}
                      </span>
                      <Tooltip content={intl.formatMessage({ id: "loans.payment.undoTooltip" })}>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setConfirmUndoPayment({ loan: paymentHistoryLoan, payment })}
                          className="h-8 w-8 rounded-full border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Undo Payment Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmUndoPayment)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmUndoPayment(null);
          }
        }}
      >
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage id="loans.payment.undoDialogTitle" />
            </DialogTitle>
            <DialogDescription>
              <FormattedMessage
                id="loans.payment.undoDialogDescription"
                values={{
                  amount: confirmUndoPayment ? formatCurrency(confirmUndoPayment.payment.amount) : "",
                }}
              />
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmUndoPayment(null)}
            >
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button
              variant="destructive"
              onClick={handleUndoPayment}
              disabled={isProcessingPayment}
            >
              <FormattedMessage id="loans.payment.undoConfirm" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
