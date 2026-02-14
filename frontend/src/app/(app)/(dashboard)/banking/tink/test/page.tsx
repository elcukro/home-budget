"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedPage from '@/components/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TinkDebugData {
  has_connection: boolean;
  error?: string;
  connection_info?: {
    id: number;
    created_at: string;
    last_sync_at: string | null;
    token_expires_at: string;
    scopes: string;
    stored_accounts: string[];
    stored_account_details: Record<string, any>;
  };
  accounts?: {
    count: number;
    data: any[];
    raw: any[];
  };
  transactions?: {
    count: number;
    period: string;
    next_page_token: string | null;
    data: any[];
  };
  timestamp: string;
}

interface Provider {
  name: string;
  financialInstitutionId: string;
  accessType: string;
  images: {
    icon?: string;
    banner?: string;
  };
}

interface ProvidersData {
  market: string;
  count: number;
  providers: Provider[];
  timestamp: string;
}

export default function TinkTestPage() {
  const router = useRouter();
  const [data, setData] = useState<TinkDebugData | null>(null);
  const [providers, setProviders] = useState<ProvidersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/banking/tink/debug-data');
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await fetch('/api/banking/tink/providers?market=PL');
      const result = await response.json();
      setProviders(result);
    } catch (err: any) {
      console.error('Failed to fetch providers:', err);
    } finally {
      setLoadingProviders(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const response = await fetch('/api/banking/tink/refresh', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        setRefreshMessage(`Refreshed! ${result.accounts_count} accounts synced.`);
        // Reload data after refresh
        await fetchData();
      } else {
        setRefreshMessage(`Error: ${result.error}`);
      }
    } catch (err: any) {
      setRefreshMessage(`Error: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatCurrency = (amount: any) => {
    if (!amount) return 'N/A';
    const value = amount.value?.unscaledValue
      ? Number(amount.value.unscaledValue) / Math.pow(10, amount.value.scale || 0)
      : amount.value;
    return `${value} ${amount.currencyCode || ''}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <ProtectedPage>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tink API Test Page</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/settings?tab=banking')}>
              Back to Settings
            </Button>
            <Button variant="outline" onClick={refreshData} disabled={refreshing || loading}>
              {refreshing ? 'Syncing...' : 'Sync from Bank'}
            </Button>
            <Button onClick={fetchData} disabled={loading}>
              {loading ? 'Loading...' : 'Reload'}
            </Button>
          </div>
        </div>

        {refreshMessage && (
          <div className={`p-4 rounded-lg mb-6 ${refreshMessage.includes('Error') ? 'bg-destructive/10 border border-destructive/40 text-destructive' : 'bg-green-100 border border-green-400 text-green-800'}`}>
            {refreshMessage}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/40 text-destructive p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading Tink data...</p>
          </div>
        )}

        {data && !data.has_connection && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No active Tink connection found.</p>
              <Button onClick={() => router.push('/settings?tab=banking')}>
                Connect Bank Account
              </Button>
            </CardContent>
          </Card>
        )}

        {data && data.has_connection && (
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="accounts">Accounts ({data.accounts?.count || 0})</TabsTrigger>
              <TabsTrigger value="transactions">Transactions ({data.transactions?.count || 0})</TabsTrigger>
              <TabsTrigger value="providers" onClick={() => !providers && fetchProviders()}>
                Banks ({providers?.count || '...'})
              </TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Connection Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connection ID:</span>
                      <span className="font-mono">{data.connection_info?.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{formatDate(data.connection_info?.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Sync:</span>
                      <span>{formatDate(data.connection_info?.last_sync_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Token Expires:</span>
                      <span>{formatDate(data.connection_info?.token_expires_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stored Accounts:</span>
                      <span>{data.connection_info?.stored_accounts?.length || 0}</span>
                    </div>
                    <div className="pt-2">
                      <span className="text-muted-foreground">Scopes:</span>
                      <p className="font-mono text-xs mt-1 break-all bg-muted p-2 rounded">
                        {data.connection_info?.scopes || 'N/A'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Data Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded">
                      <span>Accounts</span>
                      <span className="text-2xl font-bold">{data.accounts?.count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded">
                      <span>Transactions</span>
                      <span className="text-2xl font-bold">{data.transactions?.count || 0}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Period: {data.transactions?.period}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Data fetched: {formatDate(data.timestamp)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Accounts Tab */}
            <TabsContent value="accounts">
              <div className="space-y-4">
                {data.accounts?.data.map((account, index) => (
                  <Card key={account.id || index}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{account.name || 'Unnamed Account'}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {account.type}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 text-sm">
                          <h4 className="font-medium">Identifiers</h4>
                          <div className="bg-muted p-3 rounded space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Account ID:</span>
                              <span className="font-mono text-xs">{account.id}</span>
                            </div>
                            {account.identifiers?.iban?.iban && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">IBAN:</span>
                                <span className="font-mono">{account.identifiers.iban.iban}</span>
                              </div>
                            )}
                            {account.financialInstitutionId && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bank ID:</span>
                                <span className="font-mono text-xs">{account.financialInstitutionId}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <h4 className="font-medium">Balances</h4>
                          <div className="bg-muted p-3 rounded space-y-1">
                            {account.balances?.booked && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Booked:</span>
                                <span className="font-bold">{formatCurrency(account.balances.booked.amount)}</span>
                              </div>
                            )}
                            {account.balances?.available && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Available:</span>
                                <span>{formatCurrency(account.balances.available.amount)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {account.dates && (
                          <div className="space-y-2 text-sm md:col-span-2">
                            <h4 className="font-medium">Dates</h4>
                            <div className="bg-muted p-3 rounded flex gap-4 flex-wrap">
                              {account.dates.lastRefreshed && (
                                <div>
                                  <span className="text-muted-foreground">Last Refreshed: </span>
                                  <span>{formatDate(account.dates.lastRefreshed)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3"
                        onClick={() => toggleSection(`account-${index}`)}
                      >
                        {expandedSections[`account-${index}`] ? 'Hide' : 'Show'} Raw Data
                      </Button>
                      {expandedSections[`account-${index}`] && (
                        <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-64">
                          {JSON.stringify(account, null, 2)}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Transactions</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {data.transactions?.period}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Description / Merchant</th>
                          <th className="text-left p-2">MCC</th>
                          <th className="text-left p-2">Category</th>
                          <th className="text-right p-2">Amount</th>
                          <th className="text-left p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.transactions?.data.slice(0, 50).map((tx, index) => (
                          <tr key={tx.id || index} className="border-b hover:bg-muted/50">
                            <td className="p-2 whitespace-nowrap">
                              {tx.dates?.booked || tx.dates?.valueDate || 'N/A'}
                            </td>
                            <td className="p-2">
                              <div className="max-w-xs truncate">
                                {tx.descriptions?.display || tx.descriptions?.original || 'N/A'}
                              </div>
                              {(tx.merchantInformation?.merchantName || tx.merchantInformation?.name) && (
                                <div className="text-xs text-blue-600 font-medium">
                                  🏪 {tx.merchantInformation?.merchantName || tx.merchantInformation?.name}
                                </div>
                              )}
                            </td>
                            <td className="p-2">
                              {tx.merchantInformation?.merchantCategoryCode ? (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">
                                  {tx.merchantInformation.merchantCategoryCode}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {tx.categories?.pfm?.name || tx.enrichedData?.categories?.pfm?.name || tx.types?.type || 'Unknown'}
                              </span>
                              {(tx.categories?.pfm?.id || tx.enrichedData?.categories?.pfm?.id) && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  ({tx.categories?.pfm?.id || tx.enrichedData?.categories?.pfm?.id})
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-right whitespace-nowrap font-mono">
                              <span className={
                                tx.amount?.value?.unscaledValue > 0
                                  ? 'text-green-600'
                                  : tx.amount?.value?.unscaledValue < 0
                                    ? 'text-red-600'
                                    : ''
                              }>
                                {formatCurrency(tx.amount)}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                tx.status === 'BOOKED'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {tx.status || 'Unknown'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {data.transactions && data.transactions.count > 50 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Showing 50 of {data.transactions.count} transactions
                    </p>
                  )}

                  {data.transactions?.next_page_token && (
                    <p className="text-center text-sm text-muted-foreground mt-2">
                      More transactions available (pagination token exists)
                    </p>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={() => toggleSection('transactions-raw')}
                  >
                    {expandedSections['transactions-raw'] ? 'Hide' : 'Show'} Raw Transaction Data (first 5)
                  </Button>
                  {expandedSections['transactions-raw'] && (
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(data.transactions?.data.slice(0, 5), null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Providers (Banks) Tab */}
            <TabsContent value="providers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Available Banks in Poland</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchProviders}
                      disabled={loadingProviders}
                    >
                      {loadingProviders ? 'Loading...' : 'Refresh'}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingProviders && !providers && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading banks...</p>
                    </div>
                  )}

                  {providers && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {providers.providers.map((provider, index) => (
                        <div
                          key={provider.financialInstitutionId || index}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            {provider.images?.icon ? (
                              <img
                                src={provider.images.icon}
                                alt={provider.name}
                                className="w-10 h-10 object-contain rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs font-bold">
                                {provider.name?.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{provider.name}</p>
                              <p className="text-xs text-muted-foreground">{provider.accessType}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {provider.financialInstitutionId}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {providers && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      {providers.count} banks available in {providers.market}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Raw JSON Tab */}
            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle>Complete API Response</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-[600px]">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ProtectedPage>
  );
}
