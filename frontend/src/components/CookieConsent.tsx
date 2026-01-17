'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Cookie, X, Settings, Check } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'firedup-cookie-consent';

type ConsentType = 'all' | 'necessary' | null;

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ type: 'all', date: new Date().toISOString() }));
    setIsVisible(false);
    // Enable analytics
    if (typeof window !== 'undefined' && (window as unknown as { posthog?: { opt_in_capturing: () => void } }).posthog) {
      (window as unknown as { posthog: { opt_in_capturing: () => void } }).posthog.opt_in_capturing();
    }
  };

  const handleAcceptNecessary = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ type: 'necessary', date: new Date().toISOString() }));
    setIsVisible(false);
    // Keep analytics disabled
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
        {/* Main banner */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Cookie className="w-6 h-6 text-emerald-600" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-emerald-900 mb-1">
                Ciasteczka na Twojej drodze do wolności
              </h3>
              <p className="text-sm text-emerald-700/70 mb-4">
                Używamy plików cookies, żeby nasza aplikacja działała sprawnie i mogła Ci lepiej pomagać.
                Analityczne cookies pomagają nam rozumieć, jak korzystasz z FiredUp, żebyśmy mogli go ulepszać.
              </p>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleAcceptAll}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Akceptuję wszystkie
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAcceptNecessary}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  Tylko niezbędne
                </Button>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-emerald-600 hover:text-emerald-800 underline underline-offset-2 flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  {showDetails ? 'Ukryj szczegóły' : 'Szczegóły'}
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleAcceptNecessary}
              className="flex-shrink-0 p-2 hover:bg-emerald-50 rounded-full transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5 text-emerald-400" />
            </button>
          </div>

          {/* Details panel */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-emerald-100">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Necessary cookies */}
                <div className="p-4 bg-emerald-50/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="font-medium text-emerald-900">Niezbędne</h4>
                    <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Zawsze aktywne</span>
                  </div>
                  <p className="text-sm text-emerald-700/70">
                    Kluczowe dla działania aplikacji: logowanie, ustawienia, bezpieczeństwo sesji.
                  </p>
                </div>

                {/* Analytics cookies */}
                <div className="p-4 bg-amber-50/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h4 className="font-medium text-emerald-900">Analityczne</h4>
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Opcjonalne</span>
                  </div>
                  <p className="text-sm text-emerald-700/70">
                    Pomagają nam zrozumieć, jak korzystasz z FiredUp. Dane są anonimowe i nie sprzedajemy ich.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-emerald-600/60">
                Więcej informacji znajdziesz w naszej{' '}
                <Link href="/privacy" className="underline hover:text-emerald-800">
                  Polityce Prywatności
                </Link>
                . Możesz zmienić ustawienia w dowolnym momencie.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
