'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Landmark,
  Target,
  Footprints,
  Building2,
  BarChart3,
  Sparkles,
  Settings,
  Crown,
  BookOpen,
} from 'lucide-react';

const manualCards = [
  { slug: 'dashboard', icon: LayoutDashboard, color: 'bg-emerald-100', iconColor: 'text-emerald-600', title: 'Panel główny', description: 'Przeglądaj najważniejsze wskaźniki finansowe w jednym miejscu.' },
  { slug: 'income', icon: TrendingUp, color: 'bg-sky-100', iconColor: 'text-sky-600', title: 'Przychody', description: 'Zarządzaj źródłami dochodu i śledź przychody.' },
  { slug: 'expenses', icon: Receipt, color: 'bg-rose-100', iconColor: 'text-rose-600', title: 'Wydatki', description: 'Kontroluj wydatki z automatyczną kategoryzacją.' },
  { slug: 'loans', icon: Landmark, color: 'bg-amber-100', iconColor: 'text-amber-600', title: 'Kredyty i dług', description: 'Zarządzaj kredytami i planuj szybszą spłatę.' },
  { slug: 'savings', icon: Target, color: 'bg-sky-100', iconColor: 'text-sky-600', title: 'Cele oszczędnościowe', description: 'Ustal cele i śledź postęp oszczędzania.' },
  { slug: 'financial-freedom', icon: Footprints, color: 'bg-emerald-100', iconColor: 'text-emerald-600', title: 'Wolność finansowa', description: '7 kroków i kalkulator FIRE dla Twojej niezależności.' },
  { slug: 'bank-transactions', icon: Building2, color: 'bg-violet-100', iconColor: 'text-violet-600', title: 'Transakcje bankowe', description: 'Automatyczne pobieranie transakcji z banku.' },
  { slug: 'reports', icon: BarChart3, color: 'bg-amber-100', iconColor: 'text-amber-600', title: 'Raporty', description: 'Szczegółowe raporty i wykresy Twoich finansów.' },
  { slug: 'ai-analysis', icon: Sparkles, color: 'bg-violet-100', iconColor: 'text-violet-600', title: 'Analiza AI', description: 'Inteligentne rekomendacje i wykrywanie trendów.' },
  { slug: 'settings', icon: Settings, color: 'bg-rose-100', iconColor: 'text-rose-600', title: 'Ustawienia', description: 'Konfiguracja konta i połączenia bankowe.' },
  { slug: 'premium', icon: Crown, color: 'bg-yellow-100', iconColor: 'text-yellow-600', title: 'Pakiet Premium', description: 'Brak limitów, integracja z bankami, AI i więcej.' },
];

export default function ManualSection() {
  return (
    <section id="manual" className="py-20 scroll-mt-20 bg-gradient-to-b from-white to-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <BookOpen className="w-8 h-8 text-emerald-600" />
          <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center">
            Podręcznik użytkownika
          </h2>
        </div>
        <p className="text-emerald-700/70 text-center mb-12 max-w-2xl mx-auto">
          Poznaj każdą funkcję FiredUp. Szczegółowe opisy ze zrzutami ekranu pokażą Ci,
          jak w pełni wykorzystać aplikację.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {manualCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.slug}
                href={`/manual/${card.slug}`}
                className="group bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <h3 className="text-sm font-semibold text-emerald-900 mb-1">
                  {card.title}
                </h3>
                <p className="text-xs text-emerald-700/60 leading-relaxed">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/manual"
            className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Przejdź do pełnego podręcznika &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
