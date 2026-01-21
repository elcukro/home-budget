import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore, TOTAL_ONBOARDING_STEPS, CURRENCY_OPTIONS } from '@/stores/onboarding';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import OnboardingNumberInput from '@/components/onboarding/OnboardingNumberInput';
import Mascot from '@/components/Mascot';
import { calculateNetIncomeWith50KUP, formatPLN, getTaxSummaryMessage } from '@/utils/polishTaxCalculator';

export default function IncomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, setField } = useOnboardingStore();

  const handleNext = () => {
    router.push('/(onboarding)/expenses');
  };

  const handleBack = () => {
    router.back();
  };

  // Get currency symbol
  const currencySymbol = CURRENCY_OPTIONS.find(c => c.value === data.currency)?.symbol || 'zł';
  const isPLN = data.currency === 'PLN';

  // Calculate tax info when using 50% KUP (only for PLN)
  const taxCalc = useMemo(() => {
    if (data.uses50KUP && data.grossMonthlyIncome && data.grossMonthlyIncome > 0 && isPLN) {
      return calculateNetIncomeWith50KUP(data.grossMonthlyIncome);
    }
    return null;
  }, [data.uses50KUP, data.grossMonthlyIncome, isPLN]);

  // Auto-update net income when gross changes and KUP is enabled (PLN only)
  useEffect(() => {
    if (taxCalc && data.uses50KUP && isPLN) {
      // Use average monthly net (accounts for tax bracket changes throughout year)
      const calculatedNet = Math.round(taxCalc.netMonthlyAverage);
      if (calculatedNet !== data.netMonthlyIncome) {
        setField('netMonthlyIncome', calculatedNet);
      }
    }
  }, [taxCalc, data.uses50KUP, isPLN]);

  // Validate that income is provided (required field)
  // If using 50% KUP, also require gross income
  const isValid = data.netMonthlyIncome !== null && data.netMonthlyIncome > 0 &&
    (!data.uses50KUP || (data.grossMonthlyIncome !== null && data.grossMonthlyIncome > 0));

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          {/* Progress Bar */}
          <OnboardingProgressBar currentStep={2} totalSteps={TOTAL_ONBOARDING_STEPS} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mascot Header */}
            <View style={styles.header}>
              <Mascot mood="happy" size="small" />
              <View style={styles.headerText}>
                <Text style={styles.title}>Ile zarabiasz?</Text>
                <Text style={styles.subtitle}>
                  Podaj kwotę netto (na rękę) - to podstawa do obliczeń FIRE
                </Text>
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <OnboardingNumberInput
                label="Miesięczne wynagrodzenie netto"
                emoji="💰"
                value={data.netMonthlyIncome}
                onChange={(value) => setField('netMonthlyIncome', value)}
                placeholder="0"
                suffix={currencySymbol}
                large
                helperText="Suma wszystkich Twoich miesięcznych przychodów po odliczeniu podatków"
              />

              {/* 50% KUP Toggle */}
              <View style={styles.kupSection}>
                <TouchableOpacity
                  style={[styles.kupToggle, data.uses50KUP && styles.kupToggleActive]}
                  onPress={() => {
                    setField('uses50KUP', !data.uses50KUP);
                    if (data.uses50KUP) {
                      // Clear gross income when disabling
                      setField('grossMonthlyIncome', null);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.kupCheckbox, data.uses50KUP && styles.kupCheckboxActive]}>
                    {data.uses50KUP && <Text style={styles.kupCheckmark}>✓</Text>}
                  </View>
                  <View style={styles.kupTextContainer}>
                    <Text style={styles.kupLabel}>Korzystam z 50% KUP</Text>
                    <Text style={styles.kupDescription}>
                      Koszty uzyskania przychodu dla twórców (np. programiści, artyści)
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Gross Income - only when 50% KUP is enabled */}
              {data.uses50KUP && (
                <>
                  <OnboardingNumberInput
                    label="Miesięczne wynagrodzenie brutto"
                    emoji="📊"
                    value={data.grossMonthlyIncome}
                    onChange={(value) => setField('grossMonthlyIncome', value)}
                    placeholder="0"
                    suffix={currencySymbol}
                    helperText={isPLN ? "Podaj brutto - netto obliczymy automatycznie wg przepisów 2026" : "Kwota przed odliczeniem podatków"}
                  />

                  {/* Tax Calculation Results - only for PLN */}
                  {taxCalc && isPLN && (
                    <View style={styles.taxCalcCard}>
                      <Text style={styles.taxCalcTitle}>📊 Kalkulacja podatkowa</Text>

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabel}>Brutto rocznie:</Text>
                        <Text style={styles.taxCalcValue}>{formatPLN(taxCalc.grossAnnual)} zł</Text>
                      </View>

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabel}>50% KUP (odliczone):</Text>
                        <Text style={[styles.taxCalcValue, styles.taxCalcGreen]}>-{formatPLN(taxCalc.kupDeducted)} zł</Text>
                      </View>

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabel}>Podstawa opodatkowania:</Text>
                        <Text style={styles.taxCalcValue}>{formatPLN(taxCalc.taxableIncome)} zł</Text>
                      </View>

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabel}>Podatek dochodowy:</Text>
                        <Text style={[styles.taxCalcValue, styles.taxCalcRed]}>-{formatPLN(taxCalc.taxPaid)} zł</Text>
                      </View>

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabel}>Składka zdrowotna (9%):</Text>
                        <Text style={[styles.taxCalcValue, styles.taxCalcRed]}>-{formatPLN(taxCalc.healthInsurance)} zł</Text>
                      </View>

                      <View style={styles.taxCalcDivider} />

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabelBold}>Netto miesięcznie:</Text>
                        <Text style={styles.taxCalcValueBold}>{formatPLN(taxCalc.netMonthlyAverage)} zł</Text>
                      </View>

                      <View style={styles.taxCalcRow}>
                        <Text style={styles.taxCalcLabel}>Efektywna stawka:</Text>
                        <Text style={styles.taxCalcValue}>{(taxCalc.effectiveTaxRate * 100).toFixed(1)}%</Text>
                      </View>

                      {taxCalc.inSecondBracket && (
                        <View style={styles.taxCalcWarning}>
                          <Text style={styles.taxCalcWarningText}>
                            ⚠️ Od {taxCalc.secondBracketMonth}. miesiąca wchodzisz w II próg podatkowy (32%).
                            Pokazana kwota to średnia z całego roku.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoEmoji}>💡</Text>
              <Text style={styles.infoText}>
                {data.uses50KUP && isPLN
                  ? 'Kalkulacja uwzględnia: 50% KUP (limit 120 000 zł/rok), progi podatkowe (12%/32%), kwotę wolną (30 000 zł) i składkę zdrowotną (9%).'
                  : data.uses50KUP
                  ? '50% KUP pozwala odliczyć połowę przychodu jako koszty. Podaj kwotę brutto, by dokładnie obliczyć Twoją sytuację podatkową.'
                  : 'Dochód to najważniejszy element Twojej drogi do wolności finansowej. Dokładna kwota pomoże obliczyć Twoją stopę oszczędności.'}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Section */}
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
            {/* CTA Button */}
            <TouchableOpacity
              style={[styles.ctaButton, !isValid && styles.ctaDisabled]}
              onPress={handleNext}
              disabled={!isValid}
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
    marginBottom: 20,
  },
  kupSection: {
    marginTop: 16,
  },
  kupToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fed7aa',
    gap: 12,
  },
  kupToggleActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  kupCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d4d4d4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  kupCheckboxActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  kupCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  kupTextContainer: {
    flex: 1,
  },
  kupLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78350f',
  },
  kupDescription: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 2,
    lineHeight: 16,
  },
  taxCalcCard: {
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
  taxCalcTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 12,
  },
  taxCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taxCalcLabel: {
    fontSize: 13,
    color: '#9a3412',
  },
  taxCalcLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
  },
  taxCalcValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350f',
  },
  taxCalcValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22c55e',
  },
  taxCalcGreen: {
    color: '#22c55e',
  },
  taxCalcRed: {
    color: '#ef4444',
  },
  taxCalcDivider: {
    height: 1,
    backgroundColor: '#fed7aa',
    marginVertical: 8,
  },
  taxCalcWarning: {
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  taxCalcWarningText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoEmoji: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
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
  ctaDisabled: {
    opacity: 0.5,
    backgroundColor: '#d4a373',
    borderBottomColor: '#b8956f',
    shadowColor: '#b8956f',
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
