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

interface BankingConnection {
  id: number;
  institution_id: string;
  institution_name: string;
  requisition_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  accounts: string[] | null;
}

interface UserSettings {
  id: number;
  user_id: string;
  language: string;
  currency: string;
  ai?: {
    apiKey?: string;
  };
  emergency_fund_target: number;
  emergency_fund_months: number;
  banking?: {
    connections?: BankingConnection[];
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
  const [bankingConnections, setBankingConnections] = useState<BankingConnection[]>([]);

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

  const fetchBankingConnections = async () => {
    if (!session?.user?.email) {
      return;
    }

    try {
      const response = await fetch('/api/banking/connections');
      if (!response.ok) {
        throw new Error('Failed to fetch banking connections');
      }
      const data = await response.json();
      setBankingConnections(data);
    } catch (err) {
      console.error('Error fetching banking connections:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchBankingConnections();
  }, [session]);
  
  const handleDeleteConnection = async (connectionId: number) => {
    if (!confirm('Are you sure you want to remove this bank connection?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/banking/connections/${connectionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete banking connection');
      }
      
      // Refresh the connections list
      fetchBankingConnections();
      toast.success('Bank connection removed successfully');
    } catch (err) {
      console.error('Error deleting banking connection:', err);
      toast.error('Failed to remove bank connection');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.email) {
      toast.error(intl.formatMessage({ id: 'settings.messages.notLoggedIn' }));
      return;
    }

    if (!settings) return;
    
    setUpdateStatus('loading');
    try {
      // Capture current values to detect changes
      const oldCurrency = settings.currency;
      
      // Update settings using context method
      await updateContextSettings({
        language: settings.language,
        currency: settings.currency,
        ai: {
          apiKey: settings.ai?.apiKey
        },
        emergency_fund_target: settings.emergency_fund_target,
        emergency_fund_months: settings.emergency_fund_months,
        base_currency: settings.base_currency
      });
      
      // Refresh settings
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/settings/`);
      if (!response.ok) {
        throw new Error('Failed to fetch updated settings');
      }
      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      
      // Show success message
      setUpdateStatus('success');
      toast.success(intl.formatMessage({ id: 'settings.messages.success' }));
      
      // If currency changed, show notification about emergency fund target conversion
      if (oldCurrency !== updatedSettings.currency && updatedSettings.emergency_fund_target) {
        toast.success(
          intl.formatMessage(
            { id: 'settings.messages.currencyConverted' },
            { 
              oldCurrency: oldCurrency,
              newCurrency: updatedSettings.currency,
              amount: updatedSettings.emergency_fund_target
            }
          ),
          { duration: 6000 }
        );
      }
      
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
          
          <h3 className="text-lg font-medium mt-6 mb-4 text-primary">
            {intl.formatMessage({ id: 'settings.financialFreedom.title' })}
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              {intl.formatMessage({ id: 'settings.financialFreedom.emergencyFundTarget' })}
              <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.emergencyFundTarget' })} icon={true} />
            </label>
            <div className="relative">
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-default bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                  {getCurrencySymbol(settings.currency)}
                </span>
                <input
                  type="number"
                  min="1000"
                  max="5000"
                  step="100"
                  value={settings.emergency_fund_target || 1000}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    emergency_fund_target: Math.max(1000, Math.min(5000, parseInt(e.target.value) || 1000))
                  })}
                  className="w-full rounded-r-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="mt-1 text-xs text-secondary">
                {intl.formatMessage({ id: 'settings.financialFreedom.emergencyFundTargetRange' })}
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-secondary mb-1">
              {intl.formatMessage({ id: 'settings.financialFreedom.emergencyFundMonths' })}
              <Tooltip content={intl.formatMessage({ id: 'settings.tooltips.emergencyFundMonths' })} icon={true} />
            </label>
            <div className="relative">
              <select
                value={settings.emergency_fund_months || 3}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  emergency_fund_months: parseInt(e.target.value) 
                })}
                className="w-full mt-1 block rounded-md border border-default bg-input text-primary px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((months) => (
                  <option key={months} value={months}>
                    {months} {intl.formatMessage({ id: 'settings.financialFreedom.months' })}
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

      {/* Banking Connections Section */}
      <div className="bg-white dark:bg-background-primary p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-medium mb-4">
          Banking Connections
          <Tooltip content="View and manage your connected bank accounts" icon={true} />
        </h2>
        
        {bankingConnections.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Connected On</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Accounts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {bankingConnections.map((connection) => {
                  const createdDate = new Date(connection.created_at).toLocaleDateString();
                  const expiresDate = new Date(connection.expires_at).toLocaleDateString();
                  const isExpired = new Date(connection.expires_at) < new Date();
                  
                  return (
                    <tr key={connection.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">{connection.institution_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">{createdDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={isExpired ? 'text-red-500' : 'text-secondary'}>
                          {expiresDate}
                          {isExpired && ' (Expired)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {connection.accounts ? connection.accounts.length : 0} accounts
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDeleteConnection(connection.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-4 text-center text-secondary">
            <p>No bank connections found.</p>
            <p className="mt-2">
              <a href="/banking" className="text-blue-500 hover:text-blue-700">
                Connect your bank account
              </a>
            </p>
          </div>
        )}
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