'use client';

import posthog from 'posthog-js';
import { useCallback } from 'react';

// Event names - centralized for consistency
export const AnalyticsEvents = {
  // Auth events
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN: 'login',
  LOGOUT: 'logout',

  // Onboarding events
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_SKIPPED: 'onboarding_skipped',

  // Core actions
  EXPENSE_ADDED: 'expense_added',
  EXPENSE_EDITED: 'expense_edited',
  EXPENSE_DELETED: 'expense_deleted',
  INCOME_ADDED: 'income_added',
  INCOME_EDITED: 'income_edited',
  INCOME_DELETED: 'income_deleted',

  // Savings
  SAVINGS_GOAL_CREATED: 'savings_goal_created',
  SAVINGS_GOAL_UPDATED: 'savings_goal_updated',
  SAVINGS_DEPOSIT: 'savings_deposit',

  // Loans
  LOAN_ADDED: 'loan_added',
  LOAN_PAYMENT: 'loan_payment',

  // Subscription
  CHECKOUT_STARTED: 'checkout_started',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // Features
  AI_ANALYSIS_REQUESTED: 'ai_analysis_requested',
  REPORT_GENERATED: 'report_generated',
  BANK_CONNECTED: 'bank_connected',
  EXPORT_DATA: 'export_data',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
} as const;

type EventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export function useAnalytics() {
  const track = useCallback((event: EventName, properties?: EventProperties) => {
    if (typeof window !== 'undefined' && posthog) {
      posthog.capture(event, properties);
    }
  }, []);

  const trackOnboardingStep = useCallback((step: number, stepName: string) => {
    track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
      step_number: step,
      step_name: stepName,
    });
  }, [track]);

  const trackExpense = useCallback((action: 'added' | 'edited' | 'deleted', amount?: number, category?: string) => {
    const eventMap = {
      added: AnalyticsEvents.EXPENSE_ADDED,
      edited: AnalyticsEvents.EXPENSE_EDITED,
      deleted: AnalyticsEvents.EXPENSE_DELETED,
    };
    track(eventMap[action], { amount, category });
  }, [track]);

  const trackIncome = useCallback((action: 'added' | 'edited' | 'deleted', amount?: number, category?: string) => {
    const eventMap = {
      added: AnalyticsEvents.INCOME_ADDED,
      edited: AnalyticsEvents.INCOME_EDITED,
      deleted: AnalyticsEvents.INCOME_DELETED,
    };
    track(eventMap[action], { amount, category });
  }, [track]);

  const trackError = useCallback((errorType: string, errorMessage: string, context?: string) => {
    track(AnalyticsEvents.ERROR_OCCURRED, {
      error_type: errorType,
      error_message: errorMessage,
      context,
    });
  }, [track]);

  return {
    track,
    trackOnboardingStep,
    trackExpense,
    trackIncome,
    trackError,
    events: AnalyticsEvents,
  };
}

// Standalone function for use outside React components
export function trackEvent(event: EventName, properties?: EventProperties) {
  if (typeof window !== 'undefined' && posthog) {
    posthog.capture(event, properties);
  }
}
