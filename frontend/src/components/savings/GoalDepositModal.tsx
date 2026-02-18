"use client";

import React, { useState, useEffect } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { ArrowUpRight, Loader2 } from "lucide-react";
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

interface GoalDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalName: string;
  goalCategory: SavingCategory;
  /** Remaining amount needed to reach target (0 if target already met) */
  remainingAmount: number;
  /** Current balance of the general (free savings) category */
  generalBalance: number;
  onSuccess: () => void;
}

export const GoalDepositModal: React.FC<GoalDepositModalProps> = ({
  open,
  onOpenChange,
  goalName,
  goalCategory,
  remainingAmount,
  generalBalance,
  onSuccess,
}) => {
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const { toast } = useToast();

  // Suggest the smaller of remaining_amount and available general balance
  const suggestedAmount = Math.min(remainingAmount, generalBalance);

  const [amount, setAmount] = useState<number>(suggestedAmount > 0 ? suggestedAmount : 0);
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset amount when modal opens
  useEffect(() => {
    if (open) {
      setAmount(suggestedAmount > 0 ? suggestedAmount : 0);
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, suggestedAmount]);

  const maxGeneral = Math.round(generalBalance * 100) / 100;
  const isAmountValid = amount > 0 && amount <= maxGeneral;

  const handleSubmit = async () => {
    if (!isAmountValid) return;
    setIsSubmitting(true);
    try {
      // Withdrawal from general (free savings) → deposit to goal category
      await createSaving({
        category: SavingCategory.GENERAL,
        saving_type: "withdrawal",
        amount,
        date,
        description: `Transfer do: ${goalName}`,
      });
      await createSaving({
        category: goalCategory,
        saving_type: "deposit",
        amount,
        date,
        description: `Wpłata do: ${goalName}`,
      });

      toast({
        title: intl.formatMessage(
          { id: "savings.deposit.success" },
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
            <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            <FormattedMessage
              id="savings.deposit.title"
              values={{ name: goalName }}
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Available free savings info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">
              <FormattedMessage id="savings.deposit.availableFree" />
            </span>{" "}
            <span className="font-semibold">{formatCurrency(generalBalance)}</span>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="deposit-amount">
              <FormattedMessage id="common.amount" />
            </Label>
            <CurrencyInput
              id="deposit-amount"
              value={amount}
              onValueChange={setAmount}
              max={generalBalance}
            />
            {amount > maxGeneral && (
              <p className="text-xs text-destructive">
                <FormattedMessage
                  id="savings.deposit.exceedsBalance"
                  values={{ max: formatCurrency(maxGeneral) }}
                />
              </p>
            )}
            {suggestedAmount > 0 && amount !== suggestedAmount && (
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setAmount(suggestedAmount)}
              >
                <FormattedMessage
                  id="savings.deposit.useSuggested"
                  values={{ amount: formatCurrency(suggestedAmount) }}
                />
              </button>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="deposit-date">
              <FormattedMessage id="common.date" />
            </Label>
            <Input
              id="deposit-date"
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight className="mr-2 h-4 w-4" />
            )}
            <FormattedMessage id="savings.deposit.confirm" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
