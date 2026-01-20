/**
 * LevelProgress - Displays user's XP level and progress
 *
 * Shows the current level, XP progress bar, and level name.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Level configuration matching backend
const LEVEL_INFO: Record<number, { name: string; icon: string; color: string }> = {
  1: { name: 'Początkujący', icon: '🌱', color: '#9ca3af' },
  2: { name: 'Świadomy', icon: '👀', color: '#3b82f6' },
  3: { name: 'Oszczędny', icon: '💰', color: '#22c55e' },
  4: { name: 'Strateg', icon: '🎯', color: '#8b5cf6' },
  5: { name: 'Inwestor', icon: '📈', color: '#f97316' },
  6: { name: 'Wolny Finansowo', icon: '🏝️', color: '#eab308' },
};

// ==========================================
// Compact Level Badge (for header)
// ==========================================

interface CompactLevelProps {
  level: number;
  totalXp: number;
  onPress?: () => void;
}

export function CompactLevel({ level, totalXp, onPress }: CompactLevelProps) {
  const levelInfo = LEVEL_INFO[level] || LEVEL_INFO[1];

  return (
    <Pressable onPress={onPress} style={styles.compactContainer}>
      <Text style={styles.compactIcon}>{levelInfo.icon}</Text>
      <Text style={[styles.compactLevel, { color: levelInfo.color }]}>
        Lvl {level}
      </Text>
    </Pressable>
  );
}

// ==========================================
// Level Progress Bar
// ==========================================

interface LevelProgressBarProps {
  level: number;
  levelName: string;
  totalXp: number;
  xpForNext: number;
  xpProgress: number;
  onPress?: () => void;
}

export function LevelProgressBar({
  level,
  levelName,
  totalXp,
  xpForNext,
  xpProgress,
  onPress,
}: LevelProgressBarProps) {
  const levelInfo = LEVEL_INFO[level] || LEVEL_INFO[1];
  const progressPercent = xpForNext > 0 ? Math.min(100, (xpProgress / xpForNext) * 100) : 100;
  const isMaxLevel = level >= 6;

  return (
    <Pressable onPress={onPress} style={styles.barContainer}>
      <View style={styles.barHeader}>
        <View style={styles.barLevelInfo}>
          <Text style={styles.barIcon}>{levelInfo.icon}</Text>
          <View>
            <Text style={styles.barLevelName}>{levelName}</Text>
            <Text style={styles.barLevelNumber}>Poziom {level}</Text>
          </View>
        </View>
        <View style={styles.barXpInfo}>
          <Ionicons name="star" size={14} color="#f97316" />
          <Text style={styles.barXpText}>{totalXp} XP</Text>
        </View>
      </View>

      {!isMaxLevel && (
        <>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%`, backgroundColor: levelInfo.color },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {xpProgress} / {xpForNext} XP do poziomu {level + 1}
          </Text>
        </>
      )}

      {isMaxLevel && (
        <View style={styles.maxLevelBanner}>
          <Ionicons name="trophy" size={16} color="#eab308" />
          <Text style={styles.maxLevelText}>Maksymalny poziom osiągnięty!</Text>
        </View>
      )}
    </Pressable>
  );
}

// ==========================================
// Level Card (detailed view for stats screen)
// ==========================================

interface LevelCardProps {
  level: number;
  levelName: string;
  totalXp: number;
  xpForNext: number;
  xpProgress: number;
  onPress?: () => void;
}

export function LevelCard({
  level,
  levelName,
  totalXp,
  xpForNext,
  xpProgress,
  onPress,
}: LevelCardProps) {
  const levelInfo = LEVEL_INFO[level] || LEVEL_INFO[1];
  const nextLevelInfo = LEVEL_INFO[level + 1];
  const progressPercent = xpForNext > 0 ? Math.min(100, (xpProgress / xpForNext) * 100) : 100;
  const isMaxLevel = level >= 6;

  return (
    <Pressable onPress={onPress} style={styles.cardContainer}>
      {/* Current Level */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconContainer, { backgroundColor: `${levelInfo.color}15` }]}>
          <Text style={styles.cardIcon}>{levelInfo.icon}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardLevelName}>{levelName}</Text>
          <Text style={styles.cardLevelNumber}>Poziom {level}</Text>
        </View>
        <View style={styles.cardXpBadge}>
          <Ionicons name="star" size={16} color="#f97316" />
          <Text style={styles.cardXpText}>{totalXp}</Text>
        </View>
      </View>

      {/* Progress Section */}
      {!isMaxLevel && nextLevelInfo && (
        <View style={styles.cardProgress}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Postęp do następnego poziomu</Text>
            <Text style={styles.progressPercent}>{Math.round(progressPercent)}%</Text>
          </View>

          <View style={styles.progressBarLarge}>
            <View
              style={[
                styles.progressBarFillLarge,
                { width: `${progressPercent}%`, backgroundColor: levelInfo.color },
              ]}
            />
          </View>

          <View style={styles.progressDetails}>
            <Text style={styles.progressXp}>
              <Text style={styles.progressXpCurrent}>{xpProgress}</Text>
              <Text style={styles.progressXpSlash}> / </Text>
              <Text style={styles.progressXpTotal}>{xpForNext} XP</Text>
            </Text>
          </View>

          {/* Next Level Preview */}
          <View style={styles.nextLevelPreview}>
            <View style={styles.nextLevelLine} />
            <View style={[styles.nextLevelBadge, { borderColor: nextLevelInfo.color }]}>
              <Text style={styles.nextLevelIcon}>{nextLevelInfo.icon}</Text>
              <Text style={[styles.nextLevelName, { color: nextLevelInfo.color }]}>
                {nextLevelInfo.name}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Max Level Banner */}
      {isMaxLevel && (
        <View style={styles.maxLevelCard}>
          <Ionicons name="trophy" size={24} color="#eab308" />
          <Text style={styles.maxLevelCardText}>
            Gratulacje! Osiągnąłeś najwyższy poziom!
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  // Compact version
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  compactIcon: {
    fontSize: 14,
  },
  compactLevel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Progress bar version
  barContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  barLevelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barIcon: {
    fontSize: 24,
  },
  barLevelName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  barLevelNumber: {
    fontSize: 12,
    color: '#6b7280',
  },
  barXpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barXpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  maxLevelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef9c3',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  maxLevelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ca8a04',
  },

  // Card version
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
    gap: 12,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 32,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardLevelName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardLevelNumber: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  cardXpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  cardProgress: {
    marginTop: 20,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  progressBarLarge: {
    height: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFillLarge: {
    height: '100%',
    borderRadius: 6,
  },
  progressDetails: {
    alignItems: 'center',
    marginTop: 8,
  },
  progressXp: {
    fontSize: 14,
  },
  progressXpCurrent: {
    fontWeight: '700',
    color: '#1f2937',
  },
  progressXpSlash: {
    color: '#9ca3af',
  },
  progressXpTotal: {
    color: '#6b7280',
  },
  nextLevelPreview: {
    marginTop: 16,
    alignItems: 'center',
  },
  nextLevelLine: {
    width: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
  },
  nextLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    opacity: 0.7,
  },
  nextLevelIcon: {
    fontSize: 20,
  },
  nextLevelName: {
    fontSize: 14,
    fontWeight: '600',
  },
  maxLevelCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fef9c3',
    paddingVertical: 16,
    borderRadius: 12,
  },
  maxLevelCardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ca8a04',
  },
});

// Default export
export default LevelProgressBar;
