"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import {
  AlertCircle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Home,
  LineChart,
  Link2,
  Minus,
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
import { Separator } from "@/components/ui/separator";
import IncomeChart from "@/components/charts/IncomeChart";
import IncomeBudgetChart from "@/components/budget/IncomeBudgetChart";
import MonthBar from "@/components/budget/MonthBar";
import BudgetView from "@/components/budget/BudgetView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  kup_type?: string | null;  // "standard", "author_50", "none"
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
  kup_type: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.is_gross && (!data.employment_type || data.employment_type === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "income.validation.employmentTypeRequiredForGross",
      path: ["employment_type"],
    });
  }
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const incomeDefaultValues: IncomeFormValues = {
  category: "salary",
  description: "",
  amount: 0,
  date: todayISO,
  end_date: null,
  is_recurring: false,
  employment_type: null,
  gross_amount: null,
  is_gross: false,
  kup_type: null,
  owner: null,
};

const employmentTypeOptions = [
  { value: EmploymentType.UOP, labelId: "income.employmentTypes.uop" },
  { value: EmploymentType.B2B, labelId: "income.employmentTypes.b2b" },
  { value: EmploymentType.ZLECENIE, labelId: "income.employmentTypes.zlecenie" },
  { value: EmploymentType.DZIELO, labelId: "income.employmentTypes.dzielo" },
  { value: EmploymentType.OTHER, labelId: "income.employmentTypes.other" },
];

const kupTypeOptions = [
  { value: "standard", labelId: "income.form.kupOptions.standard" },
  { value: "author_50", labelId: "income.form.kupOptions.author50" },
  { value: "none", labelId: "income.form.kupOptions.none" },
];

const categoryOptions = [
  { value: "salary", labelId: "income.categories.salary", icon: <Briefcase className="h-5 w-5" /> },
  { value: "freelance", labelId: "income.categories.freelance", icon: <ArrowUpRight className="h-5 w-5" /> },
  { value: "investments", labelId: "income.categories.investments", icon: <LineChart className="h-5 w-5" /> },
  { value: "rental", labelId: "income.categories.rental", icon: <Home className="h-5 w-5" /> },
  { value: "benefits", labelId: "income.categories.benefits", icon: <Heart className="h-5 w-5" /> },
  { value: "other", labelId: "income.categories.other", icon: <ArrowDownRight className="h-5 w-5" /> },
];

// Tax breakdown preview state — shared between renderExtra and submit
interface TaxResult {
  gross: number;
  net: number;
  breakdown: {
    zus: number;
    ppk: number;
    kup: number;
    health: number;
    pit: number;
  };
}

function TaxBreakdownPreview({
  taxResult,
  employmentType,
  kupType,
  isGross,
  amount,
  owner,
  intl,
  formatCurrency,
  onValuesChange,
}: {
  taxResult: TaxResult | null;
  employmentType: string | null | undefined;
  kupType: string | null | undefined;
  isGross: boolean;
  amount: number;
  owner?: string | null;
  intl: ReturnType<typeof useIntl>;
  formatCurrency: (n: number) => string;
  onValuesChange: (amount: number, employmentType: string | null | undefined, isGross: boolean, kupType: string | null | undefined, owner?: string | null) => void;
}) {
  // Trigger tax calculation when relevant values change
  useEffect(() => {
    onValuesChange(amount, employmentType, isGross, kupType, owner);
  }, [amount, employmentType, isGross, kupType, owner, onValuesChange]);

  if (!isGross) return null;

  if (!employmentType || employmentType === "") {
    return (
      <p className="text-xs text-amber-600 mt-1">
        {intl.formatMessage({ id: "income.form.selectEmploymentFirst" })}
      </p>
    );
  }

  if (!amount || amount <= 0) return null;

  if (!taxResult) {
    return (
      <div className="mt-2 rounded-lg border border-muted/60 bg-muted/20 p-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
    );
  }

  const { breakdown } = taxResult;
  const items = [
    { key: "zus", value: breakdown.zus },
    { key: "health", value: breakdown.health },
    { key: "kup", value: breakdown.kup },
    { key: "pit", value: breakdown.pit },
    { key: "ppk", value: breakdown.ppk },
  ].filter((item) => item.value > 0);

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-emerald-800">
          {intl.formatMessage({ id: "income.form.computedNet" })}
        </span>
        <span className="text-lg font-bold text-emerald-700">
          {formatCurrency(taxResult.net)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {items.map((item) => (
          <div key={item.key} className="flex justify-between text-xs text-muted-foreground">
            <span>{intl.formatMessage({ id: `income.form.taxBreakdown.${item.key}` })}</span>
            <span className="font-mono">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
      {employmentType === "b2b" && (
        <p className="text-xs text-amber-600 italic">
          {intl.formatMessage({ id: "income.form.b2bDisclaimer" })}
        </p>
      )}
    </div>
  );
}

// Helper to build field config (needs to be a function since renderExtra uses hooks context)
// Employment status → employment_type mapping (same as onboarding)
const employmentStatusToType: Record<string, string | null> = {
  employee: 'uop',
  b2b: 'b2b',
  business: 'b2b',
  contract: 'zlecenie',
  freelancer: 'other',
  unemployed: null,
};

function useIncomeFieldConfig(
  taxResult: TaxResult | null,
  intl: ReturnType<typeof useIntl>,
  formatCurrency: (n: number) => string,
  onTaxValuesChange: (amount: number, employmentType: string | null | undefined, isGross: boolean, kupType: string | null | undefined, owner?: string | null) => void,
  settings: { employment_status?: string; use_authors_costs?: boolean; include_partner_finances?: boolean; partner_name?: string; partner_employment_status?: string; partner_use_authors_costs?: boolean } | null,
): FormFieldConfig<IncomeFormValues>[] {
  const ownerOptions = useMemo(() => [
    { value: "self", labelId: "income.form.ownerOptions.self", label: intl.formatMessage({ id: "income.form.ownerOptions.self" }) },
    {
      value: "partner",
      labelId: "income.form.ownerOptions.partnerDefault",
      label: settings?.partner_name || intl.formatMessage({ id: "income.form.ownerOptions.partnerDefault" }),
    },
  ], [settings?.partner_name, intl]);

  // Categories where employment type / tax calculation makes sense
  // salary, freelance, other (bonuses, etc.) — NOT investments/rental (flat tax, shared)
  const taxCategories = ["salary", "freelance", "other"];
  const hasTaxFields = (values: IncomeFormValues) => taxCategories.includes(values.category);

  return useMemo(() => [
    {
      name: "category" as const,
      labelId: "income.form.category",
      component: "icon-select" as const,
      options: categoryOptions,
      onValueChange: (value: unknown, form: Parameters<NonNullable<FormFieldConfig<IncomeFormValues>['onValueChange']>>[1]) => {
        const cat = value as string;
        if (!taxCategories.includes(cat)) {
          // Clear tax-related fields when switching to non-tax category
          form.setValue("employment_type", null);
          form.setValue("kup_type", null);
          form.setValue("is_gross", false);
        }
      },
    },
    {
      name: "description" as const,
      labelId: "income.form.description",
      component: "text" as const,
    },
    ...(settings?.include_partner_finances ? [{
      name: "owner" as const,
      labelId: "income.form.owner",
      component: "select" as const,
      options: ownerOptions,
      showWhen: (values: IncomeFormValues) => !["investments", "rental", "benefits"].includes(values.category),
      onValueChange: (value: unknown, form: Parameters<NonNullable<FormFieldConfig<IncomeFormValues>['onValueChange']>>[1]) => {
        if (value === "partner" && settings?.partner_employment_status) {
          const mappedType = employmentStatusToType[settings.partner_employment_status] ?? null;
          if (mappedType) form.setValue("employment_type", mappedType);
          form.setValue("kup_type", settings?.partner_use_authors_costs ? "author_50" : "standard");
        } else if (value === "self" && settings?.employment_status) {
          const mappedType = employmentStatusToType[settings.employment_status] ?? null;
          if (mappedType) form.setValue("employment_type", mappedType);
          form.setValue("kup_type", settings?.use_authors_costs ? "author_50" : "standard");
        }
      },
    } satisfies FormFieldConfig<IncomeFormValues>] : []),
    {
      name: "employment_type" as const,
      labelId: "income.form.employmentType",
      descriptionId: "income.form.employmentTypeHint",
      component: "select" as const,
      options: employmentTypeOptions,
      showWhen: hasTaxFields,
      onValueChange: (value, form) => {
        const et = value as string;
        if (["uop", "zlecenie", "dzielo"].includes(et)) {
          form.setValue("kup_type", settings?.use_authors_costs ? "author_50" : "standard");
        } else {
          form.setValue("kup_type", null);
        }
      },
    },
    {
      name: "kup_type" as const,
      labelId: "income.form.kupType",
      descriptionId: "income.form.kupTypeHint",
      component: "select" as const,
      options: kupTypeOptions,
      showWhen: (values: IncomeFormValues) =>
        hasTaxFields(values) && ["uop", "zlecenie", "dzielo"].includes(values.employment_type || ""),
    },
    {
      name: "amount" as const,
      labelId: "income.form.amount",
      component: "currency" as const,
    },
    {
      name: "is_gross" as const,
      labelId: "income.form.isGross",
      descriptionId: "income.form.isGrossHint",
      component: "switch" as const,
      showWhen: hasTaxFields,
      renderExtra: (form) => {
        const values = form.watch();
        return (
          <TaxBreakdownPreview
            taxResult={taxResult}
            employmentType={values.employment_type}
            kupType={values.kup_type}
            isGross={values.is_gross}
            amount={values.amount}
            owner={values.owner}
            intl={intl}
            formatCurrency={formatCurrency}
            onValuesChange={onTaxValuesChange}
          />
        );
      },
    },
    {
      name: "date" as const,
      labelId: "income.form.startDate",
      component: "date" as const,
    },
    {
      name: "is_recurring" as const,
      labelId: "income.form.recurring",
      component: "switch" as const,
    },
    {
      name: "end_date" as const,
      labelId: "income.form.endDate",
      component: "date" as const,
      showWhen: (values: IncomeFormValues) => values.is_recurring === true,
    },
  ], [taxResult, intl, formatCurrency, onTaxValuesChange, settings, ownerOptions, hasTaxFields, taxCategories]);
}

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

const mapIncomeToFormValues = (income: Income): IncomeFormValues => ({
  category: income.category,
  description: income.description,
  // When editing a gross income, show the gross amount in the form field
  amount: income.is_gross ? (income.gross_amount ?? income.amount) : income.amount,
  date: income.date.slice(0, 10),
  end_date: income.end_date ? income.end_date.slice(0, 10) : null,
  is_recurring: income.is_recurring,
  employment_type: income.employment_type || null,
  gross_amount: income.gross_amount || null,
  is_gross: income.is_gross || false,
  kup_type: income.kup_type || null,
  owner: income.owner || null,
});

// SourceBadge component to show income source (bank vs manual)
interface SourceBadgeProps {
  income: Income;
}

function SourceBadge({ income }: SourceBadgeProps) {
  if (income.bank_transaction_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <Building2 className="h-3 w-3" />
        Bank
      </span>
    );
  }

  if (income.reconciliation_status === "unreviewed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Needs Review
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
      <Pencil className="h-3 w-3" />
      Manual
    </span>
  );
}

export default function IncomePage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { settings, formatCurrency } = useSettings();
  const { trackIncome } = useAnalytics();

  const [activeTab, setActiveTab] = useState("transactions");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [budgetMonth, setBudgetMonth] = useState<number>(new Date().getMonth() + 1);

  const handleBudgetChartMonthSelect = (monthKey: string) => {
    if (monthKey === "all") return;
    const m = parseInt(monthKey.split("-")[1], 10);
    if (!Number.isNaN(m)) setBudgetMonth(m);
  };

  // Disable future months in MonthBar
  const futureDisabledMonths = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const disabled = new Set<number>();
    for (let m = currentMonth + 1; m <= 12; m++) {
      disabled.add(m);
    }
    return disabled;
  }, []);

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Reconciliation states
  const [sourceFilter, setSourceFilter] = useState<"all" | "bank" | "manual" | "needs_review">("all");
  const [monthlyTotalsBreakdown, setMonthlyTotalsBreakdown] = useState<{
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
  } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeIncome, setActiveIncome] = useState<Income | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tax calculation state
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);
  const taxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTaxKeyRef = useRef<string>("");

  // Resolve tax profile based on income owner
  const getTaxProfile = useCallback((owner?: string | null) => {
    const isPartner = owner === "partner";
    return {
      use_authors_costs: isPartner
        ? settings?.partner_use_authors_costs ?? false
        : settings?.use_authors_costs ?? false,
      ppk_employee_rate: isPartner
        ? (settings?.partner_ppk_enrolled && settings?.partner_ppk_employee_rate)
          ? settings.partner_ppk_employee_rate / 100 : 0
        : (settings?.ppk_enrolled && settings?.ppk_employee_rate)
          ? settings.ppk_employee_rate / 100 : 0,
    };
  }, [settings]);

  const fetchTaxCalculation = useCallback(async (
    grossMonthly: number,
    employmentType: string,
    kupType?: string | null,
    owner?: string | null,
  ) => {
    const profile = getTaxProfile(owner);
    const key = `${grossMonthly}:${employmentType}:${kupType}:${profile.use_authors_costs}:${profile.ppk_employee_rate}`;
    if (key === lastTaxKeyRef.current) return;
    lastTaxKeyRef.current = key;

    try {
      const res = await fetch("/api/tax/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gross_monthly: grossMonthly,
          employment_type: employmentType,
          use_authors_costs: profile.use_authors_costs,
          ppk_employee_rate: profile.ppk_employee_rate,
          kup_type: kupType || undefined,
        }),
      });
      if (res.ok) {
        const data: TaxResult = await res.json();
        setTaxResult(data);
      }
    } catch (err) {
      logger.error("[Income] Tax calculation failed", err);
    }
  }, [getTaxProfile]);


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

  // Load monthly totals breakdown (bank vs manual)
  useEffect(() => {
    const loadMonthlyTotals = async () => {
      if (!userEmail || selectedMonth === 0) {
        setMonthlyTotalsBreakdown(null);
        return;
      }

      const year = new Date().getFullYear();
      const monthStr = `${year}-${String(selectedMonth).padStart(2, "0")}`;

      try {
        const response = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/income/monthly?month=${monthStr}&include_bank=true`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          setMonthlyTotalsBreakdown(null);
          return;
        }

        const data = await response.json();
        setMonthlyTotalsBreakdown(data);
      } catch (error) {
        logger.error("[Income] Failed to load monthly totals", error);
        setMonthlyTotalsBreakdown(null);
      }
    };

    void loadMonthlyTotals();
  }, [userEmail, selectedMonth]);

  // Group incomes by category + description, with current and historical items
  interface IncomeGroup {
    key: string;
    category: string;
    description: string;
    current: Income | null;
    historical: Income[];
  }

  const groupedIncomes = useMemo(() => {
    // Filter by source
    let filteredIncomes = incomes;
    if (sourceFilter === "bank") {
      filteredIncomes = incomes.filter((i) => i.bank_transaction_id);
    } else if (sourceFilter === "manual") {
      filteredIncomes = incomes.filter((i) => !i.bank_transaction_id);
    } else if (sourceFilter === "needs_review") {
      filteredIncomes = incomes.filter(
        (i) => !i.bank_transaction_id && i.reconciliation_status === "unreviewed"
      );
    }

    const groups = new Map<string, IncomeGroup>();

    // Group by category + description
    filteredIncomes.forEach((income) => {
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

      const isPast = income.end_date && new Date(income.end_date) < new Date();
      if (isPast) {
        // end_date in the past = historical
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
  }, [incomes, intl.locale, sortDirection, sortKey, sourceFilter]);

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
      setTaxResult(null);
      lastTaxKeyRef.current = "";
    }
  };

  // Debounced tax calculation trigger — called from CrudDialog via renderExtra watching form values
  const scheduleTaxCalc = useCallback((amount: number, employmentType: string | null | undefined, isGross: boolean, kupType?: string | null, owner?: string | null) => {
    if (taxDebounceRef.current) clearTimeout(taxDebounceRef.current);
    if (!isGross || !employmentType || !amount || amount <= 0) {
      setTaxResult(null);
      lastTaxKeyRef.current = "";
      return;
    }
    taxDebounceRef.current = setTimeout(() => {
      void fetchTaxCalculation(amount, employmentType, kupType, owner);
    }, 300);
  }, [fetchTaxCalculation]);

  const incomeFieldConfig = useIncomeFieldConfig(taxResult, intl, formatCurrency, scheduleTaxCalc, settings);

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
      let netAmount = values.amount;
      let grossAmount: number | null = null;

      if (values.is_gross && values.employment_type) {
        // Call server for authoritative net calculation using correct owner profile
        const profile = getTaxProfile(values.owner);
        const taxRes = await fetch("/api/tax/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gross_monthly: values.amount,
            employment_type: values.employment_type,
            use_authors_costs: profile.use_authors_costs,
            ppk_employee_rate: profile.ppk_employee_rate,
            kup_type: values.kup_type || undefined,
          }),
        });
        if (taxRes.ok) {
          const taxData: TaxResult = await taxRes.json();
          grossAmount = values.amount;
          netAmount = taxData.net;
        }
      }

      const payload = {
        ...values,
        amount: netAmount,
        gross_amount: grossAmount,
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
            end_date: values.hasEndDate ? (values.endDate || null) : null,
            is_recurring: true,
            // Preserve employment details from original income
            employment_type: changeRateItem.employment_type || null,
            gross_amount: changeRateItem.is_gross ? values.newAmount : (changeRateItem.gross_amount || null),
            is_gross: changeRateItem.is_gross || false,
            kup_type: changeRateItem.kup_type || null,
            owner: changeRateItem.owner || null,
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
        {activeTab === "transactions" && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="income.actions.add" />
          </Button>
        )}
      </div>

      {apiError && (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="py-4">
            <p>{apiError}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transactions">
            <FormattedMessage id="income.tabs.transactions" />
          </TabsTrigger>
          <TabsTrigger value="budget">
            <FormattedMessage id="income.tabs.budget" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">

      {/* Month navigation bar */}
      <div className="flex justify-center mb-4">
        <MonthBar
          selectedMonth={selectedMonth}
          onMonthSelect={setSelectedMonth}
          disabledMonths={futureDisabledMonths}
        />
      </div>

      {/* Budget vs Actual chart */}
      <IncomeBudgetChart
        incomes={incomes}
        selectedMonth={`${new Date().getFullYear()}-${String(selectedMonth).padStart(2, "0")}`}
      />

      {/* Monthly Breakdown (Bank vs Manual) */}
      {monthlyTotalsBreakdown && (
        <Card className="mb-6 rounded-3xl border border-muted/60 bg-card shadow-sm">
          <CardHeader className="rounded-t-3xl border-b border-muted/40 bg-muted/20 py-4">
            <CardTitle className="text-base font-semibold text-primary">
              {intl.formatMessage({ id: "income.monthlyBreakdown.title" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {intl.formatMessage({ id: "income.monthlyBreakdown.fromBank" })} ({monthlyTotalsBreakdown.breakdown.bank_count})
                </span>
                <span className="font-semibold">
                  {formatCurrency(monthlyTotalsBreakdown.from_bank)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {intl.formatMessage({ id: "income.monthlyBreakdown.manualEntries" })} ({monthlyTotalsBreakdown.breakdown.manual_count})
                </span>
                <span className="font-semibold">
                  {formatCurrency(monthlyTotalsBreakdown.from_manual)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-bold">
                  {intl.formatMessage({ id: "income.monthlyBreakdown.totalActual" })}
                </span>
                <span className="font-bold">
                  {formatCurrency(monthlyTotalsBreakdown.total)}
                </span>
              </div>
              {monthlyTotalsBreakdown.breakdown.duplicate_count > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {intl.formatMessage(
                    { id: "income.monthlyBreakdown.duplicatesExcluded" },
                    { count: monthlyTotalsBreakdown.breakdown.duplicate_count }
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Needs Review Alert */}
      {monthlyTotalsBreakdown && monthlyTotalsBreakdown.breakdown.unreviewed_count > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  {intl.formatMessage(
                    { id: "income.needsReview.title" },
                    { count: monthlyTotalsBreakdown.breakdown.unreviewed_count }
                  )}
                </p>
                <p className="text-xs text-amber-700">
                  {intl.formatMessage({ id: "income.needsReview.description" })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white hover:bg-amber-100 text-amber-900"
              >
                {intl.formatMessage({ id: "income.needsReview.reviewButton" })}
              </Button>
            </div>
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
                  <TableHead className="text-center text-xs uppercase tracking-wide text-muted-foreground">
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

                  const expandableHistory = group.historical.filter(h => h.id !== mainIncome.id);
                  const hasHistory = expandableHistory.length > 0;
                  const isExpanded = expandedGroups.has(group.key);

                  const getIcon = (category: string) => {
                    if (category === "salary") return <Briefcase className="h-4 w-4" aria-hidden="true" />;
                    if (category === "freelance") return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
                    if (category === "investments") return <LineChart className="h-4 w-4" aria-hidden="true" />;
                    if (category === "rental") return <Home className="h-4 w-4" aria-hidden="true" />;
                    if (category === "benefits") return <Heart className="h-4 w-4" aria-hidden="true" />;
                    return <ArrowDownRight className="h-4 w-4" aria-hidden="true" />;
                  };

                  const renderIncomeRow = (income: Income, isMain: boolean) => {
                    const isHistorical = !!income.end_date && new Date(income.end_date) < new Date();
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
                                      📜 {expandableHistory.length} {intl.formatMessage({
                                        id: expandableHistory.length === 1 ? "common.historyCount.one" : "common.historyCount.many",
                                        defaultMessage: expandableHistory.length === 1 ? "change" : "changes"
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
                          <div className="flex items-center gap-2">
                            {settings?.include_partner_finances && !["investments", "rental", "benefits"].includes(income.category) && income.owner === "partner" ? (
                              <span className="group relative shrink-0">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                                  {(settings?.partner_name || "P")[0].toUpperCase()}
                                </span>
                                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                  {settings?.partner_name || intl.formatMessage({ id: "income.form.ownerOptions.partnerDefault" })}
                                </span>
                              </span>
                            ) : settings?.include_partner_finances && !["investments", "rental", "benefits"].includes(income.category) && (!income.owner || income.owner === "self") ? (
                              <span className="group relative shrink-0">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                                  {(session?.user?.name || "?")[0].toUpperCase()}
                                </span>
                                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                  {session?.user?.name || intl.formatMessage({ id: "income.form.ownerOptions.self" })}
                                </span>
                              </span>
                            ) : settings?.include_partner_finances && ["investments", "rental", "benefits"].includes(income.category) ? (
                              <span className="group relative shrink-0">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                  <Link2 className="h-3.5 w-3.5" />
                                </span>
                                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                                  {intl.formatMessage({ id: "income.form.ownerOptions.shared" })}
                                </span>
                              </span>
                            ) : null}
                            <span>{income.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className={cn(
                          "text-right text-sm font-semibold",
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
                        <TableCell className="text-center">
                          {isHistorical ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 p-1 text-slate-500">
                              <Archive className="h-3.5 w-3.5" />
                            </span>
                          ) : income.is_recurring ? (
                            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 p-1 text-slate-500">
                              <Minus className="h-3.5 w-3.5" />
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
                      {isExpanded && expandableHistory.map((histIncome) => (
                        renderIncomeRow(histIncome, false)
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
                <p className="text-sm font-semibold text-emerald-700">
                  {formatCurrency(totalsByFrequency.recurring)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="income.summaryTotals.oneOff" />
                </p>
                <p className="text-sm font-semibold text-slate-600">
                  {formatCurrency(totalsByFrequency.oneOff)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  <FormattedMessage id="income.summaryTotals.total" />
                </p>
                <p className="text-sm font-semibold text-emerald-800">
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
        </TabsContent>

        <TabsContent value="budget">
          <div className="space-y-6">
            <IncomeChart
              incomes={incomes}
              selectedMonth={`${new Date().getFullYear()}-${String(budgetMonth).padStart(2, "0")}`}
              onMonthSelect={handleBudgetChartMonthSelect}
              compact
            />
            <BudgetView month={budgetMonth} onMonthChange={setBudgetMonth} showTypes={["income"]} />
          </div>
        </TabsContent>
      </Tabs>

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
