"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LEGAL_ENTITY } from "@/constants/legal";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Regulamin Usługi</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ostatnia aktualizacja: {LEGAL_ENTITY.lastUpdated}
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">

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
              <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.contact}`} className="text-primary">{LEGAL_ENTITY.email.contact}</a></li>
            </ul>
            <p>
              1.3. Użytkownik: osoba fizyczna korzystająca z Aplikacji (dalej: &quot;Użytkownik&quot;, &quot;Ty&quot;).
            </p>
            <p>
              1.4. Korzystanie z Aplikacji oznacza akceptację niniejszego Regulaminu oraz
              <Link href="/privacy" className="text-primary"> Polityki Prywatności</Link>.
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
              <li>Akceptuje <a href="https://tink.com/legal/end-user-terms" target="_blank" rel="noopener noreferrer" className="text-primary">Warunki Tink dla Użytkowników Końcowych</a></li>
              <li>Rozumie, że logowanie odbywa się bezpośrednio na stronie banku</li>
            </ul>
            <p>
              4.4. Użytkownik może w każdej chwili rozłączyć konto bankowe w Ustawieniach aplikacji
              lub przez <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-primary">portal Tink</a>.
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
              8.1. Zasady przetwarzania danych osobowych określone są w
              <Link href="/privacy" className="text-primary"> Polityce Prywatności</Link>.
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
              <li>Email: <a href={`mailto:${LEGAL_ENTITY.email.contact}`} className="text-primary">{LEGAL_ENTITY.email.contact}</a></li>
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
