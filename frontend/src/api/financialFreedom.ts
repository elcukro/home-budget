import { BabyStep, FinancialFreedomData } from '@/types/financial-freedom';
import { fetchWithAuth } from './fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const getFinancialFreedomData = async (): Promise<FinancialFreedomData> => {
  try {
    const response = await fetchWithAuth(`${API_URL}/financial-freedom`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch financial freedom data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching financial freedom data:', error);
    throw error;
  }
};

export const updateFinancialFreedomData = async (data: { steps: BabyStep[], startDate?: string }): Promise<FinancialFreedomData> => {
  try {
    const response = await fetchWithAuth(`${API_URL}/financial-freedom`, {
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
    console.error('Error updating financial freedom data:', error);
    throw error;
  }
};

// Reset functionality removed as it's no longer needed 