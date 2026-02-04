'use client';

import { IntlProvider } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { useEffect, useState, useRef } from 'react';
import { loadMessages, SupportedLocale, DEFAULT_LOCALE } from '@/utils/i18n';
import { initializeChartJS } from '@/utils/chartUtils';
import { logger } from '@/lib/logger';

export default function IntlProviderWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loadedLocale, setLoadedLocale] = useState<SupportedLocale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingLocaleRef = useRef<string | null>(null);

  const currentLocale = (settings?.language || DEFAULT_LOCALE) as SupportedLocale;

  useEffect(() => {
    const loadLocaleMessages = async () => {
      // Track which locale we're loading to handle race conditions
      const localeToLoad = currentLocale;
      loadingLocaleRef.current = localeToLoad;

      try {
        setIsLoading(true);
        const msgs = await loadMessages(localeToLoad);

        // Only update state if this is still the locale we want
        // This prevents race conditions when language changes rapidly
        if (loadingLocaleRef.current === localeToLoad) {
          setMessages(msgs);
          setLoadedLocale(localeToLoad);

          // Re-initialize Chart.js after language change
          // This ensures all controllers are properly registered
          initializeChartJS();
          logger.debug('[IntlProviderWrapper] Re-initialized Chart.js after language change to:', localeToLoad);
        }
      } catch (error) {
        logger.error('[IntlProviderWrapper] Failed to load messages:', error);
      } finally {
        // Only set loading to false if this is still the current load operation
        if (loadingLocaleRef.current === localeToLoad) {
          setIsLoading(false);
        }
      }
    };

    loadLocaleMessages();
  }, [currentLocale]);

  // Show loading spinner if:
  // 1. Messages are actively loading
  // 2. Messages haven't been loaded yet (empty)
  // 3. Loaded locale doesn't match current locale (language switch in progress)
  const shouldShowLoading = isLoading ||
    Object.keys(messages).length === 0 ||
    loadedLocale !== currentLocale;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-primary font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <IntlProvider
      messages={messages}
      locale={loadedLocale}
      defaultLocale={DEFAULT_LOCALE}
      onError={(err) => {
        if (process.env.NODE_ENV !== 'production') {
          logger.error('[IntlProviderWrapper] IntlProvider error:', err);
        }
      }}
    >
      {children}
    </IntlProvider>
  );
} 
