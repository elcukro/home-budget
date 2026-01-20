import { useState, useEffect, useCallback } from 'react';
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
import type { FinancialFreedomResponse, DashboardSummary } from '@/lib/api';

// Step definitions for Polish FIRE journey
const STEPS = [
  {
    id: 1,
    name: 'Fundusz Awaryjny',
    shortName: 'Fundusz',
    title: 'Fundusz Awaryjny 3 000 zł',
    description: 'Zaoszczędź 3 000 zł jako początkowy fundusz awaryjny, aby pokryć nieoczekiwane wydatki bez zadłużania się.',
    icon: 'shield-checkmark' as const,
    hasAmount: true,
  },
  {
    id: 2,
    name: 'Spłata Długów',
    shortName: 'Długi',
    title: 'Spłać Wszystkie Długi',
    description: 'Spłać wszystkie długi (oprócz kredytu hipotecznego) metodą kuli śnieżnej, płacąc od najmniejszego do największego.',
    icon: 'trending-down' as const,
    hasAmount: false,
  },
  {
    id: 3,
    name: 'Pełny Fundusz',
    shortName: 'Rezerwa',
    title: '6 Miesięcy Wydatków',
    description: 'Zaoszczędź 6 miesięcy wydatków w pełnym funduszu awaryjnym.',
    icon: 'wallet' as const,
    hasAmount: true,
  },
  {
    id: 4,
    name: 'IKE/IKZE/PPK',
    shortName: 'Emerytura',
    title: '15% na Przyszłość',
    description: 'Inwestuj 15% dochodu w długoterminowe oszczędności: PPK (dopłata pracodawcy), IKE (limit 2026: 28 260 PLN, brak podatku Belki), IKZE (limit: 11 304 PLN lub 16 956 PLN dla JDG, odliczenie od podatku).',
    icon: 'trending-up' as const,
    hasAmount: false,
  },
  {
    id: 5,
    name: 'Przyszłość Dziecka',
    shortName: 'Dziecko',
    title: 'Start Dziecka w Dorosłość',
    description: 'W Polsce studia są darmowe, ale młody człowiek potrzebuje: wkładu własnego na mieszkanie (30-50 tys. PLN), prawa jazdy, pierwszego samochodu, zabezpieczenia na start.',
    icon: 'school' as const,
    hasAmount: false,
    canSkip: true,
  },
  {
    id: 6,
    name: 'Spłata Hipoteki',
    shortName: 'Hipoteka',
    title: 'Wcześniejsza Spłata Hipoteki',
    description: 'Spłać wcześniej kredyt hipoteczny. Każda nadpłata skraca okres kredytowania i zmniejsza całkowity koszt odsetek.',
    icon: 'home' as const,
    hasAmount: true,
  },
  {
    id: 7,
    name: 'FIRE Number',
    shortName: 'FIRE',
    title: 'Osiągnij FIRE Number',
    description: 'Zbuduj majątek pozwalający na niezależność finansową. FIRE Number = roczne wydatki × 25 (zasada 4%). Gdy osiągniesz tę kwotę, możesz żyć z odsetek.',
    icon: 'flame' as const,
    hasAmount: false,
  },
];

// Mock data for dev mode
const MOCK_FINANCIAL_FREEDOM: FinancialFreedomResponse = {
  userId: 'dev-user',
  steps: [
    { id: 1, titleKey: '', descriptionKey: '', isCompleted: true, progress: 100, targetAmount: 3000, currentAmount: 3000, completionDate: '2025-06-15', notes: '' },
    { id: 2, titleKey: '', descriptionKey: '', isCompleted: true, progress: 100, targetAmount: null, currentAmount: null, completionDate: '2025-09-01', notes: '' },
    { id: 3, titleKey: '', descriptionKey: '', isCompleted: true, progress: 100, targetAmount: 9000, currentAmount: 53000, completionDate: '2025-12-01', notes: '' },
    { id: 4, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
    { id: 5, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
    { id: 6, titleKey: '', descriptionKey: '', isCompleted: false, progress: 95, targetAmount: 980000, currentAmount: 927690, completionDate: null, notes: '' },
    { id: 7, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
  ],
  startDate: '2025-01-01',
  lastUpdated: '2026-01-20',
};

export default function GoalsScreen() {
  const { user, token } = useAuthStore();
  const api = useApi();
  const [financialFreedom, setFinancialFreedom] = useState<FinancialFreedomResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDevMode = token === 'dev-token-for-testing';

  const fetchData = useCallback(async () => {
    if (!api) return;

    if (isDevMode) {
      setFinancialFreedom(MOCK_FINANCIAL_FREEDOM);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);

      // Fetch financial freedom data (with calculated values) and dashboard data in parallel
      const [ffData, summaryData] = await Promise.all([
        api.financialFreedom.getCalculated().catch(() => null),
        user?.email ? api.dashboard.getSummary(user.email).catch(() => null) : Promise.resolve(null),
      ]);

      if (ffData) {
        setFinancialFreedom(ffData);
      } else {
        setFinancialFreedom(MOCK_FINANCIAL_FREEDOM);
      }

      if (summaryData) {
        setDashboardData(summaryData);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setFinancialFreedom(MOCK_FINANCIAL_FREEDOM);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api, isDevMode, user?.email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate completed steps count
  const completedCount = financialFreedom?.steps.filter((s) => s.isCompleted).length || 0;

  // Find current active step
  const getCurrentStep = (): number => {
    if (!financialFreedom) return 1;
    const firstIncomplete = financialFreedom.steps.find((s) => !s.isCompleted);
    return firstIncomplete?.id || 7;
  };

  const currentStep = getCurrentStep();

  // Get step status based on completion and progress
  const getStepStatus = (step: FinancialFreedomResponse['steps'][0]): 'completed' | 'in_progress' | 'not_started' => {
    if (step.isCompleted) return 'completed';
    if (step.progress > 0) return 'in_progress';
    return 'not_started';
  };

  // Get mortgage data from dashboard for step 6
  const getMortgageData = () => {
    if (!dashboardData?.loans) return null;
    // Find mortgage (usually the largest loan or one with "hipoteka" or "dom" in description)
    const mortgage = dashboardData.loans.find(l =>
      l.description.toLowerCase().includes('hipote') ||
      l.description.toLowerCase().includes('dom') ||
      l.description.toLowerCase().includes('mieszka')
    ) || dashboardData.loans[0];
    return mortgage;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const mortgage = getMortgageData();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.headerTitle}>Fire</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Droga do Wolności Finansowej
            </Text>
            <Text style={styles.headerDescription}>
              Plan FIRE dostosowany do polskich realiów: IKE, IKZE, PPK, ulgi podatkowe.
            </Text>
          </View>

          {/* Progress Tracker - Static (no swipe) */}
          <View style={styles.progressTracker}>
            <Text style={styles.trackerTitle}>Śledzenie Postępu 7 Kroków</Text>
            <View style={styles.trackerContent}>
              {STEPS.map((stepDef, index) => {
                const step = financialFreedom?.steps.find((s) => s.id === stepDef.id);
                const status = step ? getStepStatus(step) : 'not_started';
                const isCompleted = status === 'completed';
                const isInProgress = status === 'in_progress';
                const isNotStarted = status === 'not_started';

                return (
                  <View key={stepDef.id} style={styles.trackerStep}>
                    <View
                      style={[
                        styles.trackerCircle,
                        isCompleted && styles.trackerCircleCompleted,
                        isInProgress && styles.trackerCircleInProgress,
                        isNotStarted && styles.trackerCircleNotStarted,
                      ]}
                    >
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : (
                        <Text
                          style={[
                            styles.trackerNumber,
                            (isInProgress || isNotStarted) && styles.trackerNumberWhite,
                          ]}
                        >
                          {stepDef.id}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.trackerLabel,
                        isCompleted && styles.trackerLabelCompleted,
                        isInProgress && styles.trackerLabelInProgress,
                        isNotStarted && styles.trackerLabelNotStarted,
                      ]}
                      numberOfLines={2}
                    >
                      {stepDef.shortName}
                    </Text>
                    {index < STEPS.length - 1 && (
                      <View
                        style={[
                          styles.trackerLine,
                          isCompleted && styles.trackerLineCompleted,
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Current Step Banner */}
          {currentStep <= 7 && (
            <View style={styles.currentStepBanner}>
              <View style={styles.currentStepNumber}>
                <Text style={styles.currentStepNumberText}>{currentStep}</Text>
              </View>
              <View style={styles.currentStepContent}>
                <Text style={styles.currentStepTitle}>
                  Krok {currentStep}: {STEPS[currentStep - 1].title}
                </Text>
                <Text style={styles.currentStepDescription} numberOfLines={2}>
                  {STEPS[currentStep - 1].description}
                </Text>
              </View>
            </View>
          )}

          {/* Steps List */}
          <View style={styles.stepsSection}>
            <Text style={styles.sectionTitle}>Twój Postęp</Text>

            {financialFreedom?.steps.map((step) => {
              const stepDef = STEPS[step.id - 1];
              const status = getStepStatus(step);
              const isCompleted = status === 'completed';
              const isInProgress = status === 'in_progress';
              const isNotStarted = status === 'not_started';

              // Special handling for step 6 (mortgage) - use real loan data
              const isMortgageStep = step.id === 6;
              const mortgageProgress = isMortgageStep && mortgage ? mortgage.progress : step.progress;
              const mortgageRemaining = isMortgageStep && mortgage ? mortgage.balance : null;
              const mortgageTotal = isMortgageStep && mortgage ? mortgage.totalAmount : step.targetAmount;

              return (
                <View
                  key={step.id}
                  style={[
                    styles.stepCard,
                    isCompleted && styles.stepCardCompleted,
                    isInProgress && styles.stepCardInProgress,
                    isNotStarted && styles.stepCardNotStarted,
                  ]}
                >
                  <View style={styles.stepCardHeader}>
                    <View style={styles.stepCardTitleRow}>
                      <View
                        style={[
                          styles.stepIcon,
                          isCompleted && styles.stepIconCompleted,
                          isInProgress && styles.stepIconInProgress,
                          isNotStarted && styles.stepIconNotStarted,
                        ]}
                      >
                        <Ionicons
                          name={stepDef.icon}
                          size={20}
                          color={isCompleted ? '#fff' : isInProgress ? '#fff' : isNotStarted ? '#fff' : '#6b7280'}
                        />
                      </View>
                      <View style={styles.stepCardTitleContent}>
                        <Text style={styles.stepCardTitle}>
                          Krok {step.id}: {stepDef.title}
                        </Text>
                        <Text style={styles.stepCardDescription}>
                          {stepDef.description}
                        </Text>
                      </View>
                    </View>

                    {/* Progress indicator */}
                    {isInProgress && (
                      <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>
                          {isMortgageStep && mortgage ? Math.round(mortgageProgress) : Math.round(step.progress)}%
                        </Text>
                      </View>
                    )}

                    {/* Not started indicator */}
                    {isNotStarted && (
                      <View style={styles.notStartedBadge}>
                        <Text style={styles.notStartedBadgeText}>0%</Text>
                      </View>
                    )}

                    {isCompleted && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                      </View>
                    )}
                  </View>

                  {/* Step-specific content */}
                  {step.id === 1 && (
                    <View style={styles.stepDetails}>
                      <View style={styles.stepDetailRow}>
                        <Text style={styles.stepDetailLabel}>Cel:</Text>
                        <Text style={styles.stepDetailValue}>
                          {formatCurrency(step.targetAmount || 3000)}
                        </Text>
                      </View>
                      <View style={styles.stepDetailRow}>
                        <Text style={styles.stepDetailLabel}>Aktualnie:</Text>
                        <Text style={[styles.stepDetailValue, isCompleted && styles.stepDetailValueSuccess]}>
                          {formatCurrency(step.currentAmount || 0)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {step.id === 2 && isCompleted && (
                    <View style={styles.debtFreeMessage}>
                      <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                      <Text style={styles.debtFreeText}>Jesteś wolny od długów!</Text>
                    </View>
                  )}

                  {step.id === 3 && (
                    <View style={styles.stepDetails}>
                      <View style={styles.stepDetailRow}>
                        <Text style={styles.stepDetailLabel}>Cel:</Text>
                        <Text style={styles.stepDetailValue}>
                          {formatCurrency(step.targetAmount || 9000)}
                        </Text>
                      </View>
                      <View style={styles.stepDetailRow}>
                        <Text style={styles.stepDetailLabel}>Aktualnie:</Text>
                        <Text style={[styles.stepDetailValue, (step.currentAmount || 0) >= (step.targetAmount || 9000) && styles.stepDetailValueSuccess]}>
                          {formatCurrency(step.currentAmount || 0)}
                        </Text>
                      </View>
                      {!isCompleted && (
                        <Text style={styles.stepHint}>
                          Oblicz swoje miesięczne wydatki i pomnóż przez 6.
                        </Text>
                      )}
                    </View>
                  )}

                  {step.id === 4 && !isCompleted && (
                    <View style={styles.stepDetails}>
                      <View style={styles.stepDetailRow}>
                        <Text style={styles.stepDetailLabel}>Cel:</Text>
                        <Text style={styles.stepDetailValue}>15% dochodu</Text>
                      </View>
                      <View style={styles.stepDetailRow}>
                        <Text style={styles.stepDetailLabel}>Aktualnie:</Text>
                        <Text style={styles.stepDetailValue}>{step.progress || 0}% dochodu</Text>
                      </View>
                    </View>
                  )}

                  {step.id === 5 && stepDef.canSkip && !isCompleted && (
                    <TouchableOpacity style={styles.skipButton}>
                      <Text style={styles.skipButtonText}>Nie dotyczy</Text>
                    </TouchableOpacity>
                  )}

                  {step.id === 6 && !isCompleted && (isMortgageStep && mortgage || step.progress > 0) && (
                    <View style={styles.stepDetails}>
                      {/* Circular progress for mortgage */}
                      <View style={styles.mortgageProgress}>
                        <View style={styles.mortgageInfo}>
                          <View style={styles.stepDetailRow}>
                            <Text style={styles.stepDetailLabel}>Pozostały Kredyt:</Text>
                            <Text style={styles.stepDetailValue}>
                              {formatCurrency(mortgageRemaining || (mortgageTotal || 0) - (step.currentAmount || 0))}
                            </Text>
                          </View>
                          <View style={styles.stepDetailRow}>
                            <Text style={styles.stepDetailLabel}>Pierwotny Kredyt:</Text>
                            <Text style={styles.stepDetailValue}>
                              {formatCurrency(mortgageTotal || 0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.stepHint}>
                        Nadpłata 500 PLN/mies. przy kredycie 400 tys. PLN skraca spłatę o 7 lat i oszczędza ~87 tys. PLN odsetek.
                      </Text>
                    </View>
                  )}

                  {step.id === 7 && !isCompleted && (
                    <View style={styles.stepDetails}>
                      <Text style={styles.stepHint}>
                        Postęp do FIRE Number
                      </Text>
                    </View>
                  )}

                  {/* Progress bar for in-progress steps */}
                  {isInProgress && step.progress > 0 && step.progress < 100 && (
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[styles.progressFill, { width: `${Math.min(step.progress, 100)}%` }]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Completion date */}
                  {isCompleted && step.completionDate && (
                    <View style={styles.completionInfo}>
                      <Text style={styles.completionText}>
                        Ukończono {new Date(step.completionDate).toLocaleDateString('pl-PL', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Summary Section */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Podsumowanie Podróży</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ogólny Postęp</Text>
                <Text style={styles.summaryValue}>
                  {completedCount} / 7 ({Math.round((completedCount / 7) * 100)}%)
                </Text>
              </View>

              <View style={styles.summaryProgressBar}>
                <View
                  style={[
                    styles.summaryProgressFill,
                    { width: `${(completedCount / 7) * 100}%` },
                  ]}
                />
              </View>

              <View style={styles.summaryDates}>
                <View style={styles.summaryDateItem}>
                  <Text style={styles.summaryDateLabel}>Rozpoczęto</Text>
                  <Text style={styles.summaryDateValue}>
                    {financialFreedom?.startDate
                      ? new Date(financialFreedom.startDate).toLocaleDateString('pl-PL')
                      : '-'}
                  </Text>
                </View>
                <View style={styles.summaryDateItem}>
                  <Text style={styles.summaryDateLabel}>Ostatnia aktualizacja</Text>
                  <Text style={styles.summaryDateValue}>
                    {financialFreedom?.lastUpdated
                      ? new Date(financialFreedom.lastUpdated).toLocaleDateString('pl-PL')
                      : '-'}
                  </Text>
                </View>
              </View>

              {currentStep <= 7 && (
                <View style={styles.currentFocus}>
                  <Text style={styles.currentFocusLabel}>Aktualny Fokus</Text>
                  <Text style={styles.currentFocusValue}>
                    Krok {currentStep}: {STEPS[currentStep - 1].title}
                  </Text>
                  <View style={styles.focusProgressBar}>
                    <View
                      style={[
                        styles.focusProgressFill,
                        { width: `${financialFreedom?.steps[currentStep - 1]?.progress || 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.focusProgressText}>
                    {financialFreedom?.steps[currentStep - 1]?.progress || 0}%
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Insights */}
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>Spostrzeżenia Finansowe</Text>
            <View style={styles.insightCard}>
              <View style={styles.insightItem}>
                <Ionicons name="flag" size={16} color="#f97316" />
                <Text style={styles.insightText}>
                  Następny kamień milowy: Krok {currentStep}: {STEPS[currentStep - 1]?.title}
                </Text>
              </View>
              {currentStep === 4 && (
                <View style={styles.insightItem}>
                  <Ionicons name="bulb" size={16} color="#eab308" />
                  <Text style={styles.insightText}>
                    Sugestia: Kolejność - najpierw maksymalizuj PPK (darmowe pieniądze od pracodawcy!), potem IKE, na końcu IKZE.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}
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
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Header
  headerSection: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fireEmoji: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  // Progress Tracker
  progressTracker: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'visible',
  },
  trackerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  trackerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    overflow: 'visible',
  },
  trackerStep: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },
  trackerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  trackerCircleCompleted: {
    backgroundColor: '#22c55e', // Green - completed
  },
  trackerCircleInProgress: {
    backgroundColor: '#f97316', // Orange - in progress
  },
  trackerCircleNotStarted: {
    backgroundColor: '#9ca3af', // Gray - not started
  },
  trackerNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  trackerNumberWhite: {
    color: '#fff',
  },
  trackerLabel: {
    fontSize: 9,
    color: '#9ca3af',
    textAlign: 'center',
  },
  trackerLabelCompleted: {
    color: '#22c55e',
    fontWeight: '600',
  },
  trackerLabelInProgress: {
    color: '#f97316',
    fontWeight: '600',
  },
  trackerLabelNotStarted: {
    color: '#9ca3af',
  },
  trackerLine: {
    position: 'absolute',
    top: 13,
    left: 14,
    right: -14,
    height: 2,
    backgroundColor: '#d1d5db',
    zIndex: -1,
  },
  trackerLineCompleted: {
    backgroundColor: '#22c55e',
  },

  // Current Step Banner
  currentStepBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  currentStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentStepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  currentStepContent: {
    flex: 1,
  },
  currentStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 2,
  },
  currentStepDescription: {
    fontSize: 12,
    color: '#9a3412',
    lineHeight: 16,
  },

  // Steps Section
  stepsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stepCardCompleted: {
    backgroundColor: '#f0fdf4', // Light green
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stepCardInProgress: {
    backgroundColor: '#fff7ed', // Light orange
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  stepCardNotStarted: {
    backgroundColor: '#f9fafb', // Light gray
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCardTitleRow: {
    flex: 1,
    flexDirection: 'row',
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepIconCompleted: {
    backgroundColor: '#22c55e', // Green
  },
  stepIconInProgress: {
    backgroundColor: '#f97316', // Orange
  },
  stepIconNotStarted: {
    backgroundColor: '#9ca3af', // Gray
  },
  stepCardTitleContent: {
    flex: 1,
  },
  stepCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  stepCardDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  progressBadge: {
    backgroundColor: '#f97316', // Orange for in progress
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  notStartedBadge: {
    backgroundColor: '#9ca3af', // Gray for not started
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  notStartedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  completedBadge: {
    marginLeft: 8,
  },

  // Step Details
  stepDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  stepDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stepDetailLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  stepDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  stepDetailValueSuccess: {
    color: '#22c55e',
  },
  stepHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  debtFreeMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  debtFreeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  skipButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  skipButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  mortgageProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mortgageInfo: {
    flex: 1,
  },

  // Progress Bar
  progressBarContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#fed7aa',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 4,
  },
  completionInfo: {
    marginTop: 8,
  },
  completionText: {
    fontSize: 11,
    color: '#22c55e',
  },

  // Summary Section
  summarySection: {
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  summaryProgressBar: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  summaryProgressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 5,
  },
  summaryDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryDateItem: {},
  summaryDateLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  summaryDateValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  currentFocus: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
  },
  currentFocusLabel: {
    fontSize: 11,
    color: '#9a3412',
    marginBottom: 4,
  },
  currentFocusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 8,
  },
  focusProgressBar: {
    height: 6,
    backgroundColor: '#fed7aa',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  focusProgressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  focusProgressText: {
    fontSize: 12,
    color: '#ea580c',
    textAlign: 'right',
  },

  // Insights Section
  insightsSection: {
    marginBottom: 20,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
});
