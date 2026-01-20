/**
 * StreakCounter - Displays current streak with fire emoji
 *
 * Shows the user's current daily streak in a compact, visually appealing format.
 * Used in the header of the Home screen.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak?: number;
  onPress?: () => void;
  compact?: boolean;
}

export default function StreakCounter({
  currentStreak,
  longestStreak,
  onPress,
  compact = false,
}: StreakCounterProps) {
  // Determine streak status for styling
  const isActive = currentStreak > 0;
  const isRecord = longestStreak && currentStreak >= longestStreak && currentStreak > 0;

  if (compact) {
    return (
      <Pressable onPress={onPress} style={styles.compactContainer}>
        <Text style={styles.fireEmoji}>🔥</Text>
        <Text style={[styles.compactNumber, isActive && styles.activeNumber]}>
          {currentStreak}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
        <Text style={styles.fireEmoji}>🔥</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.number, isActive && styles.activeNumber]}>
          {currentStreak}
        </Text>
        <Text style={styles.label}>
          {currentStreak === 1 ? 'dzień' : 'dni'}
        </Text>
      </View>
      {isRecord && currentStreak > 1 && (
        <View style={styles.recordBadge}>
          <Ionicons name="trophy" size={10} color="#f97316" />
        </View>
      )}
    </Pressable>
  );
}

/**
 * StreakCard - Larger version for achievements/stats screen
 */
export function StreakCard({
  currentStreak,
  longestStreak,
  onPress,
}: {
  currentStreak: number;
  longestStreak: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardFireEmoji}>🔥</Text>
        <Text style={styles.cardTitle}>Twój Streak</Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.streakMain}>
          <Text style={styles.cardNumber}>{currentStreak}</Text>
          <Text style={styles.cardLabel}>
            {currentStreak === 1 ? 'dzień z rzędu' : 'dni z rzędu'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.streakRecord}>
          <View style={styles.recordRow}>
            <Ionicons name="trophy-outline" size={16} color="#f97316" />
            <Text style={styles.recordLabel}>Najlepszy:</Text>
            <Text style={styles.recordValue}>{longestStreak} dni</Text>
          </View>
        </View>
      </View>

      {currentStreak >= longestStreak && currentStreak > 0 && (
        <View style={styles.newRecordBanner}>
          <Text style={styles.newRecordText}>Nowy rekord! 🎉</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Compact version (for header)
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  fireEmoji: {
    fontSize: 16,
  },
  compactNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },

  // Regular version
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconContainer: {
    backgroundColor: '#fff7ed',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  number: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9ca3af',
  },
  activeNumber: {
    color: '#f97316',
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
  },
  recordBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Card version (for stats screen)
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardFireEmoji: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardContent: {
    gap: 12,
  },
  streakMain: {
    alignItems: 'center',
  },
  cardNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#f97316',
  },
  cardLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: -4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  streakRecord: {
    alignItems: 'center',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  newRecordBanner: {
    backgroundColor: '#fff7ed',
    marginTop: 12,
    marginHorizontal: -16,
    marginBottom: -16,
    paddingVertical: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  newRecordText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
    textAlign: 'center',
  },
});
