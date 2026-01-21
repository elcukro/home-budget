import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface OnboardingNumberInputProps {
  label: string;
  emoji?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  suffix?: string;
  helperText?: string;
  large?: boolean;
}

export default function OnboardingNumberInput({
  label,
  emoji,
  value,
  onChange,
  placeholder = '0',
  suffix = 'zł',
  helperText,
  large = false,
}: OnboardingNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pl-PL');
  };

  const handleChangeText = (text: string) => {
    // Remove all non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      onChange(null);
    } else {
      onChange(parseInt(cleaned, 10));
    }
  };

  const displayValue = value !== null ? formatNumber(value) : '';

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {emoji && <Text style={styles.emoji}>{emoji}</Text>}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View
        style={[
          styles.inputContainer,
          large && styles.inputContainerLarge,
          isFocused && styles.inputContainerFocused,
        ]}
      >
        <TextInput
          style={[styles.input, large && styles.inputLarge]}
          value={displayValue}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor="#d4a373"
          keyboardType="numeric"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Text style={[styles.suffix, large && styles.suffixLarge]}>{suffix}</Text>
      </View>
      {helperText && <Text style={styles.helperText}>{helperText}</Text>}
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  inputContainerLarge: {
    paddingVertical: 20,
    borderRadius: 20,
  },
  inputContainerFocused: {
    borderColor: '#ea580c',
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#78350f',
    padding: 0,
  },
  inputLarge: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  suffix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9a3412',
    marginLeft: 8,
  },
  suffixLarge: {
    fontSize: 24,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    color: '#9a3412',
    marginTop: 6,
    paddingHorizontal: 4,
  },
});
