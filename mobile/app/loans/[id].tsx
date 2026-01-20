/**
 * LoanDetailScreen - Detailed view of a loan with overpayment functionality
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  // Schedule expansion state: -1 = initial (6 months), 0 = until Dec this year, 1 = until Dec next year, etc.
  const [targetDecemberYear, setTargetDecemberYear] = useState(-1);

  // Celebration state
  const addCelebration = useGamificationStore((s) => s.addCelebration);
  const pendingCelebration = useGamificationStore((s) => s.pendingCelebrations[0] || null);
  const dismissCelebration = useGamificationStore((s) => s.dismissCelebration);

  // Handle celebration dismiss - go back to home if loan was paid off
  const handleCelebrationDismiss = useCallback(() => {
    // Check type before dismissing since dismissCelebration clears the celebration
    const wasMortgagePayoff = pendingCelebration?.type === 'mortgage_paid_off';
    dismissCelebration();
    // If this was a mortgage payoff celebration, go back to home
    if (wasMortgagePayoff) {
      router.back();
    }
  }, [dismissCelebration, pendingCelebration, router]);

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

  const handleExpandSchedule = () => {
    const currentYear = new Date().getFullYear();
    setTargetDecemberYear((prev) => {
      if (prev === -1) {
        // First expansion: show until December of current year
        return currentYear;
      } else {
        // Next expansions: show until December of next year
        return prev + 1;
      }
    });
  };

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

  const formatMonthShort = (month: number, year: number) => {
    const monthNames = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
    return `${monthNames[month - 1]} ${year}`;
  };

  // Calculate loan end date
  const loanEndDate = useMemo(() => {
    if (!loan) return null;
    const startDate = new Date(loan.start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + loan.term_months);
    return { month: endDate.getMonth() + 1, year: endDate.getFullYear() };
  }, [loan]);

  // Calculate remaining months for interest savings calculation
  const remainingMonths = useMemo(() => {
    if (!loan) return 0;
    const startDate = new Date(loan.start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + loan.term_months);
    const now = new Date();
    const monthsRemaining = (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth());
    return Math.max(0, monthsRemaining);
  }, [loan]);

  // Generate payment schedule: 1 month back + months until December of target year
  const paymentSchedule = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const schedule: Array<{
      month: number;
      year: number;
      isPaid: boolean;
      isCurrent: boolean;
      isPast: boolean;
    }> = [];

    // Calculate end offset based on targetDecemberYear
    let endOffset: number;
    if (targetDecemberYear === -1) {
      // Initial state: just show 4 months ahead
      endOffset = 4;
    } else {
      // Show until December of targetDecemberYear
      // Example: if current is Jan 2026 (month 1) and target Dec year is 2026:
      // months until Dec 2026 = (2026 - 2026) * 12 + (12 - 1) = 11
      const yearsAhead = targetDecemberYear - currentYear;
      endOffset = (yearsAhead * 12) + (12 - currentMonth);
    }

    for (let offset = -1; offset <= endOffset; offset++) {
      let month = currentMonth + offset;
      let year = currentYear;

      // Handle year boundaries
      while (month < 1) {
        month += 12;
        year -= 1;
      }
      while (month > 12) {
        month -= 12;
        year += 1;
      }

      // Stop if we've passed the loan end date
      if (loanEndDate) {
        if (year > loanEndDate.year ||
            (year === loanEndDate.year && month > loanEndDate.month)) {
          break;
        }
      }

      // Check if this month is paid
      const isPaid = payments.some(
        (p) => p.covers_month === month && p.covers_year === year
      );

      schedule.push({
        month,
        year,
        isPaid,
        isCurrent: offset === 0,
        isPast: offset < 0,
      });
    }

    return schedule;
  }, [payments, targetDecemberYear, loanEndDate]);

  // Check if we've reached the end of the loan
  const hasMoreMonths = useMemo(() => {
    if (!loanEndDate || paymentSchedule.length === 0) return false;
    const lastMonth = paymentSchedule[paymentSchedule.length - 1];
    return lastMonth.year < loanEndDate.year ||
           (lastMonth.year === loanEndDate.year && lastMonth.month < loanEndDate.month);
  }, [paymentSchedule, loanEndDate]);

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen
        options={{
          title: loan.description,
          headerBackTitle: 'Wróć',
          headerShown: false,
        }}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#f97316" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {loan.description}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Celebration Modal */}
      <CelebrationModal
        celebration={pendingCelebration}
        onDismiss={handleCelebrationDismiss}
      />

      {/* Overpayment Modal */}
      <OverpaymentModal
        visible={showOverpaymentModal}
        loanId={loanId}
        loanDescription={loan.description}
        remainingBalance={loan.remaining_balance}
        interestRate={loan.interest_rate}
        remainingMonths={remainingMonths}
        onClose={() => setShowOverpaymentModal(false)}
        onSubmit={handleOverpayment}
        isLoading={isSubmitting}
      />

      <ScrollView
        style={styles.scrollView}
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

          {/* Overpay Button - only show if loan has remaining balance */}
          {loan.remaining_balance > 0 && (
            <Pressable
              style={styles.overpayButton}
              onPress={() => setShowOverpaymentModal(true)}
            >
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.overpayButtonText}>Nadpłać kredyt</Text>
            </Pressable>
          )}
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

        {/* Payment Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Harmonogram rat</Text>
          <View style={styles.scheduleCard}>
            {paymentSchedule.map((item) => (
              <View
                key={`${item.month}-${item.year}`}
                style={[
                  styles.scheduleListItem,
                  item.isCurrent && styles.scheduleListItemCurrent,
                  item.isPast && !item.isPaid && styles.scheduleListItemPast,
                ]}
              >
                <View style={styles.scheduleListLeft}>
                  <View
                    style={[
                      styles.scheduleStatusIcon,
                      item.isPaid && styles.scheduleStatusPaid,
                      item.isCurrent && !item.isPaid && styles.scheduleStatusCurrent,
                      item.isPast && !item.isPaid && styles.scheduleStatusPast,
                      !item.isPaid && !item.isCurrent && !item.isPast && styles.scheduleStatusFuture,
                    ]}
                  >
                    {item.isPaid ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : item.isCurrent ? (
                      <Ionicons name="time" size={14} color="#f97316" />
                    ) : item.isPast ? (
                      <Ionicons name="help" size={14} color="#9ca3af" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={14} color="#9ca3af" />
                    )}
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.scheduleListMonth,
                        item.isCurrent && styles.scheduleListMonthCurrent,
                        item.isPaid && styles.scheduleListMonthPaid,
                        item.isPast && !item.isPaid && styles.scheduleListMonthPast,
                      ]}
                    >
                      {formatMonthShort(item.month, item.year)}
                    </Text>
                    <Text style={styles.scheduleListStatus}>
                      {item.isPaid
                        ? 'Spłacone'
                        : item.isCurrent
                        ? 'Do zapłaty'
                        : item.isPast
                        ? 'Brak danych'
                        : 'Nadchodzi'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.scheduleListAmount,
                    item.isPaid && styles.scheduleListAmountPaid,
                  ]}
                >
                  {loan ? formatCurrency(loan.monthly_payment) : ''}
                </Text>
              </View>
            ))}

            {/* Show more button */}
            {hasMoreMonths && (
              <Pressable
                style={styles.showMoreButton}
                onPress={handleExpandSchedule}
              >
                <Text style={styles.showMoreText}>Pokaż więcej miesięcy</Text>
                <Ionicons name="chevron-down" size={16} color="#f97316" />
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 16,
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

  // Payment Schedule (List)
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  scheduleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  scheduleListItemCurrent: {
    backgroundColor: '#fff7ed',
  },
  scheduleListItemPast: {
    backgroundColor: '#f9fafb',
  },
  scheduleListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleStatusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleStatusPaid: {
    backgroundColor: '#22c55e',
  },
  scheduleStatusCurrent: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f97316',
  },
  scheduleStatusPast: {
    backgroundColor: '#e5e7eb',
  },
  scheduleStatusFuture: {
    backgroundColor: '#f3f4f6',
  },
  scheduleListMonth: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  scheduleListMonthCurrent: {
    fontWeight: '600',
    color: '#f97316',
  },
  scheduleListMonthPaid: {
    color: '#22c55e',
  },
  scheduleListMonthPast: {
    color: '#6b7280',
  },
  scheduleListStatus: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  scheduleListAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  scheduleListAmountPaid: {
    color: '#22c55e',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f97316',
  },
});
