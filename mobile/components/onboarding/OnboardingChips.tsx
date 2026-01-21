import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface ChipOption {
  value: string;
  label: string;
}

interface OnboardingChipsProps {
  label: string;
  options: readonly ChipOption[] | ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
}

export default function OnboardingChips({
  label,
  options,
  value,
  onChange,
}: OnboardingChipsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.chip,
              value === option.value && styles.chipSelected,
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                value === option.value && styles.chipTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78350f',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  chipSelected: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350f',
  },
  chipTextSelected: {
    color: '#fff',
  },
});
