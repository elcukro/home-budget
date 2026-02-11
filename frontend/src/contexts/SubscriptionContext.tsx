'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';

// Use Next.js API proxy for all backend calls to ensure auth headers are added
const API_BASE_URL = '/api/backend';

interface SubscriptionStatus {
  status: string;
  plan_type: string;
  is_premium: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_lifetime: boolean;
}

interface UsageStats {
  is_premium: boolean;
  expenses: {
    used: number;
    limit: number | null;
    unlimited: boolean;
  };
  incomes: {
    used: number;
    limit: number | null;
    unlimited: boolean;
  };
  loans: {
    used: number;
    limit: number | null;
    unlimited: boolean;
  };
  savings_goals: {
    used: number;
    limit: number | null;
    unlimited: boolean;
  };
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  usage: UsageStats | null;
  isLoading: boolean;
  error: Error | null;
  isPremium: boolean;
  isTrial: boolean;
  trialDaysLeft: number | null;
  refreshSubscription: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  createCheckout: (planType: string) => Promise<string>;
  openPortal: () => Promise<string>;
}

const defaultStatus: SubscriptionStatus = {
  status: 'free',
  plan_type: 'free',
  is_premium: false,
  is_trial: false,
  trial_ends_at: null,
  trial_days_left: null,
  current_period_end: null,
  cancel_at_period_end: false,
  is_lifetime: false,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  usage: null,
  isLoading: true,
  error: null,
  isPremium: false,
  isTrial: false,
  trialDaysLeft: null,
  refreshSubscription: async () => {},
  refreshUsage: async () => {},
  createCheckout: async () => '',
  openPortal: async () => '',
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!session?.user?.email) {
      setSubscription(defaultStatus);
      setIsLoading(false);
      return;
    }

    try {
      // Billing endpoints require user_id as a query parameter
      const response = await fetch(`${API_BASE_URL}/billing/status?user_id=${encodeURIComponent(session.user.email)}`);

      if (response.status === 404) {
        // New user — no subscription yet
        setSubscription(defaultStatus);
        setError(null);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      const data = await response.json();
      setSubscription(data);
      setError(null);
    } catch (err) {
      logger.error('[SubscriptionContext] Error fetching subscription:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSubscription(defaultStatus);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email]);

  const fetchUsage = useCallback(async () => {
    if (!session?.user?.email) {
      return;
    }

    try {
      // Billing endpoints require user_id as a query parameter
      const response = await fetch(`${API_BASE_URL}/billing/usage?user_id=${encodeURIComponent(session.user.email)}`);

      if (response.status === 404) {
        // New user — no usage data yet
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch usage stats');
      }

      const data = await response.json();
      setUsage(data);
    } catch (err) {
      logger.error('[SubscriptionContext] Error fetching usage:', err);
    }
  }, [session?.user?.email]);

  const createCheckout = useCallback(async (planType: string): Promise<string> => {
    if (!session?.user?.email) {
      throw new Error('Not authenticated');
    }

    // Billing endpoints require user_id as a query parameter
    const response = await fetch(`${API_BASE_URL}/billing/checkout?user_id=${encodeURIComponent(session.user.email)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan_type: planType }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create checkout session');
    }

    const data = await response.json();
    return data.checkout_url;
  }, [session?.user?.email]);

  const openPortal = useCallback(async (): Promise<string> => {
    if (!session?.user?.email) {
      throw new Error('Not authenticated');
    }

    // Billing endpoints require user_id as a query parameter
    const response = await fetch(`${API_BASE_URL}/billing/portal?user_id=${encodeURIComponent(session.user.email)}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create portal session');
    }

    const data = await response.json();
    return data.portal_url;
  }, [session?.user?.email]);

  useEffect(() => {
    fetchSubscription();
    fetchUsage();
  }, [fetchSubscription, fetchUsage]);

  const isPremium = subscription?.is_premium ?? false;
  const isTrial = subscription?.is_trial ?? false;
  const trialDaysLeft = subscription?.trial_days_left ?? null;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        usage,
        isLoading,
        error,
        isPremium,
        isTrial,
        trialDaysLeft,
        refreshSubscription: fetchSubscription,
        refreshUsage: fetchUsage,
        createCheckout,
        openPortal,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
