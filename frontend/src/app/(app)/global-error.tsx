'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="pl">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden">
          {/* Gradient orbs */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-200/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />

          <div className="relative z-10 text-center px-4 max-w-2xl mx-auto">
            {/* Error icon */}
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
              Coś poszło nie tak
            </h1>

            {/* Description */}
            <p className="text-lg text-emerald-700/70 mb-4 max-w-md mx-auto">
              Przepraszamy za utrudnienia. Nasz zespół został powiadomiony o problemie.
              Twoje dane są bezpieczne.
            </p>

            {/* Error digest for support */}
            {error.digest && (
              <p className="text-sm text-emerald-600/50 mb-8 font-mono">
                Kod błędu: {error.digest}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={reset}
                className="group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300"
              >
                <RefreshCw className="mr-2 w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                Spróbuj ponownie
              </Button>
              <a href="/">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Home className="mr-2 w-5 h-5" />
                  Strona główna
                </Button>
              </a>
            </div>

            {/* Support info */}
            <p className="mt-8 text-sm text-emerald-600/60">
              Problem się powtarza?{' '}
              <a
                href="mailto:support@firedup.app"
                className="underline hover:text-emerald-800"
              >
                Napisz do nas
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
