"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Regulamin Uslugi</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ostatnia aktualizacja: 13 stycznia 2026
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Postanowienia ogolne</h2>
            <p>
              1.1. Niniejszy Regulamin okresla zasady korzystania z aplikacji <strong>FiredUp</strong>
              (dalej: "Aplikacja", "Usluga") dostepnej pod adresem firedup.app.
            </p>
            <p>
              1.2. Uslugodawca: <strong>FiredUp</strong> z siedziba w Polsce (dalej: "Uslugodawca", "my").
            </p>
            <p>
              1.3. Uzytkownik: osoba fizyczna korzystajaca z Aplikacji (dalej: "Uzytkownik", "Ty").
            </p>
            <p>
              1.4. Korzystanie z Aplikacji oznacza akceptacje niniejszego Regulaminu oraz
              <Link href="/privacy" className="text-primary"> Polityki Prywatnosci</Link>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Opis Uslugi</h2>
            <p>
              2.1. FiredUp to aplikacja do zarzadzania budzetem domowym, ktora umozliwia:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Reczne wprowadzanie wydatkow i przychodow</li>
              <li>Kategoryzacje transakcji</li>
              <li>Sledzenie celow oszczednosciowych</li>
              <li>Generowanie raportow finansowych</li>
              <li>Automatyczne pobieranie transakcji z kont bankowych (opcjonalnie)</li>
            </ul>
            <p>
              2.2. Usluga ma charakter informacyjny i pomocniczy. Nie stanowi doradzwa finansowego,
              podatkowego ani inwestycyjnego.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Rejestracja i konto</h2>
            <p>
              3.1. Korzystanie z Aplikacji wymaga utworzenia konta za pomoca adresu e-mail lub
              logowania przez dostawce tozsamosci (Google, itp.).
            </p>
            <p>
              3.2. Uzytkownik zobowiazuje sie do:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Podania prawdziwych danych</li>
              <li>Zachowania poufnosci danych logowania</li>
              <li>Niezwlocznego powiadomienia o nieautoryzowanym dostepie do konta</li>
            </ul>
            <p>
              3.3. Jedno konto moze byc uzywane tylko przez jedna osobe.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Polaczenie z bankiem (Tink)</h2>
            <p>
              4.1. Aplikacja umozliwia opcjonalne polaczenie konta bankowego w celu automatycznego
              pobierania transakcji.
            </p>
            <p>
              4.2. Usluga polaczenia z bankiem jest realizowana przez <strong>Tink AB</strong>,
              licencjonowanego dostawce uslug platniczych (AISP) regulowanego przez Finansinspektionen (Szwecja).
            </p>
            <p>
              4.3. Laczac konto bankowe, Uzytkownik:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Wyrazza zgode na dostep do danych konta (lista kont, salda, transakcje)</li>
              <li>Akceptuje <a href="https://tink.com/legal/end-user-terms" target="_blank" rel="noopener noreferrer" className="text-primary">Warunki Tink dla Uzytkownikow Koncowych</a></li>
              <li>Rozumie, ze logowanie odbywa sie bezposrednio na stronie banku</li>
            </ul>
            <p>
              4.4. Uzytkownik moze w kazdej chwili rozlaczyc konto bankowe w Ustawieniach aplikacji
              lub przez <a href="https://tink.com/consumer/revocation" target="_blank" rel="noopener noreferrer" className="text-primary">portal Tink</a>.
            </p>
            <p>
              4.5. Nie przechowujemy danych logowania do banku (hasel, PIN-ow).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Zasady korzystania</h2>
            <p>5.1. Uzytkownik zobowiazuje sie do:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Korzystania z Aplikacji zgodnie z prawem i dobrymi obyczajami</li>
              <li>Niepodejmowania prob obejscia zabezpieczen</li>
              <li>Nieuzywania Aplikacji do celow niezgodnych z prawem</li>
              <li>Nieprzeciazania infrastruktury Aplikacji</li>
            </ul>
            <p>5.2. Zabrania sie:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Udostepniania konta osobom trzecim</li>
              <li>Automatycznego pobierania danych (scraping) bez zgody</li>
              <li>Reverse engineeringu Aplikacji</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Odpowiedzialnosc</h2>
            <p>
              6.1. Uslugodawca doklada starannosci, aby Aplikacja dzialala poprawnie, jednak nie
              gwarantuje nieprzerwanej dostepnosci ani braku bledow.
            </p>
            <p>
              6.2. Uslugodawca nie ponosi odpowiedzialnosci za:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Decyzje finansowe podjete na podstawie danych z Aplikacji</li>
              <li>Bledy w danych pobranych z bankow (zrodlem sa systemy bankowe)</li>
              <li>Przerwy w dzialaniu spowodowane czynnikami zewnetrznymi</li>
              <li>Utrate danych spowodowana dzialaniem Uzytkownika</li>
              <li>Dzialania lub zaniechania Tink AB</li>
            </ul>
            <p>
              6.3. Aplikacja jest udostepniana "tak jak jest" (as is). Uzytkownik korzysta z niej
              na wlasna odpowiedzialnosc.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Wlasnosc intelektualna</h2>
            <p>
              7.1. Wszelkie prawa do Aplikacji, w tym kod zrodlowy, design i znaki towarowe,
              naleza do Uslugodawcy.
            </p>
            <p>
              7.2. Uzytkownik otrzymuje ograniczona, niewylaczna licencje na korzystanie z Aplikacji
              do celow osobistych.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Ochrona danych osobowych</h2>
            <p>
              8.1. Zasady przetwarzania danych osobowych okreslone sa w
              <Link href="/privacy" className="text-primary"> Polityce Prywatnosci</Link>.
            </p>
            <p>
              8.2. Uzytkownik ma prawo dostepu, sprostowania, usuniecia i przenoszenia swoich danych
              zgodnie z RODO.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Zmiany Regulaminu</h2>
            <p>
              9.1. Uslugodawca moze zmieniac niniejszy Regulamin.
            </p>
            <p>
              9.2. O istotnych zmianach Uzytkownik zostanie powiadomiony drogą mailowa lub
              przez powiadomienie w Aplikacji.
            </p>
            <p>
              9.3. Dalsze korzystanie z Aplikacji po wprowadzeniu zmian oznacza ich akceptacje.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Usuniecie konta</h2>
            <p>
              10.1. Uzytkownik moze w kazdej chwili usunac swoje konto kontaktujac sie z nami
              lub przez funkcje w Ustawieniach (jesli dostepna).
            </p>
            <p>
              10.2. Usuniecie konta skutkuje trwalym usunieciem wszystkich danych Uzytkownika.
            </p>
            <p>
              10.3. Uslugodawca moze usunac konto Uzytkownika w przypadku naruszenia Regulaminu.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Postanowienia koncowe</h2>
            <p>
              11.1. Regulamin podlega prawu polskiemu.
            </p>
            <p>
              11.2. Spory beda rozstrzygane przez sądy powszechne wlasciwe dla siedziby Uslugodawcy.
            </p>
            <p>
              11.3. Jezeli jakiekolwiek postanowienie Regulaminu okaże sie niewazne, pozostale
              postanowienia pozostaja w mocy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. Kontakt</h2>
            <p>
              W sprawach zwiazanych z Regulaminem mozesz skontaktowac sie z nami:
            </p>
            <ul className="list-none space-y-1 mt-2">
              <li>Email: <a href="mailto:contact@firedup.app" className="text-primary">contact@firedup.app</a></li>
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
