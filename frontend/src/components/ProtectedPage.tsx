'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function ProtectedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    logger.debug('[ProtectedPage][debug] Session status:', {
      status,
      session: session ? {
        user: {
          name: session.user?.name,
          email: session.user?.email
        }
      } : null
    });

    if (status === 'unauthenticated') {
      logger.debug('[ProtectedPage][debug] Redirecting unauthenticated user to sign-in');
      router.replace('/auth/signin');
    }
  }, [status, router, session]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-primary">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
} 
