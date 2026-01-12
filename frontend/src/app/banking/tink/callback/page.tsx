"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/api/fetchWithAuth';
import ProtectedPage from '@/components/ProtectedPage';
import { logger } from '@/lib/logger';

interface AccountDetail {
  id: string;
  name?: string;
  iban?: string;
  currency?: string;
  type?: string;
}

interface CallbackResponse {
  success: boolean;
  connection_id: number;
  accounts: AccountDetail[];
  message: string;
}

export default function TinkCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing bank connection...');
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle error from Tink
      if (errorParam) {
        setStatus('error');
        setError(errorDescription || errorParam || 'Unknown error from bank');
        setMessage('Bank connection failed');
        return;
      }

      // Check for required parameters
      if (!code || !state) {
        setStatus('error');
        setError('Missing authorization code or state parameter');
        setMessage('Invalid callback parameters');
        return;
      }

      try {
        logger.debug('Processing Tink callback with code and state');

        const response = await fetchWithAuth('/api/banking/tink/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to complete bank connection');
        }

        const data: CallbackResponse = await response.json();

        setStatus('success');
        setMessage(data.message || 'Bank account connected successfully!');
        setAccounts(data.accounts || []);

        logger.debug('Tink connection successful:', data);

      } catch (err: any) {
        logger.error('Tink callback error:', err);
        setStatus('error');
        setError(err.message || 'An error occurred while connecting your bank');
        setMessage('Bank connection failed');
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleGoToSettings = () => {
    router.push('/settings');
  };

  const handleTryAgain = () => {
    router.push('/settings');
  };

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-card border border-default p-8 rounded-lg shadow-sm text-center">
            {status === 'loading' && (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h1 className="text-xl font-semibold mb-2">Connecting Your Bank</h1>
                <p className="text-secondary">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold mb-2 text-success">Bank Connected!</h1>
                <p className="text-secondary mb-4">{message}</p>

                {accounts.length > 0 && (
                  <div className="mt-4 mb-6 text-left">
                    <h2 className="text-sm font-medium mb-2">Connected Accounts:</h2>
                    <ul className="bg-muted rounded p-3 space-y-2">
                      {accounts.map((account) => (
                        <li key={account.id} className="text-sm">
                          <span className="font-medium">{account.name || 'Account'}</span>
                          {account.iban && (
                            <span className="text-secondary ml-2">
                              ({account.iban.slice(-4)})
                            </span>
                          )}
                          {account.currency && (
                            <span className="text-secondary ml-2">
                              {account.currency}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={handleGoToSettings}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-6 rounded"
                >
                  Go to Settings
                </button>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold mb-2 text-destructive">Connection Failed</h1>
                <p className="text-secondary mb-2">{message}</p>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 p-3 rounded mb-4">
                    {error}
                  </p>
                )}
                <button
                  onClick={handleTryAgain}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-6 rounded"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
