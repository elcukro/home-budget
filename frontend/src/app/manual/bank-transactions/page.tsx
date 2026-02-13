'use client';

import { Building2 } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function BankTransactionsManualPage() {
  return (
    <ManualPageTemplate
      icon={Building2}
      title="Transakcje bankowe"
      description="Połącz swój bank z FiredUp i zapomnij o ręcznym wpisywaniu transakcji. Aplikacja automatycznie pobiera Twoje operacje bankowe i kategoryzuje je. Obsługujemy większość polskich banków."
      sections={[
        {
          title: 'Lista transakcji',
          description: 'Po połączeniu banku Twoje transakcje pojawiają się automatycznie. Przeglądaj je, filtruj i przeszukuj. Każda transakcja jest automatycznie kategoryzowana, ale możesz zmienić kategorię ręcznie.',
          features: [
            'Automatyczne pobieranie transakcji z banku',
            'Inteligentna kategoryzacja (AI przypisuje kategorie)',
            'Wyszukiwanie i filtrowanie po dacie, kwocie, opisie',
            'Import z CSV dla banków bez integracji',
            'Rozpoznawanie transakcji cyklicznych',
          ],
          screenshots: [
            { src: '/images/manual/bank-transactions-list.png', alt: 'Transakcje bankowe - lista', caption: 'Lista transakcji z automatyczną kategoryzacją' },
          ],
        },
        {
          title: 'Synchronizacja z bankiem',
          description: 'FiredUp korzysta z bezpiecznych API bankowych (Tink), żeby pobierać Twoje dane. Połączenie wymaga jednorazowej autoryzacji w Twoim banku. Dane są szyfrowane i przechowywane bezpiecznie.',
          features: [
            'Obsługa polskich banków: ING, PKO BP, mBank, Santander, Millennium',
            'Bezpieczne połączenie przez API bankowe (Tink)',
            'Jednorazowa autoryzacja — potem wszystko automatycznie',
            'Status synchronizacji — widzisz kiedy ostatnio pobrano dane',
          ],
          screenshots: [
            { src: '/images/manual/bank-transactions-sync.png', alt: 'Synchronizacja z bankiem', caption: 'Status połączenia bankowego' },
          ],
        },
      ]}
    />
  );
}
