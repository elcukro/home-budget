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
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/hooks/useApi';
import { getIncomeCategoryConfig } from '@/constants/categories';
import AddTransactionSheet from '@/components/AddTransactionSheet';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface IncomeItem {
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
  categoryKey: string;
  category: string;
  total: number;
  items: IncomeItem[];
  emoji: string;
  color: string;
  backgroundColor: string;
}

// Mock data for dev mode
const MOCK_INCOME: IncomeItem[] = [
  { id: 1, category: 'salary', description: 'Pensja netto', amount: 10000, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
  { id: 2, category: 'salary', description: 'Premia roczna', amount: 5000, is_recurring: false, date: '2026-01-15', end_date: null, source: 'manual' },
  { id: 3, category: 'freelance', description: 'Projekt dla klienta X', amount: 3000, is_recurring: false, date: '2026-01-10', end_date: null, source: 'manual' },
  { id: 4, category: 'investments', description: 'Dywidendy', amount: 800, is_recurring: false, date: '2026-01-20', end_date: null, source: 'manual' },
  { id: 5, category: 'rental', description: 'Wynajem mieszkania', amount: 2500, is_recurring: true, date: '2026-01-01', end_date: null, source: 'manual' },
];

export default function IncomeListScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const api = useApi();
  const [income, setIncome] = useState<IncomeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddSheet, setShowAddSheet] = useState(false);

  const isDevMode = token === 'dev-token-for-testing';

  const fetchIncome = useCallback(async () => {
    if (!user?.email || !api) return;

    if (isDevMode) {
      setIncome(MOCK_INCOME);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const data = await api.income.list(user.email);
      setIncome(data);
    } catch (err) {
      console.error('Failed to fetch income:', err);
      setError('Nie udalo sie zaladowac przychodow');
      setIncome(MOCK_INCOME);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.email, api, isDevMode]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchIncome();
  }, [fetchIncome]);

  // Group income by category
  const groupedIncome = useMemo((): CategoryGroup[] => {
    const groups: Record<string, CategoryGroup> = {};

    income.forEach((item) => {
      const categoryKey = item.category || 'other';
      const config = getIncomeCategoryConfig(categoryKey);

      if (!groups[categoryKey]) {
        groups[categoryKey] = {
          categoryKey,
          category: config.label,
          total: 0,
          items: [],
          emoji: config.emoji,
          color: config.textColor,
          backgroundColor: config.backgroundColor,
        };
      }
      groups[categoryKey].total += item.amount;
      groups[categoryKey].items.push(item);
    });

    // Sort by total amount descending
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [income]);

  // Calculate totals
  const totalIncome = useMemo(() => {
    return income.reduce((sum, item) => sum + item.amount, 0);
  }, [income]);

  const recurringTotal = useMemo(() => {
    return income.filter(item => item.is_recurring).reduce((sum, item) => sum + item.amount, 0);
  }, [income]);

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddSuccess = () => {
    fetchIncome();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: 'Przychody',
            headerRight: () => null,
          }}
        />
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Przychody',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowAddSheet(true)}
              style={styles.headerButton}
            >
              <Ionicons name="add-circle" size={28} color="#22c55e" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#22c55e"
          />
        }
      >
        {/* Month Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Podsumowanie miesiaca</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Suma przychodow</Text>
              <Text style={styles.summaryValueLarge}>{formatCurrency(totalIncome)}</Text>
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
              <Text style={styles.summaryValue}>{formatCurrency(totalIncome - recurringTotal)}</Text>
            </View>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Category Groups */}
        <Text style={styles.sectionTitle}>Lista przychodow</Text>

        {groupedIncome.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={48} color="#22c55e" />
            </View>
            <Text style={styles.emptyTitle}>Brak przychodow</Text>
            <Text style={styles.emptyText}>
              Dodaj pierwszy przychod, aby zaczac sledzic finanse
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowAddSheet(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Dodaj przychod</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groupedIncome.map((group) => {
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
                    <View style={[styles.emojiContainer, { backgroundColor: group.backgroundColor }]}>
                      <Text style={styles.emoji}>{group.emoji}</Text>
                    </View>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{group.category}</Text>
                      <Text style={styles.categoryCount}>
                        {group.items.length} {group.items.length === 1 ? 'przychod' : 'przychodow'}
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

                {/* Expanded Items */}
                {isExpanded && (
                  <View style={styles.itemsList}>
                    {group.items.map((item, index) => (
                      <View
                        key={`${item.id}-${index}`}
                        style={[
                          styles.incomeItem,
                          index < group.items.length - 1 && styles.incomeItemBorder,
                        ]}
                      >
                        <View style={styles.incomeInfo}>
                          <Text style={styles.incomeDescription}>{item.description}</Text>
                          <View style={styles.incomeMeta}>
                            {item.is_recurring && (
                              <View style={styles.recurringBadge}>
                                <Ionicons name="repeat" size={12} color="#22c55e" />
                                <Text style={styles.recurringText}>Cykliczny</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={styles.incomeAmount}>{formatCurrency(item.amount)}</Text>
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

        {/* Bottom padding */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Transaction Sheet */}
      <AddTransactionSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSuccess={handleAddSuccess}
        initialType="income"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  headerButton: {
    padding: 4,
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
    color: '#22c55e',
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
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#fff',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 22,
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

  // Items List
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  incomeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  incomeItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  incomeInfo: {
    flex: 1,
  },
  incomeDescription: {
    fontSize: 14,
    color: '#374151',
  },
  incomeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  recurringText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '500',
  },
  incomeAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },

  // Category Total Row
  categoryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0fdf4',
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  categoryTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoryTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
});
