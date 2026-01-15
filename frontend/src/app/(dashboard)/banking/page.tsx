"use client";

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/api/fetchWithAuth';
import PageTitle from '@/components/PageTitle';
import ProtectedPage from '@/components/ProtectedPage';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

interface AccountInfo {
  id: string;
  name?: string;
}

export default function BankingPage() {
  const router = useRouter();
  const [country, setCountry] = useState<string>('gb');
  const [institutionId, setInstitutionId] = useState<string>('');
  const [requisitionId, setRequisitionId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [transactions, setTransactions] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [useSandbox, setUseSandbox] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // Fetch saved bank connections from user settings
  const fetchBankConnections = async () => {
    try {
      const response = await fetchWithAuth('/api/banking/connections');
      
      if (!response.ok) {
        throw new Error('Failed to fetch banking connections');
      }
      
      const connections = await response.json();
      
      // If we have active connections, use the most recent one
      if (connections && connections.length > 0) {
        // Sort by creation date (newest first)
        const sortedConnections = [...connections].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        const latestConnection = sortedConnections[0];
        
        // Auto-populate form fields with the saved connection data
        setInstitutionId(latestConnection.institution_id);
        setRequisitionId(latestConnection.requisition_id);
        
        // Get institutions to properly display the bank name
        await getInstitutions();
        
        // If connection has account names, prepare accounts array with names
        if (latestConnection.accounts && latestConnection.accounts.length > 0) {
          const accountsWithNames = latestConnection.accounts.map((accountId: string) => {
            const name = latestConnection.account_names?.[accountId] || null;
            return { id: accountId, name };
          });
          
          setAccounts(accountsWithNames);
          
          // Set accountId to the first one
          setAccountId(latestConnection.accounts[0]);
          
          setStatusMessage(`Found existing bank connection to ${latestConnection.institution_name} with ${accountsWithNames.length} accounts. Form has been auto-populated.`);
        } else if (typeof latestConnection.requisition_id === 'string') {
          // Fetch accounts without account names
          await getRequisition(latestConnection.requisition_id);
          setStatusMessage(`Found existing bank connection to ${latestConnection.institution_name}. Form has been auto-populated.`);
        } else {
          logger.error('Invalid requisition ID:', latestConnection.requisition_id);
          setStatusMessage(`Found existing bank connection to ${latestConnection.institution_name}, but couldn't fetch accounts due to invalid requisition ID.`);
        }
      }
    } catch (error) {
      logger.error('Error fetching bank connections:', error);
      // Don't show an error message, just silently fail
    }
  };

  useEffect(() => {
    // Clear error and status message when dependencies change
    setError(null);
    setStatusMessage(null);
  }, [country, institutionId, requisitionId, accountId]);
  
  // When sandbox mode changes, update the UI
  useEffect(() => {
    if (useSandbox) {
      // When enabling sandbox mode, auto-select the sandbox bank
      getInstitutions();
    } else {
      // When disabling sandbox mode, clear the institution selection
      setInstitutionId('');
      setInstitutions([]);
    }
  }, [useSandbox]);
  
  // Auto-fetch transactions when account is selected
  useEffect(() => {
    if (accountId) {
      getTransactions();
    }
  }, [accountId]);

  // Handle redirect from bank and fetch saved connections on page load
  useEffect(() => {
    // First try to load saved connections
    fetchBankConnections();
    
    // Check if we have a URL parameter (we were redirected back from the bank)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      
      if (refParam) {
        logger.debug('Detected redirect from bank with ref:', refParam);
        // Check if we have a requisitionId in state already
        if (requisitionId && typeof requisitionId === 'string') {
          logger.debug('Using existing requisition ID:', requisitionId);
          // We already have a requisition ID, we can use it to fetch accounts
          getRequisition(requisitionId);
        } else {
          // We need to get the requisition ID from the reference parameter
          setStatusMessage('Redirect detected. Please enter your requisition ID to continue.');
        }
      }
    }
  }, []);

  const getInstitutions = async () => {
    setLoading(true);
    setError(null);
    setInstitutions([]);
    
    try {
      if (useSandbox) {
        // If sandbox mode is on, just add the sandbox bank
        const sandboxBank = {
          id: "SANDBOXFINANCE_SFIN0000",
          name: "Sandbox Bank",
          bic: "SANDBOXX",
          transaction_total_days: "90",
          countries: ["GB", "DE", "FR", "ES", "IT", "NL", "PL"],
          logo: "",
          max_access_valid_for_days: "90"
        };
        setInstitutions([sandboxBank]);
        setInstitutionId("SANDBOXFINANCE_SFIN0000");
        setStatusMessage("Using Sandbox Bank for testing");
      } else {
        // Normal flow - fetch real institutions
        const response = await fetchWithAuth(`/api/banking/institutions?country=${country}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch institutions');
        }
        
        const data = await response.json();
        setInstitutions(data);
        setStatusMessage(`Found ${data.length} institutions`);
      }
    } catch (error: any) {
      setError(error.message || 'Error fetching institutions');
    } finally {
      setLoading(false);
    }
  };

  const createRequisition = async () => {
    // If sandbox mode is on, we'll use the sandbox institution
    const finalInstitutionId = useSandbox ? 'SANDBOXFINANCE_SFIN0000' : institutionId;
    
    if (!finalInstitutionId) {
      setError('Please select an institution first');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get the current origin for the redirect URL
      const origin = window.location.origin;
      const redirectUrl = `${origin}/banking`;
      
      const response = await fetchWithAuth('/api/banking/requisitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirect: redirectUrl,
          institution_id: finalInstitutionId,
          reference: Date.now().toString(),
          user_language: 'EN',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create requisition');
      }
      
      const data = await response.json();
      setRequisitionId(data.id);
      setStatusMessage('Requisition created successfully');
      
      // Open the link in a new tab/window for authentication
      if (data.link) {
        window.open(data.link.replace('{$INSTITUTION_ID}', institutionId), '_blank');
      }
    } catch (error: any) {
      setError(error.message || 'Error creating requisition');
    } finally {
      setLoading(false);
    }
  };

  const getRequisition = async (reqId?: string) => {
    // Add detailed logging
    logger.debug('getRequisition called with param:', reqId);
    logger.debug('Current requisitionId state:', requisitionId);
    logger.debug('requisitionId type:', typeof requisitionId);
    
    // Use the provided requisition ID or the one from state
    let requisitionIdToUse = reqId || requisitionId;
    
    // Force to string if it's not already a string but can be converted
    if (requisitionIdToUse && typeof requisitionIdToUse !== 'string') {
      try {
        // Try to convert to string
        const stringId = String(requisitionIdToUse);
        logger.debug('Converted requisitionId to string:', stringId);
        requisitionIdToUse = stringId;
      } catch (e) {
        logger.error('Failed to convert requisitionId to string:', e);
      }
    }
    
    // Add validation for requisition ID type
    if (!requisitionIdToUse) {
      setError('Please enter a requisition ID');
      return;
    }
    
    // Even with conversion attempt, still validate the type for safety
    if (typeof requisitionIdToUse !== 'string') {
      logger.error('Invalid requisition ID type after conversion attempt:', typeof requisitionIdToUse, requisitionIdToUse);
      setError('Invalid requisition ID format. Please try entering it manually.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setAccounts([]);
    
    try {
      const response = await fetchWithAuth(`/api/banking/requisitions/${requisitionIdToUse}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch requisition');
      }
      
      const data = await response.json();
      const accountIds = data.accounts || [];
      
      // Create account objects with IDs
      const accountsWithIds = accountIds.map((id: string) => ({ id }));
      setAccounts(accountsWithIds);
      
      // For each account, fetch details to get the owner name
      if (accountIds.length > 0) {
        setStatusMessage(`Found ${accountIds.length} accounts. Fetching account details...`);
        
        // Fetch account details for each account
        const accountDetailsPromises = accountIds.map(async (accountId: string) => {
          try {
            const detailsResponse = await fetchWithAuth(`/api/banking/accounts/${accountId}/details`);
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();
              const account = detailsData.account || {};
              
              // Format: {name}, {product} ({currency})
              let formattedName = 'Unknown Account';
              if (account.ownerName) {
                formattedName = account.ownerName;
                if (account.product) {
                  formattedName += `, ${account.product}`;
                }
                if (account.currency) {
                  formattedName += ` (${account.currency})`;
                }
              }
              
              return {
                id: accountId,
                name: formattedName,
                currency: account.currency,
                product: account.product,
                ownerName: account.ownerName
              };
            }
            return { id: accountId };
          } catch {
            return { id: accountId };
          }
        });
        
        // Wait for all account details to be fetched
        const accountsWithDetails = await Promise.all(accountDetailsPromises);
        setAccounts(accountsWithDetails);
        setStatusMessage(`Found ${accountIds.length} accounts with owner details`);
      } else {
        setStatusMessage(`Found ${accountIds.length} accounts`);
      }
    } catch (error: any) {
      setError(error.message || 'Error fetching requisition');
    } finally {
      setLoading(false);
    }
  };
  
  const saveConnection = async () => {
    if (!requisitionId || !institutionId) {
      setError('Please enter requisition ID and select an institution');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Find institution name
      const institutionName = institutions.find(i => i.id === institutionId)?.name || 'Unknown Bank';
      
      // Calculate expiration date (90 days from now by default)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);
      
      // Create a map of account IDs to account names
      const accountNames = accounts.reduce((map, account) => {
        if (account.name) {
          // Use the formatted name that includes product and currency
          map[account.id] = account.name;
        }
        return map;
      }, {} as Record<string, string>);
      
      const accountIds = accounts.map(account => account.id);
      
      const response = await fetchWithAuth('/api/banking/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requisition_id: requisitionId,
          institution_id: institutionId,
          institution_name: institutionName,
          expires_at: expiresAt.toISOString(),
          accounts: accountIds,
          account_names: accountNames
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save connection');
      }
      
      setStatusMessage('Banking connection saved successfully! You can now access your banking data from your account settings.');
    } catch (error: any) {
      setError(error.message || 'Error saving connection');
    } finally {
      setLoading(false);
    }
  };

  const getTransactions = async () => {
    if (!accountId) {
      setError('Please select an account first');
      return;
    }
    
    setLoading(true);
    setError(null);
    setTransactions(null);
    
    try {
      const response = await fetchWithAuth(`/api/banking/accounts/${accountId}/transactions`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch transactions');
      }
      
      const data = await response.json();
      setTransactions(data);
      
      const bookedCount = data.transactions?.booked?.length || 0;
      const pendingCount = data.transactions?.pending?.length || 0;
      setStatusMessage(`Found ${bookedCount} booked and ${pendingCount} pending transactions`);
    } catch (error: any) {
      setError(error.message || 'Error fetching transactions');
    } finally {
      setLoading(false);
    }
  };

  // Function to close the transaction details modal
  const closeTransactionDetails = () => {
    setSelectedTransaction(null);
  };
  
  // Modal component for transaction details
  const TransactionDetailsModal = ({ transaction }: { transaction: any }) => {
    if (!transaction) return null;
    
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card border border-default p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-primary">Transaction Details</h2>
            <button 
              onClick={closeTransactionDetails}
              className="text-secondary hover:text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="overflow-auto bg-muted p-4 rounded">
            <pre className="text-sm whitespace-pre-wrap break-words text-secondary">
              {JSON.stringify(transaction, null, 2)}
            </pre>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={closeTransactionDetails}
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <ProtectedPage>
      {selectedTransaction && <TransactionDetailsModal transaction={selectedTransaction} />}
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <PageTitle title="Banking Data Integration" />
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${useSandbox ? 'font-semibold text-primary' : 'text-secondary'}`}>
              Sandbox Mode
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={useSandbox}
                onChange={() => setUseSandbox(!useSandbox)}
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border border-default after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
        
        {useSandbox && (
          <div className="bg-mint/40 border border-primary text-primary px-4 py-3 rounded mb-4">
            <strong>Sandbox Mode Active:</strong> Using GoCardless Sandbox Bank (SANDBOXFINANCE_SFIN0000). No real bank credentials needed.
          </div>
        )}
        
        {requisitionId && accounts.length > 0 && (
          <div className="bg-mint/40 border border-primary text-primary px-4 py-3 rounded mb-4">
            <strong>Active Bank Connection:</strong> Your bank account is connected. You can view transactions or create a new connection below.
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {statusMessage && (
          <div className="bg-success/15 border border-success text-success px-4 py-3 rounded mb-4">
            <strong>Status:</strong> {statusMessage}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Step 1: Select Country and Get Institutions */}
          <div className="bg-card border border-default p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Step 1: Select Country and Get Institutions</h2>
            
            {!useSandbox && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Country</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="gb">United Kingdom (GB)</option>
                  <option value="de">Germany (DE)</option>
                  <option value="fr">France (FR)</option>
                  <option value="es">Spain (ES)</option>
                  <option value="it">Italy (IT)</option>
                  <option value="nl">Netherlands (NL)</option>
                  <option value="pl">Poland (PL)</option>
                </select>
              </div>
            )}
            
            {useSandbox && (
              <div className="mb-4 p-3 bg-mint/40 rounded">
                <p className="text-sm">
                  <span className="font-bold">Sandbox Mode Active:</span> Using Sandbox Bank for testing.
                  No need to select a country or fetch institutions - the sandbox bank will be used automatically.
                </p>
              </div>
            )}
            
            <button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded disabled:opacity-50"
              onClick={getInstitutions}
              disabled={loading || useSandbox}
            >
              {loading ? 'Loading...' : 'Get Institutions'}
            </button>
            
            {institutions.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Select Institution</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                >
                  <option value="">Select an institution</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                  <option value="SANDBOXFINANCE_SFIN0000">Sandbox Finance (Testing)</option>
                </select>
              </div>
            )}
          </div>
          
          {/* Step 2: Create Requisition */}
          <div className="bg-card border border-default p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Step 2: Create Requisition</h2>
            
            <p className="mb-4 text-sm">
              This will create a link to connect to your selected bank. 
              The link will open in a new tab where you can authenticate 
              with your bank credentials.
            </p>
            
            <button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded disabled:opacity-50"
              onClick={createRequisition}
              disabled={loading || !institutionId}
            >
              {loading ? 'Creating...' : 'Create Bank Connection Link'}
            </button>
            
            {requisitionId && (
              <div className="mt-4">
                <p className="text-sm font-medium">Requisition ID:</p>
                <code className="block p-2 bg-muted rounded mt-1 text-sm break-all">
                  {requisitionId}
                </code>
              </div>
            )}
          </div>
          
          {/* Step 3: Get Accounts */}
          <div className="bg-card border border-default p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Step 3: Get Accounts</h2>
            
            <p className="mb-4 text-sm">
              After authenticating with your bank, get the list of accounts.
              Enter the requisition ID from Step 2 or from a previous session.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Requisition ID</label>
              <input 
                type="text"
                className="w-full p-2 border rounded"
                value={typeof requisitionId === 'string' ? requisitionId : ''}
                onChange={(e) => setRequisitionId(e.target.value)}
                placeholder="Enter requisition ID"
              />
              {requisitionId && typeof requisitionId !== 'string' && (
                <p className="text-destructive text-xs mt-1">
                  Invalid requisition ID format detected. Please enter the ID manually.
                </p>
              )}
            </div>
            
            <button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded disabled:opacity-50"
              onClick={() => {
                // Create a specific handler to ensure only string values are passed
                if (typeof requisitionId === 'string') {
                  getRequisition(requisitionId);
                } else {
                  setError('Invalid requisition ID format. Please enter a valid ID string.');
                }
              }}
              disabled={loading || !requisitionId}
            >
              {loading ? 'Loading...' : 'Get Accounts'}
            </button>
            
            {accounts.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Select Account</label>
                <select 
                  className="w-full p-2 border rounded"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name ? account.name : account.id}
                    </option>
                  ))}
                </select>
                
                <button 
              className="mt-4 bg-success hover:bg-success/90 text-success-foreground py-2 px-4 rounded disabled:opacity-50"
                  onClick={saveConnection}
                  disabled={loading || !requisitionId || !institutionId}
                >
                  {loading ? 'Saving...' : 'Save Bank Connection to Settings'}
                </button>
              </div>
            )}
          </div>
          
          {/* Step 4: Get Transactions */}
          <div className="bg-card border border-default p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Step 4: Get Transactions</h2>
            
            <p className="mb-4 text-sm">
              Retrieve transactions for the selected account.
            </p>
            
            <button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded disabled:opacity-50"
              onClick={getTransactions}
              disabled={loading || !accountId}
            >
              {loading ? 'Loading...' : 'Get Transactions'}
            </button>
          </div>
        </div>
        
        {/* Transaction Results */}
        {transactions && (
        <div className="mt-8 bg-card border border-default p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Transaction Results</h2>
              <span className="text-sm text-secondary">
                Click on any transaction to view full details
              </span>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Booked Transactions</h3>
              {transactions.transactions?.booked?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.transactions.booked.map((transaction: any, index: number) => (
                        <tr 
                          key={index} 
                          className="border-b hover:bg-muted cursor-pointer"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <td className="px-4 py-2">{transaction.bookingDate || transaction.valueDate || 'N/A'}</td>
                          <td className="px-4 py-2">{transaction.remittanceInformationUnstructured || 'N/A'}</td>
                          <td className={`px-4 py-2 ${parseFloat(transaction.transactionAmount.amount) < 0 ? 'text-destructive' : 'text-success'}`}>
                            {transaction.transactionAmount.amount}
                          </td>
                          <td className="px-4 py-2">{transaction.transactionAmount.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No booked transactions found.</p>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Pending Transactions</h3>
              {transactions.transactions?.pending?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.transactions.pending.map((transaction: any, index: number) => (
                        <tr 
                          key={index} 
                          className="border-b hover:bg-muted cursor-pointer"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <td className="px-4 py-2">{transaction.valueDate || 'N/A'}</td>
                          <td className="px-4 py-2">{transaction.remittanceInformationUnstructured || 'N/A'}</td>
                          <td className={`px-4 py-2 ${parseFloat(transaction.transactionAmount.amount) < 0 ? 'text-destructive' : 'text-success'}`}>
                            {transaction.transactionAmount.amount}
                          </td>
                          <td className="px-4 py-2">{transaction.transactionAmount.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No pending transactions found.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
