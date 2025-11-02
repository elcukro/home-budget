import { getSession } from 'next-auth/react';
import { logger } from '@/lib/logger';

export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const session = await getSession();
  
  if (!session?.user?.email) {
    logger.error('No active session found or missing user email');
    throw new Error('No active session found');
  }
  
  // Log the session info for debugging
  logger.debug('Session user:', session.user.email);
  
  const headers = {
    ...options.headers,
    'X-User-ID': session.user.email,
  };
  
  logger.debug('Request headers:', headers);
  
  return fetch(url, {
    ...options,
    headers,
  });
}; 
