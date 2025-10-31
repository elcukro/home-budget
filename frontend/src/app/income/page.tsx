"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
  parseNumber,
  validateAmountPositive,
  validateDateString,
} from "@/lib/validation";
import { logActivity } from "@/utils/activityLogger";
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

  const sortedIncomes = useMemo(
    () =>
      [...incomes].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [incomes],
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            <FormattedMessage id="income.title" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="income.subtitle" />
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="income.actions.add" />
        </Button>
      </div>

      {apiError && (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="py-4">
            <p>{apiError}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">
            <FormattedMessage id="income.incomeHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedIncomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="income.noEntries" />
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <FormattedMessage id="income.table.category" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="income.table.description" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="income.table.amount" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="income.table.date" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="income.table.recurring" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="income.table.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedIncomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>
                      <FormattedMessage
                        id={`income.categories.${income.category}`}
                      />
                    </TableCell>
                    <TableCell>{income.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(income.amount)}
                    </TableCell>
                    <TableCell>
                      <FormattedDate value={new Date(income.date)} />
                    </TableCell>
                    <TableCell>
                      {income.is_recurring ? (
                        <span className="text-emerald-600">
                          <FormattedMessage id="common.yes" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          <FormattedMessage id="common.no" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(income)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">
                            {intl.formatMessage({ id: "common.edit" })}
                          </span>
                        </Button>
                      </Tooltip>
                      <Tooltip
                        content={intl.formatMessage({ id: "common.delete" })}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPendingDelete(income);
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
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
