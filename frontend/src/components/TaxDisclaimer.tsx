'use client';

import { AlertTriangle, Info } from 'lucide-react';

interface TaxDisclaimerProps {
  variant?: 'full' | 'compact' | 'inline';
  className?: string;
}

/**
 * Komponent disclaimera prawnego
 * Używać na stronach z informacjami finansowymi/podatkowymi
 */
export default function TaxDisclaimer({ variant = 'full', className = '' }: TaxDisclaimerProps) {
  if (variant === 'inline') {
    return (
      <p className={`text-xs text-secondary/70 italic ${className}`}>
        Kalkulacje mają charakter poglądowy.
      </p>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-secondary ${className}`}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Prezentowane kalkulacje mają charakter poglądowy. Przy decyzjach inwestycyjnych lub kredytowych skonsultuj się ze specjalistą.
        </p>
      </div>
    );
  }

  // variant === 'full'
  return (
    <div className={`p-4 bg-muted/30 border border-border rounded-xl ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-muted/50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-secondary" />
        </div>
        <div className="space-y-2">
          <h4 className="font-medium text-primary text-sm">Informacja</h4>
          <div className="text-xs text-secondary space-y-2">
            <p>
              FiredUp pomaga zarządzać budżetem domowym i śledzić postępy finansowe.
              Prezentowane kalkulacje, statystyki i sugestie <strong>mają charakter poglądowy</strong> i
              mogą nie uwzględniać wszystkich indywidualnych czynników.
            </p>
            <p>
              Przy istotnych decyzjach — takich jak inwestycje w IKE/IKZE/PPK,
              zaciągnięcie kredytu czy optymalizacja podatkowa — warto skonsultować się ze specjalistą:
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1">
              <li>Doradcą finansowym lub inwestycyjnym</li>
              <li>Doradcą podatkowym lub księgowym</li>
            </ul>
            <p className="text-secondary/70 italic">
              Limity podatkowe i przepisy mogą ulec zmianie. Dane w aplikacji dotyczą roku 2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Krótki disclaimer do stopki
 */
export function FooterDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-secondary/60 ${className}`}>
      Prezentowane kalkulacje mają charakter poglądowy i nie stanowią doradztwa finansowego.
    </p>
  );
}

/**
 * Info o podatku Belki - do użycia przy inwestycjach
 */
export function BelkaTaxInfo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-2 p-3 bg-warning/5 border border-warning/20 rounded-lg ${className}`}>
      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
      <div className="text-xs text-secondary">
        <p className="font-medium text-primary mb-1">Podatek od zysków kapitałowych (Belka)</p>
        <p>
          Zyski z inwestycji (dywidendy, sprzedaż akcji, odsetki z lokat) są opodatkowane stawką <strong>19%</strong>.
          Wyjątkiem są konta IKE, IKZE i OIPE — przy spełnieniu warunków wypłaty nie płacisz podatku Belki.
        </p>
      </div>
    </div>
  );
}

/**
 * Info o uldze IKZE
 */
export function IKZETaxBenefit({
  className = ''
}: {
  rocznyDochod?: number;
  className?: string;
}) {
  const limitStandard = 11304;
  const limitJDG = 16956;
  const stawka12 = 0.12;
  const stawka32 = 0.32;

  // Oblicz przykładowe oszczędności
  const przykladowaOszczednosc12 = Math.round(limitStandard * stawka12);
  const przykladowaOszczednosc32 = Math.round(limitStandard * stawka32);

  return (
    <div className={`flex items-start gap-2 p-3 bg-success/5 border border-success/20 rounded-lg ${className}`}>
      <Info className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
      <div className="text-xs text-secondary">
        <p className="font-medium text-primary mb-1">Ulga podatkowa IKZE</p>
        <p className="mb-2">
          Wpłaty na IKZE odliczasz od podstawy opodatkowania. Przy limicie {limitStandard.toLocaleString('pl-PL')} zł
          oszczędzasz:
        </p>
        <ul className="list-disc list-inside pl-1 space-y-1">
          <li>
            <strong>{przykladowaOszczednosc12.toLocaleString('pl-PL')} zł</strong> — przy dochodach do 120 000 zł (12%)
          </li>
          <li>
            <strong>{przykladowaOszczednosc32.toLocaleString('pl-PL')} zł</strong> — przy dochodach powyżej 120 000 zł (32%)
          </li>
        </ul>
        <p className="mt-2 text-secondary/70 italic">
          Dla JDG limit jest wyższy: {limitJDG.toLocaleString('pl-PL')} zł.
        </p>
      </div>
    </div>
  );
}
