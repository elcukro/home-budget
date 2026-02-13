'use client';

import { BarChart3 } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function ReportsManualPage() {
  return (
    <ManualPageTemplate
      icon={BarChart3}
      title="Raporty"
      description="Raporty dają Ci pełny obraz Twoich finansów w wybranym okresie. Generuj szczegółowe zestawienia, porównuj miesiące i eksportuj dane. Idealne do analizy trendów i planowania budżetu."
      sections={[
        {
          title: 'Zestawienia i tabele',
          description: 'Generuj raporty za dowolny okres — tydzień, miesiąc, kwartał, rok. Tabele pokazują szczegółowy rozkład przychodów i wydatków z podsumowaniem po kategoriach.',
          features: [
            'Raporty za dowolny okres czasu',
            'Rozkład przychodów i wydatków po kategoriach',
            'Porównanie okresów (np. styczeń vs luty)',
            'Eksport do CSV',
          ],
          screenshots: [
            { src: '/images/manual/reports-breakdown.png', alt: 'Raporty - zestawienia', caption: 'Zestawienie wydatków po kategoriach' },
          ],
        },
        {
          title: 'Wykresy analityczne',
          description: 'Wizualizuj swoje finanse na interaktywnych wykresach. Wykresy słupkowe, liniowe i kołowe pomagają zrozumieć trendy i wzorce w Twoich finansach.',
          features: [
            'Wykresy słupkowe: przychody vs wydatki',
            'Wykresy liniowe: trendy w czasie',
            'Wykresy kołowe: rozkład procentowy',
            'Interaktywne dymki ze szczegółami',
          ],
          screenshots: [
            { src: '/images/manual/reports-charts.png', alt: 'Raporty - wykresy', caption: 'Interaktywne wykresy finansowe' },
          ],
        },
      ]}
    />
  );
}
