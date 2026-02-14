'use client';

import { Crown } from 'lucide-react';
import ManualPageTemplate from '@/components/manual/ManualPageTemplate';

export default function PremiumManualPage() {
  return (
    <ManualPageTemplate
      icon={Crown}
      title="Pakiet Premium"
      description="FiredUp działa bez ograniczeń w pakiecie Premium. Odblokuj pełną moc aplikacji — nieograniczona liczba wpisów, integracja z bankami, analiza AI, finanse partnerskie i eksport danych w dowolnym formacie."
      sections={[
        {
          title: 'Darmowy plan vs Premium',
          description: 'Plan darmowy pozwala poznać FiredUp i zacząć śledzić finanse. Pakiet Premium usuwa wszystkie limity i dodaje zaawansowane funkcje.',
          features: [
            'Wydatki — darmowy: 20 wpisów/miesiąc → Premium: bez limitu',
            'Przychody — darmowy: 3 wpisy/miesiąc → Premium: bez limitu',
            'Kredyty — darmowy: 3 kredyty → Premium: bez limitu',
            'Cele oszczędnościowe — darmowy: 3 cele → Premium: bez limitu',
            'Eksport danych — darmowy: tylko JSON → Premium: JSON, CSV i XLSX',
            'Integracja z bankami — darmowy: niedostępna → Premium: pełna obsługa',
            'Analiza AI — darmowy: niedostępna → Premium: pełna analiza',
          ],
        },
        {
          title: 'Integracja z bankami',
          description: 'Połącz swoje konto bankowe z FiredUp przez bezpieczne API bankowe (Tink). Transakcje są automatycznie pobierane i kategoryzowane — koniec z ręcznym wpisywaniem.',
          features: [
            'Obsługiwane banki — ING, PKO BP, mBank, Santander, Millennium i wiele innych polskich banków',
            'Bezpieczne połączenie — jednorazowa autoryzacja przez stronę Twojego banku. FiredUp nie przechowuje haseł bankowych.',
            'Automatyczne pobieranie — transakcje pojawiają się automatycznie po synchronizacji',
            'Inteligentna kategoryzacja — AI przypisuje kategorie do importowanych transakcji',
            'Reconcylacja — aplikacja łączy importy bankowe z ręcznymi wpisami i wykrywa duplikaty',
            'Status synchronizacji — widzisz datę ostatniego pobierania i ewentualne błędy',
          ],
        },
        {
          title: 'Analiza AI',
          description: 'Sztuczna inteligencja analizuje Twoje finanse i generuje spersonalizowane spostrzeżenia oraz rekomendacje. Wykrywa wzorce, o których sam byś nie pomyślał.',
          features: [
            'Automatyczne wykrywanie subskrypcji — AI znajduje powtarzające się płatności (Netflix, Spotify, siłownia)',
            'Analiza trendów — które kategorie wydatków rosną, a które maleją z miesiąca na miesiąc',
            'Wykrywanie anomalii — alerty o nietypowo wysokich wydatkach w danej kategorii',
            'Porady oszczędnościowe — konkretne sugestie gdzie i ile możesz zaoszczędzić',
            'Optymalizacja budżetu — rekomendacje dostosowane do Twojej sytuacji finansowej',
            'Prognoza wydatków — szacunek kosztów na następny miesiąc na podstawie historii',
          ],
        },
        {
          title: 'Finanse partnerskie',
          description: 'Dodaj partnera do konta i śledźcie finanse wspólnie. Każdy wpis — przychód, wydatek, oszczędność — można przypisać do konkretnej osoby, zachowując pełen obraz budżetu domowego.',
          features: [
            'Dodaj partnera — w ustawieniach wpisz imię partnera, aby włączyć tę funkcję',
            'Pole „Właściciel" — pojawia się przy każdym formularzu (przychody, wydatki, oszczędności)',
            'Wspólne podsumowania — wykresy i raporty pokazują dane łączne i z podziałem na osoby',
            'Limity emerytalne — oddzielne karty IKE/IKZE/PPK dla Ciebie i partnera',
            'Budżet domowy — widzisz kto ile zarabia, wydaje i oszczędza w jednym widoku',
          ],
        },
        {
          title: 'Eksport danych',
          description: 'Eksportuj swoje dane finansowe w dowolnym formacie. Idealne do analizy w arkuszu kalkulacyjnym lub na potrzeby rozliczenia rocznego.',
          features: [
            'CSV — klasyczny format tabelaryczny, kompatybilny z Excelem, Google Sheets i innymi arkuszami',
            'XLSX — natywny format Excela z zachowaniem formatowania i formuł',
            'JSON — format surowych danych, przydatny dla programistów i automatyzacji',
            'Eksportuj wybrane dane — przychody, wydatki, kredyty lub oszczędności osobno',
            'Filtruj zakres dat — eksportuj dane z wybranego okresu',
          ],
        },
        {
          title: 'Plany i cennik',
          description: 'Wybierz plan, który najlepiej pasuje do Twoich potrzeb. Każdy plan odblokowuje pełen zestaw funkcji Premium — różnią się tylko okresem rozliczeniowym.',
          features: [
            'Plan miesięczny — elastyczność, możesz anulować w dowolnym momencie',
            'Plan roczny — oszczędzasz w porównaniu z planem miesięcznym',
            '7 dni za darmo — każdy nowy użytkownik otrzymuje 7-dniowy okres próbny z pełnym dostępem Premium',
            'Płatność przez Stripe — bezpieczna płatność kartą. Zarządzaj subskrypcją w portalu klienta.',
            'Anulowanie — możesz anulować w dowolnym momencie. Dostęp Premium działa do końca opłaconego okresu.',
          ],
        },
      ]}
    />
  );
}
