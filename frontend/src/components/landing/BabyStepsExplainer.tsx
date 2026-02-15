'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Flame
} from 'lucide-react';
import { IKZETaxBenefit } from '@/components/TaxDisclaimer';

const steps = [
  {
    number: 1,
    title: '1. Fundusz Awaryjny',
    amount: '3 000 - 5 000 PLN',
    image: '/images/steps/krok1.png',
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    description: 'Zanim zaczniesz spłacać długi, zabezpiecz się na nagłe wydatki. Bez tego funduszu każda awaria samochodu czy zepsuta pralka zmusi Cię do wzięcia kolejnej chwilówki.',
    example: 'Mariusz sprzedał nieużywane rzeczy na OLX i Vinted. W 2 miesiące uzbierał 3 500 zł - teraz wie, że awaria auta go nie wykończy.',
    tip: 'Trzymaj te pieniądze na osobnym koncie oszczędnościowym. Mają być dostępne od ręki, ale nie na karcie płatniczej.',
  },
  {
    number: 2,
    title: '2. Spłać Wszystkie Długi',
    amount: 'Metoda Kuli Śnieżnej',
    image: '/images/steps/krok2.png',
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    description: 'Płać minimalne raty wszędzie, ale najmniejszy dług spłacaj jak najszybciej. Jak go zamkniesz - bierzesz tę ratę i dorzucasz do kolejnego długu. Kula rośnie z każdym spłaconym zobowiązaniem.',
    example: 'Ania miała 3 kredyty: kartę kredytową (2 500 zł, RRSO 21% — odsetki ~525 zł/rok), chwilówkę (4 000 zł, RRSO 85% — odsetki ~3 400 zł/rok) i pożyczkę gotówkową (12 000 zł, RRSO 15% — odsetki ~1 800 zł/rok). Razem płaciła ~5 700 zł/rok samych odsetek! Metodą kuli śnieżnej zaczęła od karty — spłaciła w 3 miesiące, potem chwilówkę, na końcu pożyczkę. W 15 miesięcy była wolna i zaoszczędziła ponad 8 000 zł na odsetkach vs spłacanie minimum przez 3-4 lata.',
    tip: 'NIE bierz kolejnych kredytów "konsolidacyjnych". Spłacaj od najmniejszego do największego - każda spłata to zastrzyk motywacji.',
  },
  {
    number: 3,
    title: '3. Pełny Fundusz Awaryjny',
    amount: '3-6 miesięcy wydatków',
    image: '/images/steps/krok3.png',
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    description: 'Teraz, gdy nie masz długów, zbuduj prawdziwe zabezpieczenie. 3-6 miesięcy Twoich wydatków na osobnym koncie. To Twoja polisa na wypadek utraty pracy lub choroby.',
    example: 'Piotr wydaje miesięcznie 5 000 zł na życie. Jego cel to 15 000 - 30 000 zł. Po roku oszczędzania ma 22 000 zł - może spać spokojnie.',
    tip: 'Jeśli masz zmienne dochody (freelance, B2B), celuj w 6 miesięcy. Etat = wystarczą 3-4 miesiące.',
  },
  {
    number: 4,
    title: '4. 15% na Przyszłość',
    amount: 'PPK → IKZE → IKE → OIPE',
    image: '/images/steps/krok4.png',
    color: 'bg-sky-100',
    iconColor: 'text-sky-600',
    description: 'Inwestuj 15% dochodu w długoterminowe oszczędności emerytalne. W Polsce masz do dyspozycji: PPK (dopłata pracodawcy), IKE (brak podatku Belki przy wypłacie), IKZE (odliczenie od podatku co rok), OIPE (europejska emerytura). UWAGA: Inwestycje poza tymi "opakowaniami" są obciążone 19% podatkiem od zysków kapitałowych (tzw. podatek Belki).',
    example: 'Kasia zarabia 8 000 zł netto (~11 500 zł brutto, UoP). Na PPK co miesiąc trafia 423 zł (Kasia: 230 zł, pracodawca: 173 zł, Państwo: 20 zł) — za swoje 230 zł dostaje 193 zł „gratis". Na IKZE wpłaca 942 zł/mies., co po 12 miesiącach daje pełny limit 11 304 zł. Przy jej dochodach (I próg podatkowy, 12%) otrzyma zwrot podatku z PIT w wysokości 1 356 zł.',
    tip: 'Kolejność: najpierw zapisz się do programu PPK (darmowe pieniądze od pracodawcy!), potem IKZE (odliczenie wykorzystanego limitu w PIT — otrzymasz zwrot podatku; limity na 2026 rok: 11 304 zł lub 16 956 zł dla JDG), potem IKE (limit 2026: 28 260 zł), na końcu OIPE (limit 2026: 28 260 zł).',
  },
  {
    number: 5,
    title: '5. Start Dziecka w Dorosłość',
    amount: '30 000 - 100 000 PLN / dziecko',
    image: '/images/steps/krok5.png',
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    description: 'W Polsce studia są darmowe, ale młody człowiek potrzebuje: wkładu własnego na mieszkanie, kursu prawa jazdy, pierwszego samochodu, zabezpieczenia na start. To Twój prezent dla dorosłego dziecka.',
    example: 'Anna i Tomek mają 5-letnią córkę. Odkładają 300 zł miesięcznie na ETF. Za 15 lat (przy 7% rocznie) będą mieli około 95 000 zł - wystarczy na wkład własny w dużym mieście.',
    tip: 'Jeśli dziecko będzie studiować za granicą, cel to 150-200 tys. PLN na 4 lata. Dla studiów w Polsce skup się na mieszkaniu.',
  },
  {
    number: 6,
    title: '6. Spłać Kredyt Hipoteczny',
    amount: 'Wcześniejsza spłata',
    image: '/images/steps/krok6.png',
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    description: 'Jeśli pozbyłeś się pozostałych kredytów i zbudowałeś solidne poduszki finansowe, czas zmierzyć się z kredytem hipotecznym — w większości gospodarstw domowych to największe zobowiązanie. Każda nadpłata skraca okres kredytowania i zmniejsza całkowity koszt odsetek. Dom bez kredytu to prawdziwa wolność.',
    example: 'Marek ma kredyt 400 000 zł na 25 lat przy oprocentowaniu ~7,5% (WIBOR + marża). Rata: ~2 957 zł/mies., a całkowity koszt odsetek to aż ~487 000 zł — więcej niż sam kredyt! Nadpłacając 500 zł miesięcznie, spłaci kredyt w ~17 lat zamiast 25 i zaoszczędzi ~175 000 zł na odsetkach.',
    tip: 'Sprawdź w umowie, czy bank nie pobiera prowizji za nadpłatę (od 2022 roku dla nowych kredytów — nie może przez pierwsze 3 lata). Nadpłacaj regularnie, nawet małe kwoty.',
  },
  {
    number: 7,
    title: '7. Buduj Majątek i Pomagaj',
    amount: 'Wolność Finansowa',
    image: '/images/steps/krok7.png',
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    description: 'Gratulacje - osiągnąłeś wolność finansową! Brak długów, zabezpieczona przyszłość, dom spłacony. Teraz możesz inwestować, pomagać rodzinie, wspierać cele charytatywne i żyć na własnych zasadach.',
    example: 'Ewa i Jarek (52 i 54 lata) osiągnęli Krok 7 po 12 latach stosowania metody. Mają: spłacony dom, 800 000 zł w inwestycjach, zero długów. Jarek zmniejszył etat do 3/4, Ewa wspiera finansowo rodziców.',
    tip: 'Wolność finansowa to nie "być bogatym" - to mieć wybór. Możesz pracować bo chcesz, nie bo musisz. Możesz pomagać, nie licząc każdej złotówki. Tobie się udało — czas teraz pomóc innym!',
  },
];

export default function BabyStepsExplainer() {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  // FIRE Calculator state
  const [fireExpenses, setFireExpenses] = useState(5000);
  const [fireCurrentAge, setFireCurrentAge] = useState(30);
  const [fireTargetAge, setFireTargetAge] = useState(50);
  const [fireReturnRate, setFireReturnRate] = useState(6.5);

  const DEPOSIT_RATE = fireReturnRate / 100;
  const INFLATION_RATE = 0.035;
  const REAL_RATE = (1 + DEPOSIT_RATE) / (1 + INFLATION_RATE) - 1;

  const yearsToFire = Math.max(fireTargetAge, fireCurrentAge + 5) - fireCurrentAge;
  const annualExpensesAtFire = 12 * fireExpenses * Math.pow(1 + INFLATION_RATE, yearsToFire);
  const fireNumber = annualExpensesAtFire / REAL_RATE;

  const monthlyRate = DEPOSIT_RATE / 12;
  const months = yearsToFire * 12;
  const monthlySavings = fireNumber * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
  const totalInvested = monthlySavings * months;
  const interestEarned = fireNumber - totalInvested;

  return (
    <section id="baby-steps" className="py-20 scroll-mt-20 bg-gradient-to-b from-emerald-50/30 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Floating character - absolute positioned, overlapping content */}
        <div className="hidden xl:block absolute left-0 top-0 z-10 pointer-events-none">
          <div className="sticky top-32">
            <div className="animate-float-character">
              <Image
                src="/images/pointing-character.png"
                alt="Postać wskazująca na 7 kroków"
                width={400}
                height={570}
                className="w-auto h-[450px] drop-shadow-xl opacity-90"
              />
            </div>
          </div>
        </div>

        {/* Content - centered as before */}
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
                7 Kroków do Wolności Finansowej
              </h2>
              <p className="text-lg text-emerald-700/70 max-w-2xl mx-auto">
                Światowy standard 7 Kroków (Baby Steps), zaadaptowany do polskich realiów.
                Każdy krok buduje na poprzednim - nie przeskakuj, nie kombinuj.
                Ta kolejność działa.
              </p>
            </div>

            {/* Steps Timeline */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-300 hidden sm:block" />

              <div className="space-y-4">
                {steps.map((step) => (
                  <div
                    key={step.number}
                    className="relative"
                  >
                    {/* Step card */}
                    <div
                      className={`
                        sm:ml-16 bg-white/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300
                        ${expandedStep === step.number ? 'border-emerald-300 shadow-lg shadow-emerald-100/50' : 'border-emerald-100 hover:border-emerald-200'}
                      `}
                    >
                      {/* Header - always visible */}
                      <button
                        onClick={() => setExpandedStep(expandedStep === step.number ? null : step.number)}
                        className="w-full p-4 sm:p-6 flex items-center gap-4 text-left"
                      >
                        {/* Step number badge - mobile */}
                        <div className={`sm:hidden flex-shrink-0 w-10 h-10 ${step.color} rounded-full flex items-center justify-center`}>
                          <span className={`${step.iconColor} font-bold`}>{step.number}</span>
                        </div>

                        {/* Step number badge - desktop (on the timeline) */}
                        <div className={`hidden sm:flex absolute -left-8 top-6 w-12 h-12 ${step.color} rounded-full items-center justify-center border-4 border-white shadow-md`}>
                          <span className={`${step.iconColor} font-bold text-lg`}>{step.number}</span>
                        </div>

                        {/* Icon */}
                        <div className="hidden sm:flex flex-shrink-0 w-[68px] h-[68px] items-center justify-center relative">
                          <Image
                            src={step.image}
                            alt={step.title}
                            fill
                            sizes="68px"
                            className="object-contain"
                          />
                        </div>

                        {/* Title and amount */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-emerald-900 text-lg">
                            {step.title}
                          </h3>
                          <p className="text-sm text-emerald-600/70">
                            {step.amount}
                          </p>
                        </div>

                        {/* Expand icon */}
                        <div className="flex-shrink-0 text-emerald-500">
                          {expandedStep === step.number ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {expandedStep === step.number && (
                        <div className="px-4 sm:px-6 pb-6 space-y-4 border-t border-emerald-100 pt-4">
                          {/* Description */}
                          <p className="text-emerald-700/70 leading-relaxed">
                            {step.description}
                          </p>

                          {/* IKZE Tax Calculator - only for Step 4 */}
                          {step.number === 4 && (
                            <IKZETaxBenefit />
                          )}

                          {/* Example */}
                          <div className="bg-emerald-50 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-emerald-800 mb-1">Przykład z życia:</p>
                                <p className="text-sm text-emerald-700/70">{step.example}</p>
                              </div>
                            </div>
                          </div>

                          {/* Tip */}
                          <div className="flex items-start gap-3 text-sm">
                            <span className="text-emerald-600 font-medium">Tip:</span>
                            <p className="text-emerald-700/70">{step.tip}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FIRE Calculator */}
            <div className="mt-16 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 mb-3">
                  <Flame className="w-6 h-6 text-orange-500" />
                  <h3 className="text-2xl font-bold text-emerald-900">
                    Kalkulator FIRE
                  </h3>
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <p className="text-emerald-700/70 max-w-2xl mx-auto">
                  Po osiągnięciu 7. kroku jesteś na idealnej drodze do prawdziwej niezależności finansowej —
                  <strong> FIRE</strong> (Financial Independence, Retire Early), czyli <strong>NWFE</strong> — Niezależność Finansowa, Wcześniejsza Emerytura.
                  Sprawdź, ile musisz odłożyć, aby żyć tylko z odsetek.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {/* Monthly expenses slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-emerald-800">
                    Miesięczne wydatki
                  </label>
                  <input
                    type="range"
                    min={2000}
                    max={15000}
                    step={500}
                    value={fireExpenses}
                    onChange={(e) => setFireExpenses(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <p className="text-center text-lg font-bold text-emerald-700">
                    {fireExpenses.toLocaleString('pl-PL')} zł
                  </p>
                </div>

                {/* Current age slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-emerald-800">
                    Twój obecny wiek
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={50}
                    step={1}
                    value={fireCurrentAge}
                    onChange={(e) => {
                      const age = Number(e.target.value);
                      setFireCurrentAge(age);
                      if (age >= fireTargetAge) setFireTargetAge(age + 5);
                    }}
                    className="w-full accent-emerald-600"
                  />
                  <p className="text-center text-lg font-bold text-emerald-700">
                    {fireCurrentAge} lat
                  </p>
                </div>

                {/* FIRE age slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-emerald-800">
                    Wiek FIRE (cel)
                  </label>
                  <input
                    type="range"
                    min={Math.max(fireCurrentAge + 5, 30)}
                    max={65}
                    step={1}
                    value={Math.max(fireTargetAge, fireCurrentAge + 5)}
                    onChange={(e) => setFireTargetAge(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <p className="text-center text-lg font-bold text-emerald-700">
                    {Math.max(fireTargetAge, fireCurrentAge + 5)} lat
                  </p>
                </div>

                {/* Return rate slider */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-emerald-800">
                    Zakładany zwrot roczny
                  </label>
                  <input
                    type="range"
                    min={6}
                    max={15}
                    step={0.5}
                    value={fireReturnRate}
                    onChange={(e) => setFireReturnRate(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <p className="text-center text-lg font-bold text-emerald-700">
                    {fireReturnRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Results */}
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <div className="bg-white/80 rounded-xl p-4 text-center border border-amber-100">
                  <p className="text-xs text-emerald-600/70 mb-1">Potrzebny kapitał (FIRE number)</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-800">
                    {fireNumber.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
                  </p>
                </div>
                <div className="bg-white/80 rounded-xl p-4 text-center border border-amber-100">
                  <p className="text-xs text-emerald-600/70 mb-1">Odkładaj miesięcznie</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">
                    {monthlySavings.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
                  </p>
                </div>
                <div className="bg-white/80 rounded-xl p-4 text-center border border-amber-100">
                  <p className="text-xs text-emerald-600/70 mb-1">Czas do FIRE</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-800">
                    {yearsToFire} lat
                  </p>
                  <p className="text-xs text-emerald-600/50">
                    (wpłacisz {totalInvested.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł, odsetki: {interestEarned.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł)
                  </p>
                </div>
              </div>

              <p className="text-xs text-center text-emerald-600/40">
                Obliczenia zakładają roczny zwrot {fireReturnRate.toFixed(1)}% oraz inflację 3,5%/rok (realna stopa zwrotu ~{(REAL_RATE * 100).toFixed(1)}%).
                To symulacja edukacyjna — rzeczywiste wyniki zależą od warunków rynkowych.
              </p>
            </div>

            {/* Bottom CTA */}
            <div className="mt-12 text-center">
              <p className="text-emerald-700/70 mb-4">
                FiredUp pomoże Ci przejść przez każdy krok. Zobaczysz gdzie jesteś i co robić dalej.
              </p>
              <div className="inline-flex items-center px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium">
                Aplikacja na podstawie Twoich postępów automatycznie wskaże Ci osiągnięty etap realizacji Twojego planu prowadzącego do osiągnięcia niezależności finansowej
              </div>
            </div>

          </div>
      </div>

      {/* CSS for floating animation */}
      <style jsx global>{`
        @keyframes float-character {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float-character {
          animation: float-character 4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
