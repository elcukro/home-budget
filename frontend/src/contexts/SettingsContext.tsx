'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { SupportedLocale, DEFAULT_LOCALE, formatLocaleCurrency } from '@/utils/i18n';

interface Settings {
  language: string;
  currency: string;
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
      const url = `http://localhost:8000/users/${encodeURIComponent(session.user.email)}/settings`;
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
    console.log('[SettingsContext] Updating settings for user:', session.user.email);
    console.log('[SettingsContext] New settings:', newSettings);

    try {
      const url = `http://localhost:8000/users/${encodeURIComponent(session.user.email)}/settings`;
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
      
      // Update local state first
      setSettings(newSettings);

      // If language was changed, force a hard reload of the page
      if (oldLanguage !== newSettings.language) {
        console.log('[SettingsContext] Language changed, triggering page reload');
        // Use a small delay to ensure the state is updated and toast is visible
        setTimeout(() => {
          window.location.href = window.location.href;
        }, 1000);
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