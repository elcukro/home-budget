'use client';

import { Footprints } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function FinancialFreedomManualPage() {
  return (
    <ManualPageTemplate
      icon={Footprints}
      title="Wolność finansowa"
      description="To serce FiredUp. Moduł wolności finansowej łączy sprawdzoną metodę 7 Kroków (Baby Steps) z kalkulatorem FIRE. Masz konkretną roadmapę — od funduszu awaryjnego aż po niezależność finansową."
      sections={[
        {
          title: '7 Kroków do wolności',
          description: 'Metoda 7 Kroków to sprawdzony plan, który przeprowadził miliony ludzi od długów do wolności finansowej. FiredUp automatycznie wykrywa, na którym kroku jesteś, i daje Ci konkretne cele do realizacji.',
          features: [
            'Krok 1: Fundusz awaryjny (1000 zł)',
            'Krok 2: Spłata długów metodą kuli śnieżnej',
            'Krok 3: Pełny fundusz awaryjny (3-6 miesięcy wydatków)',
            'Krok 4: Inwestowanie 15% przychodu',
            'Krok 5: Fundusz edukacyjny dla dzieci',
            'Krok 6: Spłata kredytu hipotecznego',
            'Krok 7: Budowanie majątku i dobroczynność',
          ],
          screenshots: [
            { src: '/images/manual/financial-freedom-steps.png', alt: 'Wolność finansowa - 7 kroków', caption: 'Tracker 7 Kroków z Twoim aktualnym postępem' },
          ],
        },
        {
          title: 'Kalkulator FIRE',
          description: 'FIRE (Financial Independence, Retire Early) to styl życia, w którym oszczędzasz i inwestujesz agresywnie, by osiągnąć niezależność finansową wcześniej niż na emeryturze. Kalkulator pokaże Ci, ile lat Ci to zajmie.',
          features: [
            'Obliczenie kwoty potrzebnej do FIRE',
            'Szacowany czas do niezależności finansowej',
            'Symulacja różnych scenariuszy (stopa oszczędności, zwrot z inwestycji)',
            'Reguła 4% — ile możesz wypłacać rocznie',
          ],
          screenshots: [
            { src: '/images/manual/financial-freedom-fire.png', alt: 'Kalkulator FIRE', caption: 'Kalkulator niezależności finansowej FIRE' },
          ],
        },
      ]}
    />
  );
}
