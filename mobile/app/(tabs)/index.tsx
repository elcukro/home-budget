import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/hooks/useApi';
import MetricCard from '@/components/MetricCard';
import LoanCard from '@/components/LoanCard';
import StreakCounter from '@/components/StreakCounter';
import { LevelProgressBar } from '@/components/LevelProgress';
import { BadgeRow, ProgressBadge } from '@/components/AchievementBadge';
import CelebrationModal from '@/components/CelebrationModal';
import {
  useGamificationStore,
  usePendingCelebration,
  useStreak,
  useLevel,
  useRecentBadges,
  useNearestBadges,
} from '@/stores/gamification';
import type { DashboardSummary } from '@/lib/api';

// Mock data for dev mode
const MOCK_SUMMARY: DashboardSummary = {
  total_monthly_income: 12500,
  total_monthly_expenses: 8750,
  total_monthly_loan_payments: 2100,
  monthly_balance: 1650,
  savings_rate: 0.132,
  debt_to_income: 0.168,
  income_distribution: [],
  expense_distribution: [],
  cash_flow: [
    { month: '2025-12', income: 12000, expenses: 8950, loanPayments: 2100, netFlow: 950 },
    { month: '2026-01', income: 12500, expenses: 8750, loanPayments: 2100, netFlow: 1650 },
  ],
  loans: [
    {
      id: '1',
      description: 'Kredyt hipoteczny',
      balance: 180000,
      monthlyPayment: 1800,
      interestRate: 7.5,
      progress: 45,
      totalAmount: 327273,
    },
    {
      id: '2',
      description: 'Kredyt samochodowy',
      balance: 12000,
      monthlyPayment: 300,
      interestRate: 9.9,
      progress: 80,
      totalAmount: 60000,
    },
  ],
  activities: [],
  total_savings_balance: 15000,
  monthly_savings: 500,
  savings_goals: [],
};

interface DeltaValues {
  income: number;
  expenses: number;
  loanPayments: number;
  netCashflow: number;
  savingsRate: number;
  debtToIncome: number;
}

export default function DashboardScreen() {
  const { user, token } = useAuthStore();
  const api = useApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gamification state - use stable selectors
  const fetchOverview = useGamificationStore((s) => s.fetchOverview);
  const checkIn = useGamificationStore((s) => s.checkIn);
  const dismissCelebration = useGamificationStore((s) => s.dismissCelebration);
  const pendingCelebration = usePendingCelebration();
  const streak = useStreak();
  const level = useLevel();
  const recentBadges = useRecentBadges(4);
  const nearestBadges = useNearestBadges(2);

  // Check if we're in dev mode
  const isDevMode = token === 'dev-token-for-testing';

  const fetchDashboard = useCallback(async () => {
    if (!user?.email || !api) return;

    // Use mock data in dev mode
    if (isDevMode) {
      setSummary(MOCK_SUMMARY);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);

      // Use the centralized summary endpoint - all calculations are done server-side
      // This handles recurring items, active date ranges, loan payments, etc. correctly
      const data = await api.dashboard.getSummary(user.email);

      setSummary(data);

      // Fetch gamification data
      await fetchOverview();
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      setError('Nie udało się załadować danych');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.email, api, isDevMode, fetchOverview]);

  // Perform daily check-in when app opens - use ref to avoid dependency issues
  const hasCheckedIn = useRef(false);
  useEffect(() => {
    if (!isLoading && !isDevMode && api && !hasCheckedIn.current) {
      hasCheckedIn.current = true;
      // Delay check-in slightly to not block initial render
      const timer = setTimeout(() => {
        checkIn();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isDevMode, api, checkIn]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  // Calculate deltas from cash flow data
  const deltas = useMemo((): DeltaValues => {
    if (!summary || !summary.cash_flow || summary.cash_flow.length < 2) {
      return {
        income: 0,
        expenses: 0,
        loanPayments: 0,
        netCashflow: 0,
        savingsRate: 0,
        debtToIncome: 0,
      };
    }

    const entries = [...summary.cash_flow]
      .map((item) => {
        const [year, month] = item.month.split('-').map(Number);
        const entryDate = new Date(year, (month || 1) - 1, 1);
        return { ...item, entryDate };
      })
      .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());

    if (entries.length < 2) {
      return {
        income: 0,
        expenses: 0,
        loanPayments: 0,
        netCashflow: 0,
        savingsRate: 0,
        debtToIncome: 0,
      };
    }

    const current = entries[entries.length - 1];
    const previous = entries[entries.length - 2];

    const currentSavingsRate = current.income
      ? (current.income - current.expenses - current.loanPayments) / current.income
      : 0;
    const previousSavingsRate = previous.income
      ? (previous.income - previous.expenses - previous.loanPayments) / previous.income
      : 0;

    const currentDTI = current.income ? current.loanPayments / current.income : 0;
    const previousDTI = previous.income ? previous.loanPayments / previous.income : 0;

    return {
      income: current.income - previous.income,
      expenses: current.expenses - previous.expenses,
      loanPayments: current.loanPayments - previous.loanPayments,
      netCashflow: current.netFlow - previous.netFlow,
      savingsRate: currentSavingsRate - previousSavingsRate,
      debtToIncome: currentDTI - previousDTI,
    };
  }, [summary]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <>
      {/* Celebration Modal */}
      <CelebrationModal
        celebration={pendingCelebration}
        onDismiss={dismissCelebration}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Welcome with Streak */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeText}>
              <Text style={styles.greeting}>Cześć, {user?.name || 'User'}!</Text>
              <Text style={styles.date}>
                {new Date().toLocaleDateString('pl-PL', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>
            {!isDevMode && (
              <StreakCounter
                currentStreak={streak.current}
                longestStreak={streak.longest}
                compact
              />
            )}
          </View>
        </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Metrics Grid - 2x3 */}
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Podsumowanie miesiąca</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <MetricCard
                    title="Przychody"
                    value={formatCurrency(summary?.total_monthly_income || 0)}
                    delta={deltas.income}
                    deltaLabel="vs poprz."
                    color="green"
                    icon="wallet-outline"
                    trend="positive"
                    compact
                  />
                </View>
                <View style={styles.metricItem}>
                  <MetricCard
                    title="Wydatki"
                    value={formatCurrency(summary?.total_monthly_expenses || 0)}
                    delta={deltas.expenses}
                    deltaLabel="vs poprz."
                    color="red"
                    icon="cart-outline"
                    trend="negative"
                    compact
                  />
                </View>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <MetricCard
                    title="Raty kredytów"
                    value={formatCurrency(summary?.total_monthly_loan_payments || 0)}
                    delta={deltas.loanPayments}
                    deltaLabel="vs poprz."
                    color="orange"
                    icon="business-outline"
                    trend="negative"
                    compact
                  />
                </View>
                <View style={styles.metricItem}>
                  <MetricCard
                    title="Bilans netto"
                    value={formatCurrency(summary?.monthly_balance || 0)}
                    delta={deltas.netCashflow}
                    deltaLabel="vs poprz."
                    color={(summary?.monthly_balance || 0) >= 0 ? 'green' : 'red'}
                    icon="trending-up-outline"
                    trend="positive"
                    compact
                  />
                </View>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <MetricCard
                    title="Stopa oszczędności"
                    value={formatPercent(summary?.savings_rate || 0)}
                    delta={deltas.savingsRate}
                    deltaLabel="vs poprz."
                    color={(summary?.savings_rate || 0) >= 0.2 ? 'green' : 'orange'}
                    icon="save-outline"
                    trend="positive"
                    isPercentage
                    compact
                  />
                </View>
                <View style={styles.metricItem}>
                  <MetricCard
                    title="DTI (dług/dochód)"
                    value={formatPercent(summary?.debt_to_income || 0)}
                    delta={deltas.debtToIncome}
                    deltaLabel="vs poprz."
                    color={(summary?.debt_to_income || 0) <= 0.36 ? 'green' : 'red'}
                    icon="analytics-outline"
                    trend="negative"
                    isPercentage
                    compact
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Loans Section */}
          {summary?.loans && summary.loans.length > 0 && (
            <View style={styles.loansSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="business" size={20} color="#f97316" />
                  <Text style={styles.sectionTitle}>Twoje kredyty</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {summary.loans.length} {summary.loans.length === 1 ? 'kredyt' : 'kredyty'}
                </Text>
              </View>
              {summary.loans.map((loan) => (
                <LoanCard key={loan.id} loan={loan} formatCurrency={formatCurrency} />
              ))}
            </View>
          )}

          {/* Savings Summary */}
          {(summary?.total_savings_balance || 0) > 0 && (
            <View style={styles.savingsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="wallet" size={20} color="#22c55e" />
                  <Text style={styles.sectionTitle}>Oszczędności</Text>
                </View>
              </View>
              <View style={styles.savingsCard}>
                <View style={styles.savingsRow}>
                  <View style={styles.savingsItem}>
                    <Text style={styles.savingsLabel}>Całkowite oszczędności</Text>
                    <Text style={styles.savingsValue}>
                      {formatCurrency(summary?.total_savings_balance || 0)}
                    </Text>
                  </View>
                  <View style={styles.savingsItem}>
                    <Text style={styles.savingsLabel}>W tym miesiącu</Text>
                    <Text
                      style={[
                        styles.savingsValue,
                        {
                          color:
                            (summary?.monthly_savings || 0) >= 0 ? '#22c55e' : '#ef4444',
                        },
                      ]}
                    >
                      {(summary?.monthly_savings || 0) >= 0 ? '+' : ''}
                      {formatCurrency(summary?.monthly_savings || 0)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Gamification Section - Level & XP */}
          {!isDevMode && level.totalXp > 0 && (
            <View style={styles.gamificationSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="trophy" size={20} color="#f97316" />
                  <Text style={styles.sectionTitle}>Twój postęp</Text>
                </View>
              </View>
              <LevelProgressBar
                level={level.level}
                levelName={level.name}
                totalXp={level.totalXp}
                xpForNext={level.xpForNext}
                xpProgress={level.xpProgress}
              />
            </View>
          )}

          {/* Recent Achievements */}
          {!isDevMode && recentBadges.length > 0 && (
            <View style={styles.achievementsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="medal" size={20} color="#f97316" />
                  <Text style={styles.sectionTitle}>Odznaki</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {recentBadges.length} zdobyte
                </Text>
              </View>
              <View style={styles.badgesContainer}>
                <BadgeRow badges={recentBadges} maxVisible={4} />
              </View>
            </View>
          )}

          {/* Nearest Badges (Progress) */}
          {!isDevMode && nearestBadges.length > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="flag" size={20} color="#3b82f6" />
                  <Text style={styles.sectionTitle}>Do zdobycia</Text>
                </View>
              </View>
              <View style={styles.progressBadges}>
                {nearestBadges.map((progress) => (
                  <ProgressBadge key={progress.badge_id} progress={progress} />
                ))}
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Szybkie akcje</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.expenseButton]}>
                <Ionicons name="remove-circle-outline" size={24} color="#ef4444" />
                <Text style={styles.actionButtonLabel}>Dodaj wydatek</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.incomeButton]}>
                <Ionicons name="add-circle-outline" size={24} color="#22c55e" />
                <Text style={styles.actionButtonLabel}>Dodaj przychód</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
      </ScrollView>
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
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeText: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
  metricsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  metricsGrid: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flex: 1,
  },
  loansSection: {
    marginBottom: 24,
  },
  savingsSection: {
    marginBottom: 24,
  },
  savingsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  savingsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  savingsItem: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
  },
  savingsLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  savingsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  quickActions: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  expenseButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  incomeButton: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  actionButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  // Gamification styles
  gamificationSection: {
    marginBottom: 24,
  },
  achievementsSection: {
    marginBottom: 24,
  },
  badgesContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressBadges: {
    gap: 12,
  },
});
