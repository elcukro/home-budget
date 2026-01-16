'use client';

import {
  Footprints,
  LayoutDashboard,
  Landmark,
  Target,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: Landmark,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Połącz swój bank w 2 minuty',
    description: 'ING, PKO, mBank, Santander, Millennium - Twoje transakcje pobierają się automatycznie. Koniec z ręcznym wpisywaniem.',
  },
  {
    icon: LayoutDashboard,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Widzisz prawdę w 3 sekundy',
    description: 'Otwierasz aplikację i wiesz: ile zostało do wypłaty, czy stać Cię na ten wydatek, kiedy spłacisz kredyt.',
  },
  {
    icon: TrendingDown,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    title: 'Wyjdź z długów szybciej',
    description: 'Aplikacja pokaże: jeśli dołożysz 200 zł do kredytu, spłacisz go 3 lata szybciej i zaoszczędzisz 15 tys. PLN odsetek.',
  },
  {
    icon: Target,
    color: 'bg-sky-100',
    iconColor: 'text-sky-600',
    title: 'Oszczędzaj z planem',
    description: 'Ustaw cel - wakacje, fundusz awaryjny, wkład na mieszkanie. Aplikacja policzy ile odkładać miesięcznie i pokaże postęp.',
  },
  {
    icon: Footprints,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Masz plan, nie zgadujesz',
    description: '7 sprawdzonych kroków od funduszu awaryjnego do wolności finansowej. Wiesz co robić teraz i co będzie następne.',
  },
  {
    icon: Sparkles,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'AI wykrywa to, czego nie widzisz',
    description: 'Subskrypcje o których zapomniałeś, kategorie gdzie przepłacasz, trendy które powinny Cię zaniepokoić.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-gradient-to-b from-white to-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          FiredUp — Twoje narzędzie do wolności finansowej
        </h2>
        <p className="text-emerald-700 text-center mb-4 text-lg font-medium">
          Nie kolejna apka do budżetu.
        </p>
        <p className="text-emerald-600/70 text-center mb-12 max-w-2xl mx-auto">
          Narzędzie do transformacji finansowej. Zbudowane na sprawdzonej metodologii,
          z funkcjami, które naprawdę działają.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-8 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-emerald-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-emerald-700/70 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
