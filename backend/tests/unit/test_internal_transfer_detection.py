"""
Unit tests for internal transfer detection functions.

Tests the shared detection module (app.services.internal_transfer_detection)
used by Enable Banking sync, GoCardless sync, backfill, and cleanup scripts.
"""

import pytest
import sys
import os

# Add backend root to path so we can import from app and scripts
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.internal_transfer_detection import (
    detect_internal_transfer_eb as eb_detect,
    detect_internal_transfer as backfill_detect,
    detect_internal_from_descriptions,
    infer_account_bic,
)


# ============================================================================
# Helpers
# ============================================================================

def _make_eb_tx(remittance_text: str = "", cdi: str = "", **overrides) -> dict:
    """Build a minimal Enable Banking raw transaction dict."""
    tx = {
        "remittance_information": [remittance_text] if remittance_text else [],
        "credit_debit_indicator": cdi,
        "debtor": {},
        "creditor": {},
        "debtor_agent": {},
        "creditor_agent": {},
    }
    tx.update(overrides)
    return tx


def _make_crdt_tx(
    debtor_bic: str | None = None,
    creditor_bic: str | None = None,
    remittance: str = "",
) -> dict:
    """Build a CRDT transaction with optional BICs for structural testing."""
    tx = {
        "credit_debit_indicator": "CRDT",
        "remittance_information": [remittance] if remittance else [],
        "debtor": {},
        "creditor": {},
        "debtor_agent": {"bic_fi": debtor_bic} if debtor_bic else {},
        "creditor_agent": {"bic_fi": creditor_bic} if creditor_bic else {},
    }
    return tx


def _make_same_bic_tx(
    bic: str = "INGBPLPW",
    debtor_name: str = "",
    creditor_name: str = "",
    debtor_addr: str = "",
    creditor_addr: str = "",
) -> dict:
    """Build a transaction with BIC info for same-bank detection."""
    tx = {
        "remittance_information": [],
        "credit_debit_indicator": "",
        "debtor_agent": {"bic_fi": bic},
        "creditor_agent": {"bic_fi": bic},
        "debtor": {
            "name": debtor_name,
            "postal_address": {"address_line": [debtor_addr] if debtor_addr else []},
        },
        "creditor": {
            "name": creditor_name,
            "postal_address": {"address_line": [creditor_addr] if creditor_addr else []},
        },
    }
    return tx


def _desc_detect(**kwargs):
    """Wrapper for detect_internal_from_descriptions with keyword args."""
    return detect_internal_from_descriptions(
        description_display=kwargs.get("description_display", ""),
        description_original=kwargs.get("description_original", ""),
        description_detailed=kwargs.get("description_detailed", ""),
    )


# ============================================================================
# STRUCTURAL BIC DETECTION (CRDT transactions — the core income filter)
# ============================================================================

class TestStructuralBICDetection:
    """Tests for BIC-based structural filtering of CRDT transactions.

    The simple rule: income = money from a DIFFERENT bank.
    - Same bank (debtor_bic == account_bic) → internal
    - No bank (debtor_bic is None) → internal (ATM)
    - Different bank → real income (unless text pattern matches)
    """

    def test_same_bank_card_payment(self):
        """Card payment CRDT: debtor=ING, creditor=null → internal."""
        tx = _make_crdt_tx(debtor_bic="INGBPLPW", creditor_bic=None)
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_same_bank_own_transfer(self):
        """Own ING→ING transfer: both BICs = INGBPLPW → internal."""
        tx = _make_crdt_tx(debtor_bic="INGBPLPW", creditor_bic="INGBPLPW")
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_same_bank_blik_refund(self):
        """BLIK refund: debtor=ING → internal."""
        tx = _make_crdt_tx(debtor_bic="INGBPLPW", remittance="Zwrot transakcji BLIK")
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_same_bank_interest(self):
        """Interest posting: debtor=ING → internal."""
        tx = _make_crdt_tx(debtor_bic="INGBPLPW", remittance="Kapitalizacja odsetek")
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_same_bank_currency_exchange(self):
        """Currency exchange: debtor=ING → internal."""
        tx = _make_crdt_tx(debtor_bic="INGBPLPW", remittance="Wymiana walut EUR/PLN")
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_no_debtor_bic_atm(self):
        """ATM deposit: no debtor bank → internal."""
        tx = _make_crdt_tx(debtor_bic=None, creditor_bic=None)
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_different_bank_salary(self):
        """Salary from Citi Handlowy → real income."""
        tx = _make_crdt_tx(debtor_bic="CITIPLPX", creditor_bic="INGBPLPW")
        assert eb_detect(tx, account_bic="INGBPLPW") is False

    def test_different_bank_family_transfer(self):
        """Family transfer from BNP Paribas → real income."""
        tx = _make_crdt_tx(debtor_bic="PPABPLPK", creditor_bic="INGBPLPW")
        assert eb_detect(tx, account_bic="INGBPLPW") is False

    def test_different_bank_velo_caught_by_text(self):
        """Velo transfer from different bank BIC but caught by text pattern."""
        tx = _make_crdt_tx(debtor_bic="GBGCPLPK", remittance="velo zasilenie styczen")
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_different_bank_own_transfer_caught_by_text(self):
        """mBank PRZELEW SRODKOW: different BIC but caught by ASCII text pattern."""
        tx = _make_crdt_tx(debtor_bic="BREXPLPW", remittance="PRZELEW SRODKOW")
        assert eb_detect(tx, account_bic="INGBPLPW") is True

    def test_different_bank_real_transfer(self):
        """mBank real transfer (LOTY) → real income, not caught by patterns."""
        tx = _make_crdt_tx(debtor_bic="BREXPLPW", remittance="LOTY I ESTA")
        assert eb_detect(tx, account_bic="INGBPLPW") is False

    def test_no_account_bic_falls_back_to_creditor_compare(self):
        """Without account_bic, falls back to comparing debtor vs creditor BIC."""
        tx = _make_crdt_tx(debtor_bic="INGBPLPW", creditor_bic="INGBPLPW")
        assert eb_detect(tx, account_bic=None) is True

    def test_no_account_bic_different_banks(self):
        """Without account_bic, different debtor/creditor BICs → not internal."""
        tx = _make_crdt_tx(debtor_bic="CITIPLPX", creditor_bic="INGBPLPW")
        assert eb_detect(tx, account_bic=None) is False


# ============================================================================
# Enable Banking detection — text patterns (Polish diacritics + ASCII)
# ============================================================================

class TestEBDetection:
    """Tests for text pattern matching in detect_internal_transfer_eb."""

    def test_smart_saver(self):
        tx = _make_eb_tx("Smart Saver transfer")
        assert eb_detect(tx) is True

    def test_przelew_wlasny(self):
        tx = _make_eb_tx("Przelew własny na konto")
        assert eb_detect(tx) is True

    def test_przelew_wlasny_ascii(self):
        """ASCII variant without diacritics (e.g. mBank)."""
        tx = _make_eb_tx("PRZELEW WLASNY")
        assert eb_detect(tx) is True

    def test_konto_oszczednosciowe(self):
        tx = _make_eb_tx("Przelew Na Konto Oszczędnościowe")
        assert eb_detect(tx) is True

    def test_konto_oszczednosciowe_ascii(self):
        tx = _make_eb_tx("KONTO OSZCZEDNOSCIOWE")
        assert eb_detect(tx) is True

    def test_velo_zasilenie(self):
        tx = _make_eb_tx("velo zasilenie styczen")
        assert eb_detect(tx) is True

    def test_velo_generic(self):
        tx = _make_eb_tx("velo wypłata")
        assert eb_detect(tx) is True

    def test_wplatomat(self):
        tx = _make_eb_tx("Wpłatomat - wpłata własna")
        assert eb_detect(tx) is True

    def test_wplatomat_ascii(self):
        tx = _make_eb_tx("WPLATOMAT")
        assert eb_detect(tx) is True

    def test_wplata_wlasna(self):
        tx = _make_eb_tx("wpłata własna w oddziale")
        assert eb_detect(tx) is True

    def test_wplata_wlasna_ascii(self):
        tx = _make_eb_tx("WPLATA WLASNA")
        assert eb_detect(tx) is True

    def test_zasilenie_kredyt(self):
        tx = _make_eb_tx("zasilenie kredyt hipoteczny")
        assert eb_detect(tx) is True

    def test_przelew_srodkow(self):
        tx = _make_eb_tx("PRZELEW ŚRODKÓW")
        assert eb_detect(tx) is True

    def test_przelew_srodkow_ascii(self):
        """mBank sends SRODKOW without diacritics."""
        tx = _make_eb_tx("PRZELEW SRODKOW")
        assert eb_detect(tx) is True

    def test_wymiana(self):
        tx = _make_eb_tx("Wymiana walut EUR/PLN")
        assert eb_detect(tx) is True

    def test_platnosc_karta(self):
        tx = _make_eb_tx("Płatność kartą zwrot")
        assert eb_detect(tx) is True

    def test_platnosc_karta_ascii(self):
        tx = _make_eb_tx("PLATNOSC KARTA")
        assert eb_detect(tx) is True

    def test_zwrot_karta(self):
        tx = _make_eb_tx("Zwrot kartą VISA")
        assert eb_detect(tx) is True

    def test_zwrot_karta_ascii(self):
        tx = _make_eb_tx("ZWROT KARTA")
        assert eb_detect(tx) is True

    def test_kapitalizacja_odsetek(self):
        tx = _make_eb_tx("kapitalizacja odsetek za okres")
        assert eb_detect(tx) is True

    def test_naliczenie_odsetek(self):
        tx = _make_eb_tx("naliczenie odsetek konto")
        assert eb_detect(tx) is True

    def test_zwrot_blik(self):
        tx = _make_eb_tx("Zwrot transakcji BLIK nr 12345")
        assert eb_detect(tx) is True

    def test_case_insensitive(self):
        tx = _make_eb_tx("SMART SAVER TRANSFER")
        assert eb_detect(tx) is True

    def test_remittance_as_list(self):
        tx = _make_eb_tx()
        tx["remittance_information"] = ["velo zasilenie", "styczen 2026"]
        assert eb_detect(tx) is True


# ============================================================================
# Enable Banking detection — BIC-based same-person (mainly DBIT)
# ============================================================================

class TestEBDetectionBIC:
    """Tests for BIC-based same-bank same-person detection."""

    def test_same_bic_same_name(self):
        tx = _make_same_bic_tx(debtor_name="Jan Kowalski", creditor_name="Jan Kowalski")
        assert eb_detect(tx) is True

    def test_same_bic_same_name_case_insensitive(self):
        tx = _make_same_bic_tx(debtor_name="jan kowalski", creditor_name="JAN KOWALSKI")
        assert eb_detect(tx) is True

    def test_same_bic_same_address(self):
        tx = _make_same_bic_tx(debtor_addr="ul. Marszałkowska 1", creditor_addr="ul. Marszałkowska 1")
        assert eb_detect(tx) is True

    def test_same_bic_different_name_different_address(self):
        tx = _make_same_bic_tx(
            debtor_name="Jan Kowalski",
            creditor_name="Anna Nowak",
            debtor_addr="ul. Marszałkowska 1",
            creditor_addr="ul. Piękna 5",
        )
        assert eb_detect(tx) is False

    def test_different_bic(self):
        tx = _make_eb_tx()
        tx["debtor_agent"] = {"bic_fi": "INGBPLPW"}
        tx["creditor_agent"] = {"bic_fi": "PKOPPLPW"}
        tx["debtor"] = {"name": "Jan Kowalski"}
        tx["creditor"] = {"name": "Jan Kowalski"}
        assert eb_detect(tx) is False

    def test_missing_bic(self):
        tx = _make_eb_tx()
        tx["debtor_agent"] = {}
        tx["creditor_agent"] = {}
        assert eb_detect(tx) is False


# ============================================================================
# Negative cases — should NOT be detected as internal
# ============================================================================

class TestNegativeCases:
    """Transactions that should NOT be marked as internal transfers."""

    def test_salary(self):
        tx = _make_eb_tx("Wynagrodzenie za styczeń 2026")
        assert eb_detect(tx) is False

    def test_freelance_payment(self):
        tx = _make_eb_tx("Faktura 2026/01/001 za usługi programistyczne")
        assert eb_detect(tx) is False

    def test_grocery_purchase(self):
        tx = _make_eb_tx("BIEDRONKA SKLEP 1234")
        assert eb_detect(tx) is False

    def test_empty_remittance(self):
        tx = _make_eb_tx("")
        assert eb_detect(tx) is False

    def test_regular_przelew(self):
        """'PRZELEW' alone (without 'własny' or 'środków') should NOT match."""
        tx = _make_eb_tx("PRZELEW")
        assert eb_detect(tx) is False

    def test_different_bank_same_name(self):
        """Same person name but different banks — could be real transfer."""
        tx = _make_eb_tx()
        tx["debtor_agent"] = {"bic_fi": "INGBPLPW"}
        tx["creditor_agent"] = {"bic_fi": "PKOPPLPW"}
        tx["debtor"] = {"name": "Jan Kowalski"}
        tx["creditor"] = {"name": "Jan Kowalski"}
        assert eb_detect(tx) is False

    def test_salary_crdt_with_account_bic(self):
        """Salary from external bank should NOT be internal even with account_bic."""
        tx = _make_crdt_tx(debtor_bic="CITIPLPX", creditor_bic="INGBPLPW",
                           remittance="Wynagrodzenie za styczeń")
        assert eb_detect(tx, account_bic="INGBPLPW") is False

    def test_family_transfer_crdt(self):
        """Family transfer from BNP Paribas should NOT be internal."""
        tx = _make_crdt_tx(debtor_bic="PPABPLPK", remittance="Dopłata do czynszu")
        assert eb_detect(tx, account_bic="INGBPLPW") is False


# ============================================================================
# Account BIC inference
# ============================================================================

class TestInferAccountBIC:
    """Tests for infer_account_bic helper."""

    def test_infer_from_dbit(self):
        """Should find BIC from DBIT debtor_agent."""
        txs = [
            {"credit_debit_indicator": "DBIT", "debtor_agent": {"bic_fi": "INGBPLPW"}, "creditor_agent": {}},
        ]
        assert infer_account_bic(txs) == "INGBPLPW"

    def test_infer_from_crdt_creditor(self):
        """Should find BIC from CRDT creditor_agent."""
        txs = [
            {"credit_debit_indicator": "CRDT", "debtor_agent": {"bic_fi": "CITIPLPX"}, "creditor_agent": {"bic_fi": "INGBPLPW"}},
        ]
        assert infer_account_bic(txs) == "INGBPLPW"

    def test_infer_dbit_preferred_over_crdt(self):
        """DBIT comes first in iteration, should be preferred."""
        txs = [
            {"credit_debit_indicator": "DBIT", "debtor_agent": {"bic_fi": "INGBPLPW"}, "creditor_agent": {}},
            {"credit_debit_indicator": "CRDT", "debtor_agent": {"bic_fi": "CITIPLPX"}, "creditor_agent": {"bic_fi": "INGBPLPW"}},
        ]
        assert infer_account_bic(txs) == "INGBPLPW"

    def test_no_bic_available(self):
        """No BIC info → returns None."""
        txs = [
            {"credit_debit_indicator": "CRDT", "debtor_agent": {}, "creditor_agent": {}},
        ]
        assert infer_account_bic(txs) is None

    def test_empty_list(self):
        assert infer_account_bic([]) is None

    def test_whitespace_bic_ignored(self):
        """Whitespace-only BIC should be treated as None."""
        txs = [
            {"credit_debit_indicator": "DBIT", "debtor_agent": {"bic_fi": "  "}, "creditor_agent": {}},
        ]
        assert infer_account_bic(txs) is None


# ============================================================================
# Backfill detection — GoCardless
# ============================================================================

class TestBackfillGoCardless:
    """Tests for GoCardless detection in backfill script."""

    def test_gocardless_transfer_type_dict(self):
        raw = {"types": {"type": "TRANSFER"}}
        assert backfill_detect(raw, "gocardless") is True

    def test_gocardless_transfer_type_list(self):
        raw = {"types": [{"type": "TRANSFER"}]}
        assert backfill_detect(raw, "gocardless") is True

    def test_gocardless_purchase_type(self):
        raw = {"types": {"type": "PURCHASE"}}
        assert backfill_detect(raw, "gocardless") is False

    def test_gocardless_no_types(self):
        raw = {}
        assert backfill_detect(raw, "gocardless") is False

    def test_gocardless_none_raw_data(self):
        assert backfill_detect(None, "gocardless") is False


# ============================================================================
# Backfill detection — Enable Banking (mirrors sync detection)
# ============================================================================

class TestBackfillEnableBanking:
    """Tests for Enable Banking detection in backfill script."""

    def test_eb_smart_saver(self):
        raw = {"remittance_information": ["Smart Saver transfer"]}
        assert backfill_detect(raw, "enablebanking") is True

    def test_eb_velo_zasilenie(self):
        raw = {"remittance_information": ["velo zasilenie styczen"]}
        assert backfill_detect(raw, "enablebanking") is True

    def test_eb_wplatomat(self):
        raw = {"remittance_information": ["Wpłatomat - wpłata własna"]}
        assert backfill_detect(raw, "enablebanking") is True

    def test_eb_wymiana(self):
        raw = {"remittance_information": ["Wymiana walut"]}
        assert backfill_detect(raw, "enablebanking") is True

    def test_eb_salary_not_internal(self):
        raw = {"remittance_information": ["Wynagrodzenie za styczeń"]}
        assert backfill_detect(raw, "enablebanking") is False

    def test_eb_none_raw_data(self):
        assert backfill_detect(None, "enablebanking") is False

    def test_eb_same_bic_same_name(self):
        raw = {
            "remittance_information": [],
            "credit_debit_indicator": "",
            "debtor_agent": {"bic_fi": "INGBPLPW"},
            "creditor_agent": {"bic_fi": "INGBPLPW"},
            "debtor": {"name": "Jan Kowalski"},
            "creditor": {"name": "Jan Kowalski"},
        }
        assert backfill_detect(raw, "enablebanking") is True

    def test_eb_with_account_bic(self):
        """Backfill can pass account_bic for structural detection."""
        raw = {
            "credit_debit_indicator": "CRDT",
            "remittance_information": [],
            "debtor_agent": {"bic_fi": "INGBPLPW"},
            "creditor_agent": {},
            "debtor": {},
            "creditor": {},
        }
        # Without account_bic: not caught (different debtor vs no creditor)
        assert backfill_detect(raw, "enablebanking", account_bic=None) is False
        # With account_bic: caught by structural filter
        assert backfill_detect(raw, "enablebanking", account_bic="INGBPLPW") is True


# ============================================================================
# Description fallback detection (for backfill)
# ============================================================================

class TestDescriptionFallback:
    """Tests for detect_internal_from_descriptions fallback."""

    def test_description_original_match(self):
        assert _desc_detect(description_original="velo zasilenie styczen") is True

    def test_description_detailed_match(self):
        assert _desc_detect(description_detailed="Wpłatomat - wpłata własna ING") is True

    def test_description_display_match(self):
        assert _desc_detect(description_display="Smart Saver") is True

    def test_no_match(self):
        assert _desc_detect(
            description_display="BIEDRONKA",
            description_original="BIEDRONKA SKLEP",
            description_detailed="Zakupy spożywcze",
        ) is False

    def test_empty_fields(self):
        assert _desc_detect() is False

    def test_case_insensitive(self):
        assert _desc_detect(description_original="PRZELEW ŚRODKÓW na konto") is True

    def test_ascii_variant(self):
        """ASCII variant should also match."""
        assert _desc_detect(description_original="PRZELEW SRODKOW na konto") is True
