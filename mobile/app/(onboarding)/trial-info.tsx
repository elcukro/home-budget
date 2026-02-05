import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOTAL_ONBOARDING_STEPS } from '@/stores/onboarding';
import { useAuthStore } from '@/stores/auth';
import { getApiClient } from '@/lib/api';
import OnboardingProgressBar from '@/components/onboarding/OnboardingProgressBar';
import Mascot from '@/components/Mascot';

interface TrialInfo {
  trialEndDate: string;
  trialDaysLeft: number;
  isPremium: boolean;
  isLifetime: boolean;
  status: string;
}

function getDefaultTrialInfo(): TrialInfo {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);
  return {
    trialEndDate: endDate.toISOString(),
    trialDaysLeft: 14,
    isPremium: true,
    isLifetime: false,
    status: 'trialing',
  };
}

function formatTrialDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const PREMIUM_FEATURES = [
  { emoji: '🎯', title: 'Nieograniczone transakcje', description: 'Brak limitów na wydatki i przychody' },
  { emoji: '🏦', title: 'Integracja z bankami', description: 'Automatyczny import z Tink (ING, PKO BP, mBank...)' },
  { emoji: '🤖', title: 'AI Insights', description: 'Inteligentne sugestie i analiza wydatków' },
  { emoji: '📊', title: 'Zaawansowane raporty', description: 'Eksport do Excel/CSV, raporty kwartalne/roczne' },
  { emoji: '✅', title: 'Wszystkie funkcje już teraz!', description: 'Pełny dostęp przez cały trial' },
];

const COMPARISON_ROWS = [
  { feature: 'Wydatki/miesiąc', free: '20', premium: 'Bez limitu' },
  { feature: 'Przychody/miesiąc', free: '3', premium: 'Bez limitu' },
  { feature: 'Kredyty', free: '3', premium: 'Bez limitu' },
  { feature: 'Cele oszczędnościowe', free: '3', premium: 'Bez limitu' },
  { feature: 'Integracja bankowa', free: false, premium: true },
  { feature: 'AI Insights', free: false, premium: true },
  { feature: 'Eksport (Excel/CSV)', free: false, premium: true },
  { feature: 'Zaawansowane raporty', free: false, premium: true },
];

export default function TrialInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const [trialInfo, setTrialInfo] = useState<TrialInfo>(getDefaultTrialInfo);

  useEffect(() => {
    fetchTrialInfo();
  }, []);

  const fetchTrialInfo = async () => {
    // Skip API call in dev mode
    if (token === 'dev-token-for-testing' || !user) return;

    const client = getApiClient();
    if (!client) return;

    try {
      const status = await client.subscription.getStatus(user.id);

      // Handle lifetime users - they don't need trial info
      if (status.is_lifetime) {
        setTrialInfo({
          trialEndDate: '',
          trialDaysLeft: 0,
          isPremium: true,
          isLifetime: true,
          status: 'active',
        });
        return;
      }

      // Handle trial data
      if (status.trial_ends_at) {
        const daysLeft = status.trial_days_left ?? 0;
        setTrialInfo({
          trialEndDate: status.trial_ends_at,
          trialDaysLeft: Math.max(0, daysLeft),
          isPremium: status.is_premium,
          isLifetime: false,
          status: status.status,
        });
      }
      // If no trial info from API, keep the client-side default
    } catch {
      // On error, keep client-side fallback (default state)
    }
  };

  const handleNext = () => {
    router.push('/(onboarding)/about-you');
  };

  const handleBack = () => {
    router.back();
  };

  // Lifetime users see a simplified version
  if (trialInfo.isLifetime) {
    return (
      <View style={styles.container}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <OnboardingProgressBar currentStep={1} totalSteps={TOTAL_ONBOARDING_STEPS} />
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroSection}>
              <Mascot mood="celebrating" size="small" />
              <Text style={styles.title}>Masz dostęp Premium!</Text>
              <Text style={styles.subtitle}>
                Korzystasz z pełnego dostępu do wszystkich funkcji FiredUp.
              </Text>
            </View>
          </ScrollView>
          <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
            <TouchableOpacity style={styles.ctaButton} onPress={handleNext} activeOpacity={0.8}>
              <Text style={styles.ctaText}>Kontynuuj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>Wstecz</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const trialExpired = trialInfo.trialDaysLeft <= 0 && trialInfo.status !== 'trialing';

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <OnboardingProgressBar currentStep={1} totalSteps={TOTAL_ONBOARDING_STEPS} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Mascot mood="celebrating" size="small" />
            <Text style={styles.title}>
              {trialExpired
                ? 'Twój trial się zakończył'
                : 'Witaj w okresie próbnym!'}
            </Text>
            <Text style={styles.subtitle}>
              {trialExpired
                ? 'Możesz nadal korzystać z podstawowych funkcji za darmo.'
                : 'Masz pełny dostęp do wszystkich funkcji Premium. Żadnych zobowiązań – anuluj w dowolnym momencie.'}
            </Text>
          </View>

          {/* Trial Date Card */}
          {!trialExpired && (
            <View style={styles.trialCard}>
              <Text style={styles.trialCardIcon}>📅</Text>
              <View style={styles.trialCardContent}>
                <Text style={styles.trialCardLabel}>
                  Twój trial kończy się:
                </Text>
                <Text style={styles.trialCardDate}>
                  {formatTrialDate(trialInfo.trialEndDate)}
                </Text>
                <Text style={styles.trialCardNote}>
                  Przypomnimy Ci na 3 dni przed końcem
                </Text>
              </View>
            </View>
          )}

          {/* Feature Highlights */}
          <Text style={styles.sectionTitle}>Co zyskujesz z Premium?</Text>
          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Text style={styles.featureEmoji}>{feature.emoji}</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Plan Comparison */}
          <Text style={styles.sectionTitle}>Porównanie planów</Text>
          <View style={styles.comparisonTable}>
            {/* Header */}
            <View style={styles.comparisonHeader}>
              <Text style={[styles.comparisonHeaderText, styles.comparisonFeatureCol]}>Funkcja</Text>
              <Text style={[styles.comparisonHeaderText, styles.comparisonValueCol]}>Free</Text>
              <Text style={[styles.comparisonHeaderText, styles.comparisonValueCol, styles.comparisonPremiumHeader]}>Premium</Text>
            </View>

            {/* Rows */}
            {COMPARISON_ROWS.map((row, index) => (
              <View
                key={index}
                style={[
                  styles.comparisonRow,
                  index % 2 === 0 && styles.comparisonRowAlt,
                ]}
              >
                <Text style={[styles.comparisonFeature, styles.comparisonFeatureCol]}>{row.feature}</Text>
                <View style={styles.comparisonValueCol}>
                  {typeof row.free === 'boolean' ? (
                    <Text style={styles.comparisonBoolFalse}>❌</Text>
                  ) : (
                    <Text style={styles.comparisonValueFree}>{row.free}</Text>
                  )}
                </View>
                <View style={[styles.comparisonValueCol, styles.comparisonPremiumCol]}>
                  {typeof row.premium === 'boolean' ? (
                    <Text style={styles.comparisonBoolTrue}>✅</Text>
                  ) : (
                    <Text style={styles.comparisonValuePremium}>∞ {row.premium}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Fine Print */}
          <Text style={styles.finePrint}>
            Po zakończeniu trialu dostęp do podstawowych funkcji pozostanie darmowy.
          </Text>
        </ScrollView>

        {/* Bottom Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>Świetnie, kontynuuj!</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryText}>Przypomnij mi później</Text>
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

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#78350f',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#9a3412',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // Trial Card
  trialCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
    borderWidth: 2,
    borderColor: '#ea580c',
  },
  trialCardIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  trialCardContent: {
    flex: 1,
  },
  trialCardLabel: {
    fontSize: 13,
    color: '#9a3412',
    fontWeight: '500',
  },
  trialCardDate: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ea580c',
    marginTop: 2,
  },
  trialCardNote: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#78350f',
    marginBottom: 12,
  },

  // Feature List
  featureList: {
    gap: 10,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
  },
  featureDescription: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 2,
    lineHeight: 16,
  },

  // Comparison Table
  comparisonTable: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  comparisonHeader: {
    flexDirection: 'row',
    backgroundColor: '#78350f',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  comparisonHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  comparisonFeatureCol: {
    flex: 2,
  },
  comparisonValueCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonPremiumHeader: {
    color: '#fed7aa',
  },
  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  comparisonRowAlt: {
    backgroundColor: '#fff7ed',
  },
  comparisonFeature: {
    fontSize: 13,
    color: '#78350f',
    fontWeight: '500',
  },
  comparisonValueFree: {
    fontSize: 13,
    color: '#9a3412',
    fontWeight: '600',
    textAlign: 'center',
  },
  comparisonBoolFalse: {
    fontSize: 14,
    textAlign: 'center',
  },
  comparisonBoolTrue: {
    fontSize: 14,
    textAlign: 'center',
  },
  comparisonPremiumCol: {
    backgroundColor: 'rgba(234, 88, 12, 0.05)',
  },
  comparisonValuePremium: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '700',
    textAlign: 'center',
  },

  // Fine Print
  finePrint: {
    fontSize: 12,
    color: '#9a3412',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Bottom
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
    minHeight: 40,
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    color: '#9a3412',
    fontWeight: '500',
  },
});
