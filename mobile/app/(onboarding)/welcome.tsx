import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore, TOTAL_ONBOARDING_STEPS, LANGUAGE_OPTIONS, CURRENCY_OPTIONS } from '@/stores/onboarding';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import Mascot from '@/components/Mascot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const illustration = require('@/assets/illustrations/onboarding/onboarding-welcome.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { skipOnboarding, data, setField } = useOnboardingStore();
  const [isSkipping, setIsSkipping] = useState(false);

  const handleNext = () => {
    router.push('/(onboarding)/about-you');
  };

  const handleSkip = async () => {
    try {
      setIsSkipping(true);
      await skipOnboarding();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      setIsSkipping(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Progress Bar */}
        <OnboardingProgressBar currentStep={0} totalSteps={TOTAL_ONBOARDING_STEPS} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={illustration}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Witaj w FiredUp!</Text>
            <Text style={styles.subtitle}>
              Odpowiedz na kilka pytań, żebym mógł Ci lepiej pomóc w drodze do wolności finansowej
            </Text>
          </View>

          {/* Language Selection */}
          <View style={styles.selectionSection}>
            <Text style={styles.selectionLabel}>🌍 Język aplikacji</Text>
            <View style={styles.chipsRow}>
              {LANGUAGE_OPTIONS.map((lang) => (
                <TouchableOpacity
                  key={lang.value}
                  style={[
                    styles.chip,
                    data.language === lang.value && styles.chipSelected,
                  ]}
                  onPress={() => setField('language', lang.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.chipText,
                      data.language === lang.value && styles.chipTextSelected,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Currency Selection */}
          <View style={styles.selectionSection}>
            <Text style={styles.selectionLabel}>💰 Waluta</Text>
            <View style={styles.chipsRow}>
              {CURRENCY_OPTIONS.map((curr) => (
                <TouchableOpacity
                  key={curr.value}
                  style={[
                    styles.chip,
                    data.currency === curr.value && styles.chipSelected,
                  ]}
                  onPress={() => setField('currency', curr.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipFlag}>{curr.flag}</Text>
                  <Text
                    style={[
                      styles.chipText,
                      data.currency === curr.value && styles.chipTextSelected,
                    ]}
                  >
                    {curr.label} ({curr.symbol})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Mascot with Message */}
          <View style={styles.mascotSection}>
            <Mascot mood="teaching" size="small" />
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>
                Cześć! Za chwilę zadam Ci kilka pytań, żeby lepiej dostosować aplikację.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, isSkipping && styles.ctaDisabled]}
            onPress={handleNext}
            disabled={isSkipping}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>Zaczynamy!</Text>
          </TouchableOpacity>

          {/* Skip Button */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSkip}
            disabled={isSkipping}
            activeOpacity={0.7}
          >
            {isSkipping ? (
              <ActivityIndicator color="#9a3412" size="small" />
            ) : (
              <Text style={styles.secondaryText}>Pomiń wprowadzenie</Text>
            )}
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
    paddingBottom: 24,
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  illustration: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.45,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#78350f',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9a3412',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  selectionSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  selectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350f',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fed7aa',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  chipFlag: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350f',
  },
  chipTextSelected: {
    color: '#fff',
  },
  mascotSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginTop: 16,
    gap: 12,
  },
  messageBubble: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  messageText: {
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
    minHeight: 40,
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    color: '#9a3412',
    fontWeight: '500',
  },
});
