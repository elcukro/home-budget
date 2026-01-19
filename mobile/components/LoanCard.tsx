import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Loan } from '@/lib/api';

interface LoanCardProps {
  loan: Loan;
  formatCurrency: (amount: number) => string;
}

export default function LoanCard({ loan, formatCurrency }: LoanCardProps) {
  const progress = Math.min(Math.max(loan.progress, 0), 100);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: getProgressBgColor() }]}>
          <Ionicons name="business-outline" size={18} color={getProgressColor()} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {loan.description}
          </Text>
          <Text style={styles.interestRate}>
            {loan.interest_rate.toFixed(2)}% oprocentowanie
          </Text>
        </View>
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
          <Text style={styles.detailValue}>{formatCurrency(loan.balance)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Rata miesięczna</Text>
          <Text style={styles.detailValue}>{formatCurrency(loan.monthly_payment)}</Text>
        </View>
      </View>

      {/* Additional info if available */}
      {loan.next_payment_date && (
        <View style={styles.nextPayment}>
          <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
          <Text style={styles.nextPaymentText}>
            Następna rata: {new Date(loan.next_payment_date).toLocaleDateString('pl-PL')}
          </Text>
        </View>
      )}
    </View>
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
});
