"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useIntl, FormattedMessage } from "react-intl";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useSettings } from "@/contexts/SettingsContext";
import { logger } from "@/lib/logger";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
  Legend,
);

interface BudgetEntry {
  id: number;
  budget_year_id: number;
  user_id: string;
  month: number;
  entry_type: string;
  category: string;
  description: string;
  planned_amount: number;
  actual_amount: number | null;
  is_recurring: boolean;
}

interface Expense {
  id: number | string;
  category: string;
  amount: number;
  date: string;
  end_date: string | null;
  is_recurring: boolean;
}

interface BudgetChartProps {
  expenses: Expense[];
  selectedMonth: string; // "YYYY-MM" or "all"
}

// Color thresholds:
// green  = actual < planned (under budget)
// orange = actual within ±10% of planned
// red    = actual > 110% of planned
function getActualColor(actual: number, planned: number): { bg: string; border: string } {
  if (planned === 0) {
    // No budget set — treat any spending as over
    return actual > 0
      ? { bg: "#D65A56CC", border: "#D65A56" }  // red
      : { bg: "#4BA56ACC", border: "#4BA56A" };  // green
  }
  const ratio = actual / planned;
  if (ratio > 1.1) {
    // Over budget by more than 10%
    return { bg: "#D65A56CC", border: "#D65A56" }; // red
  }
  if (ratio >= 0.9) {
    // Within ±10% — close to budget
    return { bg: "#F59E0BCC", border: "#D97706" }; // orange/amber
  }
  // Under budget
  return { bg: "#4BA56ACC", border: "#4BA56A" }; // green
}

export default function BudgetChart({
  expenses,
  selectedMonth,
}: BudgetChartProps) {
  const { data: session } = useSession();
  const intl = useIntl();
  const { formatCurrency } = useSettings();
  const userEmail = session?.user?.email ?? null;

  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive year and month number from selectedMonth string
  const { year, monthNum } = useMemo(() => {
    if (selectedMonth === "all") {
      const now = new Date();
      return { year: now.getFullYear(), monthNum: now.getMonth() + 1 };
    }
    const [y, m] = selectedMonth.split("-").map(Number);
    return { year: y, monthNum: m };
  }, [selectedMonth]);

  // Fetch budget entries for the selected month
  useEffect(() => {
    const fetchBudget = async () => {
      if (!userEmail) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // First get the active budget year
        const yearsRes = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/budget/years`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        );
        if (!yearsRes.ok) {
          setLoading(false);
          return;
        }
        const years = await yearsRes.json();
        const activeYear = years.find((y: { year: number; status: string }) => y.year === year && y.status === "active")
          ?? years.find((y: { status: string }) => y.status === "active")
          ?? years[0];
        if (!activeYear) {
          setBudgetEntries([]);
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/backend/users/${encodeURIComponent(userEmail)}/budget/years/${activeYear.year}/months/${monthNum}`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        );
        if (!res.ok) {
          setBudgetEntries([]);
          setLoading(false);
          return;
        }
        const data: BudgetEntry[] = await res.json();
        setBudgetEntries(data);
      } catch (error) {
        logger.error("[BudgetChart] Failed to load budget entries", error);
        setBudgetEntries([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchBudget();
  }, [userEmail, year, monthNum]);

  // Check if an expense is active in the selected month
  const isActiveInMonth = (expense: Expense): boolean => {
    if (selectedMonth === "all") return true;
    const d = new Date(expense.date);
    if (Number.isNaN(d.getTime())) return false;

    const filterDate = new Date(year, monthNum - 1, 1);

    if (expense.is_recurring) {
      const startDate = new Date(d.getFullYear(), d.getMonth(), 1);
      if (filterDate < startDate) return false;
      if (expense.end_date) {
        const endDate = new Date(expense.end_date);
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        if (filterDate > endMonth) return false;
      }
      return true;
    }

    return d.getFullYear() === year && d.getMonth() + 1 === monthNum;
  };

  // Build comparison data
  const comparisonData = useMemo(() => {
    // Planned: group expense budget entries by category
    const planned = new Map<string, number>();
    for (const entry of budgetEntries) {
      if (entry.entry_type !== "expense") continue;
      planned.set(
        entry.category,
        (planned.get(entry.category) ?? 0) + entry.planned_amount,
      );
    }

    // Actual: group actual expenses by category for this month
    const actual = new Map<string, number>();
    for (const expense of expenses) {
      if (!isActiveInMonth(expense)) continue;
      actual.set(
        expense.category,
        (actual.get(expense.category) ?? 0) + expense.amount,
      );
    }

    // Merge categories — only show if there's at least a planned or actual value
    const allCategories = new Set([...planned.keys(), ...actual.keys()]);
    const rows = Array.from(allCategories).map((category) => ({
      category,
      planned: planned.get(category) ?? 0,
      actual: actual.get(category) ?? 0,
    }));

    // Sort by planned descending, then actual
    rows.sort((a, b) => b.planned - a.planned || b.actual - a.actual);
    return rows;
  }, [budgetEntries, expenses, selectedMonth, year, monthNum]);

  const hasActuals = comparisonData.some((r) => r.actual > 0);
  const hasPlanned = comparisonData.some((r) => r.planned > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Don't show if no budget data at all
  if (!hasPlanned && !hasActuals) {
    return null;
  }

  const categoryLabels = comparisonData.map((row) =>
    intl.formatMessage({
      id: `expenses.categories.${row.category}`,
      defaultMessage: row.category,
    }),
  );

  const chartData: ChartData<"bar"> = {
    labels: categoryLabels,
    datasets: [
      {
        label: intl.formatMessage({ id: "budget.chart.planned" }),
        data: comparisonData.map((r) => r.planned),
        backgroundColor: "#6366F1AA",
        borderColor: "#6366F1",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: intl.formatMessage({ id: "budget.chart.actual" }),
        data: comparisonData.map((r) => r.actual),
        backgroundColor: comparisonData.map((r) => getActualColor(r.actual, r.planned).bg),
        borderColor: comparisonData.map((r) => getActualColor(r.actual, r.planned).border),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const axisColor = "rgba(31, 28, 26, 0.9)";
  const gridColor = "rgba(31, 28, 26, 0.16)";

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    animation: {
      duration: 600,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: axisColor,
          font: { size: 12 },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          },
          afterBody: (contexts) => {
            if (!contexts?.length) return "";
            const index = contexts[0].dataIndex;
            const row = comparisonData[index];
            if (!row || row.planned === 0) return "";
            const diff = row.actual - row.planned;
            const percent = Math.abs((diff / row.planned) * 100).toFixed(1);
            if (diff > 0) {
              return `${intl.formatMessage({ id: "budget.chart.overBudget" })}: +${formatCurrency(diff)} (+${percent}%)`;
            }
            if (diff < 0) {
              return `${intl.formatMessage({ id: "budget.chart.underBudget" })}: ${formatCurrency(Math.abs(diff))} (-${percent}%)`;
            }
            return "";
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: axisColor,
          font: { size: 11 },
        },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: axisColor,
          callback: (value) => formatCurrency(value as number),
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/30 via-white to-white p-6 shadow-sm space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground">
          <FormattedMessage id="budget.chart.title" />
        </h3>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#4BA56A" }} />
            <FormattedMessage id="budget.chart.legendUnder" />
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#F59E0B" }} />
            <FormattedMessage id="budget.chart.legendClose" />
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#D65A56" }} />
            <FormattedMessage id="budget.chart.legendOver" />
          </span>
        </div>
      </div>
      <div style={{ height: 300 }}>
        <Bar data={chartData} options={options} />
      </div>
      {!hasActuals && hasPlanned && (
        <p className="text-xs text-muted-foreground text-center">
          <FormattedMessage id="budget.chart.noActuals" />
        </p>
      )}
    </div>
  );
}
