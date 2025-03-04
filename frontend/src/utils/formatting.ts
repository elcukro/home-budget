export const getCurrencySymbol = (currency: string | undefined): string => {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'PLN': return 'zł';
    default: return '$';
  }
};

export const formatCurrency = (amount: number | null | undefined, currency: string = 'USD'): string => {
  if (amount === null || amount === undefined) {
    return `${getCurrencySymbol(currency)}0.00`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
  }
};

export const formatPercentage = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined) return '0%';
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(rate / 100);
}; 