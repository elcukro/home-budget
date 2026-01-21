import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OnboardingProgress from './OnboardingProgress';
import Mascot, { MascotMood } from '@/components/Mascot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingScreenProps {
  illustration: ImageSourcePropType;
  title: string;
  subtitle?: string;
  mascotMood?: MascotMood;
  mascotMessage?: string;
  currentStep: number;
  totalSteps?: number;
  ctaText: string;
  onCtaPress: () => void;
  ctaLoading?: boolean;
  secondaryText?: string;
  onSecondaryPress?: () => void;
  children?: React.ReactNode;
  ctaVariant?: 'green' | 'orange';
}

export default function OnboardingScreen({
  illustration,
  title,
  subtitle,
  mascotMood,
  mascotMessage,
  currentStep,
  totalSteps = 3,
  ctaText,
  onCtaPress,
  ctaLoading = false,
  secondaryText,
  onSecondaryPress,
  children,
  ctaVariant = 'orange',
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
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
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Mascot with Message */}
        {mascotMood && mascotMessage && (
          <View style={styles.mascotSection}>
            <Mascot mood={mascotMood} size="medium" />
            <View style={styles.messageBubble}>
              <Text style={styles.messageText}>{mascotMessage}</Text>
            </View>
          </View>
        )}

        {/* Children (Feature Cards) */}
        {children && <View style={styles.childrenContainer}>{children}</View>}

        {/* Bottom Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
          {/* Progress */}
          <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />

          {/* CTA Button */}
          <TouchableOpacity
            style={[
              styles.ctaButton,
              ctaVariant === 'green' ? styles.ctaGreen : styles.ctaOrange,
              ctaLoading && styles.ctaDisabled,
            ]}
            onPress={onCtaPress}
            disabled={ctaLoading}
            activeOpacity={0.8}
          >
            {ctaLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaText}>{ctaText}</Text>
            )}
          </TouchableOpacity>

          {/* Secondary Button */}
          {secondaryText && onSecondaryPress && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSecondaryPress}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>{secondaryText}</Text>
            </TouchableOpacity>
          )}
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
  illustrationContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  illustration: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.65,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#78350f',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9a3412',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  mascotSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 12,
  },
  messageBubble: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  childrenContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  bottomSection: {
    marginTop: 'auto',
    paddingHorizontal: 24,
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginBottom: 12,
    borderBottomWidth: 4,
  },
  ctaOrange: {
    backgroundColor: '#ea580c',
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 8,
    borderBottomColor: '#c2410c',
  },
  ctaGreen: {
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
    fontSize: 20,
    fontWeight: '800',
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
