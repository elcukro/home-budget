import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/hooks/useApi';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  is_recurring: boolean;
  date: string;
  end_date: string | null;
  source: string;
}

interface CategoryGroup {
  categoryKey: string;  // Original key from backend
  category: string;     // Display label (Polish)
  total: number;
  expenses: Expense[];
  icon: string;
  color: string;
}

// Category icons and colors mapping (English keys from backend, Polish labels for display)
const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  // English category names (from backend)
  'housing': { icon: 'home', color: '#8b5cf6', label: 'Mieszkanie' },
  'food': { icon: 'restaurant', color: '#f97316', label: 'Żywność' },
  'entertainment': { icon: 'game-controller', color: '#ec4899', label: 'Rozrywka' },
  'healthcare': { icon: 'heart', color: '#ef4444', label: 'Opieka Zdrowotna' },
  'transport': { icon: 'car', color: '#3b82f6', label: 'Transport' },
  'media': { icon: 'tv', color: '#06b6d4', label: 'Media' },
  'education': { icon: 'school', color: '#10b981', label: 'Edukacja' },
  'clothing': { icon: 'shirt', color: '#a855f7', label: 'Ubrania' },
  'other': { icon: 'ellipsis-horizontal-circle', color: '#6b7280', label: 'Inne' },
  'savings': { icon: 'wallet', color: '#22c55e', label: 'Oszczędności' },
  'utilities': { icon: 'flash', color: '#eab308', label: 'Media / Rachunki' },
  'insurance': { icon: 'shield-checkmark', color: '#0ea5e9', label: 'Ubezpieczenia' },
  'subscriptions': { icon: 'repeat', color: '#f43f5e', label: 'Subskrypcje' },
  'pets': { icon: 'paw', color: '#fb923c', label: 'Zwierzęta' },
  'kids': { icon: 'people', color: '#a78bfa', label: 'Dzieci' },
  'personal': { icon: 'person', color: '#64748b', label: 'Osobiste' },
  // Polish category names (fallback)
  'Rozrywka': { icon: 'game-controller', color: '#ec4899', label: 'Rozrywka' },
  'Żywność': { icon: 'restaurant', color: '#f97316', label: 'Żywność' },
  'Mieszkanie': { icon: 'home', color: '#8b5cf6', label: 'Mieszkanie' },
  'Transport': { icon: 'car', color: '#3b82f6', label: 'Transport' },
  'Inne': { icon: 'ellipsis-horizontal-circle', color: '#6b7280', label: 'Inne' },
  // Default
  'default': { icon: 'pricetag', color: '#6b7280', label: 'Inne' },
};

// Mock data for dev mode
const MOCK_EXPENSES: Expense[] = [
  { id: 1, category: 'Mieszkanie', description: 'Czynsz za mieszkanie', amount: 1950, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 2, category: 'Mieszkanie', description: 'Media (prąd, gaz, woda)', amount: 380, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 3, category: 'Mieszkanie', description: 'Internet', amount: 100, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 4, category: 'Żywność', description: 'Zakupy spożywcze', amount: 1250, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 5, category: 'Żywność', description: 'Obiady / jedzenie na mieście', amount: 300, is_recurring: false, date: '2026-01-15', end_date: null, source: 'manual' },
  { id: 6, category: 'Rozrywka', description: 'Kino / restauracje / wyjazdy', amount: 250, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 7, category: 'Rozrywka', description: 'Inne drobne wydatki', amount: 150, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 8, category: 'Media', description: 'Netflix / Spotify / YouTube', amount: 200, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 9, category: 'Transport', description: 'Bilety komunikacja', amount: 100, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 10, category: 'Opieka Zdrowotna', description: 'Siłownia / fitness', amount: 100, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 11, category: 'Opieka Zdrowotna', description: 'Kosmetyki / fryzjer', amount: 100, is_recurring: false, date: '2026-01-10', end_date: null, source: 'manual' },
  { id: 12, category: 'Inne', description: 'Zwierzęta domowe', amount: 150, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 13, category: 'Inne', description: 'Zajęcia dodatkowe', amount: 250, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
];

export default function TransactionsScreen() {
  const { user, token } = useAuthStore();
  const api = useApi();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const isDevMode = token === 'dev-token-for-testing';

  const fetchExpenses = useCallback(async () => {
    if (!user?.email || !api) return;

    if (isDevMode) {
      setExpenses(MOCK_EXPENSES);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const data = await api.expenses.list(user.email);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
      setError('Nie udało się załadować wydatków');
      // Fallback to mock data on error
      setExpenses(MOCK_EXPENSES);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.email, api, isDevMode]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchExpenses();
  }, [fetchExpenses]);

  // Group expenses by category
  const groupedExpenses = useMemo((): CategoryGroup[] => {
    const groups: Record<string, CategoryGroup> = {};

    expenses.forEach((expense) => {
      const categoryKey = expense.category || 'other';
      const config = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG['default'];
      const displayLabel = config.label;

      if (!groups[categoryKey]) {
        groups[categoryKey] = {
          categoryKey,              // Original key for React key prop
          category: displayLabel,   // Polish label for display
          total: 0,
          expenses: [],
          icon: config.icon,
          color: config.color,
        };
      }
      groups[categoryKey].total += expense.amount;
      groups[categoryKey].expenses.push(expense);
    });

    // Sort by total amount descending
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Calculate total expenses
  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Calculate recurring vs one-time
  const recurringTotal = useMemo(() => {
    return expenses.filter(e => e.is_recurring).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const toggleCategory = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Month Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Podsumowanie miesiąca</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Suma wydatków</Text>
            <Text style={styles.summaryValueLarge}>{formatCurrency(totalExpenses)}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <View style={styles.summaryItemHalf}>
            <Text style={styles.summaryLabel}>Cykliczne</Text>
            <Text style={styles.summaryValue}>{formatCurrency(recurringTotal)}</Text>
          </View>
          <View style={styles.summaryItemHalf}>
            <Text style={styles.summaryLabel}>Jednorazowe</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalExpenses - recurringTotal)}</Text>
          </View>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Category Groups */}
      <Text style={styles.sectionTitle}>Lista wydatków</Text>

      {groupedExpenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Brak wydatków</Text>
          <Text style={styles.emptyText}>
            Dodaj pierwszy wydatek, aby zacząć śledzić finanse
          </Text>
        </View>
      ) : (
        groupedExpenses.map((group) => {
          const isExpanded = expandedCategories.has(group.categoryKey);

          return (
            <View key={group.categoryKey} style={styles.categoryCard}>
              {/* Category Header */}
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(group.categoryKey)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryHeaderLeft}>
                  <View style={[styles.categoryIcon, { backgroundColor: group.color + '20' }]}>
                    <Ionicons name={group.icon as any} size={20} color={group.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{group.category}</Text>
                    <Text style={styles.categoryCount}>
                      {group.expenses.length} {group.expenses.length === 1 ? 'wydatek' : 'wydatków'}
                    </Text>
                  </View>
                </View>
                <View style={styles.categoryHeaderRight}>
                  <Text style={[styles.categoryTotal, { color: group.color }]}>
                    {formatCurrency(group.total)}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#9ca3af"
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded Expenses */}
              {isExpanded && (
                <View style={styles.expensesList}>
                  {group.expenses.map((expense, index) => (
                    <View
                      key={`${expense.id}-${index}`}
                      style={[
                        styles.expenseItem,
                        index < group.expenses.length - 1 && styles.expenseItemBorder,
                      ]}
                    >
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseDescription}>{expense.description}</Text>
                        <View style={styles.expenseMeta}>
                          {expense.is_recurring && (
                            <View style={styles.recurringBadge}>
                              <Ionicons name="repeat" size={12} color="#f97316" />
                              <Text style={styles.recurringText}>Cykliczny</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
                    </View>
                  ))}
                  {/* Category Total Row */}
                  <View style={styles.categoryTotalRow}>
                    <Text style={styles.categoryTotalLabel}>Razem</Text>
                    <Text style={styles.categoryTotalValue}>{formatCurrency(group.total)}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* FAB Placeholder Space */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemHalf: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  summaryValueLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ef4444',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 16,
  },

  // Error
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 14,
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Category Card
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoryCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTotal: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Expenses List
  expensesList: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  expenseItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 14,
    color: '#374151',
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  recurringText: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '500',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },

  // Category Total Row
  categoryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  categoryTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoryTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
});
