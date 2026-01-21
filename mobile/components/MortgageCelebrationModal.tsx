/**
 * MortgageCelebrationModal - Premium celebration for mortgage payoff
 *
 * This is a special moment - the user has paid off their mortgage!
 * We want to make this feel like a HUGE accomplishment.
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
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// LinearGradient doesn't work in Expo Go, so we use a fallback
let LinearGradient: any = null;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  // LinearGradient not available
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MortgageStats {
  total_paid?: number;
  total_payments?: number;
  months_to_payoff?: number;
  years_to_payoff?: number;
  overpayments_total?: number;
  overpayment_count?: number;
  first_payment_date?: string;
  last_payment_date?: string;
}

interface MortgageCelebrationData {
  type: 'mortgage_paid_off';
  title: string;
  subtitle: string;
  loan_description?: string;
  stats?: MortgageStats;
  xp_earned?: number;
  badge?: {
    name: string;
    icon: string;
    xp_awarded: number;
  };
}

interface MortgageCelebrationModalProps {
  celebration: MortgageCelebrationData | null;
  onDismiss: () => void;
}

export default function MortgageCelebrationModal({
  celebration,
  onDismiss,
}: MortgageCelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const houseAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(0),
      // Pre-compute random values
      left: Math.random() * SCREEN_WIDTH,
      startY: Math.random() * SCREEN_HEIGHT * 0.3, // Start from top 30% of screen
      size: 10 + Math.random() * 10,
      isRound: Math.random() > 0.5,
      colorIndex: i % 7,
      delay: Math.random() * 500,
      duration: 3000 + Math.random() * 2000,
      xDrift: (Math.random() - 0.5) * 150,
    }))
  ).current;

  useEffect(() => {
    if (celebration) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      houseAnim.setValue(0);
      statsAnim.setValue(0);

      // Reset confetti animations
      confettiAnims.forEach((anim) => {
        anim.translateY.setValue(anim.startY);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.opacity.setValue(0);
      });

      // Start animations sequence
      Animated.sequence([
        // Fade in overlay
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Bounce in main content
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        // Bounce house icon
        Animated.spring(houseAnim, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        // Slide in stats
        Animated.spring(statsAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Start confetti animations
      confettiAnims.forEach((anim) => {
        Animated.sequence([
          Animated.delay(anim.delay),
          Animated.parallel([
            // Fade in quickly
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // Fall down slowly
            Animated.timing(anim.translateY, {
              toValue: SCREEN_HEIGHT + 100,
              duration: anim.duration,
              useNativeDriver: true,
            }),
            // Drift sideways
            Animated.timing(anim.translateX, {
              toValue: anim.xDrift,
              duration: anim.duration,
              useNativeDriver: true,
            }),
            // Rotate
            Animated.timing(anim.rotate, {
              toValue: 360 * 3,
              duration: anim.duration,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }
  }, [celebration]);

  const handleShare = async () => {
    try {
      const loanName = celebration?.loan_description || 'kredyt';
      const message = `Spłaciłem ${loanName}! 🏆🎉\n\nKolejny dług mniej! Krok bliżej do wolności finansowej!\n\n#DebtFree #FinancialFreedom #FiredUp`;

      await Share.share({
        message,
        title: `Spłaciłem ${loanName}!`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!celebration) return null;

  const stats = celebration.stats || {};

  return (
    <Modal transparent visible={!!celebration} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        {/* Confetti */}
        {confettiAnims.map((anim, index) => {
          const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
          return (
            <Animated.View
              key={index}
              style={[
                styles.confetti,
                {
                  left: anim.left,
                  backgroundColor: colors[anim.colorIndex],
                  width: anim.size,
                  height: anim.size,
                  borderRadius: anim.isRound ? 100 : 2,
                  transform: [
                    { translateY: anim.translateY },
                    { translateX: anim.translateX },
                    {
                      rotate: anim.rotate.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                  opacity: anim.opacity,
                },
              ]}
            />
          );
        })}

        {/* Main Content */}
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Header with gradient or fallback */}
          <View style={styles.gradientFallback}>
            {/* Trophy Icon */}
            <Animated.View
              style={[
                styles.houseContainer,
                {
                  transform: [
                    {
                      scale: houseAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 1.2, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.houseIcon}>🏆</Text>
              <View style={styles.trophyBadge}>
                <Text style={styles.trophyIcon}>✨</Text>
              </View>
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>GRATULACJE!</Text>
            <Text style={styles.subtitle}>
              {celebration.title || 'KREDYT SPŁACONY!'}
            </Text>

            {celebration.loan_description && (
              <Text style={styles.loanName}>{celebration.loan_description}</Text>
            )}
          </View>

          {/* Stats Section */}
          <Animated.View
            style={[
              styles.statsSection,
              {
                opacity: statsAnim,
                transform: [
                  {
                    translateY: statsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {stats.years_to_payoff && (
              <View style={styles.statItem}>
                <Ionicons name="calendar" size={24} color="#f97316" />
                <View style={styles.statText}>
                  <Text style={styles.statValue}>
                    {stats.years_to_payoff} lat
                  </Text>
                  <Text style={styles.statLabel}>czas spłaty</Text>
                </View>
              </View>
            )}

            {stats.total_paid && (
              <View style={styles.statItem}>
                <Ionicons name="cash" size={24} color="#22c55e" />
                <View style={styles.statText}>
                  <Text style={styles.statValue}>
                    {formatCurrency(stats.total_paid)}
                  </Text>
                  <Text style={styles.statLabel}>łącznie spłacone</Text>
                </View>
              </View>
            )}

            {stats.overpayment_count && stats.overpayment_count > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="rocket" size={24} color="#8b5cf6" />
                <View style={styles.statText}>
                  <Text style={styles.statValue}>
                    {stats.overpayment_count} nadpłat
                  </Text>
                  <Text style={styles.statLabel}>
                    {stats.overpayments_total
                      ? formatCurrency(stats.overpayments_total)
                      : ''}
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* XP Badge */}
          {celebration.xp_earned && celebration.xp_earned > 0 && (
            <View style={styles.xpBadge}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.xpText}>+{celebration.xp_earned} XP</Text>
            </View>
          )}

          {/* Achievement Badge */}
          {celebration.badge && (
            <View style={styles.achievementBadge}>
              <Text style={styles.badgeIcon}>{celebration.badge.icon}</Text>
              <Text style={styles.badgeName}>{celebration.badge.name}</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttons}>
            <Pressable style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Podziel się</Text>
            </Pressable>

            <Pressable style={styles.continueButton} onPress={handleDismiss}>
              <Text style={styles.continueButtonText}>Świętuj dalej! 🎉</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetti: {
    position: 'absolute',
    top: 0,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  content: {
    width: SCREEN_WIDTH - 40,
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  gradient: {
    padding: 32,
    alignItems: 'center',
  },
  gradientFallback: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FFA500', // Orange/gold fallback for Expo Go
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  houseContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  houseIcon: {
    fontSize: 80,
  },
  trophyBadge: {
    position: 'absolute',
    bottom: -5,
    right: -15,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  trophyIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.95,
  },
  loanName: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.8,
  },
  statsSection: {
    padding: 20,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  xpText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#d97706',
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef9c3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#facc15',
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#854d0e',
  },
  buttons: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  continueButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
