'use client';

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { TablePageSkeleton } from '@/components/LoadingSkeleton';
import Tooltip from '@/components/Tooltip';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/contexts/SettingsContext';

interface UserSettings {
  id: number;
  user_id: string;
  language: string;
  currency: string;
  created_at: string;
  updated_at: string | null;
}

const languages = [
  { code: 'en', name: 'settings.languages.en' },
  { code: 'pl', name: 'settings.languages.pl' },
  { code: 'es', name: 'settings.languages.es' },
];

const currencies = [
  { code: 'USD', symbol: '$', name: 'settings.currencies.USD' },
  { code: 'PLN', symbol: 'zł', name: 'settings.currencies.PLN' },
  { code: 'EUR', symbol: '€', name: 'settings.currencies.EUR' },
  { code: 'GBP', symbol: '£', name: 'settings.currencies.GBP' },
  { code: 'JPY', symbol: '¥', name: 'settings.currencies.JPY' },
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SettingsPage() {
  const { data: session } = useSession();
  const intl = useIntl();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { updateSettings: updateContextSettings } = useSettings();

  useEffect(() => {
    if (session?.user?.email) {
      fetchSettings();
    }
  }, [session]);

  const fetchSettings = async () => {
    if (!session?.user?.email) return;
    
    try {
      console.log('[Settings] Fetching settings for user:', session.user.email);
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Settings] Failed to fetch settings:', errorText);
        throw new Error(`Failed to fetch settings: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Settings] Fetched settings:', data);
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      console.error('[Settings] Error:', err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'settings.messages.notLoggedIn' }));
      return;
    }

    if (!settings) return;

    console.log('[Settings] Updating settings:', settings);
    
    try {
      await updateContextSettings({
        language: settings.language,
        currency: settings.currency
      });
      
      toast.success(intl.formatMessage({ id: 'settings.messages.success' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update settings';
      console.error('[Settings] Error:', err);
      toast.error(intl.formatMessage({ id: 'settings.messages.error' }));
    }
  };

  if (loading) {
    return <TablePageSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">
          {intl.formatMessage({ id: 'settings.noData' })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold mb-6">{intl.formatMessage({ id: 'settings.title' })}</h1>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {intl.formatMessage({ id: 'settings.form.language' })}
              <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.language' })} icon={true} />
            </label>
            <div className="relative">
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full mt-1 block rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {intl.formatMessage({ id: language.name })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {intl.formatMessage({ id: 'settings.form.currency' })}
              <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.currency' })} icon={true} />
            </label>
            <div className="relative">
              <select
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full mt-1 block rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {`${currency.code} (${currency.symbol}) - ${intl.formatMessage({ id: currency.name })}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {intl.formatMessage({ id: 'settings.form.submit' })}
          </button>
        </div>
      </form>
    </div>
  );
} 