'use client';

import { LayoutDashboard } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function DashboardManualPage() {
  return (
    <ManualPageTemplate
      icon={LayoutDashboard}
      title="Panel główny"
      description="Panel główny to Twoje centrum dowodzenia finansami. Po zalogowaniu od razu widzisz najważniejsze wskaźniki: bilans miesiąca, trendy wydatków i oszczędności, a także alerty o nietypowych transakcjach."
      sections={[
        {
          title: 'Przegląd finansów',
          description: 'Na górze panelu znajdziesz karty z podsumowaniem: łączne przychody, wydatki, oszczędności i bilans bieżącego miesiąca. Każda karta pokazuje również zmianę procentową w porównaniu z poprzednim miesiącem.',
          features: [
            'Bilans miesiąca widoczny od razu po zalogowaniu',
            'Porównanie z poprzednim miesiącem (procent zmian)',
            'Wskaźnik oszczędności (savings rate) — ile procent przychodu udało Ci się odłożyć',
            'Szybki dostęp do najważniejszych modułów',
          ],
          screenshots: [
            { src: '/images/manual/dashboard-overview.png', alt: 'Panel główny - przegląd finansów', caption: 'Karty z podsumowaniem miesiąca' },
          ],
        },
        {
          title: 'Wykresy i trendy',
          description: 'Poniżej kart podsumowania znajdziesz interaktywne wykresy prezentujące trendy z ostatnich 12 miesięcy. Wykresy pokazują dynamikę przychodów, wydatków i oszczędności, pomagając Ci wychwycić ważne zmiany.',
          features: [
            'Wykres trendów 12-miesięcy (przychody vs wydatki)',
            'Rozkład wydatków według kategorii (wykres kołowy)',
            'Historia oszczędności i bilansów',
            'Alerty o nietypowych wydatkach',
          ],
          screenshots: [
            { src: '/images/manual/dashboard-charts.png', alt: 'Panel główny - wykresy', caption: 'Wykresy trendów i rozkład wydatków' },
          ],
        },
      ]}
    />
  );
}
