'use client';

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { TablePageSkeleton } from '@/components/LoadingSkeleton';
import Tooltip from '@/components/Tooltip';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/contexts/SettingsContext';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

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

export default function Settings() {
  const { data: session } = useSession();
  const intl = useIntl();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const router = useRouter();
  const { updateSettings: updateContextSettings } = useSettings();

  const fetchSettings = async () => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings/`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Settings] Error:', err instanceof Error ? err.message : 'Failed to fetch settings');
      }
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'settings.messages.notLoggedIn' }));
      return;
    }

    if (!settings) return;
    
    setUpdateStatus('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: settings.language,
          currency: settings.currency
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const updatedSettings = await response.json();
      await updateContextSettings({
        language: updatedSettings.language,
        currency: updatedSettings.currency
      });
      
      setSettings(updatedSettings);
      setUpdateStatus('success');
      toast.success(intl.formatMessage({ id: 'settings.messages.success' }));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Settings] Update error:', err instanceof Error ? err.message : 'Failed to update settings');
      }
      setUpdateStatus('error');
      toast.error(intl.formatMessage({ id: 'settings.messages.error' }));
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'xlsx') => {
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'settings.messages.notLoggedIn' }));
      return;
    }

    setExportStatus('loading');
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/export/?format=${format}`,
        {
          headers: {
            'Accept': format === 'json' 
              ? 'application/json' 
              : format === 'csv'
              ? 'text/csv'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const data = await response.blob();
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `home_budget_export_${session.user.email}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus('success');
      toast.success(intl.formatMessage({ id: 'settings.messages.exportSuccess' }));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Settings] Export error:', err instanceof Error ? err.message : 'Failed to export data');
      }
      setExportStatus('error');
      toast.error(intl.formatMessage({ id: 'settings.messages.exportError' }));
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

      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">
          {intl.formatMessage({ id: 'settings.export.title' })}
          <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.export' })} icon={true} />
        </h2>
        <p className="text-secondary mb-4">
          {intl.formatMessage({ id: 'settings.export.description' })}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {intl.formatMessage({ id: 'settings.export.jsonButton' })}
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {intl.formatMessage({ id: 'settings.export.csvButton' })}
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {intl.formatMessage({ id: 'settings.export.excelButton' })}
          </button>
        </div>
      </div>
    </div>
  );
} 