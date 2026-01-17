'use client';

import { useState } from 'react';
import { ChevronDown, Shield, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'security' | 'product' | 'debt';
}

const faqItems: FAQItem[] = [
  {
    category: 'security',
    question: 'Czy moje dane finansowe są bezpieczne?',
    answer: 'Tak, bezpieczeństwo Twoich danych to nasz priorytet. Korzystamy z szyfrowania bankowego (TLS 1.3), a integracja z bankami odbywa się przez certyfikowanego dostawcę Tink, który spełnia wymogi PSD2. Twoje dane przechowywane są na serwerach w UE i nigdy nie sprzedajemy ich osobom trzecim.',
  },
  {
    category: 'security',
    question: 'Czy musicie znać moje hasło do banku?',
    answer: 'Nie! Nigdy nie prosimy o hasło do Twojego banku. Połączenie z bankiem odbywa się przez oficjalny interfejs API banku (Open Banking). Logowanie odbywa się bezpośrednio na stronie Twojego banku, a my otrzymujemy tylko dostęp do odczytu transakcji.',
  },
  {
    category: 'debt',
    question: 'Mam bardzo duże długi. Czy ta metoda zadziała dla mnie?',
    answer: 'Metoda Baby Steps została zaprojektowana właśnie dla osób z dużymi długami. Kluczem jest systematyczność, nie wielkość długu. Zaczynasz od małego funduszu awaryjnego (1000 zł), potem spłacasz długi metodą kuli śnieżnej - od najmniejszego do największego. Tysiące osób spłaciło w ten sposób długi przekraczające 100 000 zł.',
  },
  {
    category: 'debt',
    question: 'Co jeśli nie mogę sobie pozwolić na oszczędzanie?',
    answer: 'Rozumiemy - większość naszych użytkowników zaczynała w podobnej sytuacji. Dlatego pierwszy krok to analiza wydatków i znalezienie "wycieków" w budżecie. Nawet 50 zł miesięcznie to początek. Aplikacja pomoże Ci zidentyfikować obszary, gdzie możesz zaoszczędzić bez drastycznych zmian w stylu życia.',
  },
  {
    category: 'product',
    question: 'Czym różni się FiredUp od arkusza Excel lub innych aplikacji?',
    answer: 'FiredUp to nie tylko narzędzie do śledzenia wydatków - to kompletna metodologia budowania wolności finansowej. Otrzymujesz: automatyczne pobieranie transakcji z banku, spersonalizowany plan 7 Baby Steps, rekomendacje AI dopasowane do Twojej sytuacji, oraz wsparcie dla polskiego systemu finansowego (IKE, IKZE, PPK).',
  },
  {
    category: 'product',
    question: 'Co się stanie po zakończeniu okresu próbnego?',
    answer: 'Po 7 dniach przechodzisz na darmowy plan, który pozwala śledzić podstawowe wydatki i przychody. Przed zmianą planu możesz wyeksportować wszystkie swoje dane (Excel, CSV, JSON) - Twoje dane zawsze należą do Ciebie. Możesz korzystać z darmowego planu bez ograniczeń czasowych. Płatne plany odblokowują integrację z bankiem, zaawansowaną analitykę AI i pełny dostęp do metodologii Baby Steps.',
  },
  {
    category: 'product',
    question: 'Jak szybko zobaczę efekty?',
    answer: 'Pierwsze efekty - pełną kontrolę nad tym, gdzie idą Twoje pieniądze - zobaczysz już w pierwszym tygodniu. Fundusz awaryjny (1000 zł) większość użytkowników buduje w 1-3 miesiące. Spłata długów zależy od ich wielkości, ale dzięki metodzie kuli śnieżnej każda spłacona rata motywuje do kolejnej. Kluczem jest konsekwencja, nie szybkość.',
  },
  {
    category: 'product',
    question: 'Czy mogę korzystać z aplikacji razem z partnerem/rodziną?',
    answer: 'Tak! Możesz udostępnić dostęp do konta partnerowi - wspólne zarządzanie budżetem to klucz do sukcesu finansowego w związku. Widzicie te same dane, cele i postępy. W przyszłości planujemy też dedykowane konta rodzinne z oddzielnymi widokami dla każdego członka rodziny.',
  },
  {
    category: 'debt',
    question: 'Mam nieregularne dochody (freelancer/własna firma). Czy ta metoda zadziała?',
    answer: 'Tak, metoda Baby Steps świetnie sprawdza się przy nieregularnych dochodach - właściwie jest dla nich idealna. Kluczem jest budżetowanie w oparciu o "najgorszy miesiąc" i priorytetyzacja wydatków. Aplikacja pomoże Ci stworzyć bufor na miesiące z niższymi przychodami i zarządzać przepływem gotówki.',
  },
  {
    category: 'security',
    question: 'Czy mogę usunąć swoje konto i wszystkie dane?',
    answer: 'Oczywiście. W każdej chwili możesz usunąć swoje konto wraz ze wszystkimi danymi - wystarczy jedno kliknięcie w ustawieniach. Przed usunięciem możesz wyeksportować swoje dane. Usunięcie jest natychmiastowe i nieodwracalne, zgodnie z RODO masz pełną kontrolę nad swoimi danymi.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-gradient-to-b from-emerald-50/30 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4 border border-emerald-200/50">
            <HelpCircle className="w-4 h-4" />
            Często zadawane pytania
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
            Masz pytania? Mamy odpowiedzi
          </h2>
          <p className="text-emerald-700/70 max-w-2xl mx-auto">
            Zebraliśmy najczęściej zadawane pytania o bezpieczeństwo, metodę Baby Steps i działanie aplikacji.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div
              key={index}
              className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl overflow-hidden transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  {item.category === 'security' && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                  <span className="font-medium text-emerald-900">{item.question}</span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-emerald-500 transition-transform duration-300 flex-shrink-0 ml-4 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-5 text-emerald-700/80 leading-relaxed">
                  {item.category === 'security' && item.question.includes('dane') && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 rounded-lg text-sm text-emerald-600">
                      <Shield className="w-4 h-4" />
                      <span>Dane przechowywane w UE, szyfrowanie bankowe</span>
                    </div>
                  )}
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-emerald-700/70">
            Nie znalazłeś odpowiedzi na swoje pytanie?{' '}
            <a
              href="mailto:kontakt@firedup.app"
              className="text-emerald-600 hover:text-emerald-700 underline underline-offset-4 font-medium"
            >
              Napisz do nas
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
