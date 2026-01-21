import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface OnboardingProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function OnboardingProgressBar({
  currentStep,
  totalSteps,
}: OnboardingProgressBarProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${progress}%` }]} />
        </View>
      </View>
      <Text style={styles.label}>
        {currentStep + 1}/{totalSteps} · {Math.round(progress)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  barContainer: {
    flex: 1,
  },
  barBackground: {
    height: 8,
    backgroundColor: '#fed7aa',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#ea580c',
    borderRadius: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9a3412',
    minWidth: 70,
    textAlign: 'right',
  },
});
