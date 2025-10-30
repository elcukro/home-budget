import { fetchWithAuth } from './fetchWithAuth';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Loan {
  id: number;
  loan_type: string;
  description: string;
  principal_amount: number;
  remaining_balance: number;
  interest_rate: number;
  monthly_payment: number;
  start_date: string;
  term_months: number;
  created_at: string;
  updated_at: string | null;
}

// Cache for API responses
interface ApiCache {
  loans?: {
    data: Loan[];
    timestamp: number;
  };
  nonMortgageDebt?: {
    data: number;
    timestamp: number;
  };
  nonMortgagePrincipal?: {
    data: number;
    timestamp: number;
  };
  mortgageData?: {
    data: CombinedMortgageData | null;
    timestamp: number;
  };
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// In-memory cache
const apiCache: ApiCache = {};

export const getLoans = async (): Promise<Loan[]> => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (
    apiCache.loans && 
    now - apiCache.loans.timestamp < CACHE_DURATION
  ) {
    console.log('Using cached loans data');
    return apiCache.loans.data;
  }
  
  try {
    const session = await getSession();
    
    if (!session?.user?.email) {
      console.error('No active session found or missing user email');
      return [];
    }
    
    // Use the user_id as a query parameter instead of a header
    const url = `${API_URL}/loans?user_id=${encodeURIComponent(session.user.email)}`;
    console.log('Fetching loans from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch loans: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch loans: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Loans data:', data);
    
    // Cache the response
    apiCache.loans = {
      data,
      timestamp: now,
    };
    
    return data;
  } catch (error) {
    console.error('Error fetching loans:', error);
    // Return an empty array instead of throwing to avoid breaking the Financial Freedom page
    return [];
  }
};

export const getNonMortgageDebt = async (): Promise<number> => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (
    apiCache.nonMortgageDebt && 
    now - apiCache.nonMortgageDebt.timestamp < CACHE_DURATION
  ) {
    console.log('Using cached non-mortgage debt data');
    return apiCache.nonMortgageDebt.data;
  }
  
  try {
    const loans = await getLoans();
    const nonMortgageDebt = loans
      .filter(loan => loan.loan_type.toLowerCase() !== 'mortgage')
      .reduce((sum, loan) => sum + loan.remaining_balance, 0);
    
    // Cache the result
    apiCache.nonMortgageDebt = {
      data: nonMortgageDebt,
      timestamp: now
    };
    
    return nonMortgageDebt;
  } catch (error) {
    console.error('Error fetching non-mortgage debt:', error);
    return 0;
  }
};

export const getNonMortgagePrincipal = async (): Promise<number> => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (
    apiCache.nonMortgagePrincipal && 
    now - apiCache.nonMortgagePrincipal.timestamp < CACHE_DURATION
  ) {
    console.log('Using cached non-mortgage principal data');
    return apiCache.nonMortgagePrincipal.data;
  }
  
  try {
    const loans = await getLoans();
    const nonMortgagePrincipal = loans
      .filter(loan => loan.loan_type.toLowerCase() !== 'mortgage')
      .reduce((sum, loan) => sum + loan.principal_amount, 0);
    
    // Cache the result
    apiCache.nonMortgagePrincipal = {
      data: nonMortgagePrincipal,
      timestamp: now
    };
    
    return nonMortgagePrincipal;
  } catch (error) {
    console.error('Error fetching non-mortgage principal:', error);
    return 0;
  }
};

// Cache for combined mortgage data (all mortgages)
interface CombinedMortgageData {
  principal_amount: number;
  remaining_balance: number;
  hasMortgage: boolean;
}

/**
 * Gets the mortgage loan data with caching
 * Returns combined data from all mortgages, or null if no mortgages exist
 */
export const getMortgageData = async (): Promise<CombinedMortgageData | null> => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (
    apiCache.mortgageData && 
    now - apiCache.mortgageData.timestamp < CACHE_DURATION
  ) {
    console.log('Using cached mortgage data');
    return apiCache.mortgageData.data;
  }
  
  try {
    const loans = await getLoans();
    const mortgages = loans.filter(loan => loan.loan_type.toLowerCase() === 'mortgage');
    
    if (mortgages.length === 0) {
      // No mortgages found
      const noMortgageData = {
        principal_amount: 0,
        remaining_balance: 0,
        hasMortgage: false
      };
      
      // Cache the result
      apiCache.mortgageData = {
        data: noMortgageData,
        timestamp: now
      };
      
      return noMortgageData;
    }
    
    // Combine all mortgages data
    const combinedData = {
      principal_amount: mortgages.reduce((sum, loan) => sum + loan.principal_amount, 0),
      remaining_balance: mortgages.reduce((sum, loan) => sum + loan.remaining_balance, 0),
      hasMortgage: true
    };
    
    // Cache the result
    apiCache.mortgageData = {
      data: combinedData,
      timestamp: now
    };
    
    return combinedData;
  } catch (error) {
    console.error('Error fetching mortgage data:', error);
    return null;
  }
}; 
