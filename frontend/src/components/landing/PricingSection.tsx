'use client';

import { Button } from '@/components/ui/button';
import { Check, X, Sparkles, Shield, Zap, Ban, Building2 } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    id: 'free',
    name: 'Darmowy',
    price: '0',
    period: 'na zawsze',
    popular: false,
    description: 'Zacznij swoją drogę do wolności finansowej',
    buttonText: 'Zacznij za darmo',
    buttonStyle: 'outline',
  },
  {
    id: 'monthly',
    name: 'Miesięczny',
    price: '29',
    period: 'miesiąc',
    popular: false,
    description: 'Pełna moc bez zobowiązań',
    buttonText: 'Wybierz plan',
    buttonStyle: 'outline',
  },
  {
    id: 'annual',
    name: 'Roczny',
    price: '249',
    period: 'rok',
    popular: true,
    savings: '28%',
    description: 'Najlepsza wartość dla poważnych użytkowników',
    buttonText: 'Wybierz plan',
    buttonStyle: 'primary',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '399',
    period: 'jednorazowo',
    popular: false,
    bonus: 'Płacisz raz, korzystasz zawsze',
    description: 'Dla tych, którzy myślą długoterminowo',
    buttonText: 'Wybierz plan',
    buttonStyle: 'outline',
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

type FeatureValue = boolean | string;

interface PlanFeatures {
  expenses: FeatureValue;
  income: FeatureValue;
  loans: FeatureValue;
  savings: FeatureValue;
  bankIntegration: FeatureValue;
  ai: FeatureValue;
  export: FeatureValue;
  reports: FeatureValue;
  babySteps: FeatureValue;
}

const planFeatures: Record<string, PlanFeatures> = {
  free: {
    expenses: '50 / miesiąc',
    income: '3 źródła',
    loans: '3 pozycje',
    savings: '3 cele',
    bankIntegration: false,
    ai: false,
    export: false,
    reports: 'Podstawowe',
    babySteps: 'Podgląd kroków',
  },
  premium: {
    expenses: 'Bez limitu',
    income: 'Bez limitu',
    loans: 'Bez limitu',
    savings: 'Bez limitu',
    bankIntegration: true,
    ai: true,
    export: true,
    reports: 'Wszystkie',
    babySteps: 'Pełna analiza + rekomendacje',
  },
};

const featureLabels: Record<keyof PlanFeatures, string> = {
  expenses: 'Wydatki',
  income: 'Przychody',
  loans: 'Kredyty i pożyczki',
  savings: 'Cele oszczędnościowe',
  bankIntegration: 'Integracja z bankiem (Tink)',
  ai: 'Analiza AI',
  export: 'Eksport (JSON, CSV, XLSX)',
  reports: 'Raporty',
  babySteps: '7 Kroków do wolności',
};

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const features = plan.id === 'free' ? planFeatures.free : planFeatures.premium;
            const isFree = plan.id === 'free';

            return (
              <div
                key={plan.id}
                className={`relative bg-white/80 backdrop-blur-sm border rounded-2xl p-8 transition-all duration-300 flex flex-col ${
                  plan.popular
                    ? 'border-emerald-300 shadow-xl shadow-emerald-100/50 scale-105 z-10'
                    : 'border-emerald-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-full shadow-lg shadow-emerald-200">
                    Najpopularniejszy
                  </div>
                )}

                {/* Name - fixed height */}
                <h3 className="text-xl font-semibold text-emerald-900 h-7">
                  {plan.name}
                </h3>

                {/* Description - fixed height */}
                <p className="text-sm text-emerald-600/60 h-10 mb-4">
                  {plan.description}
                </p>

                {/* Price - fixed height */}
                <div className="flex items-baseline gap-1 h-10 mb-2">
                  <span className={`text-4xl font-bold ${isFree ? 'text-emerald-600' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent'}`}>
                    {plan.price}
                  </span>
                  <span className="text-emerald-600/70 text-sm">PLN</span>
                  <span className="text-emerald-600/70 text-sm">
                    / {plan.period}
                  </span>
                </div>

                {/* Badge area - fixed height */}
                <div className="h-8 mb-4">
                  {plan.savings && (
                    <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                      Oszczędzasz {plan.savings}
                    </span>
                  )}
                  {plan.bonus && (
                    <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      {plan.bonus}
                    </span>
                  )}
                </div>

                {/* Button */}
                <Link href="/auth/signin" className="block mb-6">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200'
                        : isFree
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.buttonText}
                  </Button>
                </Link>

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {(Object.keys(featureLabels) as Array<keyof PlanFeatures>).map((featureKey) => {
                    const value = features[featureKey];
                    const isAvailable = value !== false;
                    const displayValue = typeof value === 'string' ? value : null;

                    return (
                      <li key={featureKey} className="flex items-start gap-2">
                        {isAvailable ? (
                          <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${isAvailable ? 'text-emerald-700' : 'text-gray-400'}`}>
                            {featureLabels[featureKey]}
                          </span>
                          {displayValue && (
                            <span className={`text-sm ml-1 ${isFree ? 'text-emerald-600 font-medium' : 'text-emerald-500'}`}>
                              ({displayValue})
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div className="text-center">
          <p className="text-emerald-700/70 text-sm">
            Wszystkie płatne plany zawierają 7-dniowy okres próbny. Bez karty kredytowej.
          </p>
        </div>
      </div>
    </section>
  );
}
