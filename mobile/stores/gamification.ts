/**
 * Gamification store for FiredUp mobile app
 *
 * Manages user's gamification state including:
 * - Streaks (daily check-ins)
 * - XP and Level progression
 * - Achievements/Badges
 * - Celebrations (pending modals)
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  getApiClient,
  GamificationStats,
  GamificationOverview,
  UnlockedBadge,
  BadgeProgress,
  CheckinResponse,
  MortgageCelebrationData,
} from '../lib/api';

// ==========================================
// Types
// ==========================================

export interface CelebrationData {
  type: 'badge' | 'level_up' | 'streak_milestone' | 'checkin' | 'mortgage_paid_off';
  badge?: UnlockedBadge;
  newLevel?: number;
  newStreak?: number;
  xpEarned?: number;
  message?: string;
  // Mortgage celebration specific data
  mortgageData?: MortgageCelebrationData;
}

interface GamificationState {
  // Data
  stats: GamificationStats | null;
  unlockedBadges: UnlockedBadge[];
  badgeProgress: BadgeProgress[];
  recentEvents: Array<{
    type: string;
    data: Record<string, unknown>;
    xp_change: number;
    created_at: string;
  }>;

  // UI State
  isLoading: boolean;
  isCheckingIn: boolean;
  error: string | null;

  // Celebration queue (for showing modals)
  pendingCelebrations: CelebrationData[];

  // Actions
  fetchOverview: () => Promise<void>;
  fetchStats: () => Promise<void>;
  checkIn: () => Promise<CheckinResponse | null>;
  refreshAchievements: () => Promise<void>;
  triggerMortgageCelebration: (loanId: number) => Promise<void>;

  // Celebration management
  addCelebration: (celebration: CelebrationData) => void;
  dismissCelebration: () => void;
  clearAllCelebrations: () => void;

  // Reset
  reset: () => void;
}

// ==========================================
// Initial State
// ==========================================

const initialState = {
  stats: null,
  unlockedBadges: [],
  badgeProgress: [],
  recentEvents: [],
  isLoading: false,
  isCheckingIn: false,
  error: null,
  pendingCelebrations: [],
};

// ==========================================
// Store
// ==========================================

export const useGamificationStore = create<GamificationState>((set, get) => ({
  ...initialState,

  /**
   * Fetch complete gamification overview from API.
   * This is the main method to load all gamification data.
   */
  fetchOverview: async () => {
    const api = getApiClient();
    if (!api) {
      set({ error: 'API client not initialized' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const overview = await api.gamification.getOverview();

      set({
        stats: overview.stats,
        unlockedBadges: overview.unlocked_badges,
        badgeProgress: overview.badge_progress,
        recentEvents: overview.recent_events,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error fetching gamification overview:', err);
      set({
        error: 'Nie udało się pobrać danych gamifikacji',
        isLoading: false,
      });
    }
  },

  /**
   * Fetch only stats (lighter request for dashboard refresh).
   */
  fetchStats: async () => {
    const api = getApiClient();
    if (!api) return;

    try {
      const stats = await api.gamification.getStats();
      set({ stats });
    } catch (err) {
      console.error('Error fetching gamification stats:', err);
    }
  },

  /**
   * Perform daily check-in.
   * Updates streak, awards XP, and may unlock achievements.
   */
  checkIn: async () => {
    const api = getApiClient();
    if (!api) {
      set({ error: 'API client not initialized' });
      return null;
    }

    set({ isCheckingIn: true, error: null });

    try {
      const response = await api.gamification.checkin();

      // Update stats with new values
      set((state) => ({
        stats: state.stats
          ? {
              ...state.stats,
              current_streak: response.new_streak,
              total_xp: state.stats.total_xp + response.xp_earned,
              total_checkins: state.stats.total_checkins + 1,
            }
          : null,
        isCheckingIn: false,
      }));

      // Add celebrations for new badges
      if (response.new_badges.length > 0) {
        response.new_badges.forEach((badge) => {
          get().addCelebration({
            type: 'badge',
            badge,
            xpEarned: badge.xp_awarded,
          });
        });
      }

      // Add celebration for level up
      if (response.level_up && response.new_level) {
        get().addCelebration({
          type: 'level_up',
          newLevel: response.new_level,
        });
      }

      // Add checkin celebration if streak continued
      if (response.streak_continued && response.new_streak > 1) {
        // Only show streak milestone celebrations at 7, 30, 90, 365
        const milestones = [7, 30, 90, 365];
        if (milestones.includes(response.new_streak)) {
          get().addCelebration({
            type: 'streak_milestone',
            newStreak: response.new_streak,
            message: response.message,
          });
        }
      }

      // Refresh the full overview to get updated badge progress
      await get().fetchOverview();

      return response;
    } catch (err) {
      console.error('Error during check-in:', err);
      set({
        error: 'Nie udało się zameldować',
        isCheckingIn: false,
      });
      return null;
    }
  },

  /**
   * Force refresh of achievements (recalculate all).
   */
  refreshAchievements: async () => {
    const api = getApiClient();
    if (!api) return;

    try {
      const result = await api.gamification.calculateAchievements();

      if (result.new_badges_count > 0) {
        // Refresh to get the new badges
        await get().fetchOverview();
      }
    } catch (err) {
      console.error('Error refreshing achievements:', err);
    }
  },

  /**
   * Trigger mortgage payoff celebration.
   * Call this when marking a mortgage as paid off.
   */
  triggerMortgageCelebration: async (loanId: number) => {
    const api = getApiClient();
    if (!api) return;

    try {
      const response = await api.gamification.triggerMortgageCelebration(loanId);

      if (response.success && response.celebration) {
        // Add the mortgage celebration to the queue
        get().addCelebration({
          type: 'mortgage_paid_off',
          xpEarned: response.xp_earned,
          mortgageData: response.celebration,
        });

        // Refresh gamification data
        await get().fetchOverview();
      }
    } catch (err) {
      console.error('Error triggering mortgage celebration:', err);
    }
  },

  /**
   * Add a celebration to the queue.
   */
  addCelebration: (celebration) => {
    set((state) => ({
      pendingCelebrations: [...state.pendingCelebrations, celebration],
    }));
  },

  /**
   * Dismiss the first celebration in the queue.
   */
  dismissCelebration: () => {
    set((state) => ({
      pendingCelebrations: state.pendingCelebrations.slice(1),
    }));
  },

  /**
   * Clear all pending celebrations.
   */
  clearAllCelebrations: () => {
    set({ pendingCelebrations: [] });
  },

  /**
   * Reset store to initial state (on logout).
   */
  reset: () => {
    set(initialState);
  },
}));

// ==========================================
// Hooks
// ==========================================

/**
 * Get the first pending celebration (if any).
 */
export function usePendingCelebration(): CelebrationData | null {
  return useGamificationStore((state) => state.pendingCelebrations[0] || null);
}

/**
 * Get current streak info.
 * Uses useShallow to prevent unnecessary re-renders when object values haven't changed.
 */
export function useStreak() {
  return useGamificationStore(
    useShallow((state) => ({
      current: state.stats?.current_streak ?? 0,
      longest: state.stats?.longest_streak ?? 0,
      lastActivity: state.stats?.last_activity_date,
    }))
  );
}

/**
 * Get level info.
 * Uses useShallow to prevent unnecessary re-renders when object values haven't changed.
 */
export function useLevel() {
  return useGamificationStore(
    useShallow((state) => ({
      level: state.stats?.level ?? 1,
      name: state.stats?.level_name ?? 'Początkujący',
      nameEn: state.stats?.level_name_en ?? 'Beginner',
      totalXp: state.stats?.total_xp ?? 0,
      xpForNext: state.stats?.xp_for_next_level ?? 100,
      xpProgress: state.stats?.xp_progress_in_level ?? 0,
    }))
  );
}

/**
 * Get recent badges (last N).
 * Uses useShallow for array comparison.
 */
export function useRecentBadges(count = 3) {
  return useGamificationStore(
    useShallow((state) => state.unlockedBadges.slice(0, count))
  );
}

/**
 * Get badges closest to completion.
 * Uses useShallow for array comparison.
 */
export function useNearestBadges(count = 3) {
  return useGamificationStore(
    useShallow((state) => state.badgeProgress.slice(0, count))
  );
}
