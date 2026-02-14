'use client';

import { Target } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function SavingsManualPage() {
  return (
    <ManualPageTemplate
      icon={Target}
      title="Cele oszczędnościowe"
      description="Oszczędzanie bez celu to jak jazda bez nawigacji. FiredUp pozwala Ci ustalać konkretne cele — wakacje, fundusz awaryjny, wkład na mieszkanie — i śledzić postęp każdego z nich."
      sections={[
        {
          title: 'Twoje cele',
          description: 'Twórz nieograniczoną liczbę celów oszczędnościowych. Każdy cel ma nazwę, docelową kwotę, termin i kolorową ikonę. Widzisz od razu, ile już uzbierałeś i ile jeszcze brakuje.',
          features: [
            'Nieograniczona liczba celów',
            'Docelowa kwota i termin realizacji',
            'Automatyczny kalkulator miesięcznych wpłat',
            'Kolorowe ikony i etykiety dla każdego celu',
          ],
          screenshots: [
            { src: '/images/manual/savings-goals.png', alt: 'Cele - przegląd', caption: 'Przegląd celów oszczędnościowych' },
          ],
        },
        {
          title: 'Jak dodać wpłatę lub wypłatę',
          description: 'Kliknij „Dodaj transakcję" i wybierz typ operacji. Wpłaty powiększają Twoje oszczędności, wypłaty je pomniejszają — np. gdy musisz sięgnąć do funduszu awaryjnego.',
          features: [
            'Typ transakcji — Wpłata (zielona strzałka w górę) lub Wypłata (czerwona strzałka w dół)',
            'Kwota — wpisz kwotę operacji',
            'Data — data wpłaty lub wypłaty',
            'Kategoria — wybierz jedną z 8 opcji: Fundusz awaryjny, Fundusz 6-miesięczny, Emerytura, Edukacja, Oszczędności ogólne, Inwestycje, Nieruchomości, Inne',
            'Opis — opcjonalny komentarz, np. „Premia roczna" lub „Naprawa samochodu" (max 200 znaków)',
            'Cykliczny — włącz dla regularnych wpłat (np. 500 zł co miesiąc na fundusz awaryjny). Ustaw opcjonalną datę zakończenia.',
            'Kwota docelowa — opcjonalna kwota, którą chcesz uzbierać w tej kategorii',
          ],
          screenshots: [
            { src: '/images/manual/savings-add-dialog.png', alt: 'Dodawanie oszczędności', caption: 'Formularz dodawania wpłaty oszczędnościowej' },
          ],
        },
        {
          title: 'Konta emerytalne i inwestycyjne',
          description: 'Dla kategorii Emerytura i Inwestycje dostępne są dodatkowe opcje kont — FiredUp zna polskie limity wpłat i śledzi ich wykorzystanie.',
          features: [
            'Typ konta — wybierz: Standardowe, IKE (Indywidualne Konto Emerytalne), IKZE (Indywidualne Konto Zabezpieczenia Emerytalnego), PPK (Pracownicze Plany Kapitałowe) lub OIPE',
            'Limity roczne — aplikacja pokazuje karty z aktualnymi limitami wpłat na IKE, IKZE, PPK i OIPE',
            'Paski postępu — widzisz ile z rocznego limitu już wykorzystałeś',
            'Szybkie dodawanie — kliknij „Dodaj" przy danym typie konta, aby otworzyć formularz z gotowymi ustawieniami',
            'Oczekiwana stopa zwrotu — wpisz roczny procent zwrotu dla kont inwestycyjnych',
            'Oddzielne karty dla Ciebie i partnera — jeśli finanse partnerskie są włączone',
          ],
        },
        {
          title: 'Śledzenie postępu',
          description: 'Każdy cel ma wizualną reprezentację postępu — pasek procentowy i wykres. FiredUp oblicza, ile musisz odkładać miesięcznie, żeby osiągnąć cel na czas, i wysyła powiadomienia o kamieniach milowych.',
          features: [
            'Pasek postępu z procentem realizacji',
            'Wykres oszczędności w czasie',
            'Powiadomienia o kamieniach milowych (25%, 50%, 75%)',
            'Elastyczne wpłaty — dodaj kiedy chcesz',
            'Saldo bieżące — kolumna „Saldo po" pokazuje stan po każdej operacji',
            'Status celu — aktywny, ukończony, wstrzymany lub porzucony',
          ],
          screenshots: [
            { src: '/images/manual/savings-progress.png', alt: 'Cele - postęp', caption: 'Wizualizacja postępu oszczędności' },
          ],
        },
        {
          title: 'Edycja i zarządzanie',
          description: 'Każdą transakcję oszczędnościową możesz edytować lub usunąć. Dla wpłat cyklicznych dostępna jest zmiana stawki z zachowaniem historii.',
          features: [
            'Edycja — kliknij na transakcję, aby zmienić kwotę, datę, opis lub kategorię',
            'Usuwanie — kliknij ikonę kosza. Saldo celu zostanie automatycznie przeliczone.',
            'Zmiana stawki — dla wpłat cyklicznych: zmień kwotę od wybranej daty (np. zwiększ comiesięczną wpłatę)',
            'Historia wersji — rozwiń wpłatę cykliczną, aby zobaczyć poprzednie kwoty',
            'Transfer między celami — przenieś środki z jednego celu na inny',
          ],
          screenshots: [
            { src: '/images/manual/savings-edit-dialog.png', alt: 'Edycja oszczędności', caption: 'Formularz edycji transakcji oszczędnościowej' },
          ],
        },
        {
          title: 'Filtrowanie i sortowanie',
          description: 'Znajdź dokładnie to, czego szukasz — filtruj po kategorii, typie transakcji i zakresie dat.',
          features: [
            'Filtr kategorii — pokaż tylko wybraną kategorię (np. tylko Fundusz awaryjny)',
            'Filtr typu — wszystkie, tylko wpłaty lub tylko wypłaty',
            'Zakres dat — bieżący miesiąc, ostatni kwartał, ostatnie pół roku, rok lub wszystko',
            'Sortowanie — po kategorii, kwocie, typie lub dacie (rosnąco/malejąco)',
            'Grupowanie — transakcje są automatycznie grupowane po kategorii, opisie i typie',
            'Podsumowanie — na dole tabeli: łączne wpłaty, wypłaty i saldo netto',
          ],
        },
      ]}
    />
  );
}
