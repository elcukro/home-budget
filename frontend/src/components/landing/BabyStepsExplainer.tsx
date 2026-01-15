'use client';

import { useState } from 'react';
import {
  PiggyBank,
  Snowflake,
  Shield,
  TrendingUp,
  Home,
  CreditCard,
  Trophy,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import TaxDisclaimer, { IKZETaxBenefit } from '@/components/TaxDisclaimer';

const steps = [
  {
    number: 1,
    title: 'Fundusz Awaryjny Startowy',
    amount: '3 000 - 5 000 PLN',
    icon: PiggyBank,
    color: 'bg-mint',
    description: 'Zanim zaczniesz spłacać długi, zabezpiecz się na nagłe wydatki. Bez tego funduszu każda awaria samochodu czy zepsuta pralka zmusi Cię do wzięcia kolejnej chwilówki.',
    example: 'Mariusz sprzedał nieużywane rzeczy na OLX i Vinted. W 2 miesiące uzbierał 3 500 zł - teraz wie, że awaria auta go nie wykończy.',
    tip: 'Trzymaj te pieniądze na osobnym koncie oszczędnościowym. Mają być dostępne od ręki, ale nie na karcie płatniczej.',
  },
  {
    number: 2,
    title: 'Spłać Wszystkie Długi',
    amount: 'Metoda Kuli Śnieżnej',
    icon: Snowflake,
    color: 'bg-lilac',
    description: 'Płać minimalne raty wszędzie, ale najmniejszy dług spłacaj jak najszybciej. Jak go zamkniesz - bierzesz tę ratę i dorzucasz do kolejnego długu. Kula rośnie z każdym spłaconym zobowiązaniem.',
    example: 'Ania miała 4 kredyty: kartę (2 500 zł), chwilówkę (4 000 zł), raty za telefon (1 800 zł) i pożyczkę (12 000 zł). Zaczęła od telefonu - spłaciła w 3 miesiące. Potem karta, chwilówka... W 18 miesięcy była wolna.',
    tip: 'NIE bierz kolejnych kredytów "konsolidacyjnych". Spłacaj od najmniejszego do największego - każda spłata to zastrzyk motywacji.',
  },
  {
    number: 3,
    title: 'Pełny Fundusz Awaryjny',
    amount: '3-6 miesięcy wydatków',
    icon: Shield,
    color: 'bg-almond',
    description: 'Teraz, gdy nie masz długów, zbuduj prawdziwe zabezpieczenie. 3-6 miesięcy Twoich wydatków na osobnym koncie. To Twoja polisa na wypadek utraty pracy lub choroby.',
    example: 'Piotr wydaje miesięcznie 5 000 zł na życie. Jego cel to 15 000 - 30 000 zł. Po roku oszczędzania ma 22 000 zł - może spać spokojnie.',
    tip: 'Jeśli masz zmienne dochody (freelance, B2B), celuj w 6 miesięcy. Etat = wystarczą 3-4 miesiące.',
  },
  {
    number: 4,
    title: '15% na Przyszłość',
    amount: 'IKE + IKZE + PPK + OIPE',
    icon: TrendingUp,
    color: 'bg-primary/20',
    description: 'Inwestuj 15% dochodu w długoterminowe oszczędności emerytalne. W Polsce masz do dyspozycji: PPK (dopłata pracodawcy), IKE (brak podatku Belki przy wypłacie), IKZE (odliczenie od podatku co rok), OIPE (europejska emerytura). UWAGA: Inwestycje poza tymi "opakowaniami" są obciążone 19% podatkiem od zysków kapitałowych (tzw. podatek Belki).',
    example: 'Kasia zarabia 8 000 zł netto. 15% = 1 200 zł. Wpłaca: 200 zł na PPK (+ 150 zł od pracodawcy), 500 zł na IKE, 500 zł na IKZE. Rocznie oszczędza ponad 1 400 zł na podatkach dzięki IKZE (przy stawce 12%).',
    tip: 'Kolejność: najpierw maksymalizuj PPK (darmowe pieniądze od pracodawcy!), potem IKE (limit 2026: 28 260 zł), potem IKZE (limit 2026: 11 304 zł lub 16 956 zł dla JDG), na końcu OIPE (limit 2026: 28 260 zł). Przy zarobkach powyżej 120 000 zł rocznie oszczędzasz aż 32% wpłaconej kwoty na IKZE!',
  },
  {
    number: 5,
    title: 'Start Dziecka w Dorosłość',
    amount: '30 000 - 100 000 PLN / dziecko',
    icon: Home,
    color: 'bg-blush',
    description: 'W Polsce studia są darmowe, ale młody człowiek potrzebuje: wkładu własnego na mieszkanie, kursu prawa jazdy, pierwszego samochodu, zabezpieczenia na start. To Twój prezent dla dorosłego dziecka.',
    example: 'Anna i Tomek mają 5-letnią córkę. Odkładają 300 zł miesięcznie na ETF. Za 15 lat (przy 7% rocznie) będą mieli około 95 000 zł - wystarczy na wkład własny w dużym mieście.',
    tip: 'Jeśli dziecko będzie studiować za granicą, cel to 150-200 tys. PLN na 4 lata. Dla studiów w Polsce skup się na mieszkaniu.',
  },
  {
    number: 6,
    title: 'Spłać Kredyt Hipoteczny',
    amount: 'Wcześniejsza spłata',
    icon: CreditCard,
    color: 'bg-sand',
    description: 'Teraz atakujesz największy dług - hipotekę. Każda nadpłata skraca okres kredytowania i zmniejsza całkowity koszt odsetek. Dom bez kredytu to prawdziwa wolność.',
    example: 'Marek ma kredyt 400 000 zł na 25 lat. Nadpłaca 500 zł miesięcznie. Efekt? Spłaci 7 lat szybciej i zaoszczędzi 87 000 zł na odsetkach.',
    tip: 'Sprawdź w umowie, czy bank nie pobiera prowizji za nadpłatę (od 2022 roku dla nowych kredytów - nie może przez pierwsze 3 lata). Nadpłacaj regularnie, nawet małe kwoty.',
  },
  {
    number: 7,
    title: 'Buduj Majątek i Pomagaj',
    amount: 'Wolność Finansowa',
    icon: Trophy,
    color: 'bg-mint',
    description: 'Gratulacje - osiągnąłeś wolność finansową! Brak długów, zabezpieczona przyszłość, dom spłacony. Teraz możesz inwestować, pomagać rodzinie, wspierać cele charytatywne i żyć na własnych zasadach.',
    example: 'Ewa i Jarek (52 i 54 lata) osiągnęli Krok 7 po 12 latach stosowania metody. Mają: spłacony dom, 800 000 zł w inwestycjach, zero długów. Jarek zmniejszył etat do 3/4, Ewa wspiera finansowo rodziców.',
    tip: 'Wolność finansowa to nie "być bogatym" - to mieć wybór. Możesz pracować bo chcesz, nie bo musisz. Możesz pomagać, nie licząc każdej złotówki.',
  },
];

export default function BabyStepsExplainer() {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  return (
    <section className="py-20 bg-gradient-to-b from-background to-mint/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
            7 Kroków do Wolności Finansowej
          </h2>
          <p className="text-lg text-secondary max-w-2xl mx-auto">
            Metoda Dave'a Ramseya, zaadaptowana do polskich realiów.
            Każdy krok buduje na poprzednim - nie przeskakuj, nie kombinuj.
            Ta kolejność działa.
          </p>
        </div>

        {/* Steps Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-mint via-primary to-mint hidden sm:block" />

          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative"
              >
                {/* Step card */}
                <div
                  className={`
                    sm:ml-16 bg-card border rounded-2xl overflow-hidden transition-all duration-300
                    ${expandedStep === step.number ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50'}
                  `}
                >
                  {/* Header - always visible */}
                  <button
                    onClick={() => setExpandedStep(expandedStep === step.number ? null : step.number)}
                    className="w-full p-4 sm:p-6 flex items-center gap-4 text-left"
                  >
                    {/* Step number badge - mobile */}
                    <div className={`sm:hidden flex-shrink-0 w-10 h-10 ${step.color} rounded-full flex items-center justify-center`}>
                      <span className="text-primary font-bold">{step.number}</span>
                    </div>

                    {/* Step number badge - desktop (on the timeline) */}
                    <div className={`hidden sm:flex absolute -left-8 top-6 w-12 h-12 ${step.color} rounded-full items-center justify-center border-4 border-background shadow-md`}>
                      <span className="text-primary font-bold text-lg">{step.number}</span>
                    </div>

                    {/* Icon */}
                    <div className={`hidden sm:flex flex-shrink-0 w-12 h-12 ${step.color} rounded-xl items-center justify-center`}>
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>

                    {/* Title and amount */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-primary text-lg">
                        {step.title}
                      </h3>
                      <p className="text-sm text-secondary">
                        {step.amount}
                      </p>
                    </div>

                    {/* Expand icon */}
                    <div className="flex-shrink-0 text-secondary">
                      {expandedStep === step.number ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expandedStep === step.number && (
                    <div className="px-4 sm:px-6 pb-6 space-y-4 border-t border-border pt-4">
                      {/* Description */}
                      <p className="text-secondary leading-relaxed">
                        {step.description}
                      </p>

                      {/* IKZE Tax Calculator - only for Step 4 */}
                      {step.number === 4 && (
                        <IKZETaxBenefit />
                      )}

                      {/* Example */}
                      <div className="bg-primary/5 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-primary mb-1">Przykład z życia:</p>
                            <p className="text-sm text-secondary">{step.example}</p>
                          </div>
                        </div>
                      </div>

                      {/* Tip */}
                      <div className="flex items-start gap-3 text-sm">
                        <span className="text-primary font-medium">💡 Tip:</span>
                        <p className="text-secondary">{step.tip}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-secondary mb-4">
            FiredUp pomoże Ci przejść przez każdy krok. Zobaczysz gdzie jesteś i co robić dalej.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Aplikacja automatycznie wykryje Twój obecny krok
          </div>
        </div>

        {/* Disclaimer */}
        <TaxDisclaimer variant="compact" className="mt-12" />
      </div>
    </section>
  );
}
