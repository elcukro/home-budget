"use client";

import { useMemo } from "react";
import { useIntl } from "react-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MonthBarProps {
  selectedMonth: number; // 1-12
  onMonthSelect: (month: number) => void;
  disabledMonths?: Set<number>;
}

export default function MonthBar({
  selectedMonth,
  onMonthSelect,
  disabledMonths,
}: MonthBarProps) {
  const intl = useIntl();

  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2026, i, 1);
      return intl.formatDate(d, { month: "short" });
    });
  }, [intl]);

  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={selectedMonth <= 1}
        onClick={() => onMonthSelect(Math.max(1, selectedMonth - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex gap-0.5 overflow-x-auto">
        {monthNames.map((name, i) => {
          const month = i + 1;
          const isActive = month === selectedMonth;
          const isCurrent = month === currentMonth;
          const isDisabled = disabledMonths?.has(month);

          return (
            <button
              key={month}
              type="button"
              disabled={isDisabled}
              onClick={() => onMonthSelect(month)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                isDisabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isCurrent
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-muted-foreground hover:bg-muted",
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={selectedMonth >= 12}
        onClick={() => onMonthSelect(Math.min(12, selectedMonth + 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
