'use client';

import { Sparkles } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function AIAnalysisManualPage() {
  return (
    <ManualPageTemplate
      icon={Sparkles}
      title="Analiza AI"
      description="Sztuczna inteligencja w FiredUp analizuje Twoje finanse i znajduje rzeczy, których sam byś nie zauważył. Od zapomnianych subskrypcji po trendy, które powinny Cię zaniepokoić — AI ma na to oko."
      sections={[
        {
          title: 'Inteligentne spostrzeżenia',
          description: 'AI przegląda Twoje transakcje i generuje spostrzeżenia: które kategorie rosną najszybciej, gdzie wydajesz więcej niż średnia, jakie subskrypcje masz aktywne i czy coś się zmieniło w Twoich wzorcach wydatkowych.',
          features: [
            'Automatyczne wykrywanie subskrypcji i płatności cyklicznych',
            'Analiza trendów wydatków — które rosną, które maleją',
            'Porównanie z poprzednimi okresami',
            'Wykrywanie nietypowych transakcji',
          ],
          screenshots: [
            { src: '/images/manual/ai-analysis-insights.png', alt: 'Analiza AI - spostrzeżenia', caption: 'Panel ze spostrzeżeniami AI' },
          ],
        },
        {
          title: 'Rekomendacje',
          description: 'Na podstawie analizy AI generuje konkretne rekomendacje: gdzie możesz zaoszczędzić, jakie wydatki możesz ograniczyć, ile powinieneś odkładać na cel awaryjny. Każda rekomendacja jest spersonalizowana pod Twoją sytuację.',
          features: [
            'Spersonalizowane porady oszczędnościowe',
            'Sugestie optymalizacji budżetu',
            'Prognoza wydatków na następny miesiąc',
            'Alerty o potencjalnych problemach',
          ],
          screenshots: [
            { src: '/images/manual/ai-analysis-recommendations.png', alt: 'Analiza AI - rekomendacje', caption: 'Spersonalizowane rekomendacje AI' },
          ],
        },
      ]}
    />
  );
}
