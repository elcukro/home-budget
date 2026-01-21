/**
 * Educational content cards for "For You" section
 *
 * Content about FIRE (Financial Independence, Retire Early),
 * budgeting, and personal finance in Polish.
 */

export type ContentType = 'read' | 'watch' | 'interactive';

export interface EducationCard {
  id: string;
  title: string;
  subtitle: string;
  /** Emoji to display as illustration placeholder */
  emoji: string;
  /** Image source for illustration (optional, falls back to emoji) */
  image?: number;
  /** Reading/watching time in minutes */
  duration: number;
  type: ContentType;
  /** External URL (YouTube, article, etc.) */
  url?: string;
  /** Short content for in-app display */
  content?: string;
  /** Tags for filtering/categorization */
  tags: string[];
  /** Background color for card */
  backgroundColor: string;
  /** Text color for card */
  accentColor: string;
}

// Image imports
export const EDUCATION_IMAGES = {
  'fire-basics': require('@/assets/illustrations/education/edu-fire-basics.png'),
  'compound-interest': require('@/assets/illustrations/education/edu-compound-interest.png'),
  'emergency-fund': require('@/assets/illustrations/education/edu-emergency-fund.png'),
  'debt-snowball': require('@/assets/illustrations/education/edu-debt-snowball.png'),
  'budgeting-basics': require('@/assets/illustrations/education/edu-budgeting.png'),
  'investing-start': require('@/assets/illustrations/education/edu-investing.png'),
} as const;

export const EDUCATION_CARDS: EducationCard[] = [
  {
    id: 'fire-basics',
    title: 'Podstawy FIRE',
    subtitle: 'Poznaj metodę finansowej niezależności',
    emoji: '🔥',
    image: EDUCATION_IMAGES['fire-basics'],
    duration: 4,
    type: 'read',
    content: `FIRE (Financial Independence, Retire Early) to ruch skupiający ludzi dążących do finansowej wolności.

**Główne zasady:**
- Oszczędzaj 50-70% swoich dochodów
- Inwestuj w tanie fundusze indeksowe
- Unikaj długów konsumpcyjnych
- Żyj poniżej swoich możliwości

**Twoja liczba FIRE** to kwota, która pozwoli Ci żyć z odsetek:
Roczne wydatki × 25 = Twoja liczba FIRE

Przykład: 60 000 zł × 25 = 1 500 000 zł`,
    tags: ['fire', 'podstawy', 'oszczędności'],
    backgroundColor: '#fff7ed',
    accentColor: '#f97316',
  },
  {
    id: 'compound-interest',
    title: 'Magia procentu składanego',
    subtitle: 'Twój najlepszy przyjaciel w inwestowaniu',
    emoji: '📈',
    image: EDUCATION_IMAGES['compound-interest'],
    duration: 3,
    type: 'read',
    content: `Procent składany sprawia, że Twoje pieniądze zarabiają pieniądze, które zarabiają kolejne pieniądze.

**Przykład:**
- Wpłacasz 1000 zł miesięcznie
- Średni zwrot 7% rocznie
- Po 10 latach: ~173 000 zł
- Po 20 latach: ~520 000 zł
- Po 30 latach: ~1 220 000 zł

**Zasada 72:**
Podziel 72 przez roczną stopę zwrotu, a otrzymasz liczbę lat potrzebną do podwojenia kapitału.

72 ÷ 7% = ~10 lat do podwojenia`,
    tags: ['inwestowanie', 'podstawy', 'matematyka'],
    backgroundColor: '#dcfce7',
    accentColor: '#22c55e',
  },
  {
    id: 'emergency-fund',
    title: 'Fundusz awaryjny',
    subtitle: 'Pierwszy krok do finansowej wolności',
    emoji: '🛡️',
    image: EDUCATION_IMAGES['emergency-fund'],
    duration: 2,
    type: 'read',
    content: `Fundusz awaryjny to Twoja finansowa poduszka bezpieczeństwa.

**Ile oszczędzić?**
- Minimum: 3 miesiące wydatków
- Optimum: 6 miesięcy wydatków
- Dla samozatrudnionych: 9-12 miesięcy

**Gdzie trzymać?**
- Konto oszczędnościowe z łatwym dostępem
- Nie na lokacie z karą za wcześniejsze zerwanie
- Osobne konto, nie na codzienne wydatki

**Kiedy użyć?**
✅ Nagła naprawa samochodu
✅ Utrata pracy
✅ Nagły wydatek medyczny
❌ Nowy telefon
❌ Wakacje`,
    tags: ['oszczędności', 'podstawy', 'bezpieczeństwo'],
    backgroundColor: '#e0f2fe',
    accentColor: '#0ea5e9',
  },
  {
    id: 'debt-snowball',
    title: 'Metoda śnieżnej kuli',
    subtitle: 'Jak szybko spłacić długi',
    emoji: '⛄',
    image: EDUCATION_IMAGES['debt-snowball'],
    duration: 3,
    type: 'read',
    content: `Metoda śnieżnej kuli Dave'a Ramseya polega na spłacaniu długów od najmniejszego do największego.

**Jak to działa?**
1. Wypisz wszystkie długi od najmniejszego do największego
2. Płać minimum na wszystkie oprócz najmniejszego
3. Na najmniejszy dług wrzucaj wszystko co możesz
4. Gdy spłacisz najmniejszy, dodaj jego ratę do następnego
5. "Śnieżna kula" rośnie z każdym spłaconym długiem

**Dlaczego działa?**
- Szybkie wygrane motywują
- Widzisz postęp od razu
- Buduje nawyk spłacania

**Alternatywa:** Metoda lawiny (od najwyższego oprocentowania) - matematycznie lepsza, ale trudniejsza psychologicznie.`,
    tags: ['długi', 'spłata', 'ramsey'],
    backgroundColor: '#f3e8ff',
    accentColor: '#8b5cf6',
  },
  {
    id: 'budgeting-basics',
    title: 'Budżetowanie bez bólu',
    subtitle: 'Prostsze niż myślisz',
    emoji: '📊',
    image: EDUCATION_IMAGES['budgeting-basics'],
    duration: 3,
    type: 'read',
    content: `Budżet to plan wydawania pieniędzy, nie ograniczenie wolności.

**Zasada 50/30/20:**
- 50% na potrzeby (mieszkanie, jedzenie, transport)
- 30% na zachcianki (rozrywka, restauracje, hobby)
- 20% na oszczędności i spłatę długów

**Zero-Based Budget:**
Każda złotówka ma przypisane zadanie. Przychody - Wydatki = 0

**Wskazówki:**
- Zaczynaj od stałych wydatków
- Planuj wydatki sezonowe (ubezpieczenie, prezenty)
- Zostaw bufor na niespodzianki
- Przeglądaj budżet co tydzień

**Pamiętaj:** Budżet to Twój przyjaciel, nie wróg!`,
    tags: ['budżet', 'podstawy', 'planowanie'],
    backgroundColor: '#fef3c7',
    accentColor: '#d97706',
  },
  {
    id: 'investing-start',
    title: 'Zacznij inwestować',
    subtitle: 'Przewodnik dla początkujących',
    emoji: '💹',
    image: EDUCATION_IMAGES['investing-start'],
    duration: 5,
    type: 'read',
    url: 'https://www.youtube.com/watch?v=example',
    content: `Inwestowanie to kupowanie aktywów, które mają rosnąć na wartości lub generować dochód.

**Podstawowe zasady:**
1. Najpierw fundusz awaryjny
2. Spłać drogie długi (karty kredytowe)
3. Zacznij od małych kwot
4. Regularnie, nie jednorazowo
5. Dywersyfikuj

**Gdzie inwestować w Polsce?**
- IKE/IKZE (ulga podatkowa!)
- ETF-y na GPW lub zagraniczne
- PPK (jeśli masz dopłatę pracodawcy)

**Czego unikać na początku:**
❌ Pojedynczych akcji
❌ Kryptowalut za więcej niż "funny money"
❌ "Pewnych" tipów od znajomych
❌ Lewarowanych instrumentów`,
    tags: ['inwestowanie', 'początkujący', 'etf'],
    backgroundColor: '#dbeafe',
    accentColor: '#3b82f6',
  },
];

/**
 * Get cards by tag
 */
export function getCardsByTag(tag: string): EducationCard[] {
  return EDUCATION_CARDS.filter((card) => card.tags.includes(tag));
}

/**
 * Get card by ID
 */
export function getCardById(id: string): EducationCard | undefined {
  return EDUCATION_CARDS.find((card) => card.id === id);
}

/**
 * Get random cards
 */
export function getRandomCards(count: number): EducationCard[] {
  const shuffled = [...EDUCATION_CARDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Content type icons
 */
export const CONTENT_TYPE_CONFIG: Record<ContentType, { icon: string; label: string }> = {
  read: { icon: '📖', label: 'Czytaj' },
  watch: { icon: '🎬', label: 'Obejrzyj' },
  interactive: { icon: '🎮', label: 'Interaktywne' },
};
