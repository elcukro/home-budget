/**
 * StreakCounter - Displays current streak with fire emoji
 *
 * Shows the user's current daily streak in various formats:
 * - compact: Small pill for header display
 * - expanded: 7-day visual with emoji icons (inspired by EveryDollar)
 * - default: Medium-sized card
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak?: number;
  onPress?: () => void;
  compact?: boolean;
  variant?: 'default' | 'compact' | 'expanded';
  /** Date of last activity (ISO string) - used to calculate which days are active */
  lastActivityDate?: string;
}

// Day labels in Polish (Sunday = 0)
const DAY_LABELS = ['N', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

// Motivational messages based on streak length
const STREAK_MESSAGES: Record<string, string[]> = {
  zero: ['Zacznij dziś!', 'Czas na powrót!', 'Każdy dzień się liczy!'],
  low: ['Świetny początek!', 'Tak trzymaj!', 'Budujesz nawyk!'],
  medium: ['Nieźle Ci idzie!', 'Jesteś na dobrej drodze!', 'Konsekwencja popłaca!'],
  high: ['Jesteś rozpalony! 🔥', 'Niesamowity streak!', 'Finansowy wojownik!'],
};

function getStreakMessage(streak: number): string {
  let category: keyof typeof STREAK_MESSAGES;
  if (streak === 0) category = 'zero';
  else if (streak < 7) category = 'low';
  else if (streak < 30) category = 'medium';
  else category = 'high';

  const messages = STREAK_MESSAGES[category];
  return messages[Math.floor(Math.random() * messages.length)];
}

interface DayStatus {
  label: string;
  status: 'today' | 'past-active' | 'missed' | 'future';
  date: Date;
}

function getWeekDays(currentStreak: number, lastActivityDate?: string): DayStatus[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDay = today.getDay(); // 0 = Sunday

  // Start from Sunday of current week
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - todayDay);

  const days: DayStatus[] = [];

  // Calculate when the streak started
  const lastActivity = lastActivityDate ? new Date(lastActivityDate) : today;
  lastActivity.setHours(0, 0, 0, 0);

  // Streak start date
  const streakStartDate = new Date(lastActivity);
  streakStartDate.setDate(lastActivity.getDate() - currentStreak + 1);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);

    let status: DayStatus['status'];

    if (date.getTime() === today.getTime()) {
      // Today
      status = currentStreak > 0 ? 'today' : 'missed';
    } else if (date > today) {
      // Future
      status = 'future';
    } else if (date >= streakStartDate && date <= lastActivity) {
      // Within streak range
      status = 'past-active';
    } else {
      // Before streak or missed
      status = 'missed';
    }

    days.push({
      label: DAY_LABELS[i],
      status,
      date,
    });
  }

  return days;
}

export default function StreakCounter({
  currentStreak,
  longestStreak,
  onPress,
  compact = false,
  variant,
  lastActivityDate,
}: StreakCounterProps) {
  // Determine streak status for styling
  const isActive = currentStreak > 0;
  const isRecord = longestStreak && currentStreak >= longestStreak && currentStreak > 0;

  // Calculate week days for expanded view
  const weekDays = useMemo(() => getWeekDays(currentStreak, lastActivityDate), [currentStreak, lastActivityDate]);

  // Get motivational message
  const message = useMemo(() => getStreakMessage(currentStreak), [currentStreak]);

  // Handle backwards compatibility: compact prop maps to 'compact' variant
  const resolvedVariant = variant || (compact ? 'compact' : 'default');

  // Expanded variant with 7 days visual
  if (resolvedVariant === 'expanded') {
    return (
      <Pressable onPress={onPress} style={styles.expandedContainer}>
        {/* Header */}
        <View style={styles.expandedHeader}>
          <Text style={styles.expandedFireEmoji}>🔥</Text>
          <Text style={styles.expandedTitle}>
            {currentStreak}-dniowy streak
          </Text>
          {isRecord && currentStreak > 1 && (
            <View style={styles.expandedRecordBadge}>
              <Ionicons name="trophy" size={12} color="#f97316" />
            </View>
          )}
        </View>

        {/* Week Days */}
        <View style={styles.weekContainer}>
          {weekDays.map((day, i) => (
            <View key={i} style={styles.dayColumn}>
              <Text style={[
                styles.dayLabel,
                day.status === 'today' && styles.dayLabelToday,
              ]}>
                {day.label}
              </Text>
              <View style={[
                styles.dayCircle,
                day.status === 'today' && styles.dayCircleToday,
                day.status === 'past-active' && styles.dayCircleActive,
                day.status === 'missed' && styles.dayCircleMissed,
                day.status === 'future' && styles.dayCircleFuture,
              ]}>
                {day.status === 'today' && <Text style={styles.dayIcon}>🔥</Text>}
                {day.status === 'past-active' && <Text style={styles.dayIcon}>⚡</Text>}
                {day.status === 'missed' && <Text style={styles.dayIconMissed}>○</Text>}
                {day.status === 'future' && <Text style={styles.dayIconFuture}>○</Text>}
              </View>
              {(day.status === 'today' || day.status === 'past-active') && (
                <View style={styles.checkContainer}>
                  <Ionicons name="checkmark" size={12} color="#22c55e" />
                </View>
              )}
              {day.status === 'future' && <View style={styles.checkPlaceholder} />}
              {day.status === 'missed' && <View style={styles.checkPlaceholder} />}
            </View>
          ))}
        </View>

        {/* Motivational Message */}
        <Text style={styles.motivationalMessage}>{message}</Text>
      </Pressable>
    );
  }

  // Compact variant (for header)
  if (resolvedVariant === 'compact') {
    return (
      <Pressable onPress={onPress} style={styles.compactContainer}>
        <Text style={styles.fireEmoji}>🔥</Text>
        <Text style={[styles.compactNumber, isActive && styles.activeNumber]}>
          {currentStreak}
        </Text>
      </Pressable>
    );
  }

  // Default variant
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
  // Expanded version (7-day visual)
  expandedContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expandedFireEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  expandedRecordBadge: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 6,
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 8,
  },
  dayLabelToday: {
    color: '#f97316',
    fontWeight: '700',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleToday: {
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: '#f97316',
  },
  dayCircleActive: {
    backgroundColor: '#fef3c7',
  },
  dayCircleMissed: {
    backgroundColor: '#f3f4f6',
  },
  dayCircleFuture: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  dayIcon: {
    fontSize: 18,
  },
  dayIconMissed: {
    fontSize: 18,
    color: '#d1d5db',
  },
  dayIconFuture: {
    fontSize: 18,
    color: '#e5e7eb',
  },
  checkContainer: {
    marginTop: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkPlaceholder: {
    marginTop: 4,
    width: 16,
    height: 16,
  },
  motivationalMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },

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
