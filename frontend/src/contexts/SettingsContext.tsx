'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { SupportedLocale, DEFAULT_LOCALE, formatLocaleCurrency } from '@/utils/i18n';
import { convertCurrency } from '@/api/exchangeRates';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Settings {
  language: string;
  currency: string;
  ai?: {
    apiKey?: string;
  };
  emergency_fund_target?: number; // Target amount for Baby Step 1
  emergency_fund_months?: number; // Months for Baby Step 3
  base_currency?: string; // Base currency for emergency fund target
  // Polish tax-specific settings (from onboarding)
  employment_status?: string; // employee, b2b, business, contract, freelancer, unemployed
  tax_form?: string; // scale, linear, lumpsum, card
  birth_year?: number; // For youth tax relief eligibility
  use_authors_costs?: boolean; // KUP 50% for creators
  ppk_enrolled?: boolean; // PPK enrollment status
  ppk_employee_rate?: number; // PPK employee contribution (0.5% - 4%)
  ppk_employer_rate?: number; // PPK employer contribution (1.5% - 4%)
  children_count?: number; // For child tax relief calculation
}

export type { Settings };

interface SettingsContextType {
  settings: Settings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (newSettings: Settings) => Promise<void>;
  formatCurrency: (amount: number) => string;
}

const DEFAULT_SETTINGS: Settings = {
  language: DEFAULT_LOCALE,
  currency: 'USD',
  ai: {
    apiKey: undefined
  },
  emergency_fund_target: 3000, // Baby Step 1: 3000-5000 PLN recommended
  emergency_fund_months: 3,
  base_currency: 'USD'
};

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  error: null,
  updateSettings: async () => {},
  formatCurrency: (amount: number) => amount.toString(),
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings | null>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = async () => {
    if (!session?.user?.email) {
      logger.debug('[SettingsContext] No user email available, using default settings');
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    logger.debug('[SettingsContext] Fetching settings for user:', session.user.email);
    try {
      setIsLoading(true);
      const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings`;
      logger.debug('[SettingsContext] Fetch URL:', url);
      
      const response = await fetch(url);
      logger.debug('[SettingsContext] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.debug('[SettingsContext] Received settings:', data);
      setSettings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      logger.error('[SettingsContext] Error fetching settings:', errorMessage);
      setError(err instanceof Error ? err : new Error(errorMessage));
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    logger.debug('[SettingsContext] Session changed:', session?.user?.email);
    if (session?.user?.email) {
      fetchSettings();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
    }
  }, [session]);

  const updateSettings = async (newSettings: Settings) => {
    if (!session?.user?.email) {
      logger.error('[SettingsContext] Cannot update settings: No user email available');
      throw new Error('You must be logged in to update settings');
    }

    const oldLanguage = settings?.language;
    const oldCurrency = settings?.currency;
    logger.debug('[SettingsContext] Updating settings for user:', session.user.email);
    logger.debug('[SettingsContext] New settings:', newSettings);

    try {
      // If currency is changing and emergency_fund_target is set, convert the target amount
      if (settings && newSettings.currency !== settings.currency && newSettings.emergency_fund_target) {
        const oldCurrency = settings.base_currency || settings.currency;
        
        try {
          logger.debug(`[SettingsContext] Converting emergency fund target from ${oldCurrency} to ${newSettings.currency}`);
          
          // Convert the emergency fund target to the new currency
          const convertedTarget = await convertCurrency(
            newSettings.emergency_fund_target,
            oldCurrency,
            newSettings.currency
          );
          
          // Round to nearest whole number
          const roundedTarget = Math.round(convertedTarget);
          
          logger.debug(`[SettingsContext] Converted emergency fund target: ${newSettings.emergency_fund_target} ${oldCurrency} -> ${roundedTarget} ${newSettings.currency}`);
          
          // Update the target amount and the base currency
          newSettings.emergency_fund_target = roundedTarget;
          newSettings.base_currency = newSettings.currency;
          
        } catch (error) {
          logger.warn('[SettingsContext] Currency conversion failed:', error);
          // If conversion fails, keep the same target but update the base currency
          newSettings.base_currency = newSettings.currency;
        }
      } else {
        // Keep the base currency in sync with the display currency if no conversion happened
        newSettings.base_currency = newSettings.currency;
      }

      const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings`;
      logger.debug('[SettingsContext] Update URL:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      
      logger.debug('[SettingsContext] Update response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('[SettingsContext] Update response:', data);
      
      // Update local state
      setSettings(newSettings);

      // We no longer need to force a page reload for language changes
      // The IntlProviderWrapper will handle the language change
      // This prevents issues with Chart.js controllers not being registered
      if (oldLanguage !== newSettings.language) {
        logger.debug('[SettingsContext] Language changed, updating without page reload');
      }
      
      // Notify of currency conversion if it happened
      if (oldCurrency !== newSettings.currency && newSettings.emergency_fund_target) {
        logger.debug(`[SettingsContext] Currency changed from ${oldCurrency} to ${newSettings.currency}`);
      }
    } catch (err) {
      logger.error('[SettingsContext] Error updating settings:', err);
      throw err;
    }
  };

  const formatCurrency = (amount: number): string => {
    if (!settings) {
      logger.debug('[SettingsContext] No settings available for currency formatting');
      return amount.toString();
    }

    return formatLocaleCurrency(amount, settings.language as SupportedLocale, settings.currency);
  };

  return (
    <SettingsContext.Provider value={{ settings, isLoading, error, updateSettings, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}; 
