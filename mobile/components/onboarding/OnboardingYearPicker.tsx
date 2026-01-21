import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingYearPickerProps {
  label: string;
  emoji?: string;
  value: number | null;
  onChange: (value: number) => void;
  minYear?: number;
  maxYear?: number;
}

export default function OnboardingYearPicker({
  label,
  emoji,
  value,
  onChange,
  minYear = 1950,
  maxYear = 2010,
}: OnboardingYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => maxYear - i
  );

  const handleSelect = (year: number) => {
    onChange(year);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {emoji && <Text style={styles.emoji}>{emoji}</Text>}
        <Text style={styles.label}>{label}</Text>
      </View>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]}>
          {value || 'Wybierz rok'}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.modalClose}>Zamknij</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={years}
              keyExtractor={(item) => item.toString()}
              showsVerticalScrollIndicator={false}
              initialScrollIndex={value ? years.indexOf(value) : 30}
              getItemLayout={(_, index) => ({
                length: 52,
                offset: 52 * index,
                index,
              })}
              renderItem={({ item: year }) => (
                <TouchableOpacity
                  style={[
                    styles.yearItem,
                    value === year && styles.yearItemSelected,
                  ]}
                  onPress={() => handleSelect(year)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yearText,
                      value === year && styles.yearTextSelected,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  selectorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#78350f',
  },
  selectorPlaceholder: {
    color: '#d4a373',
  },
  chevron: {
    fontSize: 14,
    color: '#9a3412',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#fff7ed',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#78350f',
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ea580c',
  },
  yearItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  yearItemSelected: {
    backgroundColor: '#ea580c',
  },
  yearText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#78350f',
    textAlign: 'center',
  },
  yearTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});
