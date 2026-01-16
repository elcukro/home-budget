# Plan Wdrożenia Tink do Produkcji

**Data utworzenia:** 16 stycznia 2026
**Cel:** Przygotowanie FiredUp do pełnej integracji z prawdziwymi bankami przez Tink API

---

## Podsumowanie Wykonawcze

### Obecny Stan
- ✅ Sandbox działa poprawnie
- ✅ Przepływ OAuth zaimplementowany
- ✅ Tink Link zintegrowany
- ✅ Endpointy API gotowe
- ✅ Modele bazy danych utworzone
- ⚠️ Auth storage w pamięci (ryzyko utraty przy restarcie)
- ❌ Brak synchronizacji transakcji
- ❌ Brak UI do przeglądania transakcji

### Szacowany Czas: 4-6 tygodni
### Szacowany Koszt: €50-500/miesiąc (zależnie od liczby użytkowników)

---

## Faza 1: Naprawy Techniczne (Tydzień 1-2)

### 1.1 Migracja Auth Storage z Pamięci do Bazy Danych

**Problem:** `tink_service.py:62` - `self._pending_auth` jest słownikiem w pamięci.
**Ryzyko:** Restart serwera = utrata wszystkich pending auth, użytkownicy nie mogą dokończyć połączenia.

**Rozwiązanie:**

```python
# Nowy model w models.py
class TinkPendingAuth(Base):
    __tablename__ = "tink_pending_auth"

    id = Column(Integer, primary_key=True)
    state_token = Column(String(255), unique=True, index=True)
    user_id = Column(String(255), ForeignKey("users.id"), nullable=False)
    tink_user_id = Column(String(255), nullable=True)
    authorization_code = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # 15 minut od utworzenia
    used = Column(Boolean, default=False)
```

**Zmiany w tink_service.py:**
- `store_pending_auth()` → zapisuje do DB zamiast dict
- `verify_state_token()` → odczytuje z DB
- `get_pending_auth()` → odczytuje z DB
- Dodać cleanup job dla wygasłych tokenów

**Pliki do modyfikacji:**
- `backend/app/models.py` - dodać model TinkPendingAuth
- `backend/app/services/tink_service.py` - zmienić storage
- Utworzyć migrację Alembic

### 1.2 Implementacja Synchronizacji Transakcji

**Nowy endpoint:** `POST /banking/tink/sync`

```python
@router.post("/sync")
async def sync_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pobiera transakcje z Tink i zapisuje do BankTransaction.
    """
    connection = get_active_connection(current_user.id, db)
    access_token = await tink_service.get_valid_access_token(connection, db)

    # Pobierz transakcje z ostatnich 90 dni
    transactions = await tink_service.fetch_transactions(access_token)

    # Zapisz do bazy (unikaj duplikatów przez external_id)
    saved_count = save_transactions_to_db(transactions, current_user.id, db)

    return {"synced": saved_count, "status": "success"}
```

**Nowe endpointy do transakcji:**
- `GET /banking/transactions` - lista transakcji z banku
- `GET /banking/transactions/pending` - tylko nieprzetworzone
- `POST /banking/transactions/{id}/categorize` - przypisz kategorię
- `POST /banking/transactions/{id}/convert` - zamień na expense/income
- `DELETE /banking/transactions/{id}` - odrzuć transakcję

**Pliki do modyfikacji:**
- `backend/app/routers/tink.py` - nowe endpointy
- `backend/app/models.py` - rozszerzyć BankTransaction o status, category_id

### 1.3 Automatyczna Synchronizacja (Background Job)

**Opcja 1: APScheduler (prostsza)**
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', hours=6)
async def sync_all_connections():
    """Synchronizuj wszystkie aktywne połączenia co 6h."""
    async with get_db_session() as db:
        connections = db.query(TinkConnection).filter(
            TinkConnection.is_active == True
        ).all()
        for conn in connections:
            await sync_user_transactions(conn, db)
```

**Opcja 2: Celery (bardziej skalowalna)**
- Wymaga Redis jako broker
- Lepsza dla większej skali

**Rekomendacja:** APScheduler na start, migracja do Celery przy >500 użytkowników.

---

## Faza 2: Frontend - UI Transakcji (Tydzień 2-3)

### 2.1 Strona Przeglądania Transakcji Bankowych

**Nowa strona:** `/banking/transactions`

**Komponenty:**
```
frontend/src/app/(dashboard)/banking/transactions/page.tsx
frontend/src/components/banking/TransactionList.tsx
frontend/src/components/banking/TransactionCard.tsx
frontend/src/components/banking/TransactionFilters.tsx
frontend/src/components/banking/CategorySelector.tsx
frontend/src/components/banking/BulkActions.tsx
```

**Funkcjonalności:**
- Lista transakcji z paginacją
- Filtry: data, kwota, status, konto
- Status: pending, accepted, rejected
- Przypisywanie kategorii (dropdown z istniejących)
- Konwersja do expense/income jednym kliknięciem
- Bulk actions: zaznacz wszystkie, kategoryzuj masowo

### 2.2 Widget na Dashboard

**Komponent:** `PendingTransactionsWidget.tsx`

- Pokazuje liczbę oczekujących transakcji
- Quick link do `/banking/transactions`
- Preview ostatnich 3-5 transakcji

### 2.3 Rozszerzenie Settings/Banking

**Dodać:**
- Przycisk "Synchronizuj teraz"
- Ostatnia synchronizacja: data/czas
- Ustawienia auto-sync (włącz/wyłącz)
- Status połączenia z szczegółami

---

## Faza 3: Kategoryzacja Automatyczna (Tydzień 3-4)

### 3.1 Mapowanie Kategorii Tink → App

Tink zwraca kategorie w `categories.pfm`:
```json
{
  "categories": {
    "pfm": {
      "id": "expenses:food.groceries",
      "name": "Groceries"
    }
  }
}
```

**Tabela mapowania:**

| Tink Category | App Category |
|---------------|--------------|
| expenses:food.groceries | Jedzenie |
| expenses:food.restaurants | Restauracje |
| expenses:transport.fuel | Transport |
| expenses:transport.public | Transport |
| expenses:housing.rent | Mieszkanie |
| expenses:shopping.clothes | Ubrania |
| income:salary | (Income) |
| transfers:internal | (Ignoruj) |

**Model:**
```python
class TinkCategoryMapping(Base):
    __tablename__ = "tink_category_mappings"

    id = Column(Integer, primary_key=True)
    tink_category = Column(String(100), unique=True)
    app_category_id = Column(Integer, ForeignKey("expense_categories.id"))
    is_income = Column(Boolean, default=False)
    should_ignore = Column(Boolean, default=False)  # dla transferów wewnętrznych
```

### 3.2 Auto-kategoryzacja przy Sync

```python
def categorize_transaction(tx: dict, db: Session) -> Optional[int]:
    """Zwraca category_id lub None."""
    tink_cat = tx.get("categories", {}).get("pfm", {}).get("id")
    if not tink_cat:
        return None

    mapping = db.query(TinkCategoryMapping).filter(
        TinkCategoryMapping.tink_category == tink_cat
    ).first()

    if mapping:
        return mapping.app_category_id
    return None
```

### 3.3 Wykrywanie Income vs Expense

Logika na podstawie `amount.value.unscaledValue`:
- Wartość dodatnia → Income
- Wartość ujemna → Expense
- Transfer wewnętrzny (ten sam właściciel) → Ignoruj

---

## Faza 4: Wymagania Biznesowe (Tydzień 4-5)

### 4.1 Dokumenty do Przygotowania

| Dokument | Status | Wymagania |
|----------|--------|-----------|
| Polityka Prywatności | ⚠️ Wymaga aktualizacji | Dodać sekcję o Tink/danych bankowych |
| Regulamin | ⚠️ Wymaga aktualizacji | Dodać zgodę na dostęp do danych bankowych |
| Opis Use Case | ❌ Do napisania | "Personal finance SaaS, read-only transactions" |
| Dane Firmy | ✅ (zakładam) | KRS, NIP, adres |

### 4.2 Aktualizacja Polityki Prywatności

Dodać sekcję:
```markdown
## Integracja Bankowa

Nasza aplikacja umożliwia połączenie z kontem bankowym poprzez usługę
Tink AB (część Visa Inc.). Gdy zdecydujesz się połączyć konto bankowe:

1. **Jakie dane pobieramy:**
   - Lista kont bankowych (numer, nazwa, saldo)
   - Historia transakcji (ostatnie 90 dni)
   - NIE mamy dostępu do danych logowania do banku

2. **Kto przetwarza dane:**
   - Tink AB (Szwecja) - licencjonowany dostawca Open Banking
   - Dane są przesyłane szyfrowanym połączeniem

3. **Jak długo przechowujemy:**
   - Dane transakcji: tak długo jak masz konto
   - Możesz odwołać dostęp w każdej chwili

4. **Twoje prawa:**
   - Odwołanie zgody: tink.com/consumer/revocation
   - Usunięcie danych: kontakt@firedup.app
```

### 4.3 Aktualizacja Regulaminu

Dodać punkt:
```markdown
## Usługi Bankowe

1. Usługa łączenia konta bankowego jest opcjonalna.
2. Łącząc konto, wyrażasz zgodę na:
   - Pobieranie danych o kontach i transakcjach
   - Przetwarzanie danych przez Tink AB
3. Nie realizujemy płatności - mamy tylko dostęp do odczytu.
4. Możesz rozłączyć konto w dowolnym momencie.
```

---

## Faza 5: Kontakt z Tink (Tydzień 5)

### 5.1 Formularz Kontaktowy

**URL:** https://tink.com/contact

**Informacje do przygotowania:**
- Nazwa firmy i dane rejestrowe
- Opis produktu: "Personal budgeting SaaS for Polish consumers"
- Szacowana liczba użytkowników: 100-1000
- Wymagane produkty: Transactions, Account Check
- Rynek: Polska (PL)
- Model: Platform (Tink dostarcza licencję AISP)

### 5.2 Oczekiwane Pytania od Tink

1. **Business model** - Jak zarabiacie? (Subskrypcja Premium)
2. **Data usage** - Co robicie z danymi? (Analiza budżetu, kategoryzacja)
3. **Security** - Jak przechowujecie tokeny? (Szyfrowane w DB, HTTPS)
4. **Compliance** - GDPR ready? (Tak, dane w EU)
5. **Volume** - Ile requestów? (~1000/dzień na 500 użytkowników)

### 5.3 Oczekiwane Dokumenty od Tink

- Master Service Agreement (MSA)
- Data Processing Agreement (DPA)
- Technical onboarding guide
- Production credentials

---

## Faza 6: Go Live (Tydzień 6)

### 6.1 Wymiana Credentials

```bash
# .env.production
TINK_CLIENT_ID=prod_client_id_from_tink
TINK_CLIENT_SECRET=prod_secret_from_tink
TINK_REDIRECT_URI=https://firedup.app/banking/tink/callback
```

### 6.2 Testowanie z Prawdziwym Bankiem

**Procedura:**
1. Zaloguj się na własne konto (developer)
2. Połącz swój prawdziwy bank (ING/mBank/PKO)
3. Zweryfikuj pobrane konta
4. Sprawdź transakcje
5. Przetestuj sync
6. Rozłącz i połącz ponownie

### 6.3 Soft Launch

1. Włącz dla 10-20 beta testerów
2. Monitoruj logi i błędy
3. Zbieraj feedback
4. Naprawiaj problemy

### 6.4 Full Launch

1. Włącz dla wszystkich Premium users
2. Dodaj komunikat o nowej funkcji
3. Monitoruj metryki:
   - % udanych połączeń
   - Średni czas sync
   - Błędy API

---

## Szacowane Koszty

### Jednorazowe

| Element | Koszt |
|---------|-------|
| Development (4-6 tyg.) | Wewnętrzny |
| Prawnik (aktualizacja dokumentów) | ~500-1000 PLN |
| Setup z Tink | €0 |

### Miesięczne

| Użytkownicy | Koszt Tink (€) | Koszt (PLN ~4.3) |
|-------------|----------------|------------------|
| 100 | ~€50 | ~215 PLN |
| 250 | ~€125 | ~540 PLN |
| 500 | ~€250 | ~1,075 PLN |
| 1000 | ~€500 | ~2,150 PLN |

**Uwaga:** Ceny orientacyjne, wymagają potwierdzenia przez Tink Sales.

---

## Harmonogram

```
Tydzień 1: Auth storage → DB, model TinkPendingAuth
Tydzień 2: Sync endpoint, background job
Tydzień 3: Frontend - lista transakcji, kategoryzacja
Tydzień 4: Auto-kategoryzacja, dokumenty prawne
Tydzień 5: Kontakt z Tink, negocjacje
Tydzień 6: Credentials, testy, soft launch
```

---

## Ryzyka i Mitygacje

| Ryzyko | Prawdopodobność | Wpływ | Mitygacja |
|--------|-----------------|-------|-----------|
| Tink odrzuci aplikację | Niska | Wysoki | Przygotować alternatywę (GoCardless/TrueLayer) |
| Długi czas onboardingu | Średnia | Średni | Rozpocząć kontakt wcześniej |
| Banki mają problemy z API | Średnia | Średni | Obsługa błędów, retry logic |
| Użytkownicy nie ufają | Średnia | Średni | Edukacja, transparentność |
| Wysokie koszty | Niska | Niski | Tylko dla Premium users |

---

## Checklist Pre-Production

### Techniczne
- [ ] Auth storage w bazie danych
- [ ] Endpoint sync transakcji
- [ ] Background job co 6h
- [ ] Frontend lista transakcji
- [ ] Auto-kategoryzacja
- [ ] Obsługa błędów i retry
- [ ] Rate limiting
- [ ] Logi i monitoring

### Biznesowe
- [ ] Zaktualizowana Polityka Prywatności
- [ ] Zaktualizowany Regulamin
- [ ] Opis produktu dla Tink
- [ ] Dane firmy przygotowane

### Tink
- [ ] Kontakt z Sales
- [ ] MSA podpisane
- [ ] DPA podpisane
- [ ] Production credentials otrzymane
- [ ] Testy z prawdziwym bankiem

### Launch
- [ ] Beta testerzy zidentyfikowani
- [ ] Monitoring skonfigurowany
- [ ] Rollback plan gotowy
- [ ] Dokumentacja użytkownika

---

## Kontakty

- **Tink Sales:** https://tink.com/contact
- **Tink Console:** https://console.tink.com
- **Tink Docs:** https://docs.tink.com
- **Revocation Portal:** https://tink.com/consumer/revocation

---

## Załączniki

- [00-integration-status.md](./00-integration-status.md) - Obecny stan
- [01-authentication.md](./01-authentication.md) - Flow autentykacji
- [02-tink-link.md](./02-tink-link.md) - Integracja Tink Link
- [03-accounts-transactions.md](./03-accounts-transactions.md) - API kont/transakcji
- [04-sandbox-testing.md](./04-sandbox-testing.md) - Testowanie sandbox
- [05-production-requirements.md](./05-production-requirements.md) - Wymagania produkcyjne
