"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  ArrowPathIcon,
  LightBulbIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  TruckIcon,
  FilmIcon,
  HomeIcon,
  BoltIcon,
  HeartIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  BanknotesIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TablePageSkeleton } from "@/components/LoadingSkeleton";
import { useSettings } from "@/contexts/SettingsContext";
import Link from "next/link";
import { mapTinkCategoryToApp } from "@/lib/tink-category-mapping";

// API calls now go through Next.js proxy at /api/backend/* which adds auth headers

interface BankTransaction {
  id: number;
  tink_transaction_id: string;
  tink_account_id: string;
  amount: number;
  currency: string;
  date: string;
  description_display: string;
  description_original: string | null;
  merchant_name: string | null;
  tink_category_name: string | null;
  suggested_type: string | null;
  suggested_category: string | null;
  confidence_score: number | null;
  status: string;
  is_duplicate: boolean;
  created_at: string;
}

interface TinkConnection {
  id: number;
  is_active: boolean;
  last_sync_at: string | null;
}

interface SpendingPattern {
  name: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  insight: string;
  savingPotential?: number;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percentage: number;
  icon: React.ReactNode;
}

// Category icons mapping (for insights section - larger)
const categoryIcons: Record<string, React.ReactNode> = {
  food: <ShoppingBagIcon className="h-5 w-5" />,
  groceries: <ShoppingBagIcon className="h-5 w-5" />,
  restaurants: <BuildingStorefrontIcon className="h-5 w-5" />,
  coffee: <BuildingStorefrontIcon className="h-5 w-5" />,
  transport: <TruckIcon className="h-5 w-5" />,
  transportation: <TruckIcon className="h-5 w-5" />,
  entertainment: <FilmIcon className="h-5 w-5" />,
  housing: <HomeIcon className="h-5 w-5" />,
  utilities: <BoltIcon className="h-5 w-5" />,
  healthcare: <HeartIcon className="h-5 w-5" />,
  shopping: <ShoppingBagIcon className="h-5 w-5" />,
  salary: <BanknotesIcon className="h-5 w-5" />,
  freelance: <BanknotesIcon className="h-5 w-5" />,
  investments: <ChartBarIcon className="h-5 w-5" />,
  rental: <HomeIcon className="h-5 w-5" />,
  insurance: <HeartIcon className="h-5 w-5" />,
  other: <EllipsisHorizontalIcon className="h-5 w-5" />,
};

// Category icons for badge (smaller)
const categoryBadgeIcons: Record<string, React.ReactNode> = {
  food: <ShoppingBagIcon className="h-3 w-3" />,
  groceries: <ShoppingBagIcon className="h-3 w-3" />,
  transportation: <TruckIcon className="h-3 w-3" />,
  entertainment: <FilmIcon className="h-3 w-3" />,
  housing: <HomeIcon className="h-3 w-3" />,
  utilities: <BoltIcon className="h-3 w-3" />,
  healthcare: <HeartIcon className="h-3 w-3" />,
  insurance: <HeartIcon className="h-3 w-3" />,
  salary: <BanknotesIcon className="h-3 w-3" />,
  freelance: <BanknotesIcon className="h-3 w-3" />,
  investments: <ChartBarIcon className="h-3 w-3" />,
  rental: <HomeIcon className="h-3 w-3" />,
  other: <EllipsisHorizontalIcon className="h-3 w-3" />,
};

// Translation keys for categories
const categoryTranslationKeys: Record<string, string> = {
  // Expenses
  housing: "expenses.categories.housing",
  transportation: "expenses.categories.transportation",
  food: "expenses.categories.food",
  utilities: "expenses.categories.utilities",
  insurance: "expenses.categories.insurance",
  healthcare: "expenses.categories.healthcare",
  entertainment: "expenses.categories.entertainment",
  // Income
  salary: "income.categories.salary",
  freelance: "income.categories.freelance",
  investments: "income.categories.investments",
  rental: "income.categories.rental",
  // Fallback
  other: "expenses.categories.other",
};

// Expense categories for conversion
const expenseCategories = [
  { value: "housing", labelId: "expenses.categories.housing" },
  { value: "transportation", labelId: "expenses.categories.transportation" },
  { value: "food", labelId: "expenses.categories.food" },
  { value: "utilities", labelId: "expenses.categories.utilities" },
  { value: "insurance", labelId: "expenses.categories.insurance" },
  { value: "healthcare", labelId: "expenses.categories.healthcare" },
  { value: "entertainment", labelId: "expenses.categories.entertainment" },
  { value: "other", labelId: "expenses.categories.other" },
];

const incomeCategories = [
  { value: "salary", labelId: "income.categories.salary" },
  { value: "freelance", labelId: "income.categories.freelance" },
  { value: "investments", labelId: "income.categories.investments" },
  { value: "rental", labelId: "income.categories.rental" },
  { value: "other", labelId: "income.categories.other" },
];

export default function BankTransactionsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const intl = useIntl();
  const { toast } = useToast();
  const { formatCurrency } = useSettings();

  // State
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [connection, setConnection] = useState<TinkConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeProgress, setCategorizeProgress] = useState(0);
  const [categorizeStep, setCategorizeStep] = useState("");
  const [categorizeResult, setCategorizeResult] = useState<{ count: number; alreadyDone?: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [sortField, setSortField] = useState<"date" | "category" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [periodFilter, setPeriodFilter] = useState<"week" | "month" | "quarter" | "year" | "all">("all");

  // Add to budget modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [addType, setAddType] = useState<"expense" | "income">("expense");
  const [addCategory, setAddCategory] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [adding, setAdding] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!session?.user?.email) return;

    try {
      // Use proxy which adds auth headers automatically
      const [connRes, txRes] = await Promise.all([
        fetch(`/api/backend/banking/tink/connections`),
        fetch(`/api/backend/banking/transactions?limit=500`),
      ]);

      if (connRes.ok) {
        const connections = await connRes.json();
        setConnection(connections.length > 0 ? connections[0] : null);
      }

      if (txRes.ok) {
        setTransactions(await txRes.json());
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchData();
    }
  }, [sessionStatus, fetchData]);

  // Sync transactions
  const handleSync = async () => {
    if (!session?.user?.email) return;

    setSyncing(true);
    try {
      const response = await fetch(`/api/backend/banking/transactions/sync`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: intl.formatMessage(
            { id: "bankTransactions.toast.syncSuccess" },
            { count: result.synced_count }
          ),
        });
        fetchData();
      } else {
        // Parse structured error response
        const errorData = await response.json();

        // Check if it's a structured error
        if (errorData.error_code) {
          // Use error-specific translation keys
          const errorKey = `bankTransactions.errors.${errorData.error_code.toLowerCase()}`;

          toast({
            title: intl.formatMessage({ id: `${errorKey}.title` }),
            description: intl.formatMessage({ id: `${errorKey}.description` }),
            variant: "destructive",
          });
        } else {
          // Fallback to generic error
          throw new Error("Sync failed");
        }
      }
    } catch (_error) {
      toast({
        title: intl.formatMessage({ id: "bankTransactions.toast.syncError" }),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // AI Categorize transactions
  const handleCategorize = async () => {
    if (!session?.user?.email) return;

    setCategorizing(true);
    setCategorizeProgress(0);
    setCategorizeResult(null);
    setCategorizeStep(intl.formatMessage({ id: "bankTransactions.categorizeModal.step1" }));

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setCategorizeProgress((prev) => {
        if (prev >= 85) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      // Step 2: Analyzing
      setTimeout(() => {
        setCategorizeStep(intl.formatMessage({ id: "bankTransactions.categorizeModal.step2" }));
      }, 1000);

      const response = await fetch(`/api/backend/banking/transactions/categorize`, {
        method: "POST",
      });

      clearInterval(progressInterval);

      if (response.ok) {
        setCategorizeProgress(100);
        const result = await response.json();
        if (result.categorized_count === 0) {
          setCategorizeStep(intl.formatMessage({ id: "bankTransactions.categorizeModal.alreadyDone" }));
          setCategorizeResult({ count: 0, alreadyDone: true });
        } else {
          setCategorizeStep(intl.formatMessage({ id: "bankTransactions.categorizeModal.step3" }));
          setCategorizeResult({ count: result.categorized_count });
          fetchData();
        }
      } else if (response.status === 400) {
        setCategorizing(false);
        toast({
          title: intl.formatMessage({ id: "bankTransactions.toast.categorizeNoApiKey" }),
          variant: "destructive",
        });
      } else {
        throw new Error("Categorization failed");
      }
    } catch (_error) {
      clearInterval(progressInterval);
      setCategorizing(false);
      toast({
        title: intl.formatMessage({ id: "bankTransactions.toast.categorizeError" }),
        variant: "destructive",
      });
    }
  };

  const closeCategorizeModal = () => {
    setCategorizing(false);
    setCategorizeProgress(0);
    setCategorizeResult(null);
  };

  // Calculate insights from transactions
  const insights = useMemo(() => {
    const expenses = transactions.filter((t) => t.amount < 0);
    const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Group by merchant/description patterns
    const merchantGroups: Record<string, { count: number; total: number; transactions: BankTransaction[] }> = {};

    expenses.forEach((tx) => {
      // Normalize merchant name
      const key = (tx.merchant_name || tx.description_display)
        .toLowerCase()
        .replace(/[0-9]/g, "")
        .trim();

      if (!merchantGroups[key]) {
        merchantGroups[key] = { count: 0, total: 0, transactions: [] };
      }
      merchantGroups[key].count++;
      merchantGroups[key].total += Math.abs(tx.amount);
      merchantGroups[key].transactions.push(tx);
    });

    // Identify patterns (recurring small purchases)
    const patterns: SpendingPattern[] = [];

    // Coffee shops pattern (Polish + English keywords)
    const coffeeKeywords = ["caff", "coffee", "starbucks", "costa", "nero", "kawa", "kawiar", "cafe"];
    const coffeeSpending = Object.entries(merchantGroups)
      .filter(([key]) => coffeeKeywords.some((kw) => key.includes(kw)))
      .reduce((sum, [, data]) => ({ count: sum.count + data.count, total: sum.total + data.total }), { count: 0, total: 0 });

    if (coffeeSpending.count >= 3) {
      patterns.push({
        name: intl.formatMessage({ id: "bankTransactions.insights.coffee" }),
        count: coffeeSpending.count,
        total: coffeeSpending.total,
        icon: <BuildingStorefrontIcon className="h-5 w-5 text-amber-600" />,
        insight: intl.formatMessage({ id: "bankTransactions.insights.coffeeAdvice" }),
        savingPotential: Math.round(coffeeSpending.total * 0.7),
      });
    }

    // Food delivery pattern (Polish + English keywords)
    const deliveryKeywords = ["pyszne", "uber eats", "glovo", "wolt", "bolt food", "takeaway", "dostawa", "delivery"];
    const deliverySpending = Object.entries(merchantGroups)
      .filter(([key]) => deliveryKeywords.some((kw) => key.includes(kw)))
      .reduce((sum, [, data]) => ({ count: sum.count + data.count, total: sum.total + data.total }), { count: 0, total: 0 });

    if (deliverySpending.count >= 2) {
      patterns.push({
        name: intl.formatMessage({ id: "bankTransactions.insights.delivery" }),
        count: deliverySpending.count,
        total: deliverySpending.total,
        icon: <TruckIcon className="h-5 w-5 text-orange-600" />,
        insight: intl.formatMessage({ id: "bankTransactions.insights.deliveryAdvice" }),
        savingPotential: Math.round(deliverySpending.total * 0.6),
      });
    }

    // Restaurants pattern (Polish + English keywords)
    const restaurantKeywords = ["restaur", "bar", "pub", "pizza", "kebab", "sushi", "pizzeria", "lokal", "gastro"];
    const restaurantSpending = Object.entries(merchantGroups)
      .filter(([key]) => restaurantKeywords.some((kw) => key.includes(kw)))
      .reduce((sum, [, data]) => ({ count: sum.count + data.count, total: sum.total + data.total }), { count: 0, total: 0 });

    if (restaurantSpending.count >= 2) {
      patterns.push({
        name: intl.formatMessage({ id: "bankTransactions.insights.restaurants" }),
        count: restaurantSpending.count,
        total: restaurantSpending.total,
        icon: <BuildingStorefrontIcon className="h-5 w-5 text-red-600" />,
        insight: intl.formatMessage({ id: "bankTransactions.insights.restaurantsAdvice" }),
        savingPotential: Math.round(restaurantSpending.total * 0.5),
      });
    }

    // Large purchases (potential impulse buys)
    const largePurchases = expenses.filter((t) => Math.abs(t.amount) > 300);

    // Category breakdown - use Tink categories with mapping, fallback to AI suggestions
    const categoryTotals: Record<string, { total: number; count: number }> = {};
    expenses.forEach((tx) => {
      // Priority: AI suggested category > Mapped Tink category > other
      let cat: string;
      if (tx.suggested_category && tx.confidence_score && tx.confidence_score > 0.5) {
        cat = tx.suggested_category;
      } else if (tx.tink_category_name) {
        cat = mapTinkCategoryToApp(tx.tink_category_name);
      } else {
        cat = "other";
      }

      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { total: 0, count: 0 };
      }
      categoryTotals[cat].total += Math.abs(tx.amount);
      categoryTotals[cat].count++;
    });

    const categoryBreakdown: CategoryBreakdown[] = Object.entries(categoryTotals)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: totalSpent > 0 ? (data.total / totalSpent) * 100 : 0,
        icon: categoryIcons[category.toLowerCase()] || categoryIcons.other,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return {
      totalSpent,
      transactionCount: expenses.length,
      patterns,
      largePurchases,
      categoryBreakdown,
      totalSavingPotential: patterns.reduce((sum, p) => sum + (p.savingPotential || 0), 0),
    };
  }, [transactions, intl]);

  // Check if all transactions are already categorized
  const allCategorized = useMemo(() => {
    if (transactions.length === 0) return false;
    return transactions.every((tx) => tx.confidence_score && tx.confidence_score > 0);
  }, [transactions]);

  const _uncategorizedCount = useMemo(() => {
    return transactions.filter((tx) => !tx.confidence_score || tx.confidence_score === 0).length;
  }, [transactions]);

  // Handle sort header click
  const handleSort = (field: "date" | "category" | "amount") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc");
    }
  };

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.description_display.toLowerCase().includes(query) ||
          tx.merchant_name?.toLowerCase().includes(query)
      );
    }

    // Filter by type (income/expense)
    if (typeFilter !== "all") {
      result = result.filter((tx) => {
        if (typeFilter === "income") return tx.amount > 0;
        if (typeFilter === "expense") return tx.amount < 0;
        return true;
      });
    }

    // Filter by category
    if (categoryFilter !== "all") {
      result = result.filter((tx) => {
        const category = tx.suggested_category || mapTinkCategoryToApp(tx.tink_category_name);
        return category === categoryFilter;
      });
    }

    // Filter by period
    if (periodFilter !== "all") {
      const now = new Date();
      const txDate = (tx: BankTransaction) => new Date(tx.date);

      result = result.filter((tx) => {
        const date = txDate(tx);
        const diffMs = now.getTime() - date.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        switch (periodFilter) {
          case "week":
            return diffDays <= 7;
          case "month":
            return diffDays <= 30;
          case "quarter":
            return diffDays <= 90;
          case "year":
            return diffDays <= 365;
          default:
            return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "category":
          const catA = a.suggested_category || "zzz"; // Put uncategorized at the end
          const catB = b.suggested_category || "zzz";
          comparison = catA.localeCompare(catB);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result.slice(0, showAllTransactions ? undefined : 20);
  }, [transactions, searchQuery, categoryFilter, typeFilter, periodFilter, showAllTransactions, sortField, sortDirection]);

  // Add to budget handler
  const openAddModal = (tx: BankTransaction) => {
    setSelectedTransaction(tx);
    // Use AI suggested type if available, otherwise infer from amount
    const type = tx.suggested_type === "income" || tx.suggested_type === "expense"
      ? tx.suggested_type
      : (tx.amount > 0 ? "income" : "expense");
    setAddType(type);
    setAddCategory(tx.suggested_category || "");
    setAddDescription(tx.description_display);
    setAddModalOpen(true);
  };

  const handleAddToBudget = async () => {
    if (!session?.user?.email || !selectedTransaction) return;

    setAdding(true);
    try {
      const response = await fetch(
        `/api/backend/banking/transactions/${selectedTransaction.id}/convert`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: addType,
            category: addCategory,
            description: addDescription,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: intl.formatMessage({ id: "bankTransactions.addToBudget.success" }),
        });
        setAddModalOpen(false);
        fetchData();
      }
    } catch (_error) {
      toast({
        title: intl.formatMessage({ id: "bankTransactions.addToBudget.error" }),
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  if (loading || sessionStatus === "loading") {
    return <TablePageSkeleton />;
  }

  // No connection state
  if (!connection) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <CardTitle>
              <FormattedMessage id="bankTransactions.noConnection" />
            </CardTitle>
            <CardDescription>
              <FormattedMessage id="bankTransactions.noConnectionDesc" />
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/settings?tab=banking">
              <Button>
                <FormattedMessage id="bankTransactions.goToSettings" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            <FormattedMessage id="bankTransactions.title" />
          </h1>
          <p className="text-secondary text-sm">
            <FormattedMessage id="bankTransactions.subtitle" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCategorize}
              disabled={categorizing || allCategorized}
              variant="outline"
              className={allCategorized ? "opacity-50" : ""}
            >
              <SparklesIcon className={`h-4 w-4 mr-2 ${categorizing ? "animate-pulse" : ""}`} />
              {categorizing ? (
                <FormattedMessage id="bankTransactions.categorizing" />
              ) : (
                <FormattedMessage id="bankTransactions.categorize" />
              )}
            </Button>
            {allCategorized && transactions.length > 0 && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <FormattedMessage id="bankTransactions.allCategorized" />
              </span>
            )}
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? (
              <FormattedMessage id="bankTransactions.syncing" />
            ) : (
              <FormattedMessage id="bankTransactions.sync" />
            )}
          </Button>
        </div>
      </div>

      {/* AI Categorization Banner - show if not all categorized */}
      {!allCategorized && transactions.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-1">
                  <FormattedMessage id="bankTransactions.categorization.cta.title" />
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  <FormattedMessage id="bankTransactions.categorization.cta.description" />
                </p>
                <Button
                  onClick={handleCategorize}
                  disabled={categorizing}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <SparklesIcon className="h-4 w-4 mr-2" />
                  <FormattedMessage id="bankTransactions.categorize" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ChartBarIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(insights.totalSpent)}</div>
                <div className="text-xs text-secondary">
                  <FormattedMessage
                    id="bankTransactions.summary.totalSpent"
                    values={{ count: insights.transactionCount }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{insights.largePurchases.length}</div>
                <div className="text-xs text-secondary">
                  <FormattedMessage id="bankTransactions.summary.largePurchases" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={insights.totalSavingPotential > 0 ? "border-green-200 bg-green-50/50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(insights.totalSavingPotential)}
                </div>
                <div className="text-xs text-secondary">
                  <FormattedMessage id="bankTransactions.summary.savingPotential" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Section */}
      {insights.patterns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LightBulbIcon className="h-5 w-5 text-amber-500" />
              <FormattedMessage id="bankTransactions.insights.title" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.patterns.map((pattern, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <div className="p-2 bg-white rounded-lg shadow-sm">{pattern.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{pattern.name}</span>
                    <span className="text-sm font-mono">
                      {pattern.count}x = {formatCurrency(pattern.total)}
                    </span>
                  </div>
                  <p className="text-sm text-secondary mt-1">{pattern.insight}</p>
                  {pattern.savingPotential && pattern.savingPotential > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      <FormattedMessage
                        id="bankTransactions.insights.savingPotential"
                        values={{ amount: formatCurrency(pattern.savingPotential) }}
                      />
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      {insights.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-blue-500" />
              <FormattedMessage id="bankTransactions.categories.title" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="p-1.5 bg-muted rounded">{cat.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {categoryTranslationKeys[cat.category]
                          ? intl.formatMessage({ id: categoryTranslationKeys[cat.category] })
                          : cat.category}
                      </span>
                      <span className="text-sm font-mono">{formatCurrency(cat.total)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-secondary w-12 text-right">
                    {cat.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Large Purchases Alert */}
      {insights.largePurchases.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
              <FormattedMessage id="bankTransactions.largePurchases.title" />
            </CardTitle>
            <CardDescription>
              <FormattedMessage id="bankTransactions.largePurchases.subtitle" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.largePurchases.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 bg-amber-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{tx.description_display}</div>
                    <div className="text-xs text-secondary">{tx.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAddModal(tx)}
                      title={intl.formatMessage({ id: "bankTransactions.addToBudget.button" })}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg">
              <FormattedMessage id="bankTransactions.list.title" />
            </CardTitle>

            {/* Search + Filters Row */}
            <div className="flex flex-wrap gap-2">
              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                <Input
                  placeholder={intl.formatMessage({ id: "bankTransactions.filters.search" })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={intl.formatMessage({ id: "bankTransactions.filters.category" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <FormattedMessage id="bankTransactions.filters.allCategories" />
                  </SelectItem>
                  <SelectItem value="housing">
                    <FormattedMessage id="expenses.categories.housing" />
                  </SelectItem>
                  <SelectItem value="transportation">
                    <FormattedMessage id="expenses.categories.transportation" />
                  </SelectItem>
                  <SelectItem value="food">
                    <FormattedMessage id="expenses.categories.food" />
                  </SelectItem>
                  <SelectItem value="utilities">
                    <FormattedMessage id="expenses.categories.utilities" />
                  </SelectItem>
                  <SelectItem value="insurance">
                    <FormattedMessage id="expenses.categories.insurance" />
                  </SelectItem>
                  <SelectItem value="healthcare">
                    <FormattedMessage id="expenses.categories.healthcare" />
                  </SelectItem>
                  <SelectItem value="entertainment">
                    <FormattedMessage id="expenses.categories.entertainment" />
                  </SelectItem>
                  <SelectItem value="salary">
                    <FormattedMessage id="income.categories.salary" />
                  </SelectItem>
                  <SelectItem value="freelance">
                    <FormattedMessage id="income.categories.freelance" />
                  </SelectItem>
                  <SelectItem value="investments">
                    <FormattedMessage id="income.categories.investments" />
                  </SelectItem>
                  <SelectItem value="rental">
                    <FormattedMessage id="income.categories.rental" />
                  </SelectItem>
                  <SelectItem value="other">
                    <FormattedMessage id="expenses.categories.other" />
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as "all" | "income" | "expense")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={intl.formatMessage({ id: "bankTransactions.filters.type" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <FormattedMessage id="bankTransactions.filters.allTypes" />
                  </SelectItem>
                  <SelectItem value="expense">
                    <FormattedMessage id="bankTransactions.filters.expenses" />
                  </SelectItem>
                  <SelectItem value="income">
                    <FormattedMessage id="bankTransactions.filters.income" />
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Period Filter */}
              <Select value={periodFilter} onValueChange={(val) => setPeriodFilter(val as any)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={intl.formatMessage({ id: "bankTransactions.filters.period" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <FormattedMessage id="bankTransactions.filters.allTime" />
                  </SelectItem>
                  <SelectItem value="week">
                    <FormattedMessage id="bankTransactions.filters.lastWeek" />
                  </SelectItem>
                  <SelectItem value="month">
                    <FormattedMessage id="bankTransactions.filters.lastMonth" />
                  </SelectItem>
                  <SelectItem value="quarter">
                    <FormattedMessage id="bankTransactions.filters.lastQuarter" />
                  </SelectItem>
                  <SelectItem value="year">
                    <FormattedMessage id="bankTransactions.filters.lastYear" />
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters Button (only show if any filter is active) */}
              {(categoryFilter !== "all" || typeFilter !== "all" || periodFilter !== "all" || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter("all");
                    setTypeFilter("all");
                    setPeriodFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-xs"
                >
                  <FormattedMessage id="bankTransactions.filters.clearAll" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    <FormattedMessage id="bankTransactions.convert.date" />
                    {sortField === "date" && (
                      sortDirection === "asc"
                        ? <ChevronUpIcon className="h-4 w-4" />
                        : <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead><FormattedMessage id="bankTransactions.convert.description" /></TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("category")}
                >
                  <div className="flex items-center gap-1">
                    <FormattedMessage id="bankTransactions.list.category" />
                    {sortField === "category" && (
                      sortDirection === "asc"
                        ? <ChevronUpIcon className="h-4 w-4" />
                        : <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("amount")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <FormattedMessage id="bankTransactions.convert.amount" />
                    {sortField === "amount" && (
                      sortDirection === "asc"
                        ? <ChevronUpIcon className="h-4 w-4" />
                        : <ChevronDownIcon className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-sm text-secondary">
                    {tx.date}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{tx.description_display}</div>
                    {tx.merchant_name && tx.merchant_name !== tx.description_display && (
                      <div className="text-xs text-secondary mt-0.5">{tx.merchant_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {tx.suggested_category && tx.confidence_score && tx.confidence_score > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                          tx.confidence_score >= 0.8
                            ? "bg-green-100 text-green-700"
                            : tx.confidence_score >= 0.6
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                        title={`AI: ${Math.round(tx.confidence_score * 100)}%`}
                      >
                        {categoryBadgeIcons[tx.suggested_category] || categoryBadgeIcons.other}
                        {categoryTranslationKeys[tx.suggested_category]
                          ? intl.formatMessage({ id: categoryTranslationKeys[tx.suggested_category] })
                          : tx.suggested_category}
                      </span>
                    ) : (
                      <span className="text-xs text-secondary">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      tx.amount > 0 ? "text-green-600" : "text-primary"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {formatCurrency(Math.abs(tx.amount))}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openAddModal(tx)}
                      className="opacity-50 hover:opacity-100"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {transactions.length > 20 && !showAllTransactions && (
            <div className="p-4 text-center border-t">
              <Button variant="ghost" onClick={() => setShowAllTransactions(true)}>
                <FormattedMessage
                  id="bankTransactions.list.showAll"
                  values={{ count: transactions.length }}
                />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add to Budget Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <FormattedMessage id="bankTransactions.addToBudget.title" />
            </DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">{selectedTransaction.description_display}</div>
                <div className="text-sm text-secondary">
                  {selectedTransaction.date} •{" "}
                  <span className={selectedTransaction.amount > 0 ? "text-green-600" : ""}>
                    {formatCurrency(Math.abs(selectedTransaction.amount))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={addType === "expense" ? "default" : "outline"}
                  onClick={() => setAddType("expense")}
                >
                  <FormattedMessage id="bankTransactions.convert.asExpense" />
                </Button>
                <Button
                  variant={addType === "income" ? "default" : "outline"}
                  onClick={() => setAddType("income")}
                >
                  <FormattedMessage id="bankTransactions.convert.asIncome" />
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium">
                  <FormattedMessage id="bankTransactions.convert.category" />
                </label>
                <Select value={addCategory} onValueChange={setAddCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(addType === "expense" ? expenseCategories : incomeCategories).map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {intl.formatMessage({ id: cat.labelId })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  <FormattedMessage id="bankTransactions.convert.description" />
                </label>
                <Input
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              <FormattedMessage id="common.cancel" />
            </Button>
            <Button onClick={handleAddToBudget} disabled={adding || !addCategory}>
              <FormattedMessage id="bankTransactions.addToBudget.button" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Categorization Modal */}
      <Dialog open={categorizing} onOpenChange={(open) => !open && categorizeResult && closeCategorizeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              <FormattedMessage id="bankTransactions.categorizeModal.title" />
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {/* Animated Icon */}
            <div className="flex justify-center">
              {categorizeResult ? (
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <SparklesIcon className="w-8 h-8 text-primary animate-pulse" />
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${categorizeProgress}%` }}
                />
              </div>
              <p className="text-sm text-center text-secondary">
                {categorizeStep}
              </p>
            </div>

            {/* Result */}
            {categorizeResult && (
              <div className="text-center space-y-2">
                {categorizeResult.alreadyDone ? (
                  <>
                    <p className="text-lg font-semibold text-primary">
                      <FormattedMessage id="bankTransactions.categorizeModal.allDone" />
                    </p>
                    <p className="text-sm text-secondary">
                      <FormattedMessage id="bankTransactions.categorizeModal.allDoneDesc" />
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-primary">
                      <FormattedMessage
                        id="bankTransactions.categorizeModal.success"
                        values={{ count: categorizeResult.count }}
                      />
                    </p>
                    <p className="text-sm text-secondary">
                      <FormattedMessage id="bankTransactions.categorizeModal.successDesc" />
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {categorizeResult && (
            <DialogFooter>
              <Button onClick={closeCategorizeModal} className="w-full">
                <FormattedMessage id="common.close" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
