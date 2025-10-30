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

interface Expense {
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

const expenseToActivityValues = (
  expense: Expense | null | undefined,
): Record<string, unknown> | undefined => (expense ? { ...expense } : undefined);

const expenseSchema = z.object({
  category: z.string().min(1, "validation.categoryRequired"),
  description: z
    .string()
    .trim()
    .min(1, "validation.description.required")
    .max(100, { message: "validation.description.tooLong" }),
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

type ExpenseFormValues = z.infer<typeof expenseSchema>;

const todayISO = new Date().toISOString().split("T")[0];

const expenseDefaultValues: ExpenseFormValues = {
  category: "",
  description: "",
  amount: 0,
  date: todayISO,
  is_recurring: false,
};

const expenseCategoryOptions = [
  { value: "housing", labelId: "expenses.categories.housing" },
  { value: "transportation", labelId: "expenses.categories.transportation" },
  { value: "food", labelId: "expenses.categories.food" },
  { value: "utilities", labelId: "expenses.categories.utilities" },
  { value: "insurance", labelId: "expenses.categories.insurance" },
  { value: "healthcare", labelId: "expenses.categories.healthcare" },
  { value: "entertainment", labelId: "expenses.categories.entertainment" },
  { value: "other", labelId: "expenses.categories.other" },
];

const expenseFieldConfig: FormFieldConfig<ExpenseFormValues>[] = [
  {
    name: "category",
    labelId: "expenses.form.category",
    component: "select",
    placeholderId: "expenses.form.category.select",
    options: expenseCategoryOptions,
  },
  {
    name: "description",
    labelId: "expenses.form.description",
    component: "text",
  },
  {
    name: "amount",
    labelId: "expenses.form.amount",
    component: "number",
    step: "0.01",
    min: 0,
  },
  {
    name: "date",
    labelId: "expenses.form.date",
    component: "date",
  },
  {
    name: "is_recurring",
    labelId: "expenses.form.recurring",
    component: "switch",
  },
];

const mapExpenseToFormValues = (expense: Expense): ExpenseFormValues => ({
  category: expense.category,
  description: expense.description,
  amount: expense.amount,
  date: expense.date.slice(0, 10),
  is_recurring: expense.is_recurring,
});

export default function ExpensesPage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency } = useSettings();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeExpense, setActiveExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const userEmail = session?.user?.email ?? null;

  useEffect(() => {
    const loadExpenses = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setApiError(null);

        const response = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to fetch expenses");
        }

        const data: Expense[] = await response.json();
        setExpenses(data);
      } catch (error) {
        console.error("[Expenses] Failed to load expenses", error);
        setApiError(intl.formatMessage({ id: "expenses.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadExpenses();
  }, [userEmail, intl]);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [expenses],
  );

  const handleOpenCreate = () => {
    setActiveExpense(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setActiveExpense(expense);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveExpense(null);
    }
  };

  const showErrorToast = (messageId: string) => {
    toast({
      title: intl.formatMessage({ id: messageId }),
      variant: "destructive",
    });
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
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
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses`,
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
          throw new Error(errorText || "Failed to create expense");
        }

        const created: Expense = await response.json();
        setExpenses((prev) => [...prev, created]);

        await logActivity({
          entity_type: "Expense",
          operation_type: "create",
          entity_id: Number(created.id),
          new_values: expenseToActivityValues(created),
        });

        toast({
          title: intl.formatMessage({ id: "expenses.toast.createSuccess" }),
        });
      } else if (activeExpense) {
        const response = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses/${activeExpense.id}`,
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
          throw new Error(errorText || "Failed to update expense");
        }

        const updated: Expense = await response.json();

        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === updated.id ? updated : expense,
          ),
        );

        await logActivity({
          entity_type: "Expense",
          operation_type: "update",
          entity_id: Number(updated.id),
          previous_values: expenseToActivityValues(activeExpense),
          new_values: expenseToActivityValues(updated),
        });

        toast({
          title: intl.formatMessage({ id: "expenses.toast.updateSuccess" }),
        });
      }

      handleDialogClose(false);
    } catch (error) {
      console.error("[Expenses] Failed to submit form", error);
      showErrorToast("expenses.toast.genericError");
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
        `${API_BASE_URL}/users/${encodeURIComponent(userEmail)}/expenses/${pendingDelete.id}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete expense");
      }

      setExpenses((prev) =>
        prev.filter((expense) => expense.id !== pendingDelete.id),
      );

      await logActivity({
        entity_type: "Expense",
        operation_type: "delete",
        entity_id: Number(pendingDelete.id),
        previous_values: expenseToActivityValues(pendingDelete),
      });

      toast({
        title: intl.formatMessage({ id: "expenses.toast.deleteSuccess" }),
      });
    } catch (error) {
      console.error("[Expenses] Failed to delete expense", error);
      showErrorToast("expenses.toast.genericError");
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
            <FormattedMessage id="expenses.title" />
          </h1>
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="expenses.subtitle" />
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          <FormattedMessage id="expenses.actions.add" />
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
            <FormattedMessage id="expenses.expenseHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="expenses.noEntries" />
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <FormattedMessage id="expenses.table.category" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="expenses.table.description" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="expenses.table.amount" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="expenses.table.date" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="expenses.table.recurring" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="expenses.table.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <FormattedMessage
                        id={`expenses.categories.${expense.category}`}
                      />
                    </TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <FormattedDate value={new Date(expense.date)} />
                    </TableCell>
                    <TableCell>
                      {expense.is_recurring ? (
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
                          onClick={() => handleOpenEdit(expense)}
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
                            setPendingDelete(expense);
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
            ? "expenses.dialog.createTitle"
            : "expenses.dialog.editTitle"
        }
        submitLabelId={
          dialogMode === "create"
            ? "expenses.dialog.createSubmit"
            : "expenses.dialog.editSubmit"
        }
        schema={expenseSchema}
        defaultValues={expenseDefaultValues}
        initialValues={
          dialogMode === "edit" && activeExpense
            ? mapExpenseToFormValues(activeExpense)
            : undefined
        }
        fields={expenseFieldConfig}
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
        titleId="expenses.deleteDialog.title"
        descriptionId="expenses.deleteDialog.description"
        confirmLabelId="expenses.deleteDialog.confirm"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
