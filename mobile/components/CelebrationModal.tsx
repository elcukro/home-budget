/**
 * CelebrationModal - Full-screen celebration for achievements
 *
 * Shows when user:
 * - Unlocks a new badge
 * - Levels up
 * - Hits a streak milestone
 * - Pays off mortgage (renders special MortgageCelebrationModal)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CelebrationData } from '../stores/gamification';
import MortgageCelebrationModal from './MortgageCelebrationModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CelebrationModalProps {
  celebration: CelebrationData | null;
  onDismiss: () => void;
}

export default function CelebrationModal({
  celebration,
  onDismiss,
}: CelebrationModalProps) {
  // For mortgage payoff, use the special celebration modal
  if (celebration?.type === 'mortgage_paid_off' && celebration.mortgageData) {
    return (
      <MortgageCelebrationModal
        celebration={celebration.mortgageData}
        onDismiss={onDismiss}
      />
    );
  }
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (celebration) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      confettiAnim.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [celebration]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!celebration) return null;

  const content = getCelebrationContent(celebration);

  return (
    <Modal transparent visible={!!celebration} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        {/* Confetti decoration */}
        <ConfettiDecoration animation={confettiAnim} />

        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Icon/Emoji */}
          <View style={[styles.iconContainer, { backgroundColor: content.color + '20' }]}>
            <Text style={styles.icon}>{content.icon}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{content.title}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{content.subtitle}</Text>

          {/* Description */}
          {content.description && (
            <Text style={styles.description}>{content.description}</Text>
          )}

          {/* XP Badge */}
          {celebration.xpEarned && celebration.xpEarned > 0 && (
            <View style={styles.xpBadge}>
              <Ionicons name="star" size={16} color="#f97316" />
              <Text style={styles.xpText}>+{celebration.xpEarned} XP</Text>
            </View>
          )}

          {/* Continue Button */}
          <Pressable style={styles.button} onPress={handleDismiss}>
            <Text style={styles.buttonText}>Kontynuuj</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ==========================================
// Confetti Decoration
// ==========================================

function ConfettiDecoration({ animation }: { animation: Animated.Value }) {
  const confettiItems = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * SCREEN_WIDTH,
    delay: Math.random() * 500,
    color: ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899'][i % 5],
    size: 8 + Math.random() * 8,
  }));

  return (
    <View style={styles.confettiContainer}>
      {confettiItems.map((item) => (
        <Animated.View
          key={item.id}
          style={[
            styles.confetti,
            {
              left: item.left,
              width: item.size,
              height: item.size,
              backgroundColor: item.color,
              transform: [
                {
                  translateY: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 600],
                  }),
                },
                {
                  rotate: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${360 + Math.random() * 360}deg`],
                  }),
                },
              ],
              opacity: animation.interpolate({
                inputRange: [0, 0.8, 1],
                outputRange: [1, 1, 0],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

// ==========================================
// Helper Functions
// ==========================================

interface CelebrationContent {
  icon: string;
  title: string;
  subtitle: string;
  description?: string;
  color: string;
}

function getCelebrationContent(celebration: CelebrationData): CelebrationContent {
  switch (celebration.type) {
    case 'badge':
      return {
        icon: celebration.badge?.icon || '🏆',
        title: 'Nowa Odznaka!',
        subtitle: celebration.badge?.name || 'Osiągnięcie',
        description: celebration.badge?.description,
        color: '#f97316',
      };

    case 'level_up':
      return {
        icon: getLevelIcon(celebration.newLevel || 1),
        title: 'Awans!',
        subtitle: `Osiągnąłeś Poziom ${celebration.newLevel}`,
        description: getLevelName(celebration.newLevel || 1),
        color: '#8b5cf6',
      };

    case 'streak_milestone':
      return {
        icon: '🔥',
        title: 'Kamień Milowy!',
        subtitle: `${celebration.newStreak} dni z rzędu!`,
        description: celebration.message,
        color: '#ef4444',
      };

    case 'checkin':
      return {
        icon: '✅',
        title: 'Zameldowano!',
        subtitle: celebration.message || 'Świetnie!',
        color: '#22c55e',
      };

    default:
      return {
        icon: '🎉',
        title: 'Gratulacje!',
        subtitle: 'Osiągnąłeś coś świetnego!',
        color: '#f97316',
      };
  }
}

function getLevelIcon(level: number): string {
  const icons: Record<number, string> = {
    1: '🌱',
    2: '👀',
    3: '💰',
    4: '🎯',
    5: '📈',
    6: '🏝️',
  };
  return icons[level] || '⭐';
}

function getLevelName(level: number): string {
  const names: Record<number, string> = {
    1: 'Początkujący',
    2: 'Świadomy',
    3: 'Oszczędny',
    4: 'Strateg',
    5: 'Inwestor',
    6: 'Wolny Finansowo',
  };
  return names[level] || '';
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    top: -50,
    borderRadius: 2,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 24,
  },
  xpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316',
  },
  button: {
    backgroundColor: '#f97316',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
