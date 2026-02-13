'use client';

import { Landmark } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function LoansManualPage() {
  return (
    <ManualPageTemplate
      icon={Landmark}
      title="Kredyty i dług"
      description="Moduł kredytów pomaga Ci zarządzać wszystkimi zobowiązaniami — od kredytu hipotecznego, przez kredyt samochodowy, po karty kredytowe. Widzisz dokładnie ile zostało do spłaty i jak nadpłaty przyspieszają Twoją wolność od długów."
      sections={[
        {
          title: 'Lista kredytów',
          description: 'Przeglądaj wszystkie swoje kredyty i zobowiązania w jednym miejscu. Każdy kredyt pokazuje aktualne saldo, miesięczną ratę, oprocentowanie i szacowaną datę końcowej spłaty.',
          features: [
            'Przegląd wszystkich kredytów i pożyczek',
            'Aktualne saldo i pozostała kwota do spłaty',
            'Oprocentowanie i miesięczna rata',
            'Szacowana data końcowej spłaty',
            'Obsługa 10 typów kredytów (hipoteczny, samochodowy, gotówkowy i więcej)',
          ],
          screenshots: [
            { src: '/images/manual/loans-list.png', alt: 'Kredyty - lista', caption: 'Lista kredytów z podsumowaniem' },
          ],
        },
        {
          title: 'Jak dodać kredyt',
          description: 'Kliknij „Dodaj kredyt" i wypełnij formularz. Podaj dokładne dane z umowy kredytowej — na ich podstawie aplikacja wyliczy harmonogram spłat i oszczędności z nadpłat.',
          features: [
            'Typ kredytu — wybierz z 10 opcji: Hipoteczny, Samochodowy, Gotówkowy, Studencki, Karta kredytowa, Pożyczka, Raty 0%, Leasing, Debet, Inny',
            'Opis — nazwa kredytu, np. „Hipoteka ING" lub „Leasing Octavia" (ułatwia identyfikację)',
            'Kwota początkowa — pełna kwota zaciągniętego kredytu (dla leasingu obliczana automatycznie)',
            'Pozostałe saldo — aktualna kwota do spłaty (jeśli spłacasz kredyt od jakiegoś czasu)',
            'Oprocentowanie — roczna stopa procentowa (z dokładnością do 2 miejsc po przecinku)',
            'Rata miesięczna — kwota stałej raty',
            'Data rozpoczęcia — kiedy zaciągnąłeś kredyt',
            'Okres (miesiące) — łączna liczba rat',
            'Dzień spłaty — którego dnia miesiąca płacisz ratę (1-31)',
            'Opłata za nadpłatę — procent prowizji za nadpłatę (0-3%), jeśli bank ją pobiera',
            'Prowizja zniesiona do — data, do której bank nie pobiera prowizji za nadpłatę',
          ],
          screenshots: [
            { src: '/images/manual/loans-add-dialog.png', alt: 'Dodawanie kredytu', caption: 'Formularz dodawania nowego kredytu' },
          ],
        },
        {
          title: 'Rejestrowanie płatności',
          description: 'Każdego miesiąca rejestruj zapłaconą ratę. Możesz też dodawać nadpłaty — dodatkowe wpłaty pomniejszające kapitał i przyspieszające spłatę.',
          features: [
            'Rata regularna — kliknij „Dodaj płatność", wpisz kwotę, datę i opcjonalną notatkę',
            'Nadpłata — wybierz opcję nadpłaty, wpisz dodatkową kwotę ponad ratę',
            'Automatyczna aktualizacja salda — po dodaniu płatności, pozostałe saldo się zmniejsza',
            'Historia płatności — pełna lista wszystkich zarejestrowanych wpłat',
            'Nagrody XP — za każdą nadpłatę dostajesz 20 punktów doświadczenia (gamifikacja)',
          ],
        },
        {
          title: 'Szczegóły i nadpłaty',
          description: 'Po kliknięciu w kredyt widzisz szczegółowy harmonogram spłat, historię płatności i kalkulator nadpłat. Aplikacja pokaże Ci: jeśli dołożysz 200 zł miesięcznie, spłacisz kredyt 3 lata szybciej i zaoszczędzisz tysiące na odsetkach.',
          features: [
            'Harmonogram spłat — tabela z rozkładem każdej raty na kapitał i odsetki',
            'Historia wszystkich płatności — lista z datami, kwotami i notatkami',
            'Kalkulator nadpłat — wpisz kwotę dodatkowej wpłaty, aby zobaczyć ile miesięcy i odsetek zaoszczędzisz',
            'Pasek postępu spłaty — wizualizacja ile już spłaciłeś',
            'Powiadomienie o całkowitej spłacie — celebracja po zamknięciu kredytu!',
          ],
          screenshots: [
            { src: '/images/manual/loans-detail.png', alt: 'Kredyty - szczegóły', caption: 'Szczegóły kredytu z harmonogramem spłat' },
          ],
        },
        {
          title: 'Strategie spłaty długów',
          description: 'FiredUp porównuje dwie popularne strategie spłaty wielu kredytów jednocześnie. Dzięki temu możesz wybrać podejście, które najlepiej pasuje do Twojej sytuacji.',
          features: [
            'Metoda kuli śnieżnej (Snowball) — spłacaj najpierw najmniejszy dług. Szybkie „wygrane" motywują do kontynuowania.',
            'Metoda lawiny (Avalanche) — spłacaj najpierw dług z najwyższym oprocentowaniem. Matematycznie optymalnie — płacisz mniej odsetek.',
            'Porównanie obu strategii — aplikacja pokazuje oś czasu spłaty i łączne odsetki dla każdej metody',
            'Wybierz strategię dopasowaną do siebie — kula śnieżna dla motywacji, lawina dla oszczędności',
          ],
        },
        {
          title: 'Archiwizacja i zarządzanie',
          description: 'Spłacone kredyty możesz zarchiwizować, aby nie zaśmiecały listy aktywnych zobowiązań. W każdej chwili możesz je przywrócić.',
          features: [
            'Archiwizuj — przenieś spłacony kredyt do archiwum jednym kliknięciem',
            'Przywróć — odzyskaj zarchiwizowany kredyt do listy aktywnych',
            'Filtruj — pokaż tylko aktywne, tylko zarchiwizowane lub wszystkie',
            'Sortuj — po dacie rozpoczęcia, saldzie, kwocie początkowej lub racie (rosnąco/malejąco)',
            'Widok kompaktowy — przełącz na mniejsze karty, gdy masz dużo kredytów',
          ],
          screenshots: [
            { src: '/images/manual/loans-edit-dialog.png', alt: 'Edycja kredytu', caption: 'Formularz edycji kredytu' },
          ],
        },
      ]}
    />
  );
}
