'use client';

import { IntlProvider } from 'react-intl';
import { useSettings } from '@/contexts/SettingsContext';
import { useEffect, useState } from 'react';
import { loadMessages, SupportedLocale, DEFAULT_LOCALE } from '@/utils/i18n';
import { initializeChartJS } from '@/utils/chartUtils';

export default function IntlProviderWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLocaleMessages = async () => {
      try {
        setIsLoading(true);
        const locale = (settings?.language || DEFAULT_LOCALE) as SupportedLocale;
        const msgs = await loadMessages(locale);
        setMessages(msgs);
        
        // Re-initialize Chart.js after language change
        // This ensures all controllers are properly registered
        initializeChartJS();
        console.log('[IntlProviderWrapper] Re-initialized Chart.js after language change to:', locale);
      } catch (error) {
        console.error('[IntlProviderWrapper] Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocaleMessages();
  }, [settings?.language]);

  const currentLocale = (settings?.language || DEFAULT_LOCALE) as SupportedLocale;

  if (isLoading) {
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
      locale={currentLocale}
      defaultLocale={DEFAULT_LOCALE}
      onError={(err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[IntlProviderWrapper] IntlProvider error:', err);
        }
      }}
    >
      {children}
    </IntlProvider>
  );
} 