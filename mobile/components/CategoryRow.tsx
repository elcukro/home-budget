/**
 * CategoryRow - Displays a category with emoji, progress bar, and status
 *
 * Inspired by YNAB's colorful category display with:
 * - Emoji + category name
 * - Spent amount + optional budget
 * - Progress bar showing spent/budget ratio
 * - Status label (Funded, Partial, Overspent)
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getCategoryConfig,
  getBudgetStatus,
  STATUS_CONFIG,
  type BudgetStatus,
} from '@/constants/categories';

interface CategoryRowProps {
  /** Category key (e.g., 'housing', 'food') */
  category: string;
  /** Amount spent in this category */
  spent: number;
  /** Optional budget amount for this category */
  budget?: number;
  /** Number of transactions in this category */
  transactionCount?: number;
  /** Callback when row is pressed */
  onPress?: () => void;
  /** Show expanded details */
  showDetails?: boolean;
  /** Format function for currency */
  formatCurrency?: (amount: number) => string;
}

export default function CategoryRow({
  category,
  spent,
  budget,
  transactionCount,
  onPress,
  showDetails = false,
  formatCurrency = (amount) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(amount),
}: CategoryRowProps) {
  const config = getCategoryConfig(category);
  const hasBudget = budget !== undefined && budget > 0;
  const status: BudgetStatus = hasBudget ? getBudgetStatus(spent, budget) : 'empty';
  const statusConfig = STATUS_CONFIG[status];
  const progressRatio = hasBudget ? Math.min(spent / budget, 1.2) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
    >
      {/* Left side: Emoji + Name */}
      <View style={styles.leftSection}>
        <View style={[styles.emojiContainer, { backgroundColor: config.backgroundColor }]}>
          <Text style={styles.emoji}>{config.emoji}</Text>
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.categoryName}>{config.label}</Text>
          {transactionCount !== undefined && (
            <Text style={styles.transactionCount}>
              {transactionCount} {transactionCount === 1 ? 'transakcja' : 'transakcji'}
            </Text>
          )}
        </View>
      </View>

      {/* Right side: Amount + Status */}
      <View style={styles.rightSection}>
        <Text style={styles.amount}>{formatCurrency(spent)}</Text>
        {hasBudget && (
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
              {statusConfig.label}
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar (when budget is set) */}
      {hasBudget && showDetails && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progressRatio * 100, 100)}%`,
                  backgroundColor:
                    status === 'overspent'
                      ? '#ef4444'
                      : status === 'funded'
                        ? '#22c55e'
                        : config.textColor,
                },
              ]}
            />
            {/* Overspent indicator */}
            {status === 'overspent' && (
              <View
                style={[
                  styles.overspentIndicator,
                  {
                    width: `${Math.min((progressRatio - 1) * 100, 20)}%`,
                  },
                ]}
              />
            )}
          </View>
          <Text style={styles.progressText}>
            {formatCurrency(spent)} / {formatCurrency(budget)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * CategoryRowCompact - Smaller version for list views
 */
export function CategoryRowCompact({
  category,
  amount,
  onPress,
  formatCurrency = (amount) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(amount),
}: {
  category: string;
  amount: number;
  onPress?: () => void;
  formatCurrency?: (amount: number) => string;
}) {
  const config = getCategoryConfig(category);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactContainer,
        pressed && styles.containerPressed,
      ]}
    >
      <Text style={styles.compactEmoji}>{config.emoji}</Text>
      <Text style={styles.compactName} numberOfLines={1}>
        {config.label}
      </Text>
      <Text style={[styles.compactAmount, { color: config.textColor }]}>
        {formatCurrency(amount)}
      </Text>
    </Pressable>
  );
}

/**
 * CategoryHeader - Used for section headers in grouped lists
 */
export function CategoryHeader({
  category,
  total,
  itemCount,
  isExpanded,
  onToggle,
  formatCurrency = (amount) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(amount),
}: {
  category: string;
  total: number;
  itemCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  formatCurrency?: (amount: number) => string;
}) {
  const config = getCategoryConfig(category);

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.headerContainer,
        pressed && styles.containerPressed,
      ]}
    >
      <View style={styles.headerLeft}>
        <View style={[styles.emojiContainer, { backgroundColor: config.backgroundColor }]}>
          <Text style={styles.emoji}>{config.emoji}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{config.label}</Text>
          <Text style={styles.headerCount}>
            {itemCount} {itemCount === 1 ? 'wydatek' : 'wydatków'}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <Text style={[styles.headerTotal, { color: config.textColor }]}>
          {formatCurrency(total)}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9ca3af"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Main Container
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  containerPressed: {
    opacity: 0.8,
    backgroundColor: '#f9fafb',
  },

  // Left Section
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 22,
  },
  nameContainer: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  transactionCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },

  // Right Section
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Progress Section
  progressSection: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  overspentIndicator: {
    height: '100%',
    backgroundColor: '#fca5a5',
  },
  progressText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'right',
  },

  // Compact Version
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  compactEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  compactName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  compactAmount: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Header Version
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerCount: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTotal: {
    fontSize: 16,
    fontWeight: '600',
  },
});
