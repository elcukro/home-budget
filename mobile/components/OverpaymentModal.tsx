/**
 * OverpaymentModal - Modal for making loan overpayments
 *
 * Features:
 * - Input for overpayment amount
 * - "Pay full balance" quick button
 * - Warning when payment will close the loan
 * - Loading state during API call
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OverpaymentModalProps {
  visible: boolean;
  loanId: number;
  loanDescription: string;
  remainingBalance: number;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
  isLoading?: boolean;
}

export default function OverpaymentModal({
  visible,
  loanId,
  loanDescription,
  remainingBalance,
  onClose,
  onSubmit,
  isLoading = false,
}: OverpaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAmount('');
      setError(null);
    }
  }, [visible]);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const willCloseTheLoan = parsedAmount >= remainingBalance;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handlePayFullBalance = () => {
    setAmount(remainingBalance.toFixed(2).replace('.', ','));
  };

  const handleSubmit = async () => {
    if (parsedAmount <= 0) {
      setError('Podaj kwotę nadpłaty');
      return;
    }

    if (parsedAmount > remainingBalance * 1.1) {
      // Allow 10% over (for fees, interest adjustments)
      setError('Kwota przekracza pozostały dług');
      return;
    }

    setError(null);
    await onSubmit(parsedAmount);
  };

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
            <Text style={styles.title}>Nadpłata kredytu</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </Pressable>
          </View>

          {/* Loan Info */}
          <View style={styles.loanInfo}>
            <Ionicons name="business" size={20} color="#f97316" />
            <Text style={styles.loanDescription}>{loanDescription}</Text>
          </View>

          {/* Balance Info */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Pozostało do spłaty</Text>
            <Text style={styles.balanceValue}>
              {formatCurrency(remainingBalance)}
            </Text>
          </View>

          {/* Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Kwota nadpłaty</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0,00"
                keyboardType="decimal-pad"
                editable={!isLoading}
              />
              <Text style={styles.currency}>PLN</Text>
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* Quick Action */}
          <Pressable
            style={styles.quickButton}
            onPress={handlePayFullBalance}
            disabled={isLoading}
          >
            <Ionicons name="flash" size={18} color="#f97316" />
            <Text style={styles.quickButtonText}>Spłać całość</Text>
          </Pressable>

          {/* Warning */}
          {willCloseTheLoan && parsedAmount > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="trophy" size={20} color="#f59e0b" />
              <Text style={styles.warningText}>
                Ta nadpłata zamknie kredyt! Przygotuj się na celebrację!
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={[
              styles.submitButton,
              isLoading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading || parsedAmount <= 0}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>
                  {willCloseTheLoan ? 'Spłać i zamknij kredyt' : 'Potwierdź nadpłatę'}
                </Text>
              </>
            )}
          </Pressable>

          {/* Cancel Button */}
          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Anuluj</Text>
          </Pressable>
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
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  loanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loanDescription: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '500',
  },
  balanceCard: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#92400e',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#92400e',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    paddingVertical: 16,
  },
  currency: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 8,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef9c3',
    borderWidth: 1,
    borderColor: '#fde047',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#854d0e',
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#fdba74',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
});
