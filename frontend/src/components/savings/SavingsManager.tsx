"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { Pencil, Plus, Trash2, Filter } from "lucide-react";

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

interface SavingsFilters {
  category?: SavingCategory;
  startDate?: string;
  endDate?: string;
}

const savingTypeOptions = [
  { value: SavingType.DEPOSIT, labelId: "savings.types.deposit" },
  { value: SavingType.WITHDRAWAL, labelId: "savings.types.withdrawal" },
];

const categoryOptions = Object.values(SavingCategory).map((category) => ({
  value: category,
  labelId: `savings.categories.${category}`,
}));

const savingSchema = z
  .object({
    category: z.string().min(1, "validation.categoryRequired"),
    description: z.string().trim().max(200, {
      message: "validation.description.tooLong",
    }).optional().transform((value) => value ?? ""),
    amount: z
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
      }),
    date: z
      .string()
      .trim()
      .min(1, "validation.required"),
    saving_type: z.string().min(1, "validation.categoryRequired"),
    is_recurring: z.boolean().default(false),
    target_amount: z
      .string()
      .trim()
      .optional()
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

const savingFieldConfig: FormFieldConfig<SavingFormValues>[] = [
  {
    name: "category",
    labelId: "savings.form.category",
    component: "select",
    placeholderId: "savings.form.category.select",
    options: categoryOptions,
  },
  {
    name: "description",
    labelId: "savings.form.description",
    component: "text",
  },
  {
    name: "amount",
    labelId: "savings.form.amount",
    component: "number",
    step: "0.01",
    min: 0,
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

const mapSavingToFormValues = (saving: Saving): SavingFormValues => ({
  category: saving.category,
  description: saving.description ?? "",
  amount: saving.amount,
  date: saving.date.slice(0, 10),
  saving_type: saving.saving_type,
  is_recurring: saving.is_recurring,
  target_amount: saving.target_amount,
});

const formatSavingAmount = (saving: Saving, formatCurrency: (value: number) => string) => {
  const amount = formatCurrency(saving.amount);
  return saving.saving_type === SavingType.WITHDRAWAL ? `- ${amount}` : amount;
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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Saving | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const userEmail = session.data?.user?.email ?? null;

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
      if (filters.startDate) params.set("start_date", filters.startDate);
      if (filters.endDate) params.set("end_date", filters.endDate);

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
  }, [filters, intl]);

  useEffect(() => {
    void fetchSavings();
  }, [fetchSavings]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleOpenCreate = () => {
    setActiveSaving(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (saving: Saving) => {
    setActiveSaving(saving);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveSaving(null);
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

  const filteredSavings = useMemo(() => savings, [savings]);

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
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="savings.actions.add" />
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="card-mint">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <FormattedMessage id="savings.summary.totalSavings" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatCurrency(summary.total_savings)}
              </p>
            </CardContent>
          </Card>
          <Card className="card-lilac">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <FormattedMessage id="savings.summary.monthlyContribution" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatCurrency(summary.monthly_contribution)}
              </p>
            </CardContent>
          </Card>
          <Card className="card-sand">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <FormattedMessage id="savings.summary.recentTransactions" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {summary.recent_transactions.slice(0, 3).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between">
                  <span>
                    <FormattedMessage id={`savings.categories.${transaction.category}`} />
                  </span>
                  <span>{formatSavingAmount(transaction, formatCurrency)}</span>
                </div>
              ))}
              {summary.recent_transactions.length === 0 && (
                <span className="text-muted-foreground">
                  <FormattedMessage id="savings.summary.noRecent" />
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">
            <FormattedMessage id="savings.transactions" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              <Input
                type="date"
                value={filters.startDate ?? ""}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    startDate: event.target.value || undefined,
                  }))
                }
                className="w-[150px]"
                placeholder={intl.formatMessage({ id: "savings.filters.startDate" })}
              />
              <Input
                type="date"
                value={filters.endDate ?? ""}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    endDate: event.target.value || undefined,
                  }))
                }
                className="w-[150px]"
                placeholder={intl.formatMessage({ id: "savings.filters.endDate" })}
              />
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
              <TableRow>
                <TableHead>
                  <FormattedMessage id="savings.table.category" />
                </TableHead>
                <TableHead>
                  <FormattedMessage id="savings.table.description" />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage id="savings.table.amount" />
                </TableHead>
                <TableHead>
                  <FormattedMessage id="savings.table.date" />
                </TableHead>
                <TableHead>
                  <FormattedMessage id="savings.table.type" />
                </TableHead>
                <TableHead>
                  <FormattedMessage id="savings.table.recurring" />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage id="savings.table.targetAmount" />
                </TableHead>
                <TableHead className="text-right">
                  <FormattedMessage id="savings.table.actions" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSavings.map((saving) => (
                <TableRow key={saving.id}>
                  <TableCell>
                    <FormattedMessage id={`savings.categories.${saving.category}`} />
                  </TableCell>
                  <TableCell>{saving.description}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatSavingAmount(saving, formatCurrency)}
                  </TableCell>
                  <TableCell>
                    {new Date(saving.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <FormattedMessage id={`savings.types.${saving.saving_type}`} />
                  </TableCell>
                  <TableCell>
                    {saving.is_recurring ? (
                      <span className="text-emerald-600">
                        <FormattedMessage id="common.yes" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        <FormattedMessage id="common.no" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {saving.target_amount ? formatCurrency(saving.target_amount) : "-"}
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
              ))}
              {filteredSavings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    <FormattedMessage id="savings.noEntries" />
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
