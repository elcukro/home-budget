"use client";

import React, { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ArrowDownLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { createSaving } from "@/api/savings";
import { SavingCategory } from "@/types/financial-freedom";

interface GoalWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalName: string;
  goalCategory: SavingCategory;
  /** Actual balance of the goal category (from categoryTotals) */
  actualBalance: number;
  onSuccess: () => void;
}

export const GoalWithdrawModal: React.FC<GoalWithdrawModalProps> = ({
  open,
  onOpenChange,
  goalName,
  goalCategory,
  actualBalance,
  onSuccess,
}) => {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const { toast } = useToast();

  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxAmount = Math.round(actualBalance * 100) / 100;
  const isAmountValid = amount > 0 && amount <= maxAmount;

  const handleSubmit = async () => {
    if (!isAmountValid) return;
    setIsSubmitting(true);
    try {
      // Withdrawal from goal category → deposit to general (free savings)
      await createSaving({
        category: goalCategory,
        saving_type: "withdrawal",
        amount,
        date,
        description: `Wypłata z: ${goalName}`,
      });
      await createSaving({
        category: SavingCategory.GENERAL,
        saving_type: "deposit",
        amount,
        date,
        description: `Transfer z: ${goalName}`,
      });

      toast({
        title: intl.formatMessage(
          { id: "savings.withdraw.success" },
          { amount: formatCurrency(amount) }
        ),
      });
      onSuccess();
      onOpenChange(false);
      setAmount(0);
    } catch {
      toast({
        title: intl.formatMessage({ id: "common.error" }),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="h-5 w-5 text-amber-600" />
            <FormattedMessage
              id="savings.withdraw.title"
              values={{ name: goalName }}
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Available balance info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">
              <FormattedMessage id="savings.withdraw.available" />
            </span>{" "}
            <span className="font-semibold">{formatCurrency(actualBalance)}</span>
          </div>

          {/* Destination info */}
          <p className="text-sm text-muted-foreground">
            <FormattedMessage id="savings.withdraw.destination" />
          </p>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">
              <FormattedMessage id="common.amount" />
            </Label>
            <CurrencyInput
              id="withdraw-amount"
              value={amount}
              onValueChange={setAmount}
              max={actualBalance}
            />
            {amount > maxAmount && (
              <p className="text-xs text-destructive">
                <FormattedMessage
                  id="savings.withdraw.exceedsBalance"
                  values={{ max: formatCurrency(maxAmount) }}
                />
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-date">
              <FormattedMessage id="common.date" />
            </Label>
            <Input
              id="withdraw-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            <FormattedMessage id="common.cancel" />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isAmountValid || isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownLeft className="mr-2 h-4 w-4" />
            )}
            <FormattedMessage id="savings.withdraw.confirm" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
