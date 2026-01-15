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
    title: 'Metoda, nie tylko liczydło',
    description: '7 Baby Steps z planem spłaty długów i drogą do wolności finansowej',
  },
  {
    icon: Building2,
    title: 'Polski system finansowy',
    description: 'IKE, IKZE, PPK - nie amerykańskie 401k. Znamy polskie realia.',
  },
  {
    icon: Ban,
    title: 'Bez reklam i sprzedaży danych',
    description: 'Płacisz za narzędzie, nie jesteś produktem. Twoje dane to Twoje dane.',
  },
  {
    icon: Zap,
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
    <section id="pricing" className="py-20 bg-gradient-to-b from-lilac/10 to-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary text-center mb-4">
          Zacznij za darmo
        </h2>
        <p className="text-secondary text-center mb-4">
          Wybierz plan, który pasuje do Twoich potrzeb.
        </p>

        {/* Trial Banner */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-primary font-medium">
            7 dni wszystkich funkcji Premium. Bez karty kredytowej.
          </span>
        </div>

        {/* Why Paid Section */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-12 max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-primary mb-6 text-center">
            Czym różni się FiredUp od darmowych aplikacji?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whyPaid.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-primary text-sm">{item.title}</div>
                  <div className="text-secondary text-xs">{item.description}</div>
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
              className={`relative bg-card border rounded-2xl p-8 transition-all duration-300 ${
                plan.popular
                  ? 'border-primary shadow-xl scale-105 z-10'
                  : 'border-border hover:border-primary/30 hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-medium rounded-full">
                  Najpopularniejszy
                </div>
              )}

              <h3 className="text-xl font-semibold text-primary mb-2">
                {plan.name}
              </h3>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-primary">{plan.price}</span>
                <span className="text-secondary">PLN</span>
                <span className="text-secondary text-sm">
                  / {plan.period}
                </span>
              </div>

              {plan.savings && (
                <div className="inline-block px-3 py-1 bg-success/10 text-success text-sm font-medium rounded-full mb-6">
                  Oszczędzasz {plan.savings}
                </div>
              )}

              {plan.bonus && (
                <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6">
                  {plan.bonus}
                </div>
              )}

              <Link href="/auth/signin" className="block mb-6">
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  Wybierz plan
                </Button>
              </Link>

              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-secondary text-sm">
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
          <p className="text-secondary mb-2">
            Możesz też korzystać z darmowego planu z podstawowymi funkcjami.
          </p>
          <Link href="/auth/signin" className="text-primary hover:underline font-medium">
            Zacznij za darmo →
          </Link>
        </div>
      </div>
    </section>
  );
}
