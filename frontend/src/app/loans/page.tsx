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
  validateAmountNonNegative,
  validateDateString,
  validateInterestRate,
  validateMonthlyPayment,
  validateRemainingBalance,
} from "@/lib/validation";
import { logActivity } from "@/utils/activityLogger";
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
        console.error("[Loans] Failed to load loans", error);
        setApiError(intl.formatMessage({ id: "loans.loadError" }));
      } finally {
        setLoading(false);
      }
    };

    void loadLoans();
  }, [userEmail, intl]);

  const sortedLoans = useMemo(
    () =>
      [...loans].sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      ),
    [loans],
  );

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
      console.error("[Loans] Failed to submit form", error);
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
      console.error("[Loans] Failed to delete loan", error);
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
      <div className="flex items-center justify-between">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">
            <FormattedMessage id="loans.loanHistory" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedLoans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="loans.noEntries" />
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <FormattedMessage id="loans.table.type" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="loans.table.description" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="loans.table.principalAmount" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="loans.table.remainingBalance" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="loans.table.interestRate" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="loans.table.monthlyPayment" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="loans.table.termMonths" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="loans.table.startDate" />
                  </TableHead>
                  <TableHead className="text-right">
                    <FormattedMessage id="loans.table.actions" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <FormattedMessage id={`loans.types.${loan.loan_type}`} />
                    </TableCell>
                    <TableCell>{loan.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(loan.principal_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(loan.remaining_balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {loan.interest_rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(loan.monthly_payment)}
                    </TableCell>
                    <TableCell className="text-right">
                      {loan.term_months}
                    </TableCell>
                    <TableCell>
                      <FormattedDate value={new Date(loan.start_date)} />
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Tooltip content={intl.formatMessage({ id: "common.edit" })}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(loan)}
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
                            setPendingDelete(loan);
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
    </div>
  );
}
