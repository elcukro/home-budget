/**
 * LoansScreen - List of all loans with summary
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '@/hooks/useApi';
import LoanCard from '@/components/LoanCard';
import EmptyState from '@/components/EmptyState';
import AddLoanSheet from '@/components/AddLoanSheet';
import type { LoanDetail, Loan } from '@/lib/api';

// Loan type icons and labels
const LOAN_TYPE_INFO: Record<string, { icon: string; label: string }> = {
  mortgage: { icon: '🏠', label: 'Kredyt hipoteczny' },
  car: { icon: '🚗', label: 'Kredyt samochodowy' },
  personal: { icon: '💵', label: 'Kredyt gotówkowy' },
  student: { icon: '🎓', label: 'Kredyt studencki' },
  credit_card: { icon: '💳', label: 'Karta kredytowa' },
  cash_loan: { icon: '🤝', label: 'Pożyczka' },
  installment: { icon: '🛒', label: 'Raty 0%' },
  leasing: { icon: '📋', label: 'Leasing' },
  overdraft: { icon: '🏦', label: 'Debet' },
  other: { icon: '📝', label: 'Inny' },
};

export default function LoansScreen() {
  const api = useApi();
  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const fetchLoans = useCallback(async () => {
    if (!api) return;

    try {
      setError(null);
      const data = await api.loans.list();
      setLoans(data);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
      setError('Nie udało się załadować kredytów');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api]);

  // Fetch loans on mount and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchLoans();
    }, [fetchLoans])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchLoans();
  }, [fetchLoans]);

  // Handle loan archive
  const handleArchiveLoan = useCallback(async (loanId: number) => {
    if (!api) return;

    try {
      await api.loans.archive(loanId);
      fetchLoans();
    } catch (err) {
      console.error('Failed to archive loan:', err);
      Alert.alert(
        'Błąd',
        'Nie udało się zarchiwizować kredytu. Spróbuj ponownie.',
        [{ text: 'OK' }]
      );
    }
  }, [api, fetchLoans]);

  // Handle adding new loan
  const handleLoanAdded = useCallback(() => {
    setShowAddSheet(false);
    fetchLoans();
  }, [fetchLoans]);

  // Calculate summary
  const summary = useMemo(() => {
    const totalBalance = loans.reduce((sum, loan) => sum + loan.remaining_balance, 0);
    const totalMonthlyPayments = loans.reduce((sum, loan) => sum + loan.monthly_payment, 0);
    return { totalBalance, totalMonthlyPayments };
  }, [loans]);

  // Convert LoanDetail to Loan for LoanCard component
  const convertToLoan = (loanDetail: LoanDetail): Loan => {
    const progress = loanDetail.principal_amount > 0
      ? ((loanDetail.principal_amount - loanDetail.remaining_balance) / loanDetail.principal_amount) * 100
      : 0;

    return {
      id: String(loanDetail.id),
      loan_type: loanDetail.loan_type,
      description: loanDetail.description,
      balance: loanDetail.remaining_balance,
      monthlyPayment: loanDetail.monthly_payment,
      interestRate: loanDetail.interest_rate,
      progress,
      totalAmount: loanDetail.principal_amount,
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kredyty</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowAddSheet(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchLoans}>
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </Pressable>
        </View>
      ) : loans.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          <EmptyState
            type="loans"
            title="Nie masz żadnych kredytów"
            description="Dodaj swój pierwszy kredyt, żeby śledzić postęp spłaty i planować nadpłaty."
            action={
              <Pressable
                style={styles.emptyActionButton}
                onPress={() => setShowAddSheet(true)}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyActionButtonText}>Dodaj kredyt</Text>
              </Pressable>
            }
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Suma sald</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(summary.totalBalance)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Miesięczne raty</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(summary.totalMonthlyPayments)}
                </Text>
              </View>
            </View>
          </View>

          {/* Loans List */}
          <View style={styles.loansSection}>
            <Text style={styles.sectionTitle}>
              {loans.length} {loans.length === 1 ? 'kredyt' : loans.length < 5 ? 'kredyty' : 'kredytów'}
            </Text>
            {loans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={convertToLoan(loan)}
                formatCurrency={formatCurrency}
                onArchive={handleArchiveLoan}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Add Loan Sheet */}
      <AddLoanSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSuccess={handleLoanAdded}
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
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#f97316',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  loansSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
