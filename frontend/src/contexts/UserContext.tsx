'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';

// Define our own types based on the Prisma schema
interface UserSettings {
  id: string;
  userId: string;
  language: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string | null;
  settings?: UserSettings | null;
}

// Define the shape of our context
type UserContextType = {
  user: UserData | null;
  isLoading: boolean;
  error: Error | null;
  refreshUser: () => Promise<void>;
};

// Create the context with a default value
const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  error: null,
  refreshUser: async () => {},
});

// Hook to use the user context
export const useUser = () => useContext(UserContext);

// Provider component
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    if (!session?.user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Use Next.js API proxy for all backend calls to ensure auth headers are added
      const response = await fetch('/api/backend/users/me');
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      logger.error('[user-context][error] Error fetching user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user data when session changes
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'authenticated') {
      fetchUser();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [status, session]);

  // Function to manually refresh user data
  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <UserContext.Provider value={{ user, isLoading, error, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}; 
