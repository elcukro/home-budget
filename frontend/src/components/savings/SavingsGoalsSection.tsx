"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Baby,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Flag,
  Loader2,
  MoreVertical,
  Pause,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";

import confetti from "canvas-confetti";

import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import {
  SavingsGoal,
  SavingsGoalCreate,
  SavingCategory,
  GoalStatus,
} from "@/types/financial-freedom";
import {
  getSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  completeGoal,
  getSavingsSummary,
  getMonthlyRecurringExpenses,
  createSaving,
  invalidateSavingsCache,
  getRetirementLimits,
  RetirementLimitsResponse,
} from "@/api/savings";
import { AccountType } from "@/types/financial-freedom";
import { GoalWithdrawModal } from "@/components/savings/GoalWithdrawModal";
import { GoalDepositModal } from "@/components/savings/GoalDepositModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { parseNumber, validateAmountPositive } from "@/lib/validation";

// Goal form schema
const goalSchema = z.object({
  name: z.string().min(1, "validation.required").max(100),
  category: z.enum(Object.values(SavingCategory) as [SavingCategory, ...SavingCategory[]], {
    error: "validation.categoryRequired",
  }),
  target_amount: z
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
  deadline: z
    .string()
    .optional()
    .transform((v) => v || null),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v || null),
  priority: z
    .preprocess((v) => {
      if (typeof v === "number") return v;
      if (typeof v === "string") return parseInt(v, 10) || 0;
      return 0;
    }, z.number().min(0).max(100))
    .default(0),
});

type GoalFormValues = z.infer<typeof goalSchema>;

const defaultGoalValues: GoalFormValues = {
  name: "",
  category: SavingCategory.GENERAL,
  target_amount: 0,
  deadline: null,
  notes: null,
  priority: 0,
};

const categoryOptions = Object.values(SavingCategory).map((category) => ({
  value: category,
  labelId: `savings.categories.${category}`,
}));

// Goal status colors and icons
const statusConfig: Record<
  GoalStatus,
  { color: string; bgColor: string; icon: React.ReactNode; labelId: string }
> = {
  [GoalStatus.ACTIVE]: {
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    icon: <Target className="h-4 w-4" />,
    labelId: "goals.status.active",
  },
  [GoalStatus.COMPLETED]: {
    color: "text-sky-700",
    bgColor: "bg-sky-100",
    icon: <CheckCircle2 className="h-4 w-4" />,
    labelId: "goals.status.completed",
  },
  [GoalStatus.PAUSED]: {
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: <Pause className="h-4 w-4" />,
    labelId: "goals.status.paused",
  },
  [GoalStatus.ABANDONED]: {
    color: "text-slate-500",
    bgColor: "bg-slate-100",
    icon: <X className="h-4 w-4" />,
    labelId: "goals.status.abandoned",
  },
};

// Extended goal type for Baby Steps (system goals)
interface BabyStepGoal extends Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'icon'> {
  id: string; // "baby-step-1" or "baby-step-3"
  isBabyStep: true;
  babyStepNumber: number;
  babyStepIcon: React.ReactNode; // Custom icon for Baby Steps
}

type DisplayGoal = SavingsGoal | BabyStepGoal;

function isBabyStepGoal(goal: DisplayGoal): goal is BabyStepGoal {
  return 'isBabyStep' in goal && goal.isBabyStep === true;
}

interface SavingsGoalsSectionProps {
  onGoalSelect?: (goalId: number) => void;
  refreshTrigger?: number;
  onTransferComplete?: () => void;
}

export const SavingsGoalsSection: React.FC<SavingsGoalsSectionProps> = ({
  onGoalSelect,
  refreshTrigger,
  onTransferComplete,
}) => {
  const intl = useIntl();
  const { formatCurrency, settings } = useSettings();
  const { toast } = useToast();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Baby Steps data
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(0);
  const [emergencyFundSavings, setEmergencyFundSavings] = useState<number>(0);
  const [sixMonthFundSavings, setSixMonthFundSavings] = useState<number>(0);
  const [categoryTotals, setCategoryTotals] = useState<Record<SavingCategory, number>>({} as Record<SavingCategory, number>);
  const [isAllocating, setIsAllocating] = useState(false);
  const [retirementLimits, setRetirementLimits] = useState<RetirementLimitsResponse | null>(null);

  // Transfer modal state
  const [withdrawModalGoal, setWithdrawModalGoal] = useState<BabyStepGoal | null>(null);
  const [depositModalGoal, setDepositModalGoal] = useState<BabyStepGoal | null>(null);
  const [withdrawToIncomeOpen, setWithdrawToIncomeOpen] = useState(false);
  const [withdrawToIncomeAmount, setWithdrawToIncomeAmount] = useState<number>(0);
  const [withdrawToIncomeDesc, setWithdrawToIncomeDesc] = useState<string>("");
  const [withdrawToIncomeDate, setWithdrawToIncomeDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [isWithdrawingToIncome, setIsWithdrawingToIncome] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch user goals, summary, and monthly expenses in parallel
      const [goalsData, summary, expenses] = await Promise.all([
        getSavingsGoals(),
        getSavingsSummary(),
        getMonthlyRecurringExpenses(),
      ]);

      setGoals(goalsData);
      setMonthlyExpenses(expenses);
      setCategoryTotals(summary.category_totals);
      setEmergencyFundSavings(summary.category_totals[SavingCategory.EMERGENCY_FUND] || 0);
      setSixMonthFundSavings(summary.category_totals[SavingCategory.SIX_MONTH_FUND] || 0);
    } catch (error) {
      logger.error("[Goals] Failed to fetch goals", error);
      toast({
        title: intl.formatMessage({ id: "goals.toast.loadError" }),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [intl, toast]);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals, refreshTrigger]);

  // Fetch retirement limits to show advice in free savings section
  useEffect(() => {
    const isSelfEmployed = settings?.employment_type === 'b2b' || settings?.employment_type === 'jdg';
    getRetirementLimits(undefined, isSelfEmployed)
      .then(data => setRetirementLimits(data))
      .catch(() => { /* non-critical, silently ignore */ });
  }, [settings?.employment_type]);

  // Generate Baby Steps goals based on monthly expenses
  const babyStepGoals = useMemo<BabyStepGoal[]>(() => {
    if (monthlyExpenses <= 0) return [];

    const emergencyTarget = monthlyExpenses; // 1 month of expenses
    const sixMonthTarget = monthlyExpenses * 6; // 6 months of expenses

    // Round to cents to avoid floating-point artifacts (e.g. 14599.179999... vs 14599.18)
    const roundCents = (v: number) => Math.round(v * 100) / 100;
    const emergencySavingsR = roundCents(emergencyFundSavings);
    const emergencyTargetR  = roundCents(emergencyTarget);
    const sixMonthSavingsR  = roundCents(sixMonthFundSavings);
    const sixMonthTargetR   = roundCents(sixMonthTarget);

    const emergencyComplete = emergencyTargetR > 0 && emergencySavingsR >= emergencyTargetR;
    const sixMonthComplete  = sixMonthTargetR  > 0 && sixMonthSavingsR  >= sixMonthTargetR;

    const emergencyProgress = emergencyTargetR > 0
      ? Math.min((emergencySavingsR / emergencyTargetR) * 100, 100)
      : 0;
    const sixMonthProgress = sixMonthTargetR > 0
      ? Math.min((sixMonthSavingsR / sixMonthTargetR) * 100, 100)
      : 0;

    return [
      {
        id: "baby-step-1",
        isBabyStep: true,
        babyStepNumber: 1,
        name: intl.formatMessage({ id: "goals.babySteps.emergencyFund" }),
        category: SavingCategory.EMERGENCY_FUND,
        target_amount: emergencyTargetR,
        current_amount: emergencySavingsR,
        status: emergencyComplete ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
        priority: 100,
        progress_percent: emergencyProgress,
        remaining_amount: emergencyComplete ? 0 : Math.max(emergencyTargetR - emergencySavingsR, 0),
        is_on_track: null,
        monthly_needed: null,
        deadline: null,
        babyStepIcon: <ShieldCheck className="h-5 w-5" />,
        notes: null,
        color: null,
        updated_at: null,
        completed_at: null,
      },
      {
        id: "baby-step-3",
        isBabyStep: true,
        babyStepNumber: 3,
        name: intl.formatMessage({ id: "goals.babySteps.sixMonthFund" }),
        category: SavingCategory.SIX_MONTH_FUND,
        target_amount: sixMonthTargetR,
        current_amount: sixMonthSavingsR,
        status: sixMonthComplete ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
        priority: 90,
        progress_percent: sixMonthProgress,
        remaining_amount: sixMonthComplete ? 0 : Math.max(sixMonthTargetR - sixMonthSavingsR, 0),
        is_on_track: null,
        monthly_needed: null,
        deadline: null,
        babyStepIcon: <Wallet className="h-5 w-5" />,
        notes: null,
        color: null,
        updated_at: null,
        completed_at: null,
      },
    ];
  }, [monthlyExpenses, emergencyFundSavings, sixMonthFundSavings, intl]);

  // Categories that are never touched by Baby Steps allocations
  // Non-liquid assets (real estate, investments, college, other) must also be excluded —
  // they cannot be transferred to emergency fund or other liquid goals.
  const PROTECTED_CATEGORIES = useMemo(() => new Set([
    SavingCategory.RETIREMENT,
    SavingCategory.EMERGENCY_FUND,
    SavingCategory.SIX_MONTH_FUND,
    SavingCategory.REAL_ESTATE,
    SavingCategory.INVESTMENT,
    SavingCategory.COLLEGE,
    SavingCategory.OTHER,
  ]), []);

  // Available savings = non-retirement, non-target categories with positive balance
  const availableSources = useMemo(() => {
    const sources: { category: SavingCategory; amount: number }[] = [];
    for (const [cat, amount] of Object.entries(categoryTotals)) {
      if (amount > 0 && !PROTECTED_CATEGORIES.has(cat as SavingCategory)) {
        sources.push({ category: cat as SavingCategory, amount });
      }
    }
    // Sort largest first for greedy drain
    sources.sort((a, b) => b.amount - a.amount);
    return sources;
  }, [categoryTotals, PROTECTED_CATEGORIES]);

  const availableSavingsTotal = useMemo(
    () => availableSources.reduce((sum, s) => sum + s.amount, 0),
    [availableSources]
  );

  // For Step 3: overflow from emergency_fund beyond Step 1 target is also available
  const emergencyOverflowForStep3 = useMemo(() => {
    if (monthlyExpenses <= 0) return 0;
    return Math.max(emergencyFundSavings - monthlyExpenses, 0);
  }, [emergencyFundSavings, monthlyExpenses]);

  const triggerCelebration = useCallback(() => {
    const end = Date.now() + 600;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const handleAllocateToGoal = useCallback(
    async (targetCategory: SavingCategory, targetAmount: number, babyStepNumber: number) => {
      setIsAllocating(true);
      const today = new Date().toISOString().slice(0, 10);

      try {
        // Determine sources based on which step we're funding
        const sources: { category: SavingCategory; amount: number }[] = [];
        let remaining = targetAmount;

        if (babyStepNumber === 3 && emergencyOverflowForStep3 > 0) {
          // Step 3: first use emergency_fund overflow
          const overflowToUse = Math.min(emergencyOverflowForStep3, remaining);
          if (overflowToUse > 0) {
            sources.push({ category: SavingCategory.EMERGENCY_FUND, amount: overflowToUse });
            remaining -= overflowToUse;
          }
        }

        // Then drain from available categories (largest first)
        for (const src of availableSources) {
          if (remaining <= 0) break;
          const take = Math.min(src.amount, remaining);
          sources.push({ category: src.category, amount: take });
          remaining -= take;
        }

        if (sources.length === 0) return;

        const targetLabel =
          targetCategory === SavingCategory.EMERGENCY_FUND
            ? "fundusz awaryjny"
            : "fundusz bezpieczeństwa";

        // Create withdrawal + deposit pairs for each source
        for (const src of sources) {
          const srcLabel = intl.formatMessage({ id: `savings.categories.${src.category}` });
          await createSaving({
            category: src.category,
            saving_type: "withdrawal",
            amount: src.amount,
            date: today,
            description: `Transfer → ${targetLabel}`,
          });
          await createSaving({
            category: targetCategory,
            saving_type: "deposit",
            amount: src.amount,
            date: today,
            description: `Transfer ← ${srcLabel}`,
          });
        }

        // Bust cache and refetch
        invalidateSavingsCache();
        await fetchGoals();
        onTransferComplete?.();

        // Check if goal is now complete
        const freshSummary = await getSavingsSummary();
        const newAmount = freshSummary.category_totals[targetCategory] || 0;
        const target =
          targetCategory === SavingCategory.EMERGENCY_FUND
            ? monthlyExpenses
            : monthlyExpenses * 6;

        if (newAmount >= target) {
          triggerCelebration();
          toast({
            title: intl.formatMessage({
              id: babyStepNumber === 1
                ? "goals.babySteps.celebration.step1"
                : "goals.babySteps.celebration.step3",
            }),
          });
        } else {
          toast({
            title: intl.formatMessage({ id: "goals.babySteps.cta.transferSuccess" }),
          });
        }
      } catch (error) {
        logger.error("[Goals] Failed to allocate savings", error);
        toast({
          title: intl.formatMessage({ id: "goals.toast.error" }),
          variant: "destructive",
        });
        // Refetch to show actual state
        invalidateSavingsCache();
        void fetchGoals();
      } finally {
        setIsAllocating(false);
      }
    },
    [availableSources, emergencyOverflowForStep3, monthlyExpenses, intl, toast, fetchGoals, triggerCelebration, onTransferComplete]
  );

  const goalFieldConfig = useMemo<FormFieldConfig<GoalFormValues>[]>(
    () => [
      {
        name: "name",
        labelId: "goals.form.name",
        component: "text",
        autoFocus: true,
      },
      {
        name: "target_amount",
        labelId: "goals.form.targetAmount",
        component: "currency",
      },
      {
        name: "category",
        labelId: "goals.form.category",
        component: "select",
        options: categoryOptions,
      },
      {
        name: "deadline",
        labelId: "goals.form.deadline",
        component: "date",
      },
      {
        name: "notes",
        labelId: "goals.form.notes",
        component: "textarea",
      },
    ],
    []
  );

  const handleWithdrawToIncome = async () => {
    const generalBalance = Math.round((categoryTotals[SavingCategory.GENERAL] ?? 0) * 100) / 100;
    if (withdrawToIncomeAmount <= 0 || withdrawToIncomeAmount > generalBalance) return;
    setIsWithdrawingToIncome(true);
    try {
      const res = await fetch("/api/backend/savings/withdraw-to-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: withdrawToIncomeAmount,
          description: withdrawToIncomeDesc || "Wypłata oszczędności",
          date: withdrawToIncomeDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Unknown error");
      }
      toast({
        title: intl.formatMessage(
          { id: "savings.freeSavings.withdrawModal.success" },
          { amount: formatCurrency(withdrawToIncomeAmount) }
        ),
      });
      setWithdrawToIncomeOpen(false);
      setWithdrawToIncomeAmount(0);
      setWithdrawToIncomeDesc("");
      invalidateSavingsCache();
      await fetchGoals();
      onTransferComplete?.();
    } catch (err) {
      toast({
        title: String(err),
        variant: "destructive",
      });
    } finally {
      setIsWithdrawingToIncome(false);
    }
  };

  const handleOpenCreate = () => {
    setActiveGoal(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (goal: SavingsGoal) => {
    setActiveGoal(goal);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleSubmit = async (values: GoalFormValues) => {
    setIsSubmitting(true);
    try {
      if (dialogMode === "create") {
        const created = await createSavingsGoal(values as SavingsGoalCreate);
        if (created) {
          setGoals((prev) => [created, ...prev]);
          toast({
            title: intl.formatMessage({ id: "goals.toast.createSuccess" }),
          });
        }
      } else if (activeGoal) {
        const updated = await updateSavingsGoal(activeGoal.id, values);
        if (updated) {
          setGoals((prev) =>
            prev.map((g) => (g.id === updated.id ? updated : g))
          );
          toast({
            title: intl.formatMessage({ id: "goals.toast.updateSuccess" }),
          });
        }
      }
      setDialogOpen(false);
    } catch (error) {
      logger.error("[Goals] Failed to submit", error);
      toast({
        title: intl.formatMessage({ id: "goals.toast.error" }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      const success = await deleteSavingsGoal(pendingDelete.id);
      if (success) {
        setGoals((prev) => prev.filter((g) => g.id !== pendingDelete.id));
        toast({
          title: intl.formatMessage({ id: "goals.toast.deleteSuccess" }),
        });
      }
    } catch (error) {
      logger.error("[Goals] Failed to delete", error);
      toast({
        title: intl.formatMessage({ id: "goals.toast.error" }),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const handleComplete = async (goal: SavingsGoal) => {
    try {
      const updated = await completeGoal(goal.id);
      if (updated) {
        setGoals((prev) =>
          prev.map((g) => (g.id === updated.id ? updated : g))
        );
        toast({
          title: intl.formatMessage({ id: "goals.toast.completedSuccess" }),
        });
      }
    } catch (error) {
      logger.error("[Goals] Failed to complete", error);
    }
  };

  const handlePause = async (goal: SavingsGoal) => {
    try {
      const newStatus =
        goal.status === GoalStatus.PAUSED
          ? GoalStatus.ACTIVE
          : GoalStatus.PAUSED;
      const updated = await updateSavingsGoal(goal.id, { status: newStatus });
      if (updated) {
        setGoals((prev) =>
          prev.map((g) => (g.id === updated.id ? updated : g))
        );
      }
    } catch (error) {
      logger.error("[Goals] Failed to pause", error);
    }
  };

  // Combine Baby Steps with user goals for total count
  const allGoals: DisplayGoal[] = [...babyStepGoals, ...goals];

  const mapGoalToFormValues = (goal: SavingsGoal): GoalFormValues => ({
    name: goal.name,
    category: goal.category,
    target_amount: goal.target_amount,
    deadline: goal.deadline?.slice(0, 10) ?? null,
    notes: goal.notes ?? null,
    priority: goal.priority,
  });

  const renderGoalCard = (goal: DisplayGoal) => {
    const status = statusConfig[goal.status];
    const isComplete = goal.status === GoalStatus.COMPLETED;
    const isBabyStep = isBabyStepGoal(goal);
    const _progressColor =
      goal.progress_percent >= 100
        ? "bg-emerald-500"
        : goal.progress_percent >= 75
          ? "bg-sky-500"
          : goal.progress_percent >= 50
            ? "bg-amber-500"
            : "bg-slate-400";

    return (
      <Card
        key={goal.id}
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-lg",
          isComplete && "opacity-75",
          isBabyStep && "border-amber-200 bg-gradient-to-br from-amber-50/50 to-white"
        )}
      >
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-1",
            goal.progress_percent >= 100 ? "bg-emerald-500" : isBabyStep ? "bg-amber-400" : "bg-primary/60"
          )}
        />
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {/* Baby Steps badge */}
                {isBabyStep && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                    <Baby className="h-3 w-3" />
                    <FormattedMessage id="goals.babySteps.badge" values={{ step: goal.babyStepNumber }} />
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    status.bgColor,
                    status.color
                  )}
                >
                  {status.icon}
                  <FormattedMessage id={status.labelId} />
                </span>
                {goal.is_on_track === true && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <TrendingUp className="h-3 w-3" />
                    <FormattedMessage id="goals.onTrack" />
                  </span>
                )}
                {goal.is_on_track === false && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                    <Flag className="h-3 w-3" />
                    <FormattedMessage id="goals.behindSchedule" />
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-slate-800 truncate flex items-center gap-2">
                {isBabyStep && (goal as BabyStepGoal).babyStepIcon}
                {goal.name}
              </h3>

              <p className="text-xs text-muted-foreground mt-0.5">
                <FormattedMessage id={`savings.categories.${goal.category}`} />
                {isBabyStep && (
                  <span className="ml-1 text-amber-600">
                    • <FormattedMessage id="goals.babySteps.autoCalculated" />
                  </span>
                )}
              </p>

              <div className="mt-3">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(goal.current_amount)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {formatCurrency(goal.target_amount)}
                  </span>
                </div>

                <Progress
                  value={Math.min(goal.progress_percent, 100)}
                  className="h-2"
                />

                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>{goal.progress_percent.toFixed(0)}%</span>
                  {goal.remaining_amount > 0 && (
                    <span>
                      <FormattedMessage
                        id="goals.remaining"
                        values={{ amount: formatCurrency(goal.remaining_amount) }}
                      />
                    </span>
                  )}
                </div>
              </div>

              {/* Baby Steps allocation CTA */}
              {isBabyStep && goal.progress_percent < 100 && (() => {
                const step = (goal as BabyStepGoal).babyStepNumber;

                // Step 3 CTA only shows when Step 1 is complete
                if (step === 3) {
                  const step1Complete = monthlyExpenses > 0 &&
                    emergencyFundSavings >= monthlyExpenses;
                  if (!step1Complete) return null;
                }

                const needed = goal.remaining_amount;
                // For Step 3, include emergency overflow as available
                const totalAvailable = step === 3
                  ? availableSavingsTotal + emergencyOverflowForStep3
                  : availableSavingsTotal;
                const transferAmount = Math.min(needed, totalAvailable);

                if (totalAvailable <= 0 || transferAmount <= 0) return null;

                return (
                  <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm text-amber-800 mb-2">
                      <FormattedMessage
                        id="goals.babySteps.cta.hasAvailableSavings"
                        values={{
                          amount: <span key="amt" className="font-semibold">{formatCurrency(totalAvailable)}</span>,
                          transfer: <span key="xfer" className="font-semibold">{formatCurrency(transferAmount)}</span>,
                        }}
                      />
                    </p>
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isAllocating}
                      onClick={() =>
                        handleAllocateToGoal(goal.category, transferAmount, step)
                      }
                    >
                      {isAllocating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      <FormattedMessage
                        id={
                          step === 1
                            ? "goals.babySteps.cta.createEmergencyFund"
                            : "goals.babySteps.cta.createSixMonthFund"
                        }
                      />
                    </Button>
                  </div>
                );
              })()}

              {/* Wpłać / Wypłać buttons — only on baby step goals */}
              {isBabyStep && (
                <div className="mt-3 flex gap-2">
                  {/* Wypłać — pull funds back to general */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                    disabled={goal.current_amount <= 0}
                    onClick={() => setWithdrawModalGoal(goal as BabyStepGoal)}
                  >
                    <ArrowDownLeft className="mr-1.5 h-3.5 w-3.5" />
                    <FormattedMessage id="savings.types.withdrawal" />
                  </Button>
                  {/* Wpłać — move funds from general to goal */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    disabled={goal.progress_percent >= 100 || (categoryTotals[SavingCategory.GENERAL] ?? 0) <= 0}
                    onClick={() => setDepositModalGoal(goal as BabyStepGoal)}
                  >
                    <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                    <FormattedMessage id="savings.types.deposit" />
                  </Button>
                </div>
              )}

              {goal.deadline && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {intl.formatDate(new Date(goal.deadline), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {goal.monthly_needed && goal.monthly_needed > 0 && (
                    <span className="ml-2 text-primary font-medium">
                      ({formatCurrency(goal.monthly_needed)}/
                      <FormattedMessage id="common.month" />)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions menu - hidden for Baby Steps goals */}
            {!isBabyStep && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onGoalSelect && !isBabyStepGoal(goal) && (
                    <DropdownMenuItem onClick={() => onGoalSelect(goal.id as number)}>
                      <ChevronRight className="mr-2 h-4 w-4" />
                      <FormattedMessage id="goals.viewDetails" />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleOpenEdit(goal as SavingsGoal)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    <FormattedMessage id="common.edit" />
                  </DropdownMenuItem>
                  {goal.status === GoalStatus.ACTIVE && (
                    <>
                      <DropdownMenuItem onClick={() => handleComplete(goal as SavingsGoal)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        <FormattedMessage id="goals.markComplete" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePause(goal as SavingsGoal)}>
                        <Pause className="mr-2 h-4 w-4" />
                        <FormattedMessage id="goals.pause" />
                      </DropdownMenuItem>
                    </>
                  )}
                  {goal.status === GoalStatus.PAUSED && (
                    <DropdownMenuItem onClick={() => handlePause(goal as SavingsGoal)}>
                      <Target className="mr-2 h-4 w-4" />
                      <FormattedMessage id="goals.resume" />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingDelete(goal as SavingsGoal);
                      setConfirmOpen(true);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <FormattedMessage id="common.delete" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading && goals.length === 0) {
    return (
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <FormattedMessage id="goals.title" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-3xl border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <FormattedMessage id="goals.title" />
            {allGoals.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({allGoals.length})
              </span>
            )}
          </CardTitle>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            <FormattedMessage id="goals.addGoal" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Baby Steps Goals - always on top */}
          {babyStepGoals.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {babyStepGoals.map(renderGoalCard)}
            </div>
          )}

          {/* Custom Goals */}
          {goals.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {goals.map(renderGoalCard)}
            </div>
          )}

          {/* Full empty state - only show when no goals at all */}
          {allGoals.length === 0 && (
            <div className="text-center py-8">
              <Target className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                <FormattedMessage id="goals.empty" />
              </p>
              <Button onClick={handleOpenCreate} className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                <FormattedMessage id="goals.createFirst" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Free Savings Card */}
      {(categoryTotals[SavingCategory.GENERAL] ?? 0) >= 0 && monthlyExpenses > 0 && (
        <Card className="rounded-3xl border-slate-200">
          <CardContent className="flex flex-col gap-4 p-6">
            {/* Header row: icon+title | balance+button */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <WalletCards className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">
                    <FormattedMessage id="savings.freeSavings.title" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <FormattedMessage id="savings.freeSavings.description" />
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(categoryTotals[SavingCategory.GENERAL] ?? 0)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={(categoryTotals[SavingCategory.GENERAL] ?? 0) <= 0}
                  onClick={() => {
                    setWithdrawToIncomeAmount(0);
                    setWithdrawToIncomeDesc("");
                    setWithdrawToIncomeDate(new Date().toISOString().slice(0, 10));
                    setWithdrawToIncomeOpen(true);
                  }}
                >
                  <ArrowDownLeft className="mr-1.5 h-3.5 w-3.5" />
                  <FormattedMessage id="savings.freeSavings.withdrawToIncome" />
                </Button>
              </div>
            </div>

            {/* Advice chips — shown when general balance > 0 */}
            {(categoryTotals[SavingCategory.GENERAL] ?? 0) > 0 && (() => {
              const ikeAccount = retirementLimits?.accounts.find(a => a.account_type === AccountType.IKE);
              const ikzeAccount = retirementLimits?.accounts.find(a => a.account_type === AccountType.IKZE);
              const oipeAccount = retirementLimits?.accounts.find(a => a.account_type === AccountType.OIPE);

              const ikeRemaining = retirementLimits
                ? (ikeAccount?.remaining_limit ?? retirementLimits.ike_limit)
                : 28260;
              const isSelfEmployed = settings?.employment_type === 'b2b' || settings?.employment_type === 'jdg';
              const ikzeRemaining = retirementLimits
                ? (ikzeAccount?.remaining_limit ?? (isSelfEmployed ? retirementLimits.ikze_limit_jdg : retirementLimits.ikze_limit_standard))
                : 11304;
              const oipeRemaining = retirementLimits
                ? (oipeAccount?.remaining_limit ?? 0)
                : 0;

              const hasAnyLimit = ikeRemaining > 0 || ikzeRemaining > 0 || oipeRemaining > 0;

              return (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-3">
                  <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide mb-2.5">
                    💡 <FormattedMessage id="savings.freeSavings.advice.heading" />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ikeRemaining > 0 && (
                      <div className="flex flex-col rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left min-w-[140px]">
                        <span className="text-[11px] font-bold text-emerald-700">
                          <FormattedMessage id="savings.freeSavings.advice.ikeLabel" />
                        </span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">
                          {formatCurrency(ikeRemaining)}
                        </span>
                        <span className="text-[10px] text-slate-500 leading-snug">
                          <FormattedMessage id="savings.freeSavings.advice.ikeDesc" />
                        </span>
                      </div>
                    )}
                    {ikzeRemaining > 0 && (
                      <div className="flex flex-col rounded-lg border border-blue-200 bg-white px-3 py-2 text-left min-w-[140px]">
                        <span className="text-[11px] font-bold text-blue-700">
                          <FormattedMessage id="savings.freeSavings.advice.ikzeLabel" />
                        </span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">
                          {formatCurrency(ikzeRemaining)}
                        </span>
                        <span className="text-[10px] text-slate-500 leading-snug">
                          <FormattedMessage id="savings.freeSavings.advice.ikzeDesc" />
                        </span>
                      </div>
                    )}
                    {oipeRemaining > 0 && (
                      <div className="flex flex-col rounded-lg border border-purple-200 bg-white px-3 py-2 text-left min-w-[140px]">
                        <span className="text-[11px] font-bold text-purple-700">
                          <FormattedMessage id="savings.freeSavings.advice.oipeLabel" />
                        </span>
                        <span className="text-sm font-bold text-slate-800 mt-0.5">
                          {formatCurrency(oipeRemaining)}
                        </span>
                        <span className="text-[10px] text-slate-500 leading-snug">
                          <FormattedMessage id="savings.freeSavings.advice.oipeDesc" />
                        </span>
                      </div>
                    )}
                    {!hasAnyLimit && retirementLimits && (
                      <p className="text-[10px] text-slate-500 italic self-center">
                        <FormattedMessage id="savings.freeSavings.advice.allLimitsReached" />
                      </p>
                    )}
                    {/* Lokata — always shown */}
                    <div className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left min-w-[140px]">
                      <span className="text-[11px] font-bold text-slate-700">
                        <FormattedMessage id="savings.freeSavings.advice.lokataLabel" />
                      </span>
                      <span className="text-[10px] text-slate-500 leading-snug mt-0.5">
                        <FormattedMessage id="savings.freeSavings.advice.lokataDesc" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Goal Withdraw Modal */}
      {withdrawModalGoal && (
        <GoalWithdrawModal
          open={!!withdrawModalGoal}
          onOpenChange={(open) => { if (!open) setWithdrawModalGoal(null); }}
          goalName={withdrawModalGoal.name}
          goalCategory={withdrawModalGoal.category}
          actualBalance={categoryTotals[withdrawModalGoal.category] ?? 0}
          onSuccess={() => {
            invalidateSavingsCache();
            void fetchGoals();
            onTransferComplete?.();
          }}
        />
      )}

      {/* Goal Deposit Modal */}
      {depositModalGoal && (
        <GoalDepositModal
          open={!!depositModalGoal}
          onOpenChange={(open) => { if (!open) setDepositModalGoal(null); }}
          goalName={depositModalGoal.name}
          goalCategory={depositModalGoal.category}
          remainingAmount={depositModalGoal.remaining_amount}
          generalBalance={categoryTotals[SavingCategory.GENERAL] ?? 0}
          onSuccess={() => {
            invalidateSavingsCache();
            void fetchGoals();
            onTransferComplete?.();
          }}
        />
      )}

      {/* Withdraw to Income Modal */}
      <Dialog open={withdrawToIncomeOpen} onOpenChange={setWithdrawToIncomeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-slate-600" />
              <FormattedMessage id="savings.freeSavings.withdrawModal.title" />
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">
                <FormattedMessage id="savings.freeSavings.withdrawModal.available" />
              </span>{" "}
              <span className="font-semibold">
                {formatCurrency(categoryTotals[SavingCategory.GENERAL] ?? 0)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="savings.freeSavings.withdrawModal.description" />
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="wti-amount">
                <FormattedMessage id="common.amount" />
              </Label>
              <CurrencyInput
                id="wti-amount"
                value={withdrawToIncomeAmount}
                onValueChange={setWithdrawToIncomeAmount}
                max={categoryTotals[SavingCategory.GENERAL] ?? 0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wti-desc">
                <FormattedMessage id="savings.freeSavings.withdrawModal.descriptionLabel" />
              </Label>
              <Input
                id="wti-desc"
                value={withdrawToIncomeDesc}
                onChange={(e) => setWithdrawToIncomeDesc(e.target.value)}
                placeholder={intl.formatMessage({ id: "savings.freeSavings.withdrawModal.descriptionPlaceholder" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wti-date">
                <FormattedMessage id="common.date" />
              </Label>
              <Input
                id="wti-date"
                type="date"
                value={withdrawToIncomeDate}
                onChange={(e) => setWithdrawToIncomeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWithdrawToIncomeOpen(false)}
              disabled={isWithdrawingToIncome}
            >
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button
              onClick={handleWithdrawToIncome}
              disabled={
                withdrawToIncomeAmount <= 0 ||
                withdrawToIncomeAmount > Math.round((categoryTotals[SavingCategory.GENERAL] ?? 0) * 100) / 100 ||
                isWithdrawingToIncome
              }
            >
              {isWithdrawingToIncome ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownLeft className="mr-2 h-4 w-4" />
              )}
              <FormattedMessage id="savings.freeSavings.withdrawModal.confirm" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CrudDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={setDialogOpen}
        titleId={
          dialogMode === "create" ? "goals.dialog.createTitle" : "goals.dialog.editTitle"
        }
        submitLabelId={
          dialogMode === "create" ? "goals.dialog.create" : "goals.dialog.save"
        }
        schema={goalSchema}
        defaultValues={defaultGoalValues}
        initialValues={
          dialogMode === "edit" && activeGoal
            ? mapGoalToFormValues(activeGoal)
            : undefined
        }
        fields={goalFieldConfig}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingDelete(null);
        }}
        titleId="goals.deleteDialog.title"
        descriptionId="goals.deleteDialog.description"
        confirmLabelId="goals.deleteDialog.confirm"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </>
  );
};

export default SavingsGoalsSection;
