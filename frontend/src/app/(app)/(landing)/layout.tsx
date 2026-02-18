const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Czy moje dane finansowe są bezpieczne?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tak, bezpieczeństwo Twoich danych to nasz priorytet. Korzystamy z szyfrowania klasy bankowej (TLS 1.2+), a integracja z bankami odbywa się przez certyfikowanego dostawcę Tink, który spełnia wymogi PSD2. Twoje dane przechowywane są na serwerach w UE i nigdy nie sprzedajemy ich osobom trzecim.",
      },
    },
    {
      "@type": "Question",
      name: "Czy musicie znać moje hasło do banku?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nie! Nigdy nie prosimy o hasło do Twojego banku. Połączenie z bankiem odbywa się przez oficjalny interfejs API banku (Open Banking). Logowanie odbywa się bezpośrednio na stronie Twojego banku, a my otrzymujemy tylko dostęp do odczytu transakcji.",
      },
    },
    {
      "@type": "Question",
      name: "Mam bardzo duże długi. Czy ta metoda zadziała dla mnie?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Metoda Baby Steps została zaprojektowana właśnie dla osób z dużymi długami. Kluczem jest systematyczność, nie wielkość długu. Zaczynasz od małego funduszu awaryjnego (np. 1000 zł), potem spłacasz długi metodą kuli śnieżnej - od najmniejszego do największego. Tysiące osób spłaciło w ten sposób długi przekraczające 100 000 zł.",
      },
    },
    {
      "@type": "Question",
      name: "Co jeśli nie mogę sobie pozwolić na oszczędzanie?",
      acceptedAnswer: {
        "@type": "Answer",
        text: 'Rozumiemy - większość naszych użytkowników zaczynała w podobnej sytuacji. Dlatego pierwszy krok to analiza wydatków i znalezienie "wycieków" w budżecie. Nawet 50 zł miesięcznie to początek. Aplikacja pomoże Ci zidentyfikować obszary, gdzie możesz zaoszczędzić bez drastycznych zmian w stylu życia.',
      },
    },
    {
      "@type": "Question",
      name: "Czym różni się FiredUp od arkusza Excel lub innych aplikacji?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "FiredUp to nie tylko narzędzie do śledzenia wydatków - to kompletna metodologia budowania wolności finansowej. Otrzymujesz: automatyczne pobieranie transakcji z banku, spersonalizowany plan 7 Baby Steps, rekomendacje AI dopasowane do Twojej sytuacji, oraz wsparcie dla polskiego systemu finansowego (IKE, IKZE, PPK).",
      },
    },
    {
      "@type": "Question",
      name: "Co się stanie po zakończeniu okresu próbnego?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Po 7 dniach przechodzisz na darmowy plan z limitami: do 20 wydatków miesięcznie, 3 źródła przychodów, 3 kredyty i 3 cele oszczędnościowe. W trakcie okresu próbnego możesz wyeksportować wszystkie swoje dane (Excel, CSV, JSON) — Twoje dane zawsze należą do Ciebie. Możesz korzystać z darmowego planu bez ograniczeń czasowych. Płatne plany odblokowują brak limitów, integrację z bankiem, eksport danych, zaawansowaną analitykę AI i pełną metodologię Baby Steps z rekomendacjami.",
      },
    },
    {
      "@type": "Question",
      name: "Jak szybko zobaczę efekty?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pierwsze efekty - pełną kontrolę nad tym, gdzie idą Twoje pieniądze - zobaczysz już w pierwszym tygodniu. Fundusz awaryjny (np. 1000 zł) większość użytkowników buduje w 1-3 miesiące. Spłata długów zależy od ich wielkości, ale dzięki metodzie kuli śnieżnej każda spłacona rata motywuje do kolejnej. Kluczem jest konsekwencja, nie szybkość.",
      },
    },
    {
      "@type": "Question",
      name: "Czy mogę korzystać z aplikacji razem z partnerem/rodziną?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tak! W ustawieniach możesz zaprosić partnera do wspólnego budżetu domowego. Oboje widzicie te same dane, cele i postępy — wspólne zarządzanie finansami to klucz do sukcesu w związku. Każda osoba loguje się na własne konto Google, ale pracujecie na jednym budżecie.",
      },
    },
    {
      "@type": "Question",
      name: "Mam nieregularne dochody (freelancer/własna firma). Czy ta metoda zadziała?",
      acceptedAnswer: {
        "@type": "Answer",
        text: 'Tak, metoda Baby Steps świetnie sprawdza się przy nieregularnych dochodach - właściwie jest dla nich idealna. Kluczem jest budżetowanie w oparciu o "najgorszy miesiąc" i priorytetyzacja wydatków. Aplikacja pomoże Ci stworzyć bufor na miesiące z niższymi przychodami i zarządzać przepływem gotówki.',
      },
    },
    {
      "@type": "Question",
      name: "Ile kosztuje FiredUp?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Podstawowy plan jest darmowy na zawsze — możesz dodawać do 50 wydatków miesięcznie, 3 źródła przychodów, 5 kredytów i 5 celów oszczędnościowych. Plan Premium kosztuje 19,99 zł/miesiąc lub 199 zł/rok (oszczędzasz 17%). Premium odblokowuje brak limitów, integrację z bankiem, analizę AI i eksport danych. Każdy nowy użytkownik dostaje 7 dni Premium za darmo, bez podawania karty.",
      },
    },
    {
      "@type": "Question",
      name: "Czy FiredUp obsługuje PPK, IKE i IKZE?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tak! FiredUp został zaprojektowany z myślą o polskim systemie finansowym. Możesz śledzić swoje wpłaty i stan konta w PPK (Pracownicze Plany Kapitałowe), IKE i IKZE jako cele oszczędnościowe z dedykowanymi kategoriami. Aplikacja uwzględnia te produkty w kalkulacji Twojej wolności finansowej.",
      },
    },
    {
      "@type": "Question",
      name: "Czy jest aplikacja mobilna?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Aplikacja mobilna na iOS i Android jest w trakcie opracowywania i zostanie opublikowana niedługo. Będzie oferować logowanie przez Google oraz Face ID / Touch ID, z dostępem do wszystkich funkcji — dashboard, wydatki, kredyty, cele oszczędnościowe i metodę 7 Kroków — prosto z telefonu.",
      },
    },
    {
      "@type": "Question",
      name: "Czy mogę usunąć swoje konto i wszystkie dane?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oczywiście. W każdej chwili możesz usunąć swoje konto wraz ze wszystkimi danymi - wystarczy jedno kliknięcie w ustawieniach. Przed usunięciem możesz wyeksportować swoje dane. Usunięcie jest natychmiastowe i nieodwracalne, zgodnie z RODO masz pełną kontrolę nad swoimi danymi.",
      },
    },
  ],
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </div>
  );
}
