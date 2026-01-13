# Audyt UX/UI - FiredUp (SproutlyFi)

**Data audytu:** 13 stycznia 2026
**Audytor:** Claude (UX/UI Expert)
**Konto testowe:** elcukro@gmail.com (Łukasz Felsztukier)
**URL:** https://firedup.app

---

## Podsumowanie wykonawcze

Przeprowadzono kompleksowy audyt UX/UI wszystkich sekcji aplikacji FiredUp do zarządzania budżetem domowym. Przetestowano operacje CRUD (Create, Read, Update, Delete) w sekcjach Przychody, Wydatki, Kredyty i Oszczędności - wszystkie testy zakończyły się powodzeniem.

**Główne problemy wymagające natychmiastowej uwagi:**
- Błędne mapowanie danych - wartość nieruchomości (2 mln zł) wyświetlana jako fundusz awaryjny
- Widoczne klucze tłumaczeń zamiast przetłumaczonego tekstu
- Niespójność brandingu (SproutlyFi vs FiredUp)
- Literówka w stopce na wszystkich stronach

---

## Problemy globalne

### 1. Niespójność brandingu
- **Lokalizacja:** Cała aplikacja
- **Opis:** Logo wyświetla "SproutlyFi", ale copyright w stopce mówi "© 2026 FiredUp"
- **Priorytet:** Wysoki
- **Rekomendacja:** Ujednolicić branding w całej aplikacji

### 2. Literówka w stopce
- **Lokalizacja:** Stopka na wszystkich stronach
- **Opis:** "Polityka Prywatnosci" zamiast "Polityka Prywatności" (brak polskiego znaku diakrytycznego)
- **Priorytet:** Średni
- **Rekomendacja:** Poprawić na "Prywatności"

### 3. Brak symboli walutowych w formularzach
- **Lokalizacja:** Wszystkie formularze (Przychody, Wydatki, Kredyty, Oszczędności)
- **Opis:** Pola kwot nie mają przyrostka "zł" - użytkownik nie wie jakiej waluty używa
- **Priorytet:** Niski
- **Rekomendacja:** Dodać symbol "zł" do pól kwotowych

---

## Onboarding (7 kroków)

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | Pasek postępu pojawia się dopiero od kroku 2 | Niski | Pokazać pasek od początku (1/7) |
| 2 | Niespójne formatowanie liczb (spacje vs przecinki) | Średni | Ujednolicić format: "1 000,00 zł" |
| 3 | Skala priorytetów może być myląca (1=najniższy, 5=najwyższy) | Niski | Dodać wyjaśnienie "1 = najniższy" |

---

## Panel (Dashboard)

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | **BŁĄD:** Klucz tłumaczenia widoczny - "dashboard.activity.saving" | Wysoki | Dodać brakujące tłumaczenie |
| 2 | Rozbieżność danych - wydatki ~34k vs ~13k z onboardingu | Wysoki | Zbadać źródło rozbieżności |
| 3 | Anomalia styczniowa - ogromny skok wydatków na wykresie | Średni | Sprawdzić dane styczniowe |
| 4 | Gramatyka "ta minuta" vs "tę minutę" | Niski | Zweryfikować z native speakerem |

---

## Wolność Finansowa (7 Baby Steps)

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | **KRYTYCZNY:** Krok 3 pokazuje 2 000 000 zł jako fundusz awaryjny - to wartość nieruchomości! | Krytyczny | Naprawić mapowanie danych |
| 2 | Niespójność stylów przycisków - "Aktualizuj Postęp" vs "Oznacz jako Ukończony" | Niski | Ujednolicić wygląd przycisków |

**Szczegóły błędu krytycznego:**
Sekcja "Fundusz awaryjny" w Wolność Finansowa błędnie wyświetla wartość nieruchomości (Dom - 2 000 000 zł) jako fundusz awaryjny. Prawdziwy fundusz awaryjny to 50 000 zł (z sekcji Oszczędności).

---

## Przychody (Income)

### Test CRUD: ✅ ZALICZONY
- CREATE: Dodano nowy przychód - sukces
- READ: Przychód widoczny w tabeli - sukces
- UPDATE: Edycja przychodu - sukces
- DELETE: Usunięcie z potwierdzeniem - sukces

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | **BŁĄD:** "Świadczenia 800+ (limit {limit})" - placeholder nie został zastąpiony | Wysoki | Naprawić interpolację zmiennej |
| 2 | Dwie pozycje w kategorii "Inne" - mylące | Niski | Rozważyć bardziej szczegółowe kategorie |

---

## Wydatki (Expenses)

### Test CRUD: ✅ ZALICZONY
- CREATE: Dodano nowy wydatek - sukces
- READ: Wydatek widoczny w tabeli - sukces
- UPDATE: Edycja wydatku - sukces
- DELETE: Usunięcie z potwierdzeniem - sukces

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | Tekst angielski: "Recurring" i "One-off" zamiast polskich odpowiedników | Średni | Przetłumaczyć na "Cykliczny" i "Jednorazowy" |
| 2 | Kwoty wydatków w kolorze zielonym - nieintuicyjne | Średni | Użyć czerwonego/neutralnego dla wydatków |
| 3 | Kategoria "Inne" dominuje (70.7%) | Niski | Zachęcić do kategoryzacji |

---

## Kredyty (Loans)

### Test CRUD: ✅ ZALICZONY
- CREATE: Dodano nowy kredyt - sukces
- READ: Kredyt widoczny w karcie i tabeli - sukces
- UPDATE: Edycja kredytu - sukces
- DELETE: Usunięcie z potwierdzeniem - sukces

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | Niespójność routingu: URL to `/loans` ale sidebar mówi "Kredyty" | Niski | Rozważyć `/kredyty` dla spójności |
| 2 | Kwoty kredytów w kolorze ZIELONYM - nieintuicyjne dla zobowiązań | Średni | Użyć czerwonego/pomarańczowego dla długów |
| 3 | "Okres (miesiące)" domyślnie 1 - nierealistyczne dla kredytów | Niski | Zmienić domyślną wartość na np. 12 |
| 4 | Skrócony format daty: "13 paź 2032" | Niski | Rozważyć pełną nazwę miesiąca |
| 5 | Możliwy błąd: "Najbliższa rata" zmienia się po edycji | Średni | Zbadać logikę obliczania daty raty |

---

## Oszczędności (Savings)

### Test CRUD: ✅ ZALICZONY
- CREATE: Dodano nową oszczędność - sukces
- READ: Oszczędność widoczna w tabeli - sukces
- UPDATE: Edycja oszczędności - sukces
- DELETE: Usunięcie z potwierdzeniem - sukces

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | **BŁĄD:** Widoczny klucz tłumaczenia "savings.filters.dateRange.al" w filtrze | Wysoki | Dodać brakujące tłumaczenie |
| 2 | Mylący format funduszu awaryjnego: "50 000,00 zł / 1000,00 zł" | Średni | Wyjaśnić co oznacza druga liczba |
| 3 | "Dom" (2 mln zł) jako "Ogólne oszczędności" - nieruchomość to nie płynne oszczędności | Wysoki | Utworzyć oddzielną kategorię "Nieruchomości" |

---

## Raporty (Reports)

### Problemy znalezione:

| # | Problem | Priorytet | Rekomendacja |
|---|---------|-----------|--------------|
| 1 | Format waluty "PLN 23,000.00" zamiast "23 000,00 zł" | Średni | Ujednolicić z resztą aplikacji |
| 2 | Format liczb z kropkami zamiast polskiego formatu ze spacjami | Średni | Użyć "23 000,00" zamiast "23,000.00" |
| 3 | Anomalia styczniowa widoczna (-PLN 22,400) | Średni | Zbadać źródło dużych wydatków |

---

## Podsumowanie testów CRUD

| Sekcja | CREATE | READ | UPDATE | DELETE | Wynik |
|--------|--------|------|--------|--------|-------|
| Przychody | ✅ | ✅ | ✅ | ✅ | ZALICZONY |
| Wydatki | ✅ | ✅ | ✅ | ✅ | ZALICZONY |
| Kredyty | ✅ | ✅ | ✅ | ✅ | ZALICZONY |
| Oszczędności | ✅ | ✅ | ✅ | ✅ | ZALICZONY |

---

## Rekomendacje priorytetowe

### Krytyczne (naprawić natychmiast):
1. Naprawić mapowanie danych w Wolność Finansowa - fundusz awaryjny pokazuje wartość nieruchomości
2. Dodać brakujące tłumaczenia dla widocznych kluczy

### Wysokie (naprawić w najbliższym sprincie):
1. Naprawić placeholder `{limit}` w kategorii "Świadczenia 800+"
2. Ujednolicić branding (SproutlyFi vs FiredUp)
3. Utworzyć kategorię "Nieruchomości" w oszczędnościach

### Średnie (zaplanować):
1. Poprawić literówkę w stopce
2. Zmienić kolor wydatków i kredytów na bardziej intuicyjny
3. Przetłumaczyć "Recurring"/"One-off" na polski
4. Ujednolicić format liczb i walut w całej aplikacji

### Niskie (backlog):
1. Dodać symbole walut do pól formularzy
2. Poprawić domyślne wartości w formularzach
3. Rozważyć pełne nazwy miesięcy w datach

---

## Pozytywne aspekty

1. **Spójny design** - Kolory, typografia i layout są konsekwentne
2. **Responsywne okna modalne** - Formularze CRUD działają prawidłowo
3. **Potwierdzenia usunięcia** - Wszystkie operacje DELETE mają potwierdzenie
4. **Czytelne wykresy** - Wizualizacje w Raporty i Dashboard są przejrzyste
5. **Intuicyjna nawigacja** - Sidebar jest czytelny i funkcjonalny
6. **7 Baby Steps** - Ciekawa funkcjonalność oparta na metodologii Dave'a Ramseya

---

*Raport wygenerowany: 13 stycznia 2026*
