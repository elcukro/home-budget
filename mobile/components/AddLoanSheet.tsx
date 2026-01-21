/**
 * AddLoanSheet - Bottom sheet for adding a new loan
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useApi } from '@/hooks/useApi';

// Loan type options
const LOAN_TYPES = [
  { value: 'mortgage', label: 'Kredyt hipoteczny', icon: '🏠' },
  { value: 'car', label: 'Kredyt samochodowy', icon: '🚗' },
  { value: 'personal', label: 'Kredyt gotówkowy', icon: '💵' },
  { value: 'student', label: 'Kredyt studencki', icon: '🎓' },
  { value: 'credit_card', label: 'Karta kredytowa', icon: '💳' },
  { value: 'cash_loan', label: 'Pożyczka', icon: '🤝' },
  { value: 'installment', label: 'Raty 0%', icon: '🛒' },
  { value: 'leasing', label: 'Leasing', icon: '📋' },
  { value: 'overdraft', label: 'Debet', icon: '🏦' },
  { value: 'other', label: 'Inny', icon: '📝' },
];

interface AddLoanSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  loanType: string;
  description: string;
  principalAmount: string;
  remainingBalance: string;
  interestRate: string;
  monthlyPayment: string;
  startDate: string;
  termMonths: string;
  dueDay: string;
}

export default function AddLoanSheet({
  visible,
  onClose,
  onSuccess,
}: AddLoanSheetProps) {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoanTypePicker, setShowLoanTypePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [formData, setFormData] = useState<FormData>({
    loanType: '',
    description: '',
    principalAmount: '',
    remainingBalance: '',
    interestRate: '',
    monthlyPayment: '',
    startDate: todayStr,
    termMonths: '',
    dueDay: '1',
  });

  // Parse start date for DateTimePicker
  const startDateObj = formData.startDate ? new Date(formData.startDate) : today;

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setFormData({
        loanType: '',
        description: '',
        principalAmount: '',
        remainingBalance: '',
        interestRate: '',
        monthlyPayment: '',
        startDate: todayStr,
        termMonths: '',
        dueDay: '1',
      });
      setErrors({});
      setShowLoanTypePicker(false);
      setShowDatePicker(false);
    }
  }, [visible]);

  // Handle date picker change
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      updateField('startDate', dateStr);
    }
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // When principal amount changes, update remaining balance to match (if not manually edited)
  const handlePrincipalChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      principalAmount: value,
      // Auto-fill remaining balance if it's empty or matches principal
      remainingBalance: prev.remainingBalance === '' || prev.remainingBalance === prev.principalAmount
        ? value
        : prev.remainingBalance,
    }));
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.loanType) {
      newErrors.loanType = 'Wybierz rodzaj kredytu';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Podaj nazwę kredytu';
    }
    const principal = parseFloat(formData.principalAmount.replace(',', '.')) || 0;
    if (principal <= 0) {
      newErrors.principalAmount = 'Podaj kwotę początkową';
    }
    const remaining = parseFloat(formData.remainingBalance.replace(',', '.')) || 0;
    if (remaining < 0) {
      newErrors.remainingBalance = 'Podaj pozostałą kwotę';
    }
    if (remaining > principal) {
      newErrors.remainingBalance = 'Pozostało nie może być większe niż kwota początkowa';
    }
    const rate = parseFloat(formData.interestRate.replace(',', '.')) || 0;
    if (rate < 0 || rate > 100) {
      newErrors.interestRate = 'Podaj prawidłowe oprocentowanie (0-100%)';
    }
    const payment = parseFloat(formData.monthlyPayment.replace(',', '.')) || 0;
    if (payment <= 0) {
      newErrors.monthlyPayment = 'Podaj ratę miesięczną';
    }
    const term = parseInt(formData.termMonths, 10) || 0;
    if (term <= 0) {
      newErrors.termMonths = 'Podaj okres kredytowania';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !api) return;

    setIsLoading(true);
    try {
      await api.loans.create({
        loan_type: formData.loanType,
        description: formData.description.trim(),
        principal_amount: parseFloat(formData.principalAmount.replace(',', '.')) || 0,
        remaining_balance: parseFloat(formData.remainingBalance.replace(',', '.')) || 0,
        interest_rate: parseFloat(formData.interestRate.replace(',', '.')) || 0,
        monthly_payment: parseFloat(formData.monthlyPayment.replace(',', '.')) || 0,
        start_date: formData.startDate,
        term_months: parseInt(formData.termMonths, 10) || 0,
        due_day: parseInt(formData.dueDay, 10) || 1,
      });

      onSuccess();
    } catch (err) {
      console.error('Failed to create loan:', err);
      Alert.alert(
        'Błąd',
        'Nie udało się dodać kredytu. Spróbuj ponownie.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLoanType = LOAN_TYPES.find((t) => t.value === formData.loanType);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Dodaj kredyt</Text>
            <Pressable onPress={onClose} style={styles.closeButton} disabled={isLoading}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Loan Type Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Rodzaj kredytu *</Text>
              <Pressable
                style={[styles.selector, errors.loanType && styles.inputError]}
                onPress={() => setShowLoanTypePicker(!showLoanTypePicker)}
              >
                {selectedLoanType ? (
                  <View style={styles.selectedType}>
                    <Text style={styles.typeIcon}>{selectedLoanType.icon}</Text>
                    <Text style={styles.typeLabel}>{selectedLoanType.label}</Text>
                  </View>
                ) : (
                  <Text style={styles.placeholder}>Wybierz rodzaj</Text>
                )}
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color="#6b7280"
                />
              </Pressable>
              {errors.loanType && <Text style={styles.errorText}>{errors.loanType}</Text>}

              {/* Loan Type Options */}
              {showLoanTypePicker && (
                <View style={styles.typeGrid}>
                  {LOAN_TYPES.map((type) => (
                    <Pressable
                      key={type.value}
                      style={[
                        styles.typeOption,
                        formData.loanType === type.value && styles.typeOptionSelected,
                      ]}
                      onPress={() => {
                        updateField('loanType', type.value);
                        setShowLoanTypePicker(false);
                      }}
                    >
                      <Text style={styles.typeOptionIcon}>{type.icon}</Text>
                      <Text
                        style={[
                          styles.typeOptionLabel,
                          formData.loanType === type.value && styles.typeOptionLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Nazwa/opis *</Text>
              <TextInput
                style={[styles.input, errors.description && styles.inputError]}
                value={formData.description}
                onChangeText={(v) => updateField('description', v)}
                placeholder="np. Kredyt hipoteczny na mieszkanie"
                editable={!isLoading}
              />
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>

            {/* Principal Amount */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Kwota początkowa *</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.inputFlex, errors.principalAmount && styles.inputError]}
                  value={formData.principalAmount}
                  onChangeText={handlePrincipalChange}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                <Text style={styles.suffix}>PLN</Text>
              </View>
              {errors.principalAmount && <Text style={styles.errorText}>{errors.principalAmount}</Text>}
            </View>

            {/* Remaining Balance */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Pozostało do spłaty *</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.inputFlex, errors.remainingBalance && styles.inputError]}
                  value={formData.remainingBalance}
                  onChangeText={(v) => updateField('remainingBalance', v)}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                <Text style={styles.suffix}>PLN</Text>
              </View>
              {errors.remainingBalance && <Text style={styles.errorText}>{errors.remainingBalance}</Text>}
            </View>

            {/* Two columns: Interest Rate + Monthly Payment */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>Oprocentowanie *</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.inputFlex, errors.interestRate && styles.inputError]}
                    value={formData.interestRate}
                    onChangeText={(v) => updateField('interestRate', v)}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    editable={!isLoading}
                  />
                  <Text style={styles.suffix}>%</Text>
                </View>
                {errors.interestRate && <Text style={styles.errorText}>{errors.interestRate}</Text>}
              </View>

              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>Rata miesięczna *</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.inputFlex, errors.monthlyPayment && styles.inputError]}
                    value={formData.monthlyPayment}
                    onChangeText={(v) => updateField('monthlyPayment', v)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    editable={!isLoading}
                  />
                  <Text style={styles.suffix}>PLN</Text>
                </View>
                {errors.monthlyPayment && <Text style={styles.errorText}>{errors.monthlyPayment}</Text>}
              </View>
            </View>

            {/* Two columns: Term + Due Day */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>Okres kredytu *</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.inputFlex, errors.termMonths && styles.inputError]}
                    value={formData.termMonths}
                    onChangeText={(v) => updateField('termMonths', v)}
                    placeholder="0"
                    keyboardType="number-pad"
                    editable={!isLoading}
                  />
                  <Text style={styles.suffix}>mies.</Text>
                </View>
                {errors.termMonths && <Text style={styles.errorText}>{errors.termMonths}</Text>}
              </View>

              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>Dzień płatności</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={styles.inputFlex}
                    value={formData.dueDay}
                    onChangeText={(v) => updateField('dueDay', v)}
                    placeholder="1"
                    keyboardType="number-pad"
                    editable={!isLoading}
                  />
                  <Text style={styles.suffix}>dzień</Text>
                </View>
              </View>
            </View>

            {/* Start Date */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Data rozpoczęcia *</Text>
              <Pressable
                style={styles.dateSelector}
                onPress={() => setShowDatePicker(true)}
                disabled={isLoading}
              >
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text style={styles.dateSelectorText}>
                  {formatDisplayDate(formData.startDate)}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={startDateObj}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  locale="pl-PL"
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <Pressable
                  style={styles.datePickerDone}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerDoneText}>Gotowe</Text>
                </Pressable>
              )}
            </View>

            {/* Spacer for bottom */}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Dodaj kredyt</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  inputFlex: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suffix: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    minWidth: 40,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  placeholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  selectedType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeOptionSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  typeOptionIcon: {
    fontSize: 16,
  },
  typeOptionLabel: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  typeOptionLabelSelected: {
    color: '#f97316',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#fdba74',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateSelectorText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  datePickerDone: {
    alignItems: 'flex-end',
    paddingVertical: 8,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
});
