'use client';

import { Receipt } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function ExpensesManualPage() {
  return (
    <ManualPageTemplate
      icon={Receipt}
      title="Wydatki"
      description="Śledzenie wydatków to fundament kontroli finansowej. FiredUp pozwala Ci rejestrować każdą transakcję, automatycznie ją kategoryzować i analizować, gdzie tak naprawdę idą Twoje pieniądze."
      sections={[
        {
          title: 'Lista wydatków',
          description: 'Przeglądaj wszystkie wydatki w przejrzystej tabeli. Filtruj po dacie, kategorii, kwocie lub opisie. Każdy wydatek możesz edytować, usunąć lub zmienić kategorię jednym kliknięciem.',
          features: [
            'Przejrzysta tabela ze wszystkimi transakcjami',
            'Filtrowanie po dacie, kategorii i kwocie',
            'Szybka edycja kategorii jednym kliknięciem',
            'Import transakcji z pliku CSV',
            'Wykrywanie wydatków cyklicznych (subskrypcje)',
          ],
          screenshots: [
            { src: '/images/manual/expenses-list.png', alt: 'Wydatki - lista', caption: 'Lista wydatków z filtrowaniem' },
          ],
        },
        {
          title: 'Jak dodać wydatek',
          description: 'Kliknij przycisk „Dodaj wydatek" w prawym górnym rogu. Wypełnij formularz — każde pole jest opisane poniżej.',
          features: [
            'Kategoria — wybierz jedną z 8 opcji: Mieszkanie, Transport, Jedzenie, Media, Ubezpieczenie, Zdrowie, Rozrywka, Inne',
            'Opis — krótka nazwa wydatku, np. „Czynsz" lub „Netflix" (max 100 znaków)',
            'Kwota — wpisz kwotę wydatku w złotówkach',
            'Data — data transakcji lub data rozpoczęcia dla wydatków cyklicznych',
            'Cykliczny — włącz przełącznik dla powtarzających się wydatków (np. czynsz, subskrypcje). Opcjonalnie ustaw datę zakończenia.',
          ],
          screenshots: [
            { src: '/images/manual/expenses-add-dialog.png', alt: 'Dodawanie wydatku', caption: 'Formularz dodawania wydatku z wyborem kategorii' },
          ],
        },
        {
          title: 'Edycja i usuwanie',
          description: 'Wydatki z bieżącego miesiąca możesz swobodnie edytować i usuwać. Dla wydatków cyklicznych dostępna jest opcja zmiany stawki z zachowaniem historii.',
          features: [
            'Edycja — kliknij na wpis, aby otworzyć formularz. Edycja dostępna tylko dla bieżącego miesiąca.',
            'Usuwanie — kliknij ikonę kosza. Usuwanie dostępne tylko dla bieżącego miesiąca.',
            'Zmiana stawki — dla wydatków cyklicznych: zmienia kwotę od wybranej daty, np. gdy wzrośnie czynsz',
            'Historia wersji — rozwiń wydatek cykliczny, aby zobaczyć poprzednie kwoty i daty zmian',
            'Uwaga: wydatki z poprzednich miesięcy są zablokowane do edycji, aby zachować integralność danych historycznych',
          ],
          screenshots: [
            { src: '/images/manual/expenses-edit-dialog.png', alt: 'Edycja wydatku', caption: 'Formularz edycji wydatku' },
          ],
        },
        {
          title: 'Rozkład kategorii',
          description: 'Wykres kołowy pokazuje, jaką część budżetu pochłaniają poszczególne kategorie. Dzięki temu od razu widzisz, które obszary wymagają uwagi — może jedzenie na mieście to 30% Twoich wydatków?',
          features: [
            'Wykres kołowy z rozkładem procentowym',
            'Porównanie kategorii miesiąc do miesiąca',
            'Top 5 największych wydatków miesiąca',
            'Alerty o przekroczeniu średnich kosztów',
          ],
          screenshots: [
            { src: '/images/manual/expenses-categories.png', alt: 'Wydatki - kategorie', caption: 'Rozkład wydatków według kategorii' },
          ],
        },
        {
          title: 'Filtrowanie i widoki',
          description: 'Zaawansowane filtry pozwalają szybko znaleźć konkretne wydatki. Kategorie wyświetlają się jako składane karty — kliknij nagłówek kategorii, aby rozwinąć lub zwinąć listę.',
          features: [
            'Filtr typu — pokaż wszystkie, tylko cykliczne lub tylko jednorazowe',
            'Filtr źródła — wszystkie, z banku, ręczne lub wymagające przeglądu',
            'Sortowanie kategorii — od najdroższych lub od najtańszych',
            'Składane karty kategorii — każda kategoria to osobna, rozwijana sekcja',
            'Pasek miesięcy — przełączaj między miesiącami (przyszłe miesiące niedostępne)',
          ],
        },
        {
          title: 'Finanse partnerskie',
          description: 'Po włączeniu finansów partnerskich w ustawieniach, przy każdym wydatku możesz wskazać, kto go poniósł. Idealne do śledzenia wspólnych kosztów domowych.',
          features: [
            'Pole „Właściciel" — przypisz wydatek do siebie lub partnera',
            'Podsumowania uwzględniają podział na osoby',
            'Przydatne do rozliczania wspólnych kosztów (czynsz, rachunki, zakupy)',
          ],
        },
      ]}
    />
  );
}
