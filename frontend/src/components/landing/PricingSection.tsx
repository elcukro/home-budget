'use client';

import { Button } from '@/components/ui/button';
import { Check, Sparkles, Shield, Zap, Ban, Building2 } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    id: 'monthly',
    name: 'Miesięczny',
    price: '29',
    period: 'miesiąc',
    popular: false,
  },
  {
    id: 'annual',
    name: 'Roczny',
    price: '249',
    period: 'rok',
    popular: true,
    savings: '28%',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '399',
    period: 'jednorazowo',
    popular: false,
    bonus: 'Płacisz raz, korzystasz zawsze',
  },
];

const whyPaid = [
  {
    icon: Shield,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Metoda, nie tylko liczydło',
    description: '7 Baby Steps z planem spłaty długów i drogą do wolności finansowej',
  },
  {
    icon: Building2,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'Polski system finansowy',
    description: 'IKE, IKZE, PPK - nie amerykańskie 401k. Znamy polskie realia.',
  },
  {
    icon: Ban,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    title: 'Bez reklam i sprzedaży danych',
    description: 'Płacisz za narzędzie, nie jesteś produktem. Twoje dane to Twoje dane.',
  },
  {
    icon: Zap,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Integracja z polskimi bankami',
    description: 'Tink: ING, PKO, mBank, Santander, Millennium i więcej.',
  },
];

const features = [
  'Nieograniczona liczba wydatków',
  'Nieograniczona liczba przychodów',
  'Nieograniczona liczba pożyczek',
  'Nieograniczona liczba celów oszczędnościowych',
  'Integracja z bankiem (Tink)',
  'Analiza AI',
  'Eksport do JSON, CSV, XLSX',
  'Wszystkie raporty',
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-gradient-to-b from-white to-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          Zacznij za darmo
        </h2>
        <p className="text-emerald-700/70 text-center mb-4">
          Wybierz plan, który pasuje do Twoich potrzeb.
        </p>

        {/* Trial Banner */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <span className="text-emerald-700 font-medium">
            7 dni wszystkich funkcji Premium. Bez karty kredytowej.
          </span>
        </div>

        {/* Why Paid Section */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 mb-12 max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-emerald-900 mb-6 text-center">
            Czym różni się FiredUp od darmowych aplikacji?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whyPaid.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <div>
                  <div className="font-medium text-emerald-900 text-sm">{item.title}</div>
                  <div className="text-emerald-700/70 text-xs">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white/80 backdrop-blur-sm border rounded-2xl p-8 transition-all duration-300 ${
                plan.popular
                  ? 'border-emerald-300 shadow-xl shadow-emerald-100/50 scale-105 z-10'
                  : 'border-emerald-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-full shadow-lg shadow-emerald-200">
                  Najpopularniejszy
                </div>
              )}

              <h3 className="text-xl font-semibold text-emerald-900 mb-2">
                {plan.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{plan.price}</span>
                <span className="text-emerald-600/70">PLN</span>
                <span className="text-emerald-600/70 text-sm">
                  / {plan.period}
                </span>
              </div>

              {plan.savings && (
                <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full mb-6">
                  Oszczędzasz {plan.savings}
                </div>
              )}

              {plan.bonus && (
                <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-6">
                  {plan.bonus}
                </div>
              )}

              <Link href="/auth/signin" className="block mb-6">
                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200'
                      : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  Wybierz plan
                </Button>
              </Link>

              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-emerald-700/70 text-sm">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Free Tier Info */}
        <div className="text-center">
          <p className="text-emerald-700/70 mb-2">
            Możesz też korzystać z darmowego planu z podstawowymi funkcjami.
          </p>
          <Link href="/auth/signin" className="text-emerald-600 hover:text-emerald-700 hover:underline font-medium">
            Zacznij za darmo →
          </Link>
        </div>
      </div>
    </section>
  );
}
