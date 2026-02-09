'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Flame, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

// Use Next.js API proxy for all backend calls to ensure auth headers are added
const API_BASE_URL = '/api/backend';

const planNames: Record<string, string> = {
  monthly: 'Miesięczny',
  annual: 'Roczny',
};

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const plan = searchParams?.get('plan');

  useEffect(() => {
    // Redirect to signin if not authenticated (with callback to return here)
    if (status === 'unauthenticated') {
      const callbackUrl = plan ? `/checkout?plan=${plan}` : '/checkout';
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    // Validate plan parameter
    if (status === 'authenticated' && plan) {
      if (!['monthly', 'annual'].includes(plan)) {
        setError('Nieprawidłowy plan. Wybierz plan z naszej oferty.');
        setIsLoading(false);
        return;
      }

      // Create checkout session
      createCheckoutSession(plan);
    } else if (status === 'authenticated' && !plan) {
      setError('Nie wybrano planu. Wróć do strony głównej i wybierz plan.');
      setIsLoading(false);
    }
  }, [status, plan, router]);

  const createCheckoutSession = async (planType: string) => {
    if (!session?.user?.email) {
      setError('Błąd autoryzacji. Zaloguj się ponownie.');
      setIsLoading(false);
      return;
    }

    try {
      logger.debug('[checkout] Creating checkout session for plan:', planType);

      // Billing endpoints require user_id as a query parameter
      const response = await fetch(
        `${API_BASE_URL}/billing/checkout?user_id=${encodeURIComponent(session.user.email)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plan_type: planType }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Nie udało się utworzyć sesji płatności');
      }

      const data = await response.json();

      if (data.checkout_url) {
        logger.debug('[checkout] Redirecting to Stripe:', data.checkout_url);
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Brak URL do płatności');
      }
    } catch (err) {
      logger.error('[checkout] Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.');
      setIsLoading(false);
    }
  };

  if (status === 'loading' || (isLoading && !error)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-emerald-100 p-12 max-w-md mx-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Flame className="w-8 h-8 text-white" />
            </div>
          </div>
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-emerald-900 mb-2">
            Przygotowujemy płatność...
          </h1>
          {plan && (
            <p className="text-emerald-700/70">
              Plan: <span className="font-medium">{planNames[plan] || plan}</span>
            </p>
          )}
          <p className="text-sm text-emerald-600/50 mt-4">
            Za chwilę zostaniesz przekierowany do bezpiecznej strony płatności Stripe.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-emerald-100 p-12 max-w-md mx-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Ups! Coś poszło nie tak
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push('/#pricing')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Wróć do wyboru planu
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              Przejdź do panelu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
