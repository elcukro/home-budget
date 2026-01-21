/**
 * FireRoadmap - Visual timeline to FIRE
 *
 * Inspired by EveryDollar's "Your Roadmap" with:
 * - Timeline with milestones from Today to FIRE
 * - "You are here" marker
 * - Current net worth and projected FIRE number
 * - Visual representation of Baby Steps progress
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Step {
  id: number;
  name: string;
  shortName: string;
  emoji: string;
  isCompleted: boolean;
  isInProgress: boolean;
  progress: number;
}

interface FireRoadmapProps {
  steps: Step[];
  currentStepIndex: number;
  currentNetWorth?: number;
  projectedFireNumber?: number;
  estimatedFireDate?: string;
  monthlyContribution?: number;
  formatCurrency?: (amount: number) => string;
}

// Default step emojis
const STEP_EMOJIS = ['🛡️', '💳', '💰', '📈', '👶', '🏠', '🔥'];

export default function FireRoadmap({
  steps,
  currentStepIndex,
  currentNetWorth = 0,
  projectedFireNumber = 0,
  estimatedFireDate,
  monthlyContribution = 0,
  formatCurrency = (amount) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount),
}: FireRoadmapProps) {
  // Calculate overall progress percentage
  const completedSteps = steps.filter((s) => s.isCompleted).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📍</Text>
        <Text style={styles.headerTitle}>Twoja Roadmapa do FIRE</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Obecna wartość</Text>
          <Text style={styles.statValue}>{formatCurrency(currentNetWorth)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Cel FIRE</Text>
          <Text style={[styles.statValue, styles.statValueTarget]}>
            {formatCurrency(projectedFireNumber)}
          </Text>
        </View>
      </View>

      {/* Vertical Timeline */}
      <View style={styles.verticalTimeline}>
        {steps.map((step, index) => {
          const isCompleted = step.isCompleted;
          const isCurrent = index === currentStepIndex && !isCompleted;
          const isFuture = !isCompleted && !isCurrent;
          const isLast = index === steps.length - 1;
          // Check if next step is also completed (for line color)
          const nextStepCompleted = index < steps.length - 1 && steps[index + 1]?.isCompleted;

          return (
            <View key={step.id} style={styles.timelineRow}>
              {/* Left side: Circle + Line */}
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.verticalCircle,
                    isCompleted && styles.verticalCircleCompleted,
                    isCurrent && styles.verticalCircleCurrent,
                    isFuture && styles.verticalCircleFuture,
                  ]}
                >
                  {/* Always show emoji */}
                  <Text style={styles.verticalEmoji}>
                    {step.emoji || STEP_EMOJIS[index] || '○'}
                  </Text>
                </View>
                {/* Connecting line */}
                {!isLast && (
                  <View
                    style={[
                      styles.verticalLine,
                      (isCompleted && nextStepCompleted) && styles.verticalLineCompleted,
                    ]}
                  />
                )}
              </View>

              {/* Right side: Content */}
              <View style={styles.timelineRight}>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text
                      style={[
                        styles.timelineStepName,
                        isCompleted && styles.timelineStepNameCompleted,
                        isCurrent && styles.timelineStepNameCurrent,
                        isFuture && styles.timelineStepNameFuture,
                      ]}
                    >
                      {step.name}
                    </Text>
                    {/* Status badge */}
                    {isCompleted && (
                      <View style={styles.badgeCompleted}>
                        <Ionicons name="checkmark" size={10} color="#166534" />
                      </View>
                    )}
                    {isCurrent && (
                      <View style={styles.badgeCurrent}>
                        <Text style={styles.badgeCurrentText}>Teraz</Text>
                      </View>
                    )}
                  </View>
                  {/* Progress for current step */}
                  {isCurrent && step.progress > 0 && (
                    <View style={styles.timelineProgressContainer}>
                      <View style={styles.timelineProgressBar}>
                        <View
                          style={[
                            styles.timelineProgressFill,
                            { width: `${Math.min(step.progress, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.timelineProgressText}>
                        {Math.round(step.progress)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Additional Info */}
      {(estimatedFireDate || monthlyContribution > 0) && (
        <View style={styles.infoContainer}>
          {monthlyContribution > 0 && (
            <View style={styles.infoItem}>
              <Ionicons name="trending-up-outline" size={16} color="#22c55e" />
              <Text style={styles.infoText}>
                Miesięczne oszczędności: {formatCurrency(monthlyContribution)}
              </Text>
            </View>
          )}
          {estimatedFireDate && (
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              <Text style={styles.infoText}>
                Prognozowana data: {estimatedFireDate}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * MilestoneCard - Individual step card in the roadmap
 */
export function MilestoneCard({
  stepNumber,
  title,
  description,
  emoji,
  status,
  progress,
  currentAmount,
  targetAmount,
  completionDate,
  onPress,
  formatCurrency = (amount) =>
    new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
    }).format(amount),
}: {
  stepNumber: number;
  title: string;
  description: string;
  emoji: string;
  status: 'completed' | 'in_progress' | 'not_started';
  progress: number;
  currentAmount?: number | null;
  targetAmount?: number | null;
  completionDate?: string | null;
  onPress?: () => void;
  formatCurrency?: (amount: number) => string;
}) {
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';

  return (
    <View
      style={[
        styles.card,
        isCompleted && styles.cardCompleted,
        isInProgress && styles.cardInProgress,
      ]}
    >
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIcon,
            isCompleted && styles.cardIconCompleted,
            isInProgress && styles.cardIconInProgress,
          ]}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={20} color="#fff" />
          ) : (
            <Text style={styles.cardEmoji}>{emoji}</Text>
          )}
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardStep}>Krok {stepNumber}</Text>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {/* Status Badge */}
        {isCompleted && (
          <View style={styles.statusBadgeCompleted}>
            <Text style={styles.statusBadgeText}>✓ UKOŃCZONY</Text>
          </View>
        )}
        {isInProgress && (
          <View style={styles.statusBadgeInProgress}>
            <Text style={styles.statusBadgeTextInProgress}>W TRAKCIE</Text>
          </View>
        )}
        {status === 'not_started' && (
          <View style={styles.statusBadgeNotStarted}>
            <Text style={styles.statusBadgeTextNotStarted}>OCZEKUJE</Text>
          </View>
        )}
      </View>

      {/* Progress Bar for in-progress steps */}
      {isInProgress && progress > 0 && (
        <View style={styles.cardProgressContainer}>
          <View style={styles.cardProgressBar}>
            <View
              style={[
                styles.cardProgressFill,
                { width: `${Math.min(progress, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.cardProgressText}>{Math.round(progress)}%</Text>
        </View>
      )}

      {/* Amount info */}
      {(currentAmount !== null || targetAmount !== null) && (
        <View style={styles.cardAmounts}>
          {targetAmount !== null && targetAmount !== undefined && (
            <View style={styles.cardAmountRow}>
              <Text style={styles.cardAmountLabel}>Cel:</Text>
              <Text style={styles.cardAmountValue}>
                {formatCurrency(targetAmount)}
              </Text>
            </View>
          )}
          {currentAmount !== null && currentAmount !== undefined && (
            <View style={styles.cardAmountRow}>
              <Text style={styles.cardAmountLabel}>Aktualne:</Text>
              <Text
                style={[
                  styles.cardAmountValue,
                  isCompleted && styles.cardAmountValueSuccess,
                ]}
              >
                {formatCurrency(currentAmount)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Completion date */}
      {isCompleted && completionDate && (
        <Text style={styles.cardCompletionDate}>
          Ukończono {new Date(completionDate).toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Main Container
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },

  // Stats Cards
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  statValueTarget: {
    color: '#f97316',
  },

  // Vertical Timeline
  verticalTimeline: {
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineLeft: {
    width: 44,
    alignItems: 'center',
  },
  verticalCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  verticalCircleCompleted: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  verticalCircleCurrent: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#f97316',
  },
  verticalCircleFuture: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  verticalEmoji: {
    fontSize: 14,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  verticalLineCompleted: {
    backgroundColor: '#22c55e',
  },
  timelineRight: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  timelineContent: {
    minHeight: 32,
    justifyContent: 'center',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineStepName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  timelineStepNameCompleted: {
    color: '#22c55e',
    fontWeight: '600',
  },
  timelineStepNameCurrent: {
    color: '#1f2937',
    fontWeight: '700',
  },
  timelineStepNameFuture: {
    color: '#9ca3af',
  },
  badgeCompleted: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCurrent: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCurrentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f97316',
  },
  timelineProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  timelineProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#fed7aa',
    borderRadius: 3,
    overflow: 'hidden',
  },
  timelineProgressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  timelineProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
    minWidth: 36,
  },

  // Info Container
  infoContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#4b5563',
  },

  // Milestone Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  cardInProgress: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIconCompleted: {
    backgroundColor: '#22c55e',
  },
  cardIconInProgress: {
    backgroundColor: '#f97316',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardStep: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadgeCompleted: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  statusBadgeInProgress: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeTextInProgress: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c2410c',
  },
  statusBadgeNotStarted: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeTextNotStarted: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
  },

  // Progress
  cardProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  cardProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#fed7aa',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardProgressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 4,
  },
  cardProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
    minWidth: 40,
    textAlign: 'right',
  },

  // Amounts
  cardAmounts: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 4,
  },
  cardAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardAmountLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardAmountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardAmountValueSuccess: {
    color: '#22c55e',
  },
  cardCompletionDate: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 8,
  },
});
