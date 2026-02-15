'use client';

import Image from 'next/image';

const principles = [
  {
    image: '/images/solutions/swiadomosc.png',
    title: 'Świadomość',
    description: 'Zacznij od wiedzy. Gdzie idą Twoje pieniądze? Co naprawdę jest ważne?',
  },
  {
    image: '/images/solutions/plan.png',
    title: 'Plan',
    description: '7 kroków do wolności finansowej. Sprawdzony system, krok po kroku.',
  },
  {
    image: '/images/solutions/cierpliwosc.png',
    title: 'Cierpliwość',
    description: 'To maraton, nie sprint. Małe kroki prowadzą do wielkich zmian.',
  },
];

export default function SolutionSection() {
  return (
    <section className="pt-10 pb-20 bg-gradient-to-b from-white to-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          Jest inne wyjście
        </h2>

        <p className="text-emerald-700/70 text-center mb-12 max-w-3xl mx-auto text-lg leading-relaxed">
          🔥 Ruch FIRE (Financial Independence, Retire Early) pokazał milionom ludzi na świecie,
          że wolność finansowa jest możliwa — nie przez zarabianie milionów,
          ale przez świadome zarządzanie tym, co już masz.
        </p>

        {/* Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {principles.map((principle, index) => {
            return (
              <div key={index} className="text-center group">
                <div className="w-56 h-56 relative mx-auto mb-4">
                  <Image
                    src={principle.image}
                    alt={principle.title}
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-300"
                    sizes="224px"
                  />
                </div>
                <h3 className="text-xl font-semibold text-emerald-900 mb-3">
                  {principle.title}
                </h3>
                <p className="text-emerald-700/70 text-sm leading-relaxed">
                  {principle.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
