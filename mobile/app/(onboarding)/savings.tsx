import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore, TOTAL_ONBOARDING_STEPS, CURRENCY_OPTIONS } from '@/stores/onboarding';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import OnboardingNumberInput from '@/components/onboarding/OnboardingNumberInput';
import Mascot from '@/components/Mascot';

export default function SavingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, setField, submitOnboarding, isLoading } = useOnboardingStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    setIsSubmitting(true);
    console.log('[Savings] Starting submission...');

    try {
      await submitOnboarding();
      console.log('[Savings] Submission complete!');
    } catch (error) {
      console.error('[Savings] Failed to complete onboarding:', error);
      setIsSubmitting(false);
      return; // Don't navigate on error
    }

    // Navigate to tutorial after successful submission
    console.log('[Savings] Navigating to tutorial...');
    try {
      router.replace('/(onboarding)/tutorial');
    } catch (navError) {
      console.error('[Savings] Navigation failed:', navError);
      // Even if navigation fails, onboarding is complete - try alternate navigation
      router.push('/(onboarding)/tutorial');
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Get currency symbol
  const currencySymbol = CURRENCY_OPTIONS.find(c => c.value === data.currency)?.symbol || 'zł';

  // Format number with spaces as thousand separators
  const formatCurrency = (num: number): string => {
    return num.toLocaleString('pl-PL');
  };

  // Calculate values
  const totalExpenses =
    (data.housingCost || 0) + (data.foodCost || 0) + (data.transportCost || 0);
  const monthlySavings = (data.netMonthlyIncome || 0) - totalExpenses;
  const savingsRate =
    data.netMonthlyIncome && data.netMonthlyIncome > 0
      ? Math.round((monthlySavings / data.netMonthlyIncome) * 100)
      : 0;
  const emergencyFundMonths =
    totalExpenses > 0 ? ((data.currentSavings || 0) / totalExpenses).toFixed(1) : '0';

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          {/* Progress Bar */}
          <OnboardingProgressBar currentStep={4} totalSteps={TOTAL_ONBOARDING_STEPS} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mascot Header */}
            <View style={styles.header}>
              <Mascot mood="celebrating" size="small" />
              <View style={styles.headerText}>
                <Text style={styles.title}>Ile masz oszczędności?</Text>
                <Text style={styles.subtitle}>
                  Wlicz wszystkie konta oszczędnościowe i lokaty
                </Text>
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <OnboardingNumberInput
                label="Aktualne oszczędności"
                emoji="💎"
                value={data.currentSavings}
                onChange={(value) => setField('currentSavings', value)}
                placeholder="0"
                suffix={currencySymbol}
                large
              />
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Twoje podsumowanie</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Dochód miesięczny:</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(data.netMonthlyIncome || 0)} {currencySymbol}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Wydatki miesięczne:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalExpenses)} {currencySymbol}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelHighlight}>Możesz oszczędzać:</Text>
                <Text
                  style={[
                    styles.summaryValueHighlight,
                    monthlySavings < 0 && styles.valueNegative,
                  ]}
                >
                  {formatCurrency(monthlySavings)} {currencySymbol}/mies
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Stopa oszczędności:</Text>
                <Text
                  style={[
                    styles.summaryValueBadge,
                    savingsRate >= 20 && styles.badgeGreen,
                    savingsRate >= 10 && savingsRate < 20 && styles.badgeYellow,
                    savingsRate < 10 && styles.badgeRed,
                  ]}
                >
                  {savingsRate}%
                </Text>
              </View>

              {totalExpenses > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Fundusz awaryjny:</Text>
                  <Text style={styles.summaryValue}>{emergencyFundMonths} miesięcy</Text>
                </View>
              )}
            </View>

            {/* Encouragement */}
            <View style={styles.encouragement}>
              <Text style={styles.encouragementEmoji}>🎯</Text>
              <Text style={styles.encouragementText}>
                {savingsRate >= 50
                  ? 'Niesamowite! Jesteś na świetnej drodze do FIRE!'
                  : savingsRate >= 20
                  ? 'Świetny start! Z taką stopą oszczędności możesz osiągnąć niezależność finansową.'
                  : savingsRate >= 10
                  ? 'Dobry początek! Każdy procent się liczy w drodze do wolności finansowej.'
                  : 'Zacznijmy razem budować Twoje oszczędności!'}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Section */}
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
            {/* CTA Button */}
            <TouchableOpacity
              style={[styles.ctaButton, isSubmitting && styles.ctaDisabled]}
              onPress={handleComplete}
              disabled={isSubmitting || isLoading}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.ctaText}>Gotowe!</Text>
              )}
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBack}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>Wstecz</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#78350f',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9a3412',
    marginTop: 4,
    lineHeight: 18,
  },
  form: {
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9a3412',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350f',
  },
  summaryLabelHighlight: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78350f',
  },
  summaryValueHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22c55e',
  },
  valueNegative: {
    color: '#ef4444',
  },
  summaryValueBadge: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
  },
  badgeYellow: {
    backgroundColor: '#fef9c3',
    color: '#ca8a04',
  },
  badgeRed: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  divider: {
    height: 1,
    backgroundColor: '#fed7aa',
    marginVertical: 12,
  },
  encouragement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    gap: 12,
  },
  encouragementEmoji: {
    fontSize: 24,
  },
  encouragementText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginBottom: 8,
    borderBottomWidth: 3,
    backgroundColor: '#22c55e',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 8,
    borderBottomColor: '#16a34a',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 14,
    color: '#9a3412',
    fontWeight: '500',
  },
});
