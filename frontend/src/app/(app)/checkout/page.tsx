'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Flame, Loader2, AlertCircle, Check, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

const API_BASE_URL = '/api/backend';

const plans = [
  {
    id: 'monthly',
    name: 'Miesięczny',
    price: '29',
    period: 'miesiąc',
    description: 'Pełna moc bez zobowiązań',
    popular: false,
  },
  {
    id: 'annual',
    name: 'Roczny',
    price: '249',
    period: 'rok',
    description: 'Najlepsza wartość',
    savings: 'Oszczędzasz 28%',
    popular: true,
  },
];

const features = [
  'Nieograniczone transakcje',
  'Import z banku (Tink)',
  'Analiza AI',
  'Eksport do Excel/CSV',
  'Zaawansowane raporty',
];

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plan = searchParams?.get('plan');

  useEffect(() => {
    if (status === 'unauthenticated') {
      const callbackUrl = plan ? `/checkout?plan=${plan}` : '/checkout';
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    // If plan is specified, go directly to Stripe
    if (status === 'authenticated' && plan) {
      if (!['monthly', 'annual'].includes(plan)) {
        setError('Nieprawidłowy plan. Wybierz plan z naszej oferty.');
        return;
      }
      setIsLoading(true);
      createCheckoutSession(plan);
    }
  }, [status, plan, router]);

  const createCheckoutSession = async (planType: string) => {
    if (!session?.user?.email) {
      setError('Błąd autoryzacji. Zaloguj się ponownie.');
      return;
    }

    try {
      setLoadingPlan(planType);
      logger.debug('[checkout] Creating checkout session for plan:', planType);

      const response = await fetch(
        `${API_BASE_URL}/billing/checkout?user_id=${encodeURIComponent(session.user.email)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_type: planType }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Nie udało się utworzyć sesji płatności');
      }

      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Brak URL do płatności');
      }
    } catch (err) {
      logger.error('[checkout] Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.');
      setIsLoading(false);
      setLoadingPlan(null);
    }
  };

  const handleContinueWithTrial = () => {
    // Don't mark first-login-complete here — let the onboarding wizard handle it
    router.push('/onboarding');
  };

  // Loading state when redirecting to Stripe
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
          <h2 className="text-xl font-semibold text-emerald-900 mb-2">
            Przygotowujemy płatność...
          </h2>
          <p className="text-sm text-emerald-600/50 mt-4">
            Za chwilę zostaniesz przekierowany do bezpiecznej strony płatności Stripe.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-emerald-100 p-12 max-w-md mx-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ups! Coś poszło nie tak
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setError(null);
                setLoadingPlan(null);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Spróbuj ponownie
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

  // Plan selection (no plan param)
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-3xl mx-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Crown className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-emerald-900 mb-3">
            Wybierz plan Premium
          </h1>
          <p className="text-lg text-emerald-700/70">
            Odblokuj pełny potencjał swoich finansów
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`relative bg-white/80 backdrop-blur-sm border rounded-2xl p-6 transition-all duration-300 flex flex-col ${
                p.popular
                  ? 'border-emerald-300 shadow-xl shadow-emerald-100/50 ring-2 ring-emerald-200'
                  : 'border-emerald-100 hover:border-emerald-200 hover:shadow-lg'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-full shadow-lg shadow-emerald-200">
                  Najpopularniejszy
                </div>
              )}

              <h3 className="text-lg font-semibold text-emerald-900 text-center">
                {p.name}
              </h3>
              <p className="text-sm text-emerald-600/60 text-center mb-4">
                {p.description}
              </p>

              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                  {p.price}
                </span>
                <span className="text-emerald-600/70 text-sm">PLN / {p.period}</span>
              </div>

              {p.savings && (
                <div className="text-center mb-4">
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    {p.savings}
                  </span>
                </div>
              )}
              {!p.savings && <div className="h-8 mb-4" />}

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-emerald-700">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => createCheckoutSession(p.id)}
                disabled={loadingPlan !== null}
                className={`w-full ${
                  p.popular
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200'
                    : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
                variant={p.popular ? 'default' : 'outline'}
              >
                {loadingPlan === p.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Wybierz plan
              </Button>
            </div>
          ))}
        </div>

        {/* Continue with trial */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-emerald-600/70">
              Nie jesteś gotowy? Bez obaw.
            </span>
          </div>
          <button
            onClick={handleContinueWithTrial}
            className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 text-sm font-medium inline-flex items-center gap-2"
          >
            Kontynuuj z 7-dniowym trialem
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-emerald-600/40 mt-2">
            Pełny dostęp Premium przez 7 dni. Bez karty kredytowej.
          </p>
        </div>
      </div>
    </div>
  );
}
