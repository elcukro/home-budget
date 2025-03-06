'use client';

import { useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { TablePageSkeleton } from '@/components/LoadingSkeleton';
import Tooltip from '@/components/Tooltip';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/contexts/SettingsContext';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatPercentage, getCurrencySymbol } from '@/utils/formatting';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UserSettings {
  id: number;
  user_id: string;
  language: string;
  currency: string;
  ai?: {
    apiKey?: string;
  };
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

export default function Settings() {
  const { data: session } = useSession();
  const intl = useIntl();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const router = useRouter();
  const { updateSettings: updateContextSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

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
          currency: settings.currency,
          ai: {
            apiKey: settings.ai?.apiKey
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const updatedSettings = await response.json();
      await updateContextSettings({
        language: updatedSettings.language,
        currency: updatedSettings.currency,
        ai: updatedSettings.ai
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

  const handleImportClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user?.email) {
      return;
    }
    
    setImportFile(file);
    setShowImportConfirm(true);
  };

  const handleImport = async (clearExisting: boolean) => {
    if (!importFile || !session?.user?.email) {
      return;
    }

    setImportStatus('loading');
    setShowImportConfirm(false);
    
    try {
      const fileContent = await importFile.text();
      const jsonData = JSON.parse(fileContent);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/users/${encodeURIComponent(session.user.email)}/import?clear_existing=${clearExisting}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      setImportStatus('success');
      toast.success(intl.formatMessage({ id: 'settings.messages.importSuccess' }));
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setImportFile(null);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Settings] Import error:', err instanceof Error ? err.message : 'Failed to import data');
      }
      setImportStatus('error');
      toast.error(intl.formatMessage({ id: 'settings.messages.importError' }));
    }
  };

  const cancelImport = () => {
    setShowImportConfirm(false);
    setImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {intl.formatMessage({ id: 'settings.form.claudeApiKey' })}
              <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.claudeApiKey' })} icon={true} />
            </label>
            <div className="relative">
              <input
                type="password"
                value={settings.ai?.apiKey || ''}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  ai: { 
                    ...settings.ai,
                    apiKey: e.target.value 
                  }
                })}
                placeholder={intl.formatMessage({ id: 'settings.form.claudeApiKeyPlaceholder' })}
                className="w-full mt-1 block rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
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

      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-medium mb-4">
          {intl.formatMessage({ id: 'settings.import.title' })}
          <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.import' })} icon={true} />
        </h2>
        <p className="text-secondary mb-4">
          {intl.formatMessage({ id: 'settings.import.description' })}
        </p>
        <div className="flex gap-4">
          <input
            type="file"
            accept=".json"
            onChange={handleImportClick}
            ref={fileInputRef}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              dark:file:bg-blue-900 dark:file:text-blue-200"
          />
        </div>
      </div>

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

      {/* Import Confirmation Dialog */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-background-primary rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {intl.formatMessage({ id: 'settings.import.confirmTitle' })}
            </h3>
            <p className="mb-6 text-secondary">
              {intl.formatMessage({ id: 'settings.import.confirmMessage' })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelImport}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {intl.formatMessage({ id: 'common.cancel' })}
              </button>
              <button
                onClick={() => handleImport(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {intl.formatMessage({ id: 'settings.import.keepExisting' })}
              </button>
              <button
                onClick={() => handleImport(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {intl.formatMessage({ id: 'settings.import.removeExisting' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 