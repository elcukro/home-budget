import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Loan } from '@/lib/api';

// Loan type icons mapping
const LOAN_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  mortgage: 'home-outline',
  car: 'car-outline',
  personal: 'cash-outline',
  student: 'school-outline',
  credit_card: 'card-outline',
  cash_loan: 'hand-left-outline',
  installment: 'cart-outline',
  leasing: 'document-text-outline',
  overdraft: 'wallet-outline',
  other: 'ellipse-outline',
};

interface LoanCardProps {
  loan: Loan;
  formatCurrency: (amount: number) => string;
  onArchive?: (loanId: number) => void;
}

export default function LoanCard({ loan, formatCurrency, onArchive }: LoanCardProps) {
  const router = useRouter();
  const progress = Math.min(Math.max(loan.progress ?? 0, 0), 100);
  const interestRate = loan.interestRate ?? 0;
  const balance = loan.balance ?? 0;
  const monthlyPayment = loan.monthlyPayment ?? 0;

  // Get icon based on loan type
  const getLoanIcon = (): keyof typeof Ionicons.glyphMap => {
    if (loan.loan_type && LOAN_TYPE_ICONS[loan.loan_type]) {
      return LOAN_TYPE_ICONS[loan.loan_type];
    }
    return 'business-outline'; // default
  };

  // Determine color based on progress
  const getProgressColor = () => {
    if (progress >= 75) return '#22c55e'; // green - almost done!
    if (progress >= 50) return '#f97316'; // orange - halfway
    return '#3b82f6'; // blue - early stage
  };

  const getProgressBgColor = () => {
    if (progress >= 75) return '#dcfce7';
    if (progress >= 50) return '#ffedd5';
    return '#dbeafe';
  };

  const handlePress = () => {
    router.push(`/loans/${loan.id}`);
  };

  const handleArchive = () => {
    Alert.alert(
      'Archiwizuj kredyt',
      `Czy na pewno chcesz zarchiwizować kredyt "${loan.description}"? Kredyt zostanie usunięty z listy aktywnych kredytów.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Archiwizuj',
          style: 'destructive',
          onPress: () => onArchive?.(Number(loan.id)),
        },
      ]
    );
  };

  const isPaidOff = balance === 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: getProgressBgColor() }]}>
          <Ionicons name={getLoanIcon()} size={18} color={getProgressColor()} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {loan.description}
          </Text>
          <Text style={styles.interestRate}>
            {interestRate.toFixed(2)}% oprocentowanie
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: getProgressColor(),
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: getProgressColor() }]}>
          {progress.toFixed(0)}%
        </Text>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Pozostało</Text>
          <Text style={styles.detailValue}>{formatCurrency(balance)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Rata miesięczna</Text>
          <Text style={styles.detailValue}>{formatCurrency(monthlyPayment)}</Text>
        </View>
      </View>

      {/* Additional info if available */}
      {loan.next_payment_date && !isPaidOff && (
        <View style={styles.nextPayment}>
          <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
          <Text style={styles.nextPaymentText}>
            Następna rata: {new Date(loan.next_payment_date).toLocaleDateString('pl-PL')}
          </Text>
        </View>
      )}

      {/* Archive button for paid-off loans */}
      {isPaidOff && onArchive && (
        <Pressable style={styles.archiveButton} onPress={handleArchive}>
          <Ionicons name="archive-outline" size={16} color="#22c55e" />
          <Text style={styles.archiveButtonText}>Archiwizuj spłacony kredyt</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  interestRate: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  details: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  nextPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  nextPaymentText: {
    fontSize: 13,
    color: '#6b7280',
  },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
    backgroundColor: '#f0fdf4',
    marginHorizontal: -16,
    marginBottom: -16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  archiveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22c55e',
  },
});
