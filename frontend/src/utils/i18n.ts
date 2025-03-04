import { createIntl, createIntlCache } from 'react-intl';

export type SupportedLocale = 'en' | 'es' | 'fr' | 'pl';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'es', 'fr', 'pl'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

// This is optional but highly recommended since it prevents memory leak
const cache = createIntlCache();

// Define nested message structure type
export type NestedMessages = {
  [key: string]: string | NestedMessages;
};

// Load messages for a specific locale
export async function loadMessages(locale: SupportedLocale): Promise<Record<string, string>> {
  try {
    const messages = await import(`../locales/${locale}.json`);
    return flattenMessages(messages.default);
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    // Fallback to English if translation file is missing
    const fallbackMessages = await import('../locales/en.json');
    return flattenMessages(fallbackMessages.default);
  }
}

// Create an intl instance for the specified locale and messages
export function getIntl(locale: SupportedLocale, messages: Record<string, string>) {
  return createIntl(
    {
      locale,
      defaultLocale: DEFAULT_LOCALE,
      messages,
      formats: {
        number: {
          currency: {
            style: 'currency',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
          percent: {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          },
        },
        date: {
          short: {
            dateStyle: 'short',
          },
        },
      },
      onError: (err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(err);
        }
      },
    },
    cache
  );
}

// Flatten nested messages object into dot notation
function flattenMessages(nestedMessages: NestedMessages, prefix = ''): Record<string, string> {
  return Object.keys(nestedMessages).reduce((messages: Record<string, string>, key) => {
    const value = nestedMessages[key];
    const prefixedKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      messages[prefixedKey] = value;
    } else {
      Object.assign(messages, flattenMessages(value, prefixedKey));
    }

    return messages;
  }, {});
}

// Get the browser's preferred language that we support
export function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const browserLocale = navigator.language.split('-')[0] as SupportedLocale;
  return SUPPORTED_LOCALES.includes(browserLocale) ? browserLocale : DEFAULT_LOCALE;
}

// Format a number as currency based on the locale
export function formatLocaleCurrency(
  value: number,
  locale: SupportedLocale,
  currency: string
): string {
  return Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Format a date based on the locale
export function formatLocaleDate(
  date: Date | string,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString(locale, options);
} 