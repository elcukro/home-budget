import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore, TOTAL_ONBOARDING_STEPS, EMPLOYMENT_STATUS_OPTIONS, EmploymentStatus } from '@/stores/onboarding';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import OnboardingYearPicker from '@/components/onboarding/OnboardingYearPicker';
import OnboardingStepper from '@/components/onboarding/OnboardingStepper';
import OnboardingChips from '@/components/onboarding/OnboardingChips';
import Mascot from '@/components/Mascot';

export default function AboutYouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, setField } = useOnboardingStore();

  const handleNext = () => {
    router.push('/(onboarding)/income');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
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
            <Mascot mood="thinking" size="small" />
            <View style={styles.headerText}>
              <Text style={styles.title}>Opowiedz mi o sobie</Text>
              <Text style={styles.subtitle}>
                Te informacje pomogą mi lepiej dostosować obliczenia
              </Text>
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <OnboardingYearPicker
              label="Rok urodzenia"
              emoji="📅"
              value={data.birthYear}
              onChange={(value) => setField('birthYear', value)}
              minYear={1950}
              maxYear={2010}
            />

            <OnboardingStepper
              label="Ile masz dzieci?"
              emoji="👶"
              value={data.childrenCount}
              onChange={(value) => setField('childrenCount', value)}
              min={0}
              max={10}
            />

            <OnboardingChips
              label="Status zatrudnienia"
              options={EMPLOYMENT_STATUS_OPTIONS}
              value={data.employmentStatus}
              onChange={(value) => setField('employmentStatus', value as EmploymentStatus)}
            />
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7ed',
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
    gap: 8,
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
