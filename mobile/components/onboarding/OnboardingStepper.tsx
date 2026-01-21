import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface OnboardingStepperProps {
  label: string;
  emoji?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function OnboardingStepper({
  label,
  emoji,
  value,
  onChange,
  min = 0,
  max = 10,
}: OnboardingStepperProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {emoji && <Text style={styles.emoji}>{emoji}</Text>}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.stepperContainer}>
        <TouchableOpacity
          style={[styles.button, value <= min && styles.buttonDisabled]}
          onPress={handleDecrement}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, value <= min && styles.buttonTextDisabled]}>
            −
          </Text>
        </TouchableOpacity>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{value}</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, value >= max && styles.buttonDisabled]}
          onPress={handleIncrement}
          disabled={value >= max}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, value >= max && styles.buttonTextDisabled]}>
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  emoji: {
    fontSize: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78350f',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#fed7aa',
  },
  buttonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 32,
  },
  buttonTextDisabled: {
    color: '#d4a373',
  },
  valueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#78350f',
  },
});
