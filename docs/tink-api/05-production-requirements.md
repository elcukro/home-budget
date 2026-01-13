# Tink Production Access - Executive Summary

**Przygotowane dla:** SaaS budżetowy, 100-1000 użytkowników, tylko odczyt danych

---

## 1. Model Platformy (Platform Model)

Tink oferuje model **Platform** gdzie:
- **Tink dostarcza licencję AISP** (Account Information Service Provider) - nie potrzebujesz własnej licencji PSD2
- Tink jest regulowany przez Finansinspektionen (Szwecja) i FCA (UK)
- Tink jest częścią Visa Inc. i spełnia standardy ISO/IEC 27002
- SOC 2 Type II compliance

**Dla Ciebie oznacza to:** Nie musisz mieć licencji bankowej ani przechodzić audytów jak bank.

---

## 2. Produkty dla Twojego Use Case

### Potrzebujesz (read-only):
| Produkt | Opis | Plan |
|---------|------|------|
| **Transactions** | Transakcje z kont bankowych | Standard |
| **Account Check** | Weryfikacja konta + salda | Standard |
| **Balance Check** | Sprawdzenie salda | Standard |

### NIE potrzebujesz:
- Payment Initiation (płatności) - wymaga więcej compliance
- Risk Insights - tylko Enterprise
- Income Check - tylko Enterprise
- Business Transactions - tylko Enterprise

**Tink Link** - to gotowy komponent UI do logowania użytkowników do banków. Już go używasz w aplikacji.

---

## 3. Cennik (szacunkowy)

### Standard Plan:
| Element | Koszt |
|---------|-------|
| **Transactions** | €0.50 / user / miesiąc |
| **Account Check** | €0.25 / weryfikacja |
| Setup fee | Brak |
| Minimum | Brak (ale kontakt z sales wymagany) |

### Dla 100-1000 użytkowników:
| Użytkownicy | Koszt miesięczny (Transactions) |
|-------------|--------------------------------|
| 100 | ~€50 |
| 500 | ~€250 |
| 1000 | ~€500 |

**UWAGA:** Ceny są orientacyjne. Tink wymaga kontaktu z sales dla dokładnej wyceny.

---

## 4. Wymagania dla Production Access

### Co musisz mieć:
1. **Zarejestrowana firma** - działalność gospodarcza w EU
2. **Opis use case** - "Personal finance / budgeting app for consumers"
3. **Polityka prywatności** - zgodna z RODO
4. **Regulamin użytkownika** - informujący o dostępie do danych bankowych
5. **Bezpieczna infrastruktura** - HTTPS, bezpieczne przechowywanie tokenów

### Czego NIE musisz mieć:
- ❌ Własna licencja AISP/PSD2
- ❌ Audyt bezpieczeństwa jak dla banku
- ❌ Kapitał zakładowy jak dla instytucji finansowej
- ❌ Certyfikaty ISO (Tink je ma)

---

## 5. Proces Onboardingu

### Krok 1: Sandbox (ZROBIONE ✅)
- Konto w console.tink.com
- Testowanie z Demo Bank
- Integracja API

### Krok 2: Kontakt z Sales
- Wypełnij formularz na tink.com
- Opisz use case: "Personal budgeting SaaS, read-only access to transactions"
- Podaj szacowaną liczbę użytkowników

### Krok 3: Dokumentacja
Tink prawdopodobnie poprosi o:
- Dane firmy (KRS, NIP)
- Opis produktu i flow użytkownika
- Link do polityki prywatności
- Informacje o przechowywaniu danych

### Krok 4: Umowa
- Master Service Agreement z Tink
- Akceptacja Terms & Conditions
- Konfiguracja production credentials

### Krok 5: Go Live
- Wymiana credentials sandbox → production
- Ten sam kod, prawdziwe banki

---

## 6. Compliance - Co musisz zapewnić

### RODO/GDPR:
- Informuj użytkowników że ich dane bankowe są przetwarzane przez Tink
- Umożliw użytkownikom cofnięcie zgody (Tink ma portal: tink.com/consumer/revocation)
- Przechowuj dane tylko tak długo jak potrzebne

### Bezpieczeństwo:
- HTTPS dla wszystkich połączeń
- Bezpieczne przechowywanie access tokenów (nie w plain text)
- Nie loguj pełnych danych bankowych

### Transparentność:
- Użytkownik musi wiedzieć że łączy się przez Tink
- Wyświetl informację o przetwarzaniu danych

---

## 7. Kraje i Banki

### Polska (PL) - Twój rynek:
- ING Bank Śląski ✅
- PKO BP ✅
- mBank ✅
- Santander ✅
- I wiele innych...

Tink ma **3400+ połączeń** w 18 krajach Europy.

---

## 8. Alternatywy (backup)

Gdyby Tink nie pasował:

| Provider | Model | Uwagi |
|----------|-------|-------|
| **GoCardless** | Platform | Już masz integrację (legacy) |
| **TrueLayer** | Platform | Podobny do Tink |
| **Finexer** | Pay-per-use | Może tańszy dla małej skali |
| **Plaid** | Platform | Głównie US/UK |

---

## 9. Rekomendowany Plan Działania

1. **Teraz:** Dokończ integrację w Sandbox ✅
2. **Tydzień 1:** Przygotuj dokumenty (polityka prywatności, opis produktu)
3. **Tydzień 2:** Kontakt z Tink Sales
4. **Tydzień 3-4:** Negocjacje i podpisanie umowy
5. **Tydzień 5:** Production credentials + testy z prawdziwym bankiem
6. **Tydzień 6:** Go Live

---

## 10. Kontakt z Tink

- **Sales:** tink.com/contact
- **Console:** console.tink.com
- **Dokumentacja:** docs.tink.com
- **Support (Enterprise):** support portal po podpisaniu umowy

---

## Źródła

- [Tink Pricing](https://tink.com/pricing/)
- [Tink Products](https://tink.com/products/)
- [Tink FAQ](https://tink.com/faq/)
- [Tink Developer Console](https://tink.com/open-banking-developer-console/)
- [Tink's Pricing Guide (Finexer)](https://blog.finexer.com/tink-pricing/)
- [Tink Privacy Documentation](https://assets.ctfassets.net/c78bhj3obgck/32TNsqcaoHBJCeRx9HDaeQ/585d61e3f8a814c9b11610a9844acdd2/Tink_Privacy_and_Security_Documentation_2025-10-01.pdf)
