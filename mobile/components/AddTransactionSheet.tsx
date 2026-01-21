import { useState, useEffect, useCallback } from 'react';
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

interface Category {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'income' | 'expense';
}

interface AddTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'income' | 'expense';
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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock categories for dev mode
  const MOCK_CATEGORIES: Category[] = [
    { id: 1, name: 'Wynagrodzenie', icon: 'cash', color: '#22c55e', type: 'income' },
    { id: 2, name: 'Freelance', icon: 'laptop', color: '#3b82f6', type: 'income' },
    { id: 3, name: 'Inwestycje', icon: 'trending-up', color: '#8b5cf6', type: 'income' },
    { id: 4, name: 'Mieszkanie', icon: 'home', color: '#f97316', type: 'expense' },
    { id: 5, name: 'Jedzenie', icon: 'restaurant', color: '#ef4444', type: 'expense' },
    { id: 6, name: 'Transport', icon: 'car', color: '#06b6d4', type: 'expense' },
    { id: 7, name: 'Rozrywka', icon: 'film', color: '#ec4899', type: 'expense' },
    { id: 8, name: 'Zakupy', icon: 'cart', color: '#f59e0b', type: 'expense' },
    { id: 9, name: 'Zdrowie', icon: 'medkit', color: '#10b981', type: 'expense' },
    { id: 10, name: 'Inne', icon: 'ellipsis-horizontal', color: '#6b7280', type: 'expense' },
  ];

  const fetchCategories = useCallback(async () => {
    if (!user?.email || !api) return;

    if (isDevMode) {
      setCategories(MOCK_CATEGORIES);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await api.categories.list(user.email);
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      // Use mock categories as fallback
      setCategories(MOCK_CATEGORIES);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, api, isDevMode]);

  useEffect(() => {
    if (visible) {
      fetchCategories();
      // Reset form when opening
      setType(initialType);
      setAmount('');
      setCategoryId(null);
      setDate(new Date());
      setDescription('');
      setError(null);
    }
  }, [visible, fetchCategories, initialType]);

  const filteredCategories = categories.filter((cat) => cat.type === type);

  const handleSubmit = async () => {
    // Validation
    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError('Podaj prawidłową kwotę');
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
        // Get category name from selected category
        const selectedCategory = categories.find(c => c.id === categoryId);
        const categoryName = selectedCategory?.name || 'other';

        if (type === 'income') {
          await api.income.create(user.email, {
            category: categoryName,
            description: description || categoryName,
            amount: numericAmount,
            is_recurring: false,
            date: date.toISOString().split('T')[0],
          });
        } else {
          await api.expenses.create(user.email, {
            category: categoryName,
            description: description || categoryName,
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
          <Text style={styles.title}>Dodaj transakcję</Text>
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
                Przychód
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
            {isLoading ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <View style={styles.categoriesGrid}>
                {filteredCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      categoryId === cat.id && styles.categoryChipSelected,
                      categoryId === cat.id && { borderColor: cat.color || '#f97316' },
                    ]}
                    onPress={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
                  >
                    <Ionicons
                      name={(cat.icon || 'help-circle') as any}
                      size={16}
                      color={categoryId === cat.id ? cat.color || '#f97316' : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        categoryId === cat.id && { color: cat.color || '#f97316' },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
                <Text style={styles.submitButtonText}>Zapisz transakcję</Text>
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
