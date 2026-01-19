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
import type { FinancialFreedomStep, FinancialFreedomResponse } from '@/lib/api';

// Step names in Polish
const STEP_NAMES: Record<number, { name: string; description: string; icon: keyof typeof Ionicons.glyphMap }> = {
  1: {
    name: 'Fundusz awaryjny 1000 zł',
    description: 'Odłóż 1000 zł na nagłe wydatki',
    icon: 'shield-checkmark',
  },
  2: {
    name: 'Spłata długów (kula śnieżna)',
    description: 'Spłać wszystkie długi poza hipoteką',
    icon: 'trending-down',
  },
  3: {
    name: 'Pełny fundusz awaryjny',
    description: '3-6 miesięcy wydatków w rezerwie',
    icon: 'wallet',
  },
  4: {
    name: 'Inwestuj 15% na emeryturę',
    description: 'IKE, IKZE, PPK lub inne konta emerytalne',
    icon: 'trending-up',
  },
  5: {
    name: 'Oszczędzaj na studia dzieci',
    description: 'Fundusz edukacyjny dla dzieci',
    icon: 'school',
  },
  6: {
    name: 'Spłać kredyt hipoteczny',
    description: 'Nadpłacaj i spłać mieszkanie',
    icon: 'home',
  },
  7: {
    name: 'Buduj majątek i dawaj',
    description: 'Inwestuj i wspieraj innych',
    icon: 'gift',
  },
};

// Mock data for dev mode
const MOCK_FINANCIAL_FREEDOM: FinancialFreedomResponse = {
  userId: 'dev-user',
  steps: [
    { id: 1, titleKey: '', descriptionKey: '', isCompleted: true, progress: 100, targetAmount: 1000, currentAmount: 1000, completionDate: '2025-06-15', notes: '' },
    { id: 2, titleKey: '', descriptionKey: '', isCompleted: false, progress: 65, targetAmount: 25000, currentAmount: 16250, completionDate: null, notes: '' },
    { id: 3, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: 18000, currentAmount: 0, completionDate: null, notes: '' },
    { id: 4, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
    { id: 5, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
    { id: 6, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
    { id: 7, titleKey: '', descriptionKey: '', isCompleted: false, progress: 0, targetAmount: null, currentAmount: null, completionDate: null, notes: '' },
  ],
  startDate: '2025-01-01',
  lastUpdated: '2026-01-19',
};

export default function GoalsScreen() {
  const { user, token } = useAuthStore();
  const api = useApi();
  const [financialFreedom, setFinancialFreedom] = useState<FinancialFreedomResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDevMode = token === 'dev-token-for-testing';

  const fetchFinancialFreedom = useCallback(async () => {
    if (!api) return;

    if (isDevMode) {
      setFinancialFreedom(MOCK_FINANCIAL_FREEDOM);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setError(null);
      const data = await api.financialFreedom.get();
      setFinancialFreedom(data);
    } catch (err) {
      console.error('Failed to fetch financial freedom:', err);
      // Use mock data as fallback
      setFinancialFreedom(MOCK_FINANCIAL_FREEDOM);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [api, isDevMode]);

  useEffect(() => {
    fetchFinancialFreedom();
  }, [fetchFinancialFreedom]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFinancialFreedom();
  }, [fetchFinancialFreedom]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Find current active step (first non-completed step)
  const getCurrentStep = (): number => {
    if (!financialFreedom) return 1;
    const firstIncomplete = financialFreedom.steps.find((s) => !s.isCompleted);
    return firstIncomplete?.id || 7;
  };

  const currentStep = getCurrentStep();

  // Get step status
  const getStepStatus = (step: FinancialFreedomStep): 'completed' | 'active' | 'locked' => {
    if (step.isCompleted) return 'completed';
    if (step.id === currentStep) return 'active';
    return 'locked';
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
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Baby Steps Dave'a Ramseya</Text>
            <Text style={styles.headerSubtitle}>
              7 kroków do finansowej wolności
            </Text>
            <View style={styles.progressOverview}>
              <Text style={styles.progressLabel}>Twój postęp</Text>
              <Text style={styles.progressValue}>
                Krok {currentStep} z 7
              </Text>
            </View>
          </View>

          {/* Steps List */}
          <View style={styles.stepsContainer}>
            {financialFreedom?.steps.map((step) => {
              const status = getStepStatus(step);
              const stepInfo = STEP_NAMES[step.id];
              const isActive = status === 'active';
              const isCompleted = status === 'completed';
              const isLocked = status === 'locked';

              return (
                <TouchableOpacity
                  key={step.id}
                  style={[
                    styles.stepCard,
                    isActive && styles.stepCardActive,
                    isCompleted && styles.stepCardCompleted,
                    isLocked && styles.stepCardLocked,
                  ]}
                  activeOpacity={0.8}
                >
                  {/* Step Number */}
                  <View
                    style={[
                      styles.stepNumber,
                      isActive && styles.stepNumberActive,
                      isCompleted && styles.stepNumberCompleted,
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumberText,
                          isActive && styles.stepNumberTextActive,
                        ]}
                      >
                        {step.id}
                      </Text>
                    )}
                  </View>

                  {/* Step Content */}
                  <View style={styles.stepContent}>
                    <View style={styles.stepHeader}>
                      <Ionicons
                        name={stepInfo.icon}
                        size={18}
                        color={
                          isCompleted
                            ? '#22c55e'
                            : isActive
                              ? '#f97316'
                              : '#9ca3af'
                        }
                      />
                      <Text
                        style={[
                          styles.stepName,
                          isActive && styles.stepNameActive,
                          isCompleted && styles.stepNameCompleted,
                          isLocked && styles.stepNameLocked,
                        ]}
                      >
                        {stepInfo.name}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.stepDescription,
                        isLocked && styles.stepDescriptionLocked,
                      ]}
                    >
                      {stepInfo.description}
                    </Text>

                    {/* Progress Bar for active step */}
                    {isActive && step.targetAmount && (
                      <View style={styles.progressSection}>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min(step.progress, 100)}%` },
                            ]}
                          />
                        </View>
                        <View style={styles.progressDetails}>
                          <Text style={styles.progressAmount}>
                            {formatCurrency(step.currentAmount || 0)}
                          </Text>
                          <Text style={styles.progressTarget}>
                            z {formatCurrency(step.targetAmount)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Completion date for completed steps */}
                    {isCompleted && step.completionDate && (
                      <View style={styles.completionInfo}>
                        <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                        <Text style={styles.completionText}>
                          Ukończono{' '}
                          {new Date(step.completionDate).toLocaleDateString('pl-PL', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Status Indicator */}
                  <Ionicons
                    name={
                      isCompleted
                        ? 'checkmark-circle'
                        : isActive
                          ? 'radio-button-on'
                          : 'lock-closed'
                    }
                    size={24}
                    color={
                      isCompleted
                        ? '#22c55e'
                        : isActive
                          ? '#f97316'
                          : '#d1d5db'
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#6b7280" />
            <Text style={styles.infoText}>
              Baby Steps to sprawdzona metoda budowania finansowej stabilności. Skup się na
              jednym kroku na raz, od funduszu awaryjnego po budowanie majątku.
            </Text>
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
  headerSection: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  progressOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  stepsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  stepCardActive: {
    backgroundColor: '#fff7ed',
  },
  stepCardCompleted: {
    backgroundColor: '#f0fdf4',
  },
  stepCardLocked: {
    opacity: 0.6,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberActive: {
    backgroundColor: '#f97316',
  },
  stepNumberCompleted: {
    backgroundColor: '#22c55e',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberTextActive: {
    color: '#fff',
  },
  stepContent: {
    flex: 1,
    marginRight: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
  stepNameActive: {
    color: '#ea580c',
    fontWeight: '600',
  },
  stepNameCompleted: {
    color: '#15803d',
  },
  stepNameLocked: {
    color: '#9ca3af',
  },
  stepDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  stepDescriptionLocked: {
    color: '#d1d5db',
  },
  progressSection: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#fed7aa',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 4,
  },
  progressDetails: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  progressAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  progressTarget: {
    fontSize: 13,
    color: '#6b7280',
  },
  completionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  completionText: {
    fontSize: 12,
    color: '#22c55e',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
});
