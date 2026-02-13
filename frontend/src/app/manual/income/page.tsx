'use client';

import { TrendingUp } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function IncomeManualPage() {
  return (
    <ManualPageTemplate
      icon={TrendingUp}
      title="Przychody"
      description="Moduł przychodów pozwala Ci śledzić wszystkie źródła dochodu — od wynagrodzenia, przez dodatkowe prace, po przychody pasywne. Dzięki temu zawsze wiesz, ile zarabiasz i skąd pochodzą Twoje pieniądze."
      sections={[
        {
          title: 'Źródła przychodów',
          description: 'Dodawaj i zarządzaj wszystkimi źródłami przychodów. Każde źródło możesz skategoryzować (wynagrodzenie, freelance, inwestycje, wynajem itd.) i przypisać do niego częstotliwość wpływu.',
          features: [
            'Kategoryzacja przychodów (wynagrodzenie, freelance, inwestycje, inne)',
            'Częstotliwość wpływu (miesięczna, tygodniowa, jednorazowa)',
            'Historia wszystkich przychodów z filtrowaniem',
            'Automatyczne sumowanie po kategoriach',
          ],
          screenshots: [
            { src: '/images/manual/income-sources.png', alt: 'Przychody - źródła', caption: 'Lista źródeł przychodów z wykresem budżetu' },
          ],
        },
        {
          title: 'Jak dodać przychód',
          description: 'Kliknij przycisk „Dodaj przychód" w prawym górnym rogu. Wypełnij formularz podając szczegóły wpływu. Każde pole jest opisane poniżej.',
          features: [
            'Kategoria — wybierz jedną z 6 opcji: Wynagrodzenie, Freelance, Inwestycje, Wynajem, Świadczenia, Inne. Każda ma własną ikonę dla łatwej identyfikacji.',
            'Opis — krótka nazwa źródła dochodu, np. „Pensja z firmy X" lub „Wynajem kawalerki" (max 100 znaków)',
            'Kwota — wpisz kwotę netto lub brutto (przełącznik brutto/netto dostępny dla wynagrodzeń)',
            'Data — data wpływu lub data rozpoczęcia dla przychodów cyklicznych',
            'Cykliczny — włącz przełącznik jeśli przychód powtarza się co miesiąc. Opcjonalnie ustaw datę zakończenia.',
          ],
          screenshots: [
            { src: '/images/manual/income-add-dialog.png', alt: 'Dodawanie przychodu', caption: 'Formularz dodawania przychodu z wyborem kategorii' },
          ],
        },
        {
          title: 'Rozliczenia podatkowe',
          description: 'Dla kategorii Wynagrodzenie, Freelance i Inne dostępne są zaawansowane ustawienia podatkowe. FiredUp automatycznie oblicza składki i podatki na podstawie polskiego systemu podatkowego.',
          features: [
            'Typ umowy — wybierz: UoP (umowa o pracę), B2B, Zlecenie, Dzieło lub Inna',
            'Koszty uzyskania przychodu (KUP) — Standardowe, Autorskie 50% lub Brak',
            'Przełącznik Brutto/Netto — wpisz kwotę brutto, a aplikacja wyliczy netto (ZUS, PPK, składka zdrowotna, PIT)',
            'Podgląd rozbicia podatkowego — widoczny w czasie rzeczywistym przy wpisywaniu kwoty brutto',
          ],
          screenshots: [
            { src: '/images/manual/income-tax.png', alt: 'Przychody - podatki', caption: 'Podsumowanie podatkowe' },
          ],
        },
        {
          title: 'Edycja i usuwanie',
          description: 'Każdy przychód możesz edytować lub usunąć. Dla przychodów cyklicznych dostępna jest specjalna opcja „Zmień stawkę", która zachowuje historię zmian.',
          features: [
            'Edycja — kliknij na wpis, aby otworzyć formularz edycji. Zmień dowolne pole i zapisz.',
            'Usuwanie — kliknij ikonę kosza przy wpisie. Potwierdzenie jest wymagane.',
            'Zmiana stawki — dla przychodów cyklicznych: zmienia kwotę od wybranej daty, zachowując poprzednie wersje w historii.',
            'Historia wersji — rozwiń wpis cykliczny, aby zobaczyć wszystkie poprzednie stawki z datami obowiązywania.',
          ],
          screenshots: [
            { src: '/images/manual/income-edit-dialog.png', alt: 'Edycja przychodu', caption: 'Formularz edycji przychodu' },
          ],
        },
        {
          title: 'Filtrowanie i sortowanie',
          description: 'Używaj paska miesięcy na górze strony, aby przełączać się między miesiącami bieżącego roku. Sortuj wpisy według różnych kryteriów.',
          features: [
            'Filtr miesiąca — klikaj miesiące na pasku, aby zobaczyć przychody z danego okresu',
            'Sortowanie — po dacie, kwocie, kategorii lub opisie (rosnąco/malejąco)',
            'Podział bank/ręczne — podsumowanie pokazuje ile pochodzi z importu bankowego, a ile z ręcznych wpisów',
            'Grupowanie — przychody są automatycznie grupowane po kategorii i opisie',
          ],
        },
        {
          title: 'Finanse partnerskie',
          description: 'Po włączeniu funkcji partnera w ustawieniach, każdy przychód możesz przypisać do siebie lub partnera. Pozwala to śledzić dochody całego gospodarstwa domowego z podziałem na osoby.',
          features: [
            'Pole „Właściciel" pojawia się automatycznie po włączeniu finansów partnerskich',
            'Wybierz „Ja" lub imię partnera przy każdym wpisie',
            'Podsumowania i wykresy uwzględniają podział na osoby',
          ],
        },
      ]}
    />
  );
}
