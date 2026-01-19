import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/hooks/useApi';
import FilterChips, { TransactionFilter } from '@/components/FilterChips';
import AddTransactionSheet from '@/components/AddTransactionSheet';

interface Transaction {
  id: number;
  amount: number;
  currency: string;
  category_id: number | null;
  date: string;
  description: string | null;
  type: 'income' | 'expense';
}

// Mock data for dev mode
const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 1, amount: 12500, currency: 'PLN', category_id: 1, date: '2026-01-15', description: 'Wypłata', type: 'income' },
  { id: 2, amount: 2500, currency: 'PLN', category_id: 2, date: '2026-01-14', description: 'Czynsz', type: 'expense' },
  { id: 3, amount: 450, currency: 'PLN', category_id: 3, date: '2026-01-13', description: 'Zakupy spożywcze', type: 'expense' },
  { id: 4, amount: 200, currency: 'PLN', category_id: 4, date: '2026-01-12', description: 'Paliwo', type: 'expense' },
  { id: 5, amount: 150, currency: 'PLN', category_id: 5, date: '2026-01-11', description: 'Netflix + Spotify', type: 'expense' },
  { id: 6, amount: 500, currency: 'PLN', category_id: 1, date: '2026-01-10', description: 'Freelance projekt', type: 'income' },
  { id: 7, amount: 89, currency: 'PLN', category_id: 6, date: '2026-01-09', description: 'Restauracja', type: 'expense' },
  { id: 8, amount: 3500, currency: 'PLN', category_id: 1, date: '2026-01-05', description: 'Premia', type: 'income' },
  { id: 9, amount: 120, currency: 'PLN', category_id: 7, date: '2026-01-04', description: 'Apteka', type: 'expense' },
  { id: 10, amount: 350, currency: 'PLN', category_id: 8, date: '2026-01-03', description: 'Ubrania', type: 'expense' },
];

const FILTER_OPTIONS = [
  { value: 'all' as TransactionFilter, label: 'Wszystkie' },
  { value: 'income' as TransactionFilter, label: 'Przychody' },
  { value: 'expense' as TransactionFilter, label: 'Wydatki' },
];

export default function TransactionsScreen() {
  const { user, token } = useAuthStore();
  const api = useApi();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [showAddSheet, setShowAddSheet] = useState(false);

  // Check if we're in dev mode
  const isDevMode = token === 'dev-token-for-testing';

  const fetchTransactions = useCallback(async () => {
    if (!user?.email || !api) return;

    // Use mock data in dev mode
    if (isDevMode) {
      setTransactions(MOCK_TRANSACTIONS);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const data = await api.transactions.list(user.email);
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError('Nie udało się załadować transakcji');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.email, api, isDevMode]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const handleAddSuccess = useCallback(() => {
    // Refresh transactions list after adding
    fetchTransactions();
  }, [fetchTransactions]);

  // Filter transactions based on selected filter
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [transactions, filter]);

  // Calculate summary for current filter
  const summary = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const formatCurrency = (amount: number, currency: string = 'PLN') => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isExpense = item.type === 'expense';

    return (
      <TouchableOpacity style={styles.transactionItem}>
        <View
          style={[
            styles.transactionIcon,
            { backgroundColor: isExpense ? '#fef2f2' : '#f0fdf4' },
          ]}
        >
          <Ionicons
            name={isExpense ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={isExpense ? '#ef4444' : '#22c55e'}
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description || 'Brak opisu'}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            { color: isExpense ? '#ef4444' : '#22c55e' },
          ]}
        >
          {isExpense ? '-' : '+'}
          {formatCurrency(item.amount, item.currency)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Przychody</Text>
          <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
            +{formatCurrency(summary.income)}
          </Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryItemCenter]}>
          <Text style={styles.summaryLabel}>Bilans</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: summary.balance >= 0 ? '#22c55e' : '#ef4444' },
            ]}
          >
            {formatCurrency(summary.balance)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Wydatki</Text>
          <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
            -{formatCurrency(summary.expenses)}
          </Text>
        </View>
      </View>

      {/* Filter Chips */}
      <FilterChips
        options={FILTER_OPTIONS}
        selected={filter}
        onSelect={setFilter}
      />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTransaction}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {filter === 'all'
                  ? 'Brak transakcji'
                  : filter === 'income'
                    ? 'Brak przychodów'
                    : 'Brak wydatków'}
              </Text>
              <Text style={styles.emptyText}>
                Dodaj pierwszą transakcję, aby zacząć śledzić finanse
              </Text>
            </View>
          }
          contentContainerStyle={
            filteredTransactions.length === 0 ? styles.emptyList : styles.list
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddSheet(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Transaction Sheet */}
      <AddTransactionSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSuccess={handleAddSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    margin: 16,
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyList: {
    flexGrow: 1,
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
