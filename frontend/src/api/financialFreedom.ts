import { BabyStep, FinancialFreedomData } from '@/types/financial-freedom';
import { logger } from '@/lib/logger';

// Use Next.js API proxy for all backend calls to ensure auth headers are added

export const getFinancialFreedomData = async (): Promise<FinancialFreedomData> => {
  try {
    // Use Next.js API proxy which adds auth headers (X-User-ID + X-Internal-Secret)
    const response = await fetch('/api/backend/financial-freedom/calculated');

    if (!response.ok) {
      throw new Error(`Failed to fetch financial freedom data: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error fetching financial freedom data:', error);
    throw error;
  }
};

export const updateFinancialFreedomData = async (data: { steps: BabyStep[], startDate?: string }): Promise<FinancialFreedomData> => {
  try {
    // Use Next.js API proxy which adds auth headers (X-User-ID + X-Internal-Secret)
    const response = await fetch('/api/backend/financial-freedom', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update financial freedom data: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error updating financial freedom data:', error);
    throw error;
  }
};

// Reset functionality removed as it's no longer needed 
