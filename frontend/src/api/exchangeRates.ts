import { fetchWithAuth } from './fetchWithAuth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Cache exchange rates to minimize API calls
type ExchangeRateCache = {
  [key: string]: {
    rates: Record<string, number>;
    timestamp: number;
  }
};

const ratesCache: ExchangeRateCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Get exchange rates for a given base currency
 * @param baseCurrency Base currency code (e.g., 'USD')
 * @returns Record of exchange rates
 */
export async function getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  // Check if we have cached rates that are still valid
  if (
    ratesCache[baseCurrency] &&
    Date.now() - ratesCache[baseCurrency].timestamp < CACHE_TTL
  ) {
    console.log(`[Exchange Rates] Using cached rates for ${baseCurrency}`);
    return ratesCache[baseCurrency].rates;
  }

  try {
    console.log(`[Exchange Rates] Fetching rates for ${baseCurrency}`);
    const response = await fetchWithAuth(`${API_BASE_URL}/exchange-rates/${baseCurrency}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch exchange rates: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Cache the results
    ratesCache[baseCurrency] = {
      rates: data.rates,
      timestamp: Date.now()
    };

    return data.rates;
  } catch (error) {
    console.error('[Exchange Rates] Error fetching exchange rates:', error);
    throw error;
  }
}

/**
 * Convert an amount from one currency to another
 * @param amount Amount to convert
 * @param fromCurrency Source currency code
 * @param toCurrency Target currency code
 * @returns Converted amount
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  console.log(`[Exchange Rates] Converting ${amount} from ${fromCurrency} to ${toCurrency}`);
  
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }

  try {
    // Use direct conversion API endpoint if available
    const response = await fetchWithAuth(
      `${API_BASE_URL}/exchange-rates/convert/${fromCurrency}/${toCurrency}/${amount}`
    );

    if (response.ok) {
      const data = await response.json();
      return data.converted;
    }

    // Fallback to manual conversion using rates
    const fromRates = await getExchangeRates(fromCurrency);
    
    if (toCurrency in fromRates) {
      // Direct conversion available
      return amount * fromRates[toCurrency];
    } else {
      // Need to convert via USD or try another approach
      const toRates = await getExchangeRates(toCurrency);
      
      if (fromCurrency in toRates) {
        // Use inverse rate
        return amount / toRates[fromCurrency];
      } else {
        throw new Error(`Could not find exchange rate for ${fromCurrency} to ${toCurrency}`);
      }
    }
  } catch (error) {
    console.error('[Exchange Rates] Error converting currency:', error);
    throw error;
  }
}