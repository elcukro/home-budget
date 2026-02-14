'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/onboarding');

  useEffect(() => {
    // Report to Sentry
    Sentry.captureException(error, {
      tags: { errorPage: 'app-error' },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />

      <div className="relative z-10 text-center px-4 max-w-2xl mx-auto">
        {/* Error icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-600" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
          Mała turbulencja na drodze
        </h1>

        {/* Description */}
        <p className="text-lg text-emerald-700/70 mb-4 max-w-md mx-auto">
          Nawet najlepsza droga do wolności finansowej ma czasem dziury.
          Spróbuj odświeżyć stronę — często to pomaga!
        </p>

        {/* Error digest */}
        {error.digest && (
          <p className="text-sm text-emerald-600/50 mb-8 font-mono">
            Kod: {error.digest}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={reset}
            className="group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200"
          >
            <RefreshCw className="mr-2 w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            Spróbuj ponownie
          </Button>
          <Link href={isOnboarding ? '/onboarding' : '/'}>
            <Button
              variant="outline"
              size="lg"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Home className="mr-2 w-5 h-5" />
              {isOnboarding ? 'Wróć do onboardingu' : 'Strona główna'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
