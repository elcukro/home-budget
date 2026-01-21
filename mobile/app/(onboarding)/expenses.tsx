import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore, TOTAL_ONBOARDING_STEPS, CURRENCY_OPTIONS } from '@/stores/onboarding';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import OnboardingNumberInput from '@/components/onboarding/OnboardingNumberInput';
import Mascot from '@/components/Mascot';

export default function ExpensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, setField } = useOnboardingStore();

  const handleNext = () => {
    router.push('/(onboarding)/savings');
  };

  const handleBack = () => {
    router.back();
  };

  // Get currency symbol
  const currencySymbol = CURRENCY_OPTIONS.find(c => c.value === data.currency)?.symbol || 'zł';

  // Calculate total expenses
  const totalExpenses =
    (data.housingCost || 0) + (data.foodCost || 0) + (data.transportCost || 0);

  // Format number with spaces as thousand separators
  const formatCurrency = (num: number): string => {
    return num.toLocaleString('pl-PL');
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          {/* Progress Bar */}
          <OnboardingProgressBar currentStep={3} totalSteps={TOTAL_ONBOARDING_STEPS} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mascot Header */}
            <View style={styles.header}>
              <Mascot mood="determined" size="small" />
              <View style={styles.headerText}>
                <Text style={styles.title}>Ile wydajesz na życie?</Text>
                <Text style={styles.subtitle}>
                  Oszacuj główne kategorie wydatków miesięcznych
                </Text>
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <OnboardingNumberInput
                label="Mieszkanie (czynsz/rata + media)"
                emoji="🏠"
                value={data.housingCost}
                onChange={(value) => setField('housingCost', value)}
                placeholder="0"
                suffix={currencySymbol}
              />

              <OnboardingNumberInput
                label="Jedzenie i zakupy"
                emoji="🛒"
                value={data.foodCost}
                onChange={(value) => setField('foodCost', value)}
                placeholder="0"
                suffix={currencySymbol}
              />

              <OnboardingNumberInput
                label="Transport"
                emoji="🚗"
                value={data.transportCost}
                onChange={(value) => setField('transportCost', value)}
                placeholder="0"
                suffix={currencySymbol}
              />
            </View>

            {/* Total Card */}
            <View style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Suma miesięcznych wydatków:</Text>
                <Text style={styles.totalValue}>{formatCurrency(totalExpenses)} {currencySymbol}</Text>
              </View>
              {data.netMonthlyIncome && data.netMonthlyIncome > 0 && (
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsLabel}>Zostaje Ci:</Text>
                  <Text
                    style={[
                      styles.savingsValue,
                      data.netMonthlyIncome - totalExpenses < 0 && styles.savingsNegative,
                    ]}
                  >
                    {formatCurrency(data.netMonthlyIncome - totalExpenses)} {currencySymbol}
                  </Text>
                </View>
              )}
            </View>

            {/* Info Text */}
            <Text style={styles.infoText}>
              Nie musisz być dokładny - możesz to później skorygować w ustawieniach.
            </Text>
          </ScrollView>

          {/* Bottom Section */}
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaText}>Dalej</Text>
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBack}
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
    gap: 4,
  },
  totalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#78350f',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#78350f',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  savingsLabel: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  savingsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#22c55e',
  },
  savingsNegative: {
    color: '#ef4444',
  },
  infoText: {
    fontSize: 13,
    color: '#9a3412',
    textAlign: 'center',
    marginTop: 16,
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
    backgroundColor: '#ea580c',
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 8,
    borderBottomColor: '#c2410c',
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
