import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApi } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth';
import { INCOME_CATEGORIES, CATEGORIES, type CategoryConfig } from '@/constants/categories';

interface CategoryOption {
  key: string;
  label: string;
  icon: string;
  color: string;
  backgroundColor: string;
}

interface AddTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'income' | 'expense';
}

// Build category options from constants
function buildCategoryOptions(type: 'income' | 'expense'): CategoryOption[] {
  if (type === 'income') {
    return Object.entries(INCOME_CATEGORIES).map(([key, config]) => ({
      key,
      label: config.label,
      icon: config.icon,
      color: config.textColor,
      backgroundColor: config.backgroundColor,
    }));
  }

  // For expenses, use main expense categories
  const expenseKeys = [
    'housing', 'utilities', 'groceries', 'food', 'transport',
    'entertainment', 'subscriptions', 'healthcare', 'education',
    'clothing', 'personal', 'kids', 'pets', 'insurance', 'other'
  ];

  return expenseKeys
    .filter(key => CATEGORIES[key])
    .map(key => {
      const config = CATEGORIES[key];
      return {
        key,
        label: config.label,
        icon: config.icon,
        color: config.textColor,
        backgroundColor: config.backgroundColor,
      };
    });
}

export default function AddTransactionSheet({
  visible,
  onClose,
  onSuccess,
  initialType = 'expense',
}: AddTransactionSheetProps) {
  const api = useApi();
  const { user, token } = useAuthStore();
  const isDevMode = token === 'dev-token-for-testing';

  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get categories based on type
  const categories = useMemo(() => buildCategoryOptions(type), [type]);

  useEffect(() => {
    if (visible) {
      // Reset form when opening
      setType(initialType);
      setAmount('');
      setSelectedCategory(null);
      setDate(new Date());
      setDescription('');
      setError(null);
    }
  }, [visible, initialType]);

  // Reset selected category when type changes
  useEffect(() => {
    setSelectedCategory(null);
  }, [type]);

  const handleSubmit = async () => {
    // Validation
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError('Podaj prawidlowa kwote');
      return;
    }

    if (!user?.email || !api) {
      setError('Brak autoryzacji');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (!isDevMode) {
        // Use the category key directly (e.g., 'salary', 'housing')
        const categoryKey = selectedCategory || 'other';
        const categoryConfig = categories.find(c => c.key === categoryKey);
        const descriptionText = description || categoryConfig?.label || categoryKey;

        if (type === 'income') {
          await api.income.create(user.email, {
            category: categoryKey,
            description: descriptionText,
            amount: numericAmount,
            is_recurring: false,
            date: date.toISOString().split('T')[0],
          });
        } else {
          await api.expenses.create(user.email, {
            category: categoryKey,
            description: descriptionText,
            amount: numericAmount,
            is_recurring: false,
            date: date.toISOString().split('T')[0],
          });
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create transaction:', err);
      setError('Nie udalo sie zapisac transakcji');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.title}>Dodaj transakcje</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Type Selector */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'expense' && styles.typeButtonActiveExpense,
              ]}
              onPress={() => setType('expense')}
            >
              <Ionicons
                name="arrow-down-circle"
                size={20}
                color={type === 'expense' ? '#fff' : '#ef4444'}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'expense' && styles.typeButtonTextActive,
                ]}
              >
                Wydatek
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'income' && styles.typeButtonActiveIncome,
              ]}
              onPress={() => setType('income')}
            >
              <Ionicons
                name="arrow-up-circle"
                size={20}
                color={type === 'income' ? '#fff' : '#22c55e'}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'income' && styles.typeButtonTextActive,
                ]}
              >
                Przychod
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kwota</Text>
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor="#d1d5db"
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.currency}>PLN</Text>
            </View>
          </View>

          {/* Category Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kategoria</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.key && styles.categoryChipSelected,
                    selectedCategory === cat.key && {
                      borderColor: cat.color,
                      backgroundColor: cat.backgroundColor,
                    },
                  ]}
                  onPress={() => setSelectedCategory(
                    cat.key === selectedCategory ? null : cat.key
                  )}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={selectedCategory === cat.key ? cat.color : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat.key && { color: cat.color },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              <Text style={styles.dateText}>{formatDate(date)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Opis (opcjonalnie)</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="np. Zakupy w Biedronce"
              placeholderTextColor="#9ca3af"
              maxLength={100}
            />
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              type === 'expense' ? styles.submitButtonExpense : styles.submitButtonIncome,
              isSaving && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Zapisz transakcje</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  typeButtonActiveExpense: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  typeButtonActiveIncome: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    paddingVertical: 16,
  },
  currency: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: '#fff7ed',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#1f2937',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    flex: 1,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonExpense: {
    backgroundColor: '#ef4444',
  },
  submitButtonIncome: {
    backgroundColor: '#22c55e',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
