'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LEGAL_ENTITY, DATA_PROCESSORS, DATA_RETENTION } from '@/constants/legal';

interface LegalOverlayProps {
  type: 'privacy' | 'terms';
  onClose: () => void;
}

export default function LegalOverlay({ type, onClose }: LegalOverlayProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Content */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-emerald-100 bg-emerald-50/50 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-emerald-900">
              {type === 'privacy' ? 'Polityka Prywatności' : 'Regulamin Usługi'}
            </h2>
            <p className="text-sm text-emerald-600/60 mt-1">
              Ostatnia aktualizacja: {LEGAL_ENTITY.lastUpdated}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-emerald-100 transition-colors text-emerald-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-8 py-6 prose prose-sm max-w-none prose-emerald">
          {type === 'privacy' ? <PrivacyContent /> : <TermsContent />}

          {/* Close link */}
          <div className="mt-8 pt-4 border-t border-emerald-100 text-center">
            <button
              onClick={onClose}
              className="text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Administrator Danych</h2>
        <p>
          Administratorem Twoich danych osobowych jest <strong>{LEGAL_ENTITY.legalName}</strong>,
          prowadzący działalność pod marką <strong>{LEGAL_ENTITY.name}</strong>
          (dalej: &quot;Administrator&quot;, &quot;my&quot;, &quot;nas&quot;).
        </p>
        <p className="mt-2">
          <strong>Dane kontaktowe Administratora:</strong>
        </p>
        <ul className="list-none space-y-1 mt-2">
          <li>Adres: {LEGAL_ENTITY.address.street}, {LEGAL_ENTITY.address.postalCode} {LEGAL_ENTITY.address.city}, {LEGAL_ENTITY.address.country}</li>
          <li>NIP: {LEGAL_ENTITY.nip}</li>
          <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-emerald-600">{LEGAL_ENTITY.email.privacy}</a></li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Jakie dane zbieramy</h2>
        <p>W ramach korzystania z aplikacji FiredUp zbieramy następujące dane:</p>

        <h3 className="text-lg font-medium mt-4 mb-2">2.1 Dane konta</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Adres e-mail (do logowania i komunikacji)</li>
          <li>Preferencje użytkownika (język, waluta)</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-2">2.2 Dane finansowe wprowadzane ręcznie</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Wydatki i przychody</li>
          <li>Kategorie transakcji</li>
          <li>Cele oszczędnościowe</li>
          <li>Informacje o pożyczkach</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-2">2.3 Dane bankowe (przez Tink)</h3>
        <p>
          Jeżeli zdecydujesz się połączyć swoje konto bankowe, uzyskujemy dostęp do następujących danych
          za pośrednictwem usługi <strong>Tink AB</strong> (licencjonowany dostawca usług płatniczych):
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Lista kont bankowych (numer IBAN, nazwa konta)</li>
          <li>Salda kont</li>
          <li>Historia transakcji (data, kwota, opis, kategoria)</li>
        </ul>
        <p className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <strong>Ważne:</strong> Nie mamy dostępu do Twoich danych logowania do banku.
          Logowanie odbywa się bezpośrednio na stronie Twojego banku za pośrednictwem bezpiecznego
          interfejsu Tink Link. Nie przechowujemy haseł ani PIN-ów.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">3. Cel przetwarzania danych</h2>
        <p>Twoje dane przetwarzamy w następujących celach:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Świadczenie usługi</strong> - umożliwienie korzystania z aplikacji do zarządzania budżetem domowym</li>
          <li><strong>Agregacja danych bankowych</strong> - automatyczne pobieranie transakcji z Twojego banku (za Twoją zgodą)</li>
          <li><strong>Analiza finansowa</strong> - generowanie raportów, wykresów i statystyk Twoich finansów</li>
          <li><strong>Komunikacja</strong> - wysyłanie ważnych informacji o koncie i usłudze</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">4. Podstawa prawna przetwarzania (RODO)</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Art. 6 ust. 1 lit. b RODO</strong> - przetwarzanie jest niezbędne do wykonania umowy (świadczenie usługi aplikacji)</li>
          <li><strong>Art. 6 ust. 1 lit. a RODO</strong> - Twoja zgoda na dostęp do danych bankowych (możesz ją wycofać w każdej chwili)</li>
          <li><strong>Art. 6 ust. 1 lit. f RODO</strong> - prawnie uzasadniony interes Administratora (bezpieczeństwo i rozwój usługi)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">5. Tink - dostawca usług bankowych</h2>
        <p>
          Do pobierania danych z Twojego banku korzystamy z usługi <strong>Tink AB</strong>,
          licencjonowanego dostawcy usług płatniczych (AISP) regulowanego przez:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Finansinspektionen (Szwecja)</li>
          <li>Financial Conduct Authority (Wielka Brytania)</li>
        </ul>
        <p className="mt-2">
          Tink jest częścią Visa Inc. i spełnia najwyższe standardy bezpieczeństwa (SOC 2 Type II, ISO 27001).
        </p>
        <p className="mt-2">
          Więcej informacji o Tink: <a href="https://tink.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600">tink.com</a>
        </p>
        <p className="mt-2">
          Polityka prywatności Tink: <a href="https://tink.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-emerald-600">tink.com/legal/privacy-policy</a>
        </p>

        <h3 className="text-lg font-medium mt-6 mb-2">5.1 Cykl życia danych bankowych</h3>
        <p>Poniżej opisujemy jak Twoje dane bankowe przepływają przez nasz system:</p>

        <h4 className="font-medium mt-3 mb-1">Zbieranie danych</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>Autoryzujesz dostęp do banku przez bezpieczny interfejs Tink Link</li>
          <li>Tink pobiera dane o kontach, saldach i transakcjach bezpośrednio z Twojego banku</li>
          <li>FiredUp otrzymuje te dane przez zabezpieczone API Tink</li>
        </ul>

        <h4 className="font-medium mt-3 mb-1">Przetwarzanie danych</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>Transakcje bankowe są automatycznie kategoryzowane i konwertowane na wydatki/przychody w aplikacji</li>
          <li>Możesz ręcznie edytować lub usuwać przetworzone transakcje</li>
          <li>Oryginalne dane z banku są przechowywane oddzielnie od przetworzonych danych</li>
        </ul>

        <h4 className="font-medium mt-3 mb-1">Przechowywanie danych</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>Surowe dane bankowe: przechowywane do rozłączenia banku lub usunięcia konta</li>
          <li>Przetworzone wydatki/przychody: przechowywane do ręcznego usunięcia lub usunięcia konta</li>
          <li>Tokeny: krótkotrwałe (1 godzina), automatycznie odświeżane w tle</li>
        </ul>

        <h4 className="font-medium mt-3 mb-1">Usuwanie danych</h4>
        <ul className="list-disc pl-6 space-y-1">
          <li>Przy rozłączeniu banku: surowe dane bankowe usuwane w ciągu 30 dni</li>
          <li>Przy usunięciu konta: wszystkie dane (surowe i przetworzone) usuwane w ciągu 30 dni</li>
          <li>Na żądanie użytkownika (RODO): wszystkie dane usuwane w ciągu 30 dni</li>
        </ul>

        <h4 className="font-medium mt-3 mb-1">Synchronizacja danych</h4>
        <p className="mt-1">
          Dane bankowe są synchronizowane automatycznie raz dziennie oraz na żądanie użytkownika.
          Synchronizacja pobiera transakcje z ostatnich 90 dni (lub od ostatniej synchronizacji, jeśli krócej).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">6. Udostępnianie danych</h2>
        <p>Twoje dane mogą być udostępniane następującym podmiotom:</p>
        <ul className="list-disc pl-6 space-y-1">
          {DATA_PROCESSORS.map((processor) => (
            <li key={processor.name}>
              <strong>{processor.name}</strong> - {processor.purpose} ({processor.location})
            </li>
          ))}
          <li><strong>Organy państwowe</strong> - tylko gdy wymagają tego przepisy prawa</li>
        </ul>
        <p className="mt-2 font-medium">
          Nie sprzedajemy Twoich danych osobowych podmiotom trzecim.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">7. Okres przechowywania danych</h2>

        <h3 className="text-lg font-medium mt-4 mb-2">7.1 Dane konta i finansów</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Dane konta użytkownika</strong> - {DATA_RETENTION.accountData}</li>
          <li><strong>Dane finansowe (ręcznie wprowadzone)</strong> - {DATA_RETENTION.financialData}</li>
          <li><strong>Dane analityczne</strong> - {DATA_RETENTION.analyticsData}</li>
        </ul>

        <h3 className="text-lg font-medium mt-4 mb-2">7.2 Dane bankowe (Tink)</h3>
        <div className="overflow-x-auto mt-2">
          <table className="min-w-full border-collapse border border-emerald-200 text-sm">
            <thead>
              <tr className="bg-emerald-50">
                <th className="border border-emerald-200 px-3 py-2 text-left">Rodzaj danych</th>
                <th className="border border-emerald-200 px-3 py-2 text-left">Okres przechowywania</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-emerald-200 px-3 py-2">Surowe dane bankowe (konta, transakcje, salda)</td>
                <td className="border border-emerald-200 px-3 py-2">{DATA_RETENTION.bankingData}</td>
              </tr>
              <tr>
                <td className="border border-emerald-200 px-3 py-2">Przetworzone transakcje (wydatki/przychody utworzone z banku)</td>
                <td className="border border-emerald-200 px-3 py-2">{DATA_RETENTION.processedBankingData}</td>
              </tr>
              <tr>
                <td className="border border-emerald-200 px-3 py-2">Tokeny dostępu Tink</td>
                <td className="border border-emerald-200 px-3 py-2">{DATA_RETENTION.tinkAccessTokens}</td>
              </tr>
              <tr>
                <td className="border border-emerald-200 px-3 py-2">Tokeny odświeżające Tink</td>
                <td className="border border-emerald-200 px-3 py-2">{DATA_RETENTION.tinkRefreshTokens}</td>
              </tr>
              <tr>
                <td className="border border-emerald-200 px-3 py-2">Logi operacji bankowych</td>
                <td className="border border-emerald-200 px-3 py-2">{DATA_RETENTION.tinkAuditLogs}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-medium mt-4 mb-2">7.3 Co wywołuje usunięcie danych bankowych</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Rozłączenie banku</strong> - surowe dane bankowe (konta, transakcje z Tink) są usuwane w ciągu 30 dni. Przetworzone wydatki/przychody pozostają.</li>
          <li><strong>Usunięcie konta</strong> - wszystkie dane użytkownika, w tym dane bankowe i przetworzone transakcje, są usuwane.</li>
          <li><strong>Żądanie użytkownika (RODO Art. 17)</strong> - {DATA_RETENTION.deletionTimeline}</li>
        </ul>

        <p className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <strong>Uwaga:</strong> Wygaśnięcie tokenów dostępu nie oznacza usunięcia danych - oznacza jedynie,
          że aplikacja nie może pobierać nowych danych z banku do momentu ponownej autoryzacji.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">8. Twoje prawa (RODO)</h2>
        <p>Przysługują Ci następujące prawa:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Prawo dostępu</strong> - możesz żądać kopii swoich danych</li>
          <li><strong>Prawo do sprostowania</strong> - możesz poprawić nieprawidłowe dane</li>
          <li><strong>Prawo do usunięcia</strong> - możesz żądać usunięcia swoich danych (&quot;prawo do bycia zapomnianym&quot;)</li>
          <li><strong>Prawo do ograniczenia przetwarzania</strong> - możesz ograniczyć sposób wykorzystania danych</li>
          <li><strong>Prawo do przenoszenia danych</strong> - możesz pobrać swoje dane w formacie maszynowym</li>
          <li><strong>Prawo do sprzeciwu</strong> - możesz sprzeciwić się przetwarzaniu danych</li>
          <li><strong>Prawo do wycofania zgody</strong> - możesz w każdej chwili wycofać zgodę na dostęp do danych bankowych</li>
        </ul>

        <h3 className="text-lg font-medium mt-6 mb-2">8.1 Eksport danych bankowych</h3>
        <p>Możesz wyeksportować swoje dane bankowe w następujący sposób:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>W aplikacji:</strong> Ustawienia → Eksport danych - otrzymasz plik z wszystkimi swoimi transakcjami w formacie CSV lub JSON</li>
          <li><strong>Na żądanie:</strong> Skontaktuj się z nami pod adresem <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-emerald-600">{LEGAL_ENTITY.email.privacy}</a> - przygotujemy pełną kopię Twoich danych w ciągu 30 dni</li>
        </ul>

        <h3 className="text-lg font-medium mt-6 mb-2">8.2 Usunięcie danych bankowych</h3>
        <p>Masz kilka opcji usunięcia danych bankowych:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Rozłączenie pojedynczego banku (w aplikacji):</strong> Ustawienia → Połączenia bankowe → Rozłącz.
            Usuwa dane tylko dla wybranego banku. Inne połączone banki pozostają bez zmian.
          </li>
          <li>
            <strong>Cofnięcie zgody przez Tink:</strong> <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-emerald-600">tink.com/consumer/revocation</a>.
            Możesz cofnąć zgodę bezpośrednio u Tink, co spowoduje rozłączenie banku w naszej aplikacji.
          </li>
          <li>
            <strong>Pełne usunięcie danych (RODO Art. 17):</strong> Skontaktuj się z nami pod adresem <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-emerald-600">{LEGAL_ENTITY.email.privacy}</a>.
            Usuniemy WSZYSTKIE Twoje dane (w tym przetworzone wydatki/przychody) w ciągu 30 dni.
          </li>
          <li>
            <strong>Usunięcie konta:</strong> Ustawienia → Usuń konto.
            Powoduje usunięcie wszystkich danych użytkownika, w tym danych bankowych i przetworzonych transakcji.
          </li>
        </ul>

        <p className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <strong>Ważne rozróżnienie:</strong> Rozłączenie banku usuwa <em>surowe dane bankowe</em> (konta, transakcje z Tink),
          ale <em>przetworzone wydatki i przychody</em> utworzone z tych danych pozostają w aplikacji do ręcznego usunięcia.
          Jeśli chcesz usunąć wszystko, skorzystaj z opcji &quot;Pełne usunięcie danych&quot; lub &quot;Usuń konto&quot;.
        </p>

        <p className="mt-4">
          Aby skorzystać z tych praw, skontaktuj się z nami: <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-emerald-600">{LEGAL_ENTITY.email.privacy}</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">9. Wycofanie zgody na dostęp do banku</h2>
        <p>Możesz w każdej chwili wycofać zgodę na dostęp do danych bankowych:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>W aplikacji:</strong> Ustawienia → Połączenia bankowe → Rozłącz</li>
          <li><strong>Przez Tink:</strong> <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-emerald-600">tink.com/consumer/revocation</a></li>
        </ul>
        <p className="mt-2">
          Po wycofaniu zgody przestaniemy pobierać dane z Twojego banku. Dane już pobrane pozostaną
          w aplikacji do momentu ich ręcznego usunięcia lub usunięcia konta.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">10. Bezpieczeństwo danych</h2>
        <p>Stosujemy następujące środki bezpieczeństwa:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Szyfrowanie połączeń (HTTPS/TLS)</li>
          <li>Bezpieczne przechowywanie tokenów dostępu</li>
          <li>Regularne kopie zapasowe</li>
          <li>Ograniczony dostęp do danych (tylko upoważniony personel)</li>
          <li>Monitoring bezpieczeństwa</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">11. Pliki cookies</h2>
        <p>
          Aplikacja używa niezbędnych plików cookies do działania (sesja logowania, preferencje).
          Opcjonalnie używamy cookies analitycznych (PostHog) - możesz wyrazić na nie zgodę
          lub odmówić przy pierwszej wizycie.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">12. Zmiany w polityce prywatności</h2>
        <p>
          Możemy aktualizować niniejszą politykę prywatności. O istotnych zmianach poinformujemy
          Cię drogą mailową lub przez powiadomienie w aplikacji.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">13. Skargi</h2>
        <p>
          Jeżeli uważasz, że przetwarzamy Twoje dane niezgodnie z prawem, masz prawo złożyć skargę
          do organu nadzorczego:
        </p>
        <p className="mt-2">
          <strong>Prezes Urzędu Ochrony Danych Osobowych (PUODO)</strong><br />
          ul. Stawki 2, 00-193 Warszawa<br />
          <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer" className="text-emerald-600">uodo.gov.pl</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">14. Kontakt</h2>
        <p>
          W sprawach związanych z ochroną danych osobowych możesz skontaktować się z nami:
        </p>
        <ul className="list-none space-y-1 mt-2">
          <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-emerald-600">{LEGAL_ENTITY.email.privacy}</a></li>
          <li>Strona: <a href={LEGAL_ENTITY.website} className="text-emerald-600">{LEGAL_ENTITY.website.replace('https://', '')}</a></li>
        </ul>
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Postanowienia ogólne</h2>
        <p>
          1.1. Niniejszy Regulamin określa zasady korzystania z aplikacji <strong>FiredUp</strong>
          (dalej: &quot;Aplikacja&quot;, &quot;Usługa&quot;) dostępnej pod adresem firedup.app.
        </p>
        <p>
          1.2. Usługodawca: <strong>{LEGAL_ENTITY.legalName}</strong>, prowadzący działalność pod marką <strong>{LEGAL_ENTITY.name}</strong>
          (dalej: &quot;Usługodawca&quot;, &quot;my&quot;).
        </p>
        <p className="mt-2">
          <strong>Dane Usługodawcy:</strong>
        </p>
        <ul className="list-none space-y-1 mt-2 mb-4">
          <li>Adres: {LEGAL_ENTITY.address.street}, {LEGAL_ENTITY.address.postalCode} {LEGAL_ENTITY.address.city}, {LEGAL_ENTITY.address.country}</li>
          <li>NIP: {LEGAL_ENTITY.nip}</li>
          <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.contact}`} className="text-emerald-600">{LEGAL_ENTITY.email.contact}</a></li>
        </ul>
        <p>
          1.3. Użytkownik: osoba fizyczna korzystająca z Aplikacji (dalej: &quot;Użytkownik&quot;, &quot;Ty&quot;).
        </p>
        <p>
          1.4. Korzystanie z Aplikacji oznacza akceptację niniejszego Regulaminu oraz Polityki Prywatności.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">2. Opis Usługi</h2>
        <p>
          2.1. FiredUp to aplikacja do zarządzania budżetem domowym, która umożliwia:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Ręczne wprowadzanie wydatków i przychodów</li>
          <li>Kategoryzację transakcji</li>
          <li>Śledzenie celów oszczędnościowych</li>
          <li>Generowanie raportów finansowych</li>
          <li>Automatyczne pobieranie transakcji z kont bankowych (opcjonalnie)</li>
        </ul>
        <p>
          2.2. Usługa ma charakter informacyjny i pomocniczy. Nie stanowi doradztwa finansowego,
          podatkowego ani inwestycyjnego.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">3. Rejestracja i konto</h2>
        <p>
          3.1. Korzystanie z Aplikacji wymaga utworzenia konta za pomocą adresu e-mail lub
          logowania przez dostawcę tożsamości (Google, itp.).
        </p>
        <p>
          3.2. Użytkownik zobowiązuje się do:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Podania prawdziwych danych</li>
          <li>Zachowania poufności danych logowania</li>
          <li>Niezwłocznego powiadomienia o nieautoryzowanym dostępie do konta</li>
        </ul>
        <p>
          3.3. Jedno konto może być używane tylko przez jedną osobę.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">4. Połączenie z bankiem (Tink)</h2>
        <p>
          4.1. Aplikacja umożliwia opcjonalne połączenie konta bankowego w celu automatycznego
          pobierania transakcji.
        </p>
        <p>
          4.2. Usługa połączenia z bankiem jest realizowana przez <strong>Tink AB</strong>,
          licencjonowanego dostawcę usług płatniczych (AISP) regulowanego przez Finansinspektionen (Szwecja).
        </p>
        <p>
          4.3. Łącząc konto bankowe, Użytkownik:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Wyraża zgodę na dostęp do danych konta (lista kont, salda, transakcje)</li>
          <li>Akceptuje <a href="https://tink.com/legal/end-user-terms" target="_blank" rel="noopener noreferrer" className="text-emerald-600">Warunki Tink dla Użytkowników Końcowych</a></li>
          <li>Rozumie, że logowanie odbywa się bezpośrednio na stronie banku</li>
        </ul>
        <p>
          4.4. Użytkownik może w każdej chwili rozłączyć konto bankowe w Ustawieniach aplikacji
          lub przez <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-emerald-600">portal Tink</a>.
        </p>
        <p>
          4.5. Nie przechowujemy danych logowania do banku (haseł, PIN-ów).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">5. Zasady korzystania</h2>
        <p>5.1. Użytkownik zobowiązuje się do:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Korzystania z Aplikacji zgodnie z prawem i dobrymi obyczajami</li>
          <li>Niepodejmowania prób obejścia zabezpieczeń</li>
          <li>Nieużywania Aplikacji do celów niezgodnych z prawem</li>
          <li>Nieprzeciążania infrastruktury Aplikacji</li>
        </ul>
        <p>5.2. Zabrania się:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Udostępniania konta osobom trzecim</li>
          <li>Automatycznego pobierania danych (scraping) bez zgody</li>
          <li>Reverse engineeringu Aplikacji</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">6. Odpowiedzialność</h2>
        <p>
          6.1. Usługodawca dokłada staranności, aby Aplikacja działała poprawnie, jednak nie
          gwarantuje nieprzerwanej dostępności ani braku błędów.
        </p>
        <p>
          6.2. Usługodawca nie ponosi odpowiedzialności za:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Decyzje finansowe podjęte na podstawie danych z Aplikacji</li>
          <li>Błędy w danych pobranych z banków (źródłem są systemy bankowe)</li>
          <li>Przerwy w działaniu spowodowane czynnikami zewnętrznymi</li>
          <li>Utratę danych spowodowaną działaniem Użytkownika</li>
          <li>Działania lub zaniechania Tink AB</li>
        </ul>
        <p>
          6.3. Aplikacja jest udostępniana &quot;tak jak jest&quot; (as is). Użytkownik korzysta z niej
          na własną odpowiedzialność.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">7. Własność intelektualna</h2>
        <p>
          7.1. Wszelkie prawa do Aplikacji, w tym kod źródłowy, design i znaki towarowe,
          należą do Usługodawcy.
        </p>
        <p>
          7.2. Użytkownik otrzymuje ograniczoną, niewyłączną licencję na korzystanie z Aplikacji
          do celów osobistych.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">8. Ochrona danych osobowych</h2>
        <p>
          8.1. Zasady przetwarzania danych osobowych określone są w Polityce Prywatności.
        </p>
        <p>
          8.2. Użytkownik ma prawo dostępu, sprostowania, usunięcia i przenoszenia swoich danych
          zgodnie z RODO.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">9. Zmiany Regulaminu</h2>
        <p>
          9.1. Usługodawca może zmieniać niniejszy Regulamin.
        </p>
        <p>
          9.2. O istotnych zmianach Użytkownik zostanie powiadomiony drogą mailową lub
          przez powiadomienie w Aplikacji.
        </p>
        <p>
          9.3. Dalsze korzystanie z Aplikacji po wprowadzeniu zmian oznacza ich akceptację.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">10. Usunięcie konta</h2>
        <p>
          10.1. Użytkownik może w każdej chwili usunąć swoje konto kontaktując się z nami
          lub przez funkcję w Ustawieniach (jeśli dostępna).
        </p>
        <p>
          10.2. Usunięcie konta skutkuje trwałym usunięciem wszystkich danych Użytkownika.
        </p>
        <p>
          10.3. Usługodawca może usunąć konto Użytkownika w przypadku naruszenia Regulaminu.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">11. Postanowienia końcowe</h2>
        <p>
          11.1. Regulamin podlega prawu polskiemu.
        </p>
        <p>
          11.2. Spory będą rozstrzygane przez sądy powszechne właściwe dla siedziby Usługodawcy.
        </p>
        <p>
          11.3. Jeżeli jakiekolwiek postanowienie Regulaminu okaże się nieważne, pozostałe
          postanowienia pozostają w mocy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">12. Kontakt</h2>
        <p>
          W sprawach związanych z Regulaminem możesz skontaktować się z nami:
        </p>
        <ul className="list-none space-y-1 mt-2">
          <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.contact}`} className="text-emerald-600">{LEGAL_ENTITY.email.contact}</a></li>
          <li>Strona: <a href={LEGAL_ENTITY.website} className="text-emerald-600">{LEGAL_ENTITY.website.replace('https://', '')}</a></li>
        </ul>
      </section>
    </>
  );
}
