/**
 * Formats a number as a currency string based on the provided currency code
 * @param amount - The amount to format
 * @param currency - The ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
 * @returns A formatted currency string
 */
export const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    console.error(`Error formatting currency: ${error}`);
    // Fallback formatting if the currency code is invalid
    return `${currency} ${amount.toFixed(2)}`;
  }
}; 