"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LEGAL_ENTITY, DATA_PROCESSORS, DATA_RETENTION } from "@/constants/legal";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Polityka Prywatności</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ostatnia aktualizacja: {LEGAL_ENTITY.lastUpdated}
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">

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
              <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-primary">{LEGAL_ENTITY.email.privacy}</a></li>
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
            <p className="mt-2 p-3 bg-muted rounded">
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
              <li>
                <strong>Art. 6 ust. 1 lit. b RODO</strong> - przetwarzanie jest niezbędne do wykonania umowy
                (świadczenie usługi aplikacji)
              </li>
              <li>
                <strong>Art. 6 ust. 1 lit. a RODO</strong> - Twoja zgoda na dostęp do danych bankowych
                (możesz ją wycofać w każdej chwili)
              </li>
              <li>
                <strong>Art. 6 ust. 1 lit. f RODO</strong> - prawnie uzasadniony interes Administratora
                (bezpieczeństwo i rozwój usługi)
              </li>
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
              Więcej informacji o Tink: <a href="https://tink.com" target="_blank" rel="noopener noreferrer" className="text-primary">tink.com</a>
            </p>
            <p className="mt-2">
              Polityka prywatności Tink: <a href="https://tink.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary">tink.com/legal/privacy-policy</a>
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
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dane konta</strong> - {DATA_RETENTION.accountData}</li>
              <li><strong>Dane finansowe</strong> - {DATA_RETENTION.financialData}</li>
              <li><strong>Dane bankowe z Tink</strong> - {DATA_RETENTION.bankingData}</li>
              <li><strong>Tokeny dostępu Tink</strong> - {DATA_RETENTION.tinkTokens}</li>
              <li><strong>Dane analityczne</strong> - {DATA_RETENTION.analyticsData}</li>
            </ul>
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
            <p className="mt-4">
              Aby skorzystać z tych praw, skontaktuj się z nami: <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-primary">{LEGAL_ENTITY.email.privacy}</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Wycofanie zgody na dostęp do banku</h2>
            <p>Możesz w każdej chwili wycofać zgodę na dostęp do danych bankowych:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>W aplikacji:</strong> Ustawienia → Połączenia bankowe → Rozłącz</li>
              <li><strong>Przez Tink:</strong> <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-primary">tink.com/consumer/revocation</a></li>
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
              <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer" className="text-primary">uodo.gov.pl</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">14. Kontakt</h2>
            <p>
              W sprawach związanych z ochroną danych osobowych możesz skontaktować się z nami:
            </p>
            <ul className="list-none space-y-1 mt-2">
              <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.privacy}`} className="text-primary">{LEGAL_ENTITY.email.privacy}</a></li>
              <li>Strona: <a href={LEGAL_ENTITY.website} className="text-primary">{LEGAL_ENTITY.website.replace('https://', '')}</a></li>
            </ul>
          </section>

          <div className="mt-8 pt-4 border-t">
            <Link href="/" className="text-primary hover:underline">
              ← Powrót do aplikacji
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
