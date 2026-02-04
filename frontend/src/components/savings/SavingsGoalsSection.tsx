"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import {
  Baby,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Flag,
  MoreVertical,
  Pause,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

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
} from "@/api/savings";
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
}

export const SavingsGoalsSection: React.FC<SavingsGoalsSectionProps> = ({
  onGoalSelect,
  refreshTrigger,
}) => {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
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

  // Generate Baby Steps goals based on monthly expenses
  const babyStepGoals = useMemo<BabyStepGoal[]>(() => {
    if (monthlyExpenses <= 0) return [];

    const emergencyTarget = monthlyExpenses; // 1 month of expenses
    const sixMonthTarget = monthlyExpenses * 6; // 6 months of expenses

    const emergencyProgress = emergencyTarget > 0
      ? Math.min((emergencyFundSavings / emergencyTarget) * 100, 100)
      : 0;
    const sixMonthProgress = sixMonthTarget > 0
      ? Math.min((sixMonthFundSavings / sixMonthTarget) * 100, 100)
      : 0;

    return [
      {
        id: "baby-step-1",
        isBabyStep: true,
        babyStepNumber: 1,
        name: intl.formatMessage({ id: "goals.babySteps.emergencyFund" }),
        category: SavingCategory.EMERGENCY_FUND,
        target_amount: emergencyTarget,
        current_amount: emergencyFundSavings,
        status: emergencyProgress >= 100 ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
        priority: 100, // Highest priority
        progress_percent: emergencyProgress,
        remaining_amount: Math.max(emergencyTarget - emergencyFundSavings, 0),
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
        target_amount: sixMonthTarget,
        current_amount: sixMonthFundSavings,
        status: sixMonthProgress >= 100 ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
        priority: 90,
        progress_percent: sixMonthProgress,
        remaining_amount: Math.max(sixMonthTarget - sixMonthFundSavings, 0),
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

          {/* User's custom goals */}
          {goals.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {goals.map(renderGoalCard)}
            </div>
          )}

          {/* Full empty state - only show when no Baby Steps and no user goals */}
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
