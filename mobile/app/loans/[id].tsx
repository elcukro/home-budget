/**
 * LoanDetailScreen - Detailed view of a loan with overpayment functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/hooks/useApi';
import { useGamificationStore } from '@/stores/gamification';
import OverpaymentModal from '@/components/OverpaymentModal';
import CelebrationModal from '@/components/CelebrationModal';
import type { LoanDetail, LoanPayment, LoanPaymentResponse } from '@/lib/api';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const api = useApi();

  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Overpayment modal state
  const [showOverpaymentModal, setShowOverpaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Celebration state
  const addCelebration = useGamificationStore((s) => s.addCelebration);
  const pendingCelebration = useGamificationStore((s) => s.pendingCelebrations[0] || null);
  const dismissCelebration = useGamificationStore((s) => s.dismissCelebration);

  const loanId = parseInt(id || '0', 10);

  const fetchLoanData = useCallback(async () => {
    if (!api || !user?.email || !loanId) return;

    try {
      setError(null);

      // Fetch loan details and payments in parallel
      const [loansData, paymentsData] = await Promise.all([
        api.loans.list(),
        api.loans.getPayments(user.email, loanId),
      ]);

      const loanData = loansData.find((l) => l.id === loanId);
      if (!loanData) {
        setError('Kredyt nie został znaleziony');
        return;
      }

      setLoan(loanData);
      setPayments(paymentsData);
    } catch (err) {
      console.error('Error fetching loan data:', err);
      setError('Nie udało się załadować danych kredytu');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api, user?.email, loanId]);

  useEffect(() => {
    fetchLoanData();
  }, [fetchLoanData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchLoanData();
  }, [fetchLoanData]);

  const handleOverpayment = async (amount: number) => {
    if (!api || !user?.email || !loan) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response: LoanPaymentResponse = await api.loans.createPayment(
        user.email,
        loanId,
        {
          amount,
          payment_date: today,
          payment_type: 'overpayment',
          notes: 'Nadpłata z aplikacji mobilnej',
        }
      );

      // Update local state
      setLoan((prev) =>
        prev ? { ...prev, remaining_balance: response.new_balance } : null
      );

      // Close modal
      setShowOverpaymentModal(false);

      // Show celebration if loan was paid off
      if (response.loan_paid_off && response.celebration) {
        addCelebration({
          type: 'mortgage_paid_off',
          xpEarned: response.xp_earned,
          mortgageData: response.celebration,
        });
      }

      // Refresh data
      fetchLoanData();
    } catch (err) {
      console.error('Error creating overpayment:', err);
      // Error is handled in the modal
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const calculateProgress = () => {
    if (!loan) return 0;
    const paid = loan.principal_amount - loan.remaining_balance;
    return (paid / loan.principal_amount) * 100;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (error || !loan) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error || 'Nie znaleziono kredytu'}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  const progress = calculateProgress();
  const overpayments = payments.filter((p) => p.payment_type === 'overpayment');
  const regularPayments = payments.filter((p) => p.payment_type === 'regular');

  return (
    <>
      <Stack.Screen
        options={{
          title: loan.description,
          headerBackTitle: 'Wróć',
        }}
      />

      {/* Celebration Modal */}
      <CelebrationModal
        celebration={pendingCelebration}
        onDismiss={dismissCelebration}
      />

      {/* Overpayment Modal */}
      <OverpaymentModal
        visible={showOverpaymentModal}
        loanId={loanId}
        loanDescription={loan.description}
        remainingBalance={loan.remaining_balance}
        onClose={() => setShowOverpaymentModal(false)}
        onSubmit={handleOverpayment}
        isLoading={isSubmitting}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.loanTypeTag}>
              <Text style={styles.loanTypeText}>
                {loan.loan_type === 'mortgage' ? 'Hipoteczny' : 'Kredyt'}
              </Text>
            </View>
            <Text style={styles.interestRate}>
              {formatPercent(loan.interest_rate)}
            </Text>
          </View>

          <Text style={styles.balanceLabel}>Pozostało do spłaty</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(loan.remaining_balance)}
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{progress.toFixed(0)}% spłacone</Text>
          </View>

          {/* Overpay Button */}
          <Pressable
            style={styles.overpayButton}
            onPress={() => setShowOverpaymentModal(true)}
          >
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.overpayButtonText}>Nadpłać kredyt</Text>
          </Pressable>
        </View>

        {/* Loan Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Szczegóły kredytu</Text>
          <View style={styles.detailsCard}>
            <DetailRow
              icon="cash"
              label="Kwota początkowa"
              value={formatCurrency(loan.principal_amount)}
            />
            <DetailRow
              icon="calendar"
              label="Data rozpoczęcia"
              value={formatDate(loan.start_date)}
            />
            <DetailRow
              icon="time"
              label="Okres kredytowania"
              value={`${loan.term_months} miesięcy`}
            />
            <DetailRow
              icon="wallet"
              label="Rata miesięczna"
              value={formatCurrency(loan.monthly_payment)}
            />
            {loan.due_day && (
              <DetailRow
                icon="today"
                label="Dzień płatności"
                value={`${loan.due_day} każdego miesiąca`}
              />
            )}
          </View>
        </View>

        {/* Overpayments Summary */}
        {overpayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Nadpłaty ({overpayments.length})
            </Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(
                      overpayments.reduce((sum, p) => sum + p.amount, 0)
                    )}
                  </Text>
                  <Text style={styles.summaryLabel}>Łączna kwota</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {overpayments.length}
                  </Text>
                  <Text style={styles.summaryLabel}>Liczba nadpłat</Text>
                </View>
              </View>
            </View>

            {/* Recent Overpayments */}
            <View style={styles.paymentsList}>
              {overpayments.slice(0, 5).map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={styles.paymentIcon}>
                    <Ionicons name="rocket" size={16} color="#8b5cf6" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentAmount}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {formatDate(payment.payment_date)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Regular Payments */}
        {regularPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Ostatnie raty ({regularPayments.length})
            </Text>
            <View style={styles.paymentsList}>
              {regularPayments.slice(0, 5).map((payment) => (
                <View key={payment.id} style={styles.paymentItem}>
                  <View style={[styles.paymentIcon, styles.regularIcon]}>
                    <Ionicons name="checkmark" size={16} color="#22c55e" />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentAmount}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {payment.covers_month}/{payment.covers_year}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

// Helper component for detail rows
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={18} color="#6b7280" />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  backButton: {
    backgroundColor: '#f97316',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Balance Card
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  loanTypeTag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  loanTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
  },
  interestRate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  balanceLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  overpayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 14,
  },
  overpayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },

  // Details Card
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8b5cf6',
  },

  // Payments List
  paymentsList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  regularIcon: {
    backgroundColor: '#dcfce7',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  paymentDate: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
});
