'use client';

import {
  Banknote,
  CreditCard,
  PiggyBank,
  HeartCrack,
  HelpCircle,
  RefreshCcw,
} from 'lucide-react';

const problems = [
  {
    icon: Banknote,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    title: 'Nie wiesz, dokąd idą pieniądze',
    description: 'Koniec miesiąca, a konto puste. Znowu.',
  },
  {
    icon: CreditCard,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'Kredyty cię przytłaczają',
    description: 'Rata za ratą, bez końca w zasięgu wzroku.',
  },
  {
    icon: PiggyBank,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Oszczędzanie? Jakie oszczędzanie?',
    description: 'Zawsze coś wyskakuje. Nigdy nic nie zostaje.',
  },
  {
    icon: HeartCrack,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    title: 'Stres wpływa na całe życie',
    description: 'Kłótnie o pieniądze, nieprzespane noce, niepewność.',
  },
  {
    icon: HelpCircle,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Brak planu, brak kontroli',
    description: 'Nie wiesz, od czego zacząć ani co robić dalej.',
  },
  {
    icon: RefreshCcw,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    title: 'Życie od wypłaty do wypłaty',
    description: 'Spirala, z której nie widać wyjścia.',
  },
];

export default function ProblemsSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-emerald-50/30 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          Czy to brzmi znajomo?
        </h2>
        <p className="text-emerald-700/70 text-center mb-12 max-w-2xl mx-auto">
          Te problemy dotykają milionów ludzi. Nie musisz z nimi walczyć sam.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className="group bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-12 h-12 ${problem.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${problem.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-emerald-900 mb-2">
                  {problem.title}
                </h3>
                <p className="text-emerald-700/70 text-sm">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
