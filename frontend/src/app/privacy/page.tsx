"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Polityka Prywatnosci</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ostatnia aktualizacja: 13 stycznia 2026
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Administrator Danych</h2>
            <p>
              Administratorem Twoich danych osobowych jest <strong>FiredUp</strong> z siedziba w Polsce
              (dalej: "Administrator", "my", "nas").
            </p>
            <p>
              Kontakt z Administratorem: <a href="mailto:privacy@firedup.app" className="text-primary">privacy@firedup.app</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Jakie dane zbieramy</h2>
            <p>W ramach korzystania z aplikacji FiredUp zbieramy nastepujace dane:</p>

            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Dane konta</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Adres e-mail (do logowania i komunikacji)</li>
              <li>Preferencje uzytkownika (jezyk, waluta)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Dane finansowe wprowadzane recznie</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Wydatki i przychody</li>
              <li>Kategorie transakcji</li>
              <li>Cele oszczednosciowe</li>
              <li>Informacje o pozyczkach</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Dane bankowe (przez Tink)</h3>
            <p>
              Jezeli zdecydujesz sie polaczyc swoje konto bankowe, uzyskujemy dostep do nastepujacych danych
              za posrednictwem uslugi <strong>Tink AB</strong> (licencjonowany dostawca uslug platniczych):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Lista kont bankowych (numer IBAN, nazwa konta)</li>
              <li>Salda kont</li>
              <li>Historia transakcji (data, kwota, opis, kategoria)</li>
            </ul>
            <p className="mt-2 p-3 bg-muted rounded">
              <strong>Wazne:</strong> Nie mamy dostepu do Twoich danych logowania do banku.
              Logowanie odbywa sie bezposrednio na stronie Twojego banku za posrednictwem bezpiecznego
              interfejsu Tink Link. Nie przechowujemy hasel ani PIN-ow.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Cel przetwarzania danych</h2>
            <p>Twoje dane przetwarzamy w nastepujacych celach:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Swiadczenie uslugi</strong> - umozliwienie korzystania z aplikacji do zarzadzania budzetem domowym</li>
              <li><strong>Agregacja danych bankowych</strong> - automatyczne pobieranie transakcji z Twojego banku (za Twoja zgoda)</li>
              <li><strong>Analiza finansowa</strong> - generowanie raportow, wykresow i statystyk Twoich finansow</li>
              <li><strong>Komunikacja</strong> - wysylanie waznych informacji o koncie i usludze</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Podstawa prawna przetwarzania (RODO)</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Art. 6 ust. 1 lit. b RODO</strong> - przetwarzanie jest niezbedne do wykonania umowy
                (swiadczenie uslugi aplikacji)
              </li>
              <li>
                <strong>Art. 6 ust. 1 lit. a RODO</strong> - Twoja zgoda na dostep do danych bankowych
                (mozesz ja wycofac w kazdej chwili)
              </li>
              <li>
                <strong>Art. 6 ust. 1 lit. f RODO</strong> - prawnie uzasadniony interes Administratora
                (bezpieczenstwo i rozwoj uslugi)
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Tink - dostawca uslug bankowych</h2>
            <p>
              Do pobierania danych z Twojego banku korzystamy z uslugi <strong>Tink AB</strong>,
              licencjonowanego dostawcy uslug platniczych (AISP) regulowanego przez:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Finansinspektionen (Szwecja)</li>
              <li>Financial Conduct Authority (Wielka Brytania)</li>
            </ul>
            <p className="mt-2">
              Tink jest czescia Visa Inc. i spelnia najwyzsze standardy bezpieczenstwa (SOC 2 Type II, ISO 27001).
            </p>
            <p className="mt-2">
              Wiecej informacji o Tink: <a href="https://tink.com" target="_blank" rel="noopener noreferrer" className="text-primary">tink.com</a>
            </p>
            <p className="mt-2">
              Polityka prywatnosci Tink: <a href="https://tink.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary">tink.com/legal/privacy-policy</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Udostepnianie danych</h2>
            <p>Twoje dane moga byc udostepniane nastepujacym podmiotom:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Tink AB</strong> - w celu pobierania danych bankowych (za Twoja zgoda)</li>
              <li><strong>Dostawcy infrastruktury</strong> - serwery hostingowe (w UE)</li>
              <li><strong>Organy panstwowe</strong> - tylko gdy wymagaja tego przepisy prawa</li>
            </ul>
            <p className="mt-2 font-medium">
              Nie sprzedajemy Twoich danych osobowych podmiotom trzecim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Okres przechowywania danych</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Dane konta</strong> - do momentu usuniecia konta</li>
              <li><strong>Dane finansowe</strong> - do momentu usuniecia konta lub na Twoje zadanie</li>
              <li><strong>Dane bankowe z Tink</strong> - przechowywane lokalnie, odswiezane na zadanie, usuwane przy rozlaczeniu konta bankowego</li>
              <li><strong>Tokeny dostepu Tink</strong> - wazne do 90 dni, automatycznie odswiezane lub usuwane</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Twoje prawa (RODO)</h2>
            <p>Przysluguja Ci nastepujace prawa:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Prawo dostepu</strong> - mozesz zadac kopii swoich danych</li>
              <li><strong>Prawo do sprostowania</strong> - mozesz poprawic nieprawidlowe dane</li>
              <li><strong>Prawo do usuniecia</strong> - mozesz zadac usuniecia swoich danych ("prawo do bycia zapomnianym")</li>
              <li><strong>Prawo do ograniczenia przetwarzania</strong> - mozesz ograniczyc sposob wykorzystania danych</li>
              <li><strong>Prawo do przenoszenia danych</strong> - mozesz pobrac swoje dane w formacie maszynowym</li>
              <li><strong>Prawo do sprzeciwu</strong> - mozesz sprzeciwic sie przetwarzaniu danych</li>
              <li><strong>Prawo do wycofania zgody</strong> - mozesz w kazdej chwili wycofac zgode na dostep do danych bankowych</li>
            </ul>
            <p className="mt-4">
              Aby skorzystac z tych praw, skontaktuj sie z nami: <a href="mailto:privacy@firedup.app" className="text-primary">privacy@firedup.app</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Wycofanie zgody na dostep do banku</h2>
            <p>Mozesz w kazdej chwili wycofac zgode na dostep do danych bankowych:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>W aplikacji:</strong> Ustawienia → Polaczenia bankowe → Rozlacz</li>
              <li><strong>Przez Tink:</strong> <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-primary">tink.com/consumer/revocation</a></li>
            </ul>
            <p className="mt-2">
              Po wycofaniu zgody przestaniemy pobierac dane z Twojego banku. Dane juz pobrane pozostana
              w aplikacji do momentu ich recznego usuniecia lub usuniecia konta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Bezpieczenstwo danych</h2>
            <p>Stosujemy nastepujace srodki bezpieczenstwa:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Szyfrowanie polaczen (HTTPS/TLS)</li>
              <li>Bezpieczne przechowywanie tokenow dostepu</li>
              <li>Regularne kopie zapasowe</li>
              <li>Ograniczony dostep do danych (tylko upowazniony personel)</li>
              <li>Monitoring bezpieczenstwa</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Pliki cookies</h2>
            <p>
              Aplikacja uzywa niezbednych plikow cookies do dzialania (sesja logowania, preferencje).
              Nie uzywamy cookies reklamowych ani sledzacych.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. Zmiany w polityce prywatnosci</h2>
            <p>
              Mozemy aktualizowac niniejsza politykee prywatnosci. O istotnych zmianach poinformujemy
              Cie drogą mailowa lub przez powiadomienie w aplikacji.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">13. Skargi</h2>
            <p>
              Jezeli uwazasz, ze przetwarzamy Twoje dane niezgodnie z prawem, masz prawo zlozyc skarge
              do organu nadzorczego:
            </p>
            <p className="mt-2">
              <strong>Prezes Urzedu Ochrony Danych Osobowych (PUODO)</strong><br />
              ul. Stawki 2, 00-193 Warszawa<br />
              <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer" className="text-primary">uodo.gov.pl</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">14. Kontakt</h2>
            <p>
              W sprawach zwiazanych z ochroną danych osobowych mozesz skontaktowac sie z nami:
            </p>
            <ul className="list-none space-y-1 mt-2">
              <li>Email: <a href="mailto:privacy@firedup.app" className="text-primary">privacy@firedup.app</a></li>
              <li>Strona: <a href="https://firedup.app" className="text-primary">firedup.app</a></li>
            </ul>
          </section>

          <div className="mt-8 pt-4 border-t">
            <Link href="/" className="text-primary hover:underline">
              ← Powrot do aplikacji
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
