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
    color: 'bg-lilac',
    iconColor: 'text-primary',
    title: 'Połącz swój bank w 2 minuty',
    description: 'ING, PKO, mBank, Santander, Millennium - Twoje transakcje pobierają się automatycznie. Koniec z ręcznym wpisywaniem.',
  },
  {
    icon: LayoutDashboard,
    color: 'bg-mint',
    iconColor: 'text-primary',
    title: 'Widzisz prawdę w 3 sekundy',
    description: 'Otwierasz aplikację i wiesz: ile zostało do wypłaty, czy stać Cię na ten wydatek, kiedy spłacisz kredyt.',
  },
  {
    icon: TrendingDown,
    color: 'bg-blush',
    iconColor: 'text-primary',
    title: 'Wyjdź z długów szybciej',
    description: 'Aplikacja pokaże: jeśli dołożysz 200 zł do kredytu, spłacisz go 3 lata szybciej i zaoszczędzisz 15 tys. PLN odsetek.',
  },
  {
    icon: Target,
    color: 'bg-sand',
    iconColor: 'text-primary',
    title: 'Oszczędzaj z planem',
    description: 'Ustaw cel - wakacje, fundusz awaryjny, wkład na mieszkanie. Aplikacja policzy ile odkładać miesięcznie i pokaże postęp.',
  },
  {
    icon: Footprints,
    color: 'bg-primary/10',
    iconColor: 'text-primary',
    title: 'Masz plan, nie zgadujesz',
    description: '7 sprawdzonych kroków od funduszu awaryjnego do wolności finansowej. Wiesz co robić teraz i co będzie następne.',
  },
  {
    icon: Sparkles,
    color: 'bg-mint',
    iconColor: 'text-primary',
    title: 'AI wykrywa to, czego nie widzisz',
    description: 'Subskrypcje o których zapomniałeś, kategorie gdzie przepłacasz, trendy które powinny Cię zaniepokoić.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary text-center mb-4">
          FiredUp — Twoje narzędzie do wolności finansowej
        </h2>
        <p className="text-secondary text-center mb-4 text-lg">
          Nie kolejna apka do budżetu.
        </p>
        <p className="text-secondary/70 text-center mb-12 max-w-2xl mx-auto">
          Narzędzie do transformacji finansowej. Zbudowane na sprawdzonej metodologii,
          z funkcjami, które naprawdę działają.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group bg-card border border-border rounded-2xl p-8 hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-3">
                  {feature.title}
                </h3>
                <p className="text-secondary leading-relaxed">
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
