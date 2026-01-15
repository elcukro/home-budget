'use client';

import { Eye, Map, Timer, Quote } from 'lucide-react';

const principles = [
  {
    icon: Eye,
    color: 'bg-mint',
    title: 'Świadomość',
    description: 'Zacznij od wiedzy. Gdzie idą Twoje pieniądze? Co naprawdę jest ważne?',
  },
  {
    icon: Map,
    color: 'bg-lilac',
    title: 'Plan',
    description: '7 kroków do wolności finansowej. Sprawdzony system, krok po kroku.',
  },
  {
    icon: Timer,
    color: 'bg-sand',
    title: 'Cierpliwość',
    description: 'To maraton, nie sprint. Małe kroki prowadzą do wielkich zmian.',
  },
];

export default function SolutionSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-mint/10 to-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary text-center mb-4">
          Jest inne wyjście
        </h2>

        <p className="text-secondary text-center mb-12 max-w-3xl mx-auto text-lg leading-relaxed">
          Ruch FIRE (Financial Independence, Retire Early) pokazał milionom ludzi na świecie,
          że wolność finansowa jest możliwa — nie przez zarabianie milionów,
          ale przez świadome zarządzanie tym, co już masz.
        </p>

        {/* Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {principles.map((principle, index) => {
            const Icon = principle.icon;
            return (
              <div key={index} className="text-center">
                <div className={`w-16 h-16 ${principle.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-3">
                  {principle.title}
                </h3>
                <p className="text-secondary text-sm leading-relaxed">
                  {principle.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Quote */}
        <div className="relative max-w-3xl mx-auto">
          <div className="absolute -top-4 -left-4 text-primary/10">
            <Quote className="w-16 h-16" />
          </div>
          <blockquote className="relative bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-xl sm:text-2xl text-primary font-medium italic mb-4">
              "Sukces finansowy to nie kwestia szczęścia — to kwestia nawyków."
            </p>
            <footer className="text-secondary">
              — Dave Ramsey
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
