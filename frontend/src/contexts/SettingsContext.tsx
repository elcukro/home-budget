'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { SupportedLocale, DEFAULT_LOCALE, formatLocaleCurrency } from '@/utils/i18n';
import { convertCurrency } from '@/api/exchangeRates';

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
}

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
  emergency_fund_target: 1000,
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
      console.log('[SettingsContext] No user email available, using default settings');
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }

    console.log('[SettingsContext] Fetching settings for user:', session.user.email);
    try {
      setIsLoading(true);
      const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings/`;
      console.log('[SettingsContext] Fetch URL:', url);
      
      const response = await fetch(url);
      console.log('[SettingsContext] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[SettingsContext] Received settings:', data);
      setSettings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[SettingsContext] Error fetching settings:', errorMessage);
      setError(err instanceof Error ? err : new Error(errorMessage));
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('[SettingsContext] Session changed:', session?.user?.email);
    if (session?.user?.email) {
      fetchSettings();
    } else {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
    }
  }, [session]);

  const updateSettings = async (newSettings: Settings) => {
    if (!session?.user?.email) {
      console.error('[SettingsContext] Cannot update settings: No user email available');
      throw new Error('You must be logged in to update settings');
    }

    const oldLanguage = settings?.language;
    const oldCurrency = settings?.currency;
    console.log('[SettingsContext] Updating settings for user:', session.user.email);
    console.log('[SettingsContext] New settings:', newSettings);

    try {
      // If currency is changing and emergency_fund_target is set, convert the target amount
      if (settings && newSettings.currency !== settings.currency && newSettings.emergency_fund_target) {
        const oldCurrency = settings.base_currency || settings.currency;
        
        try {
          console.log(`[SettingsContext] Converting emergency fund target from ${oldCurrency} to ${newSettings.currency}`);
          
          // Convert the emergency fund target to the new currency
          const convertedTarget = await convertCurrency(
            newSettings.emergency_fund_target,
            oldCurrency,
            newSettings.currency
          );
          
          // Round to nearest whole number
          const roundedTarget = Math.round(convertedTarget);
          
          console.log(`[SettingsContext] Converted emergency fund target: ${newSettings.emergency_fund_target} ${oldCurrency} -> ${roundedTarget} ${newSettings.currency}`);
          
          // Update the target amount and the base currency
          newSettings.emergency_fund_target = roundedTarget;
          newSettings.base_currency = newSettings.currency;
          
        } catch (error) {
          console.warn('[SettingsContext] Currency conversion failed:', error);
          // If conversion fails, keep the same target but update the base currency
          newSettings.base_currency = newSettings.currency;
        }
      } else {
        // Keep the base currency in sync with the display currency if no conversion happened
        newSettings.base_currency = newSettings.currency;
      }

      const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings/`;
      console.log('[SettingsContext] Update URL:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      
      console.log('[SettingsContext] Update response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SettingsContext] Update response:', data);
      
      // Update local state
      setSettings(newSettings);

      // We no longer need to force a page reload for language changes
      // The IntlProviderWrapper will handle the language change
      // This prevents issues with Chart.js controllers not being registered
      if (oldLanguage !== newSettings.language) {
        console.log('[SettingsContext] Language changed, updating without page reload');
      }
      
      // Notify of currency conversion if it happened
      if (oldCurrency !== newSettings.currency && newSettings.emergency_fund_target) {
        console.log(`[SettingsContext] Currency changed from ${oldCurrency} to ${newSettings.currency}`);
      }
    } catch (err) {
      console.error('[SettingsContext] Error updating settings:', err);
      throw err;
    }
  };

  const formatCurrency = (amount: number): string => {
    if (!settings) {
      console.log('[SettingsContext] No settings available for currency formatting');
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