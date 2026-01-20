/**
 * AchievementBadge - Displays achievement/badge icons
 *
 * Can show unlocked badges, locked badges, or badges with progress.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UnlockedBadge, BadgeProgress } from '../lib/api';

// ==========================================
// Small Badge (for lists/grids)
// ==========================================

interface SmallBadgeProps {
  badge: UnlockedBadge;
  onPress?: () => void;
}

export function SmallBadge({ badge, onPress }: SmallBadgeProps) {
  return (
    <Pressable onPress={onPress} style={styles.smallContainer}>
      <View style={styles.smallIconContainer}>
        <Text style={styles.smallIcon}>{badge.icon}</Text>
      </View>
      <Text style={styles.smallName} numberOfLines={1}>
        {badge.name}
      </Text>
    </Pressable>
  );
}

// ==========================================
// Badge Card (detailed view)
// ==========================================

interface BadgeCardProps {
  badge: UnlockedBadge;
  onPress?: () => void;
}

export function BadgeCard({ badge, onPress }: BadgeCardProps) {
  const categoryColor = getCategoryColor(badge.category);

  return (
    <Pressable onPress={onPress} style={styles.cardContainer}>
      <View style={[styles.cardIconContainer, { backgroundColor: categoryColor.bg }]}>
        <Text style={styles.cardIcon}>{badge.icon}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName}>{badge.name}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {badge.description}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.xpBadge}>
            <Ionicons name="star" size={12} color="#f97316" />
            <Text style={styles.xpText}>+{badge.xp_awarded} XP</Text>
          </View>
          <Text style={styles.cardDate}>
            {formatDate(badge.unlocked_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ==========================================
// Progress Badge (locked with progress)
// ==========================================

interface ProgressBadgeProps {
  progress: BadgeProgress;
  onPress?: () => void;
}

export function ProgressBadge({ progress, onPress }: ProgressBadgeProps) {
  const categoryColor = getCategoryColor(progress.category);
  const progressPercent = Math.min(100, Math.round(progress.progress_percent));

  return (
    <Pressable onPress={onPress} style={styles.progressContainer}>
      <View style={[styles.progressIconContainer, { backgroundColor: '#f3f4f6' }]}>
        <Text style={[styles.progressIcon, { opacity: 0.5 }]}>{progress.icon}</Text>
        {/* Progress ring overlay */}
        <View style={styles.progressRing}>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
      </View>
      <View style={styles.progressContent}>
        <Text style={styles.progressName}>{progress.name}</Text>
        <Text style={styles.progressDescription} numberOfLines={1}>
          {progress.description}
        </Text>
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercent}%`, backgroundColor: categoryColor.text },
            ]}
          />
        </View>
        <Text style={styles.progressValues}>
          {formatValue(progress.current_value)} / {formatValue(progress.target_value)}
        </Text>
      </View>
    </Pressable>
  );
}

// ==========================================
// Locked Badge Placeholder
// ==========================================

interface LockedBadgeProps {
  onPress?: () => void;
}

export function LockedBadge({ onPress }: LockedBadgeProps) {
  return (
    <Pressable onPress={onPress} style={styles.lockedContainer}>
      <View style={styles.lockedIconContainer}>
        <Ionicons name="lock-closed" size={20} color="#9ca3af" />
      </View>
      <Text style={styles.lockedText}>???</Text>
    </Pressable>
  );
}

// ==========================================
// Badge Row (horizontal scrollable list)
// ==========================================

interface BadgeRowProps {
  badges: UnlockedBadge[];
  maxVisible?: number;
  onBadgePress?: (badge: UnlockedBadge) => void;
  onSeeAllPress?: () => void;
}

export function BadgeRow({
  badges,
  maxVisible = 4,
  onBadgePress,
  onSeeAllPress,
}: BadgeRowProps) {
  const visibleBadges = badges.slice(0, maxVisible);
  const hasMore = badges.length > maxVisible;

  return (
    <View style={styles.rowContainer}>
      {visibleBadges.map((badge) => (
        <SmallBadge
          key={badge.badge_id}
          badge={badge}
          onPress={() => onBadgePress?.(badge)}
        />
      ))}
      {hasMore && (
        <Pressable onPress={onSeeAllPress} style={styles.seeMoreContainer}>
          <Text style={styles.seeMoreText}>+{badges.length - maxVisible}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ==========================================
// Helpers
// ==========================================

function getCategoryColor(category: string): { text: string; bg: string } {
  const colors: Record<string, { text: string; bg: string }> = {
    emergency_fund: { text: '#22c55e', bg: '#f0fdf4' },
    debt: { text: '#ef4444', bg: '#fef2f2' },
    savings: { text: '#3b82f6', bg: '#dbeafe' },
    consistency: { text: '#f97316', bg: '#fff7ed' },
    fire: { text: '#f97316', bg: '#fff7ed' },
  };
  return colors[category] || { text: '#6b7280', bg: '#f3f4f6' };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Dziś';
  if (diffDays === 1) return 'Wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  // Small badge
  smallContainer: {
    alignItems: 'center',
    width: 64,
  },
  smallIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  smallIcon: {
    fontSize: 24,
  },
  smallName: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Badge card
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Progress badge
  progressContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  progressIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressIcon: {
    fontSize: 28,
  },
  progressRing: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  progressPercent: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  progressContent: {
    flex: 1,
    justifyContent: 'center',
  },
  progressName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  progressDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressValues: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },

  // Locked badge
  lockedContainer: {
    alignItems: 'center',
    width: 64,
  },
  lockedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedText: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
  },

  // Badge row
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  seeMoreContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});

// Default export for convenience
export default SmallBadge;
