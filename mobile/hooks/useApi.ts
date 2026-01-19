import { getApiClient, type ApiClient } from '@/lib/api';

export function useApi(): ApiClient | null {
  return getApiClient();
}
