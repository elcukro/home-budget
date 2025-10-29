"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIntl } from "react-intl";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  confirmLabelId?: string;
  cancelLabelId?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  titleId,
  descriptionId,
  confirmLabelId = "common.delete",
  cancelLabelId = "common.cancel",
  destructive = true,
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const intl = useIntl();

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {intl.formatMessage({ id: titleId })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {intl.formatMessage({ id: descriptionId })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {intl.formatMessage({ id: cancelLabelId })}
          </AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={async (event) => {
              event.preventDefault();
              if (!isLoading) {
                await handleConfirm();
              }
            }}
            disabled={isLoading}
          >
            {intl.formatMessage({ id: confirmLabelId })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
