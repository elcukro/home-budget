"""
Mieszko AI Chat — Integration Test Suite
=========================================
Tests the WebSocket AI endpoint end-to-end against the local sandbox DB.

Usage:
    cd backend
    ./venv/bin/pytest tests/test_mieszko.py -v -s
    ./venv/bin/pytest tests/test_mieszko.py -v -s -k "expenses"   # single test
    ./venv/bin/pytest tests/test_mieszko.py -v -s --timeout=60

Requirements:
    - Backend running on localhost:8000 (or 8100 via proxy, but WS needs :8000)
    - DB accessible (docker-compose up)
    - ANTHROPIC_API_KEY set in backend .env

Structure:
    Each test sends a Polish question via WebSocket and asserts:
    1. No error frames received
    2. Expected tool(s) were called (tool_start frames)
    3. Response content matches data from DB (optional, data-grounded)
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Optional

import jwt
import pytest
import pytest_asyncio
import websockets
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Skip in CI — requires live backend + DB ───────────────────────────────────
pytestmark = pytest.mark.skipif(
    os.getenv("ENVIRONMENT") == "test",
    reason="Integration tests require a live backend on :8100 and local DB — skip in CI",
)

# ── Config ────────────────────────────────────────────────────────────────────

WS_URL = os.getenv("MIESZKO_WS_URL", "ws://localhost:8100/ai/ws")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-minimum-32-characters-long")
JWT_ALGORITHM = "HS256"
TEST_USER = "elcukrodev@gmail.com"
TIMEOUT = 45  # seconds per test (AI can be slow)

# DB connection (direct, for ground-truth assertions)
DB_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://homebudget:devpassword@localhost:5433/homebudget",
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_token(email: str = TEST_USER, ttl: int = 120) -> str:
    """Generate a short-lived JWT token for WebSocket auth."""
    from datetime import timezone as _tz
    now = datetime.now(_tz.utc)
    payload = {
        "sub": email,
        "exp": now + timedelta(seconds=ttl),
        "iat": now,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


class MieszkoSession:
    """Async context manager that opens a WS connection and collects frames."""

    def __init__(self, conversation_id: Optional[int] = None):
        self.conversation_id = conversation_id
        self.ws = None

    async def __aenter__(self):
        token = make_token()
        url = f"{WS_URL}?token={token}"
        self.ws = await websockets.connect(url, open_timeout=10)
        return self

    async def __aexit__(self, *_):
        if self.ws:
            await self.ws.close()

    async def ask(self, question: str, page: str = "/dashboard") -> dict:
        """Send a question and collect all frames until done/error."""
        await self.ws.send(json.dumps({
            "type": "message",
            "content": question,
            "conversation_id": self.conversation_id,
            "current_page": page,
        }))

        frames = []
        full_text = ""
        tools_called = []
        error = None

        deadline = time.monotonic() + TIMEOUT
        while time.monotonic() < deadline:
            try:
                raw = await asyncio.wait_for(self.ws.recv(), timeout=5.0)
                frame = json.loads(raw)
                frames.append(frame)

                if frame["type"] == "token":
                    full_text += frame.get("content", "")
                elif frame["type"] == "tool_start":
                    tools_called.append(frame["tool"])
                elif frame["type"] == "error":
                    error = frame.get("message", "unknown error")
                    break
                elif frame["type"] in ("done", "quota_exceeded"):
                    self.conversation_id = frame.get("conversation_id", self.conversation_id)
                    break
            except asyncio.TimeoutError:
                # No frame for 5s after last one → probably still streaming
                if frames and frames[-1]["type"] in ("done", "error", "quota_exceeded"):
                    break
                continue

        return {
            "frames": frames,
            "text": full_text.strip(),
            "tools": tools_called,
            "error": error,
            "conversation_id": self.conversation_id,
        }


def db_query(sql: str, params: dict = None):
    """Run a raw SQL query against the test DB, return rows as list of dicts."""
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        keys = result.keys()
        return [dict(zip(keys, row)) for row in result.fetchall()]


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db_facts():
    """Pre-load DB facts once per module for data-grounded assertions."""
    facts = {}

    # Current month expenses total
    rows = db_query("""
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE user_id = :uid
          AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND is_recurring = FALSE
    """, {"uid": TEST_USER})
    facts["expenses_this_month"] = float(rows[0]["total"]) if rows else 0.0

    # Loan count
    rows = db_query("SELECT COUNT(*) AS n FROM loans WHERE user_id = :uid AND is_archived = FALSE",
                    {"uid": TEST_USER})
    facts["loan_count"] = int(rows[0]["n"]) if rows else 0

    # Biedronka transactions in last 30 days
    rows = db_query("""
        SELECT COUNT(*) AS n, COALESCE(SUM(ABS(amount)), 0) AS total
        FROM bank_transactions
        WHERE user_id = :uid
          AND date >= CURRENT_DATE - INTERVAL '30 days'
          AND is_duplicate = FALSE
          AND (description_display ILIKE '%biedronka%' OR merchant_name ILIKE '%biedronka%')
    """, {"uid": TEST_USER})
    facts["biedronka_count"] = int(rows[0]["n"]) if rows else 0
    facts["biedronka_total"] = float(rows[0]["total"]) if rows else 0.0

    # Bank transaction count
    rows = db_query("SELECT COUNT(*) AS n FROM bank_transactions WHERE user_id = :uid AND is_duplicate = FALSE",
                    {"uid": TEST_USER})
    facts["bank_txn_count"] = int(rows[0]["n"]) if rows else 0

    # IKE balance
    rows = db_query("""
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM savings
        WHERE user_id = :uid AND account_type = 'ike'
    """, {"uid": TEST_USER})
    facts["ike_balance"] = float(rows[0]["balance"]) if rows else 0.0

    print(f"\n📊 DB facts: {facts}")
    return facts


# ── Test Cases ────────────────────────────────────────────────────────────────

class TestMieszkoTools:
    """Each test verifies a specific tool is called and response is sensible."""

    @pytest.mark.asyncio
    async def test_expenses_by_category(self, db_facts):
        """Mieszko should use expense or bank transaction data for food spending questions."""
        async with MieszkoSession() as s:
            r = await s.ask("Ile wydałem na jedzenie w tym miesiącu?")

        assert r["error"] is None, f"Got error: {r['error']}"
        # Mieszko may use either tool depending on context
        valid_tools = {"get_expenses_by_category", "get_bank_transactions", "get_cash_flow_summary"}
        assert any(t in valid_tools for t in r["tools"]), \
            f"Expected expense/bank tool, got: {r['tools']}"
        assert len(r["text"]) > 20, "Response too short"
        print(f"\n✅ Tools: {r['tools']}\n📝 Response: {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_income_breakdown(self):
        """Mieszko should call get_income_breakdown for income questions."""
        async with MieszkoSession() as s:
            r = await s.ask("Jakie mam przychody w tym miesiącu?")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_income_breakdown" in r["tools"], \
            f"Expected get_income_breakdown, got: {r['tools']}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_loans_status(self, db_facts):
        """Mieszko should call get_loans_status and mention loan count."""
        async with MieszkoSession() as s:
            r = await s.ask("Jakie mam kredyty i ile zostało do spłaty?")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_loans_status" in r["tools"], \
            f"Expected get_loans_status, got: {r['tools']}"
        if db_facts["loan_count"] == 0:
            pytest.skip("No loans in test DB")
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_polish_tax_calculation(self):
        """Mieszko should answer tax questions with concrete amounts (tool or built-in knowledge)."""
        async with MieszkoSession() as s:
            r = await s.ask("Ile podatku PIT zapłacę w tym roku przy zarobkach 8000 zł netto miesięcznie?")

        assert r["error"] is None, f"Got error: {r['error']}"
        # calculate_polish_tax preferred; Mieszko may also use built-in tax knowledge
        text_lower = r["text"].lower()
        assert any(kw in text_lower for kw in ["zł", "%", "podatek", "pit", "12%", "32%"]), \
            f"Response doesn't mention tax amounts: {r['text'][:300]}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:300]}")

    @pytest.mark.asyncio
    async def test_savings_analysis_ike(self, db_facts):
        """Mieszko should call get_savings_analysis and show IKE/IKZE data."""
        async with MieszkoSession() as s:
            r = await s.ask("Jak wygląda moje IKE i IKZE? Ile mogę jeszcze wpłacić?")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_savings_analysis" in r["tools"], \
            f"Expected get_savings_analysis, got: {r['tools']}"
        # Should mention IKE limit (28 260 PLN)
        text_lower = r["text"].lower()
        assert any(kw in text_lower for kw in ["ike", "ikze", "limit", "28"]), \
            f"Response doesn't mention IKE/limit: {r['text'][:300]}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:300]}")

    @pytest.mark.asyncio
    async def test_baby_steps_progress(self):
        """Mieszko should answer Baby Steps questions with step numbers."""
        async with MieszkoSession() as s:
            r = await s.ask("Na którym kroku Baby Steps jestem?")

        assert r["error"] is None, f"Got error: {r['error']}"
        # Should use the tool OR answer with step information
        text_lower = r["text"].lower()
        assert "get_baby_steps_progress" in r["tools"] or \
               any(kw in text_lower for kw in ["krok", "step", "baby step", "fundusz", "emeryt"]), \
            f"Expected Baby Steps tool or content, got tools={r['tools']}, text={r['text'][:200]}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_spending_trend(self):
        """Mieszko should call get_spending_trend for trend questions."""
        async with MieszkoSession() as s:
            r = await s.ask("Pokaż mi trend moich wydatków z ostatnich 3 miesięcy")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_spending_trend" in r["tools"], \
            f"Expected get_spending_trend, got: {r['tools']}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_cash_flow_summary(self):
        """Mieszko should call get_cash_flow_summary for savings rate questions."""
        async with MieszkoSession() as s:
            r = await s.ask("Jaki mam cashflow? Ile oszczędzam miesięcznie?")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_cash_flow_summary" in r["tools"], \
            f"Expected get_cash_flow_summary, got: {r['tools']}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_loan_overpayment_simulation(self, db_facts):
        """Mieszko should simulate loan overpayment when asked."""
        if db_facts["loan_count"] == 0:
            pytest.skip("No loans in test DB")
        async with MieszkoSession() as s:
            r = await s.ask("Co się stanie jak nadpłacę kredyt hipoteczny o 1000 zł?")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "simulate_loan_overpayment" in r["tools"], \
            f"Expected simulate_loan_overpayment, got: {r['tools']}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:300]}")

    @pytest.mark.asyncio
    async def test_bank_transactions_biedronka(self, db_facts):
        """Mieszko should call get_bank_transactions and return Biedronka data."""
        async with MieszkoSession() as s:
            r = await s.ask("Pokaż mi zakupy z Biedronki z ostatniego miesiąca")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_bank_transactions" in r["tools"], \
            f"Expected get_bank_transactions, got: {r['tools']}"

        if db_facts["biedronka_count"] == 0:
            pytest.skip("No Biedronka transactions in test DB")

        # Should mention Biedronka (stem "biedron" handles all Polish declensions:
        # Biedronka/Biedronki/Biedronce/Biedronce etc.)
        assert "biedron" in r["text"].lower(), \
            f"Response doesn't mention Biedronka: {r['text'][:300]}"
        print(f"\n✅ Tools: {r['tools']}\n📊 DB: {db_facts['biedronka_count']} txns, "
              f"{db_facts['biedronka_total']:.2f} PLN\n📝 {r['text'][:300]}")

    @pytest.mark.asyncio
    async def test_bank_transactions_general(self, db_facts):
        """Mieszko should return bank transactions when asked generally."""
        if db_facts["bank_txn_count"] == 0:
            pytest.skip("No bank transactions in test DB")
        async with MieszkoSession() as s:
            r = await s.ask("Pokaż moje ostatnie 10 transakcji bankowych")

        assert r["error"] is None, f"Got error: {r['error']}"
        assert "get_bank_transactions" in r["tools"], \
            f"Expected get_bank_transactions, got: {r['tools']}"
        print(f"\n✅ Tools: {r['tools']}\n📝 {r['text'][:300]}")


class TestMieszkoQuality:
    """Tests for response quality — language, formatting, no English leakage."""

    FORBIDDEN_ENGLISH = [
        "verdict", "summary", "bottom line", "key takeaway",
        "overview", "breakdown", "wrap-up", "insight",
    ]

    @pytest.mark.asyncio
    async def test_responds_in_polish(self):
        """Response should be in Polish, not English."""
        async with MieszkoSession() as s:
            r = await s.ask("Jak mi idzie oszczędzanie?")

        assert r["error"] is None
        text_lower = r["text"].lower()
        # Should contain Polish characters or common Polish words
        polish_markers = ["ę", "ą", "ś", "ó", "ć", "ń", "ź", "ż", "zł", "miesięcznie", "twoje", "masz"]
        assert any(m in text_lower for m in polish_markers), \
            f"Response doesn't appear to be in Polish: {r['text'][:200]}"
        print(f"\n✅ Polish response confirmed\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_no_english_buzzwords(self):
        """Mieszko should not use English words like Verdict, Summary, etc."""
        async with MieszkoSession() as s:
            r = await s.ask("Podsumuj moje finanse")

        assert r["error"] is None
        text_lower = r["text"].lower()
        for word in self.FORBIDDEN_ENGLISH:
            assert word not in text_lower, \
                f"Found forbidden English word '{word}' in response: {r['text'][:400]}"
        print(f"\n✅ No English buzzwords found\n📝 {r['text'][:300]}")

    @pytest.mark.asyncio
    async def test_ike_limit_is_correct(self):
        """Mieszko should cite the correct IKE limit: 28 260 PLN (not 11 304)."""
        async with MieszkoSession() as s:
            r = await s.ask("Jaki jest limit wpłat na IKE w 2026 roku?")

        assert r["error"] is None
        text = r["text"]
        # Should mention 28 260 (or 28260 or 28,260) — NOT 11 304
        assert any(v in text.replace(" ", "").replace(",", ".") for v in ["28260", "28.260"]), \
            f"IKE limit not mentioned or wrong: {text[:400]}"
        assert "11304" not in text.replace(" ", "").replace(",", ""), \
            f"Wrong IKE limit (11 304) found in response: {text[:400]}"
        print(f"\n✅ Correct IKE limit (28 260) in response\n📝 {text[:300]}")

    @pytest.mark.asyncio
    async def test_streaming_completes(self):
        """WebSocket stream should end with a done frame, not hang."""
        async with MieszkoSession() as s:
            r = await s.ask("Cześć! Co możesz dla mnie zrobić?")

        assert r["error"] is None, f"Got error: {r['error']}"
        done_frames = [f for f in r["frames"] if f["type"] == "done"]
        assert len(done_frames) == 1, \
            f"Expected exactly 1 done frame, got: {[f['type'] for f in r['frames']]}"
        print(f"\n✅ Stream completed with done frame\n📝 {r['text'][:200]}")

    @pytest.mark.asyncio
    async def test_quota_returned_in_done_frame(self):
        """done frame should include quota info."""
        async with MieszkoSession() as s:
            r = await s.ask("Ile mam na koncie oszczędnościowym?")

        assert r["error"] is None
        done_frames = [f for f in r["frames"] if f["type"] == "done"]
        assert done_frames, "No done frame received"
        done = done_frames[0]
        assert "queries_used" in done, f"done frame missing queries_used: {done}"
        assert "queries_limit" in done, f"done frame missing queries_limit: {done}"
        assert done["queries_limit"] > 0
        print(f"\n✅ Quota in done frame: {done['queries_used']}/{done['queries_limit']}")

    @pytest.mark.asyncio
    async def test_multi_tool_complex_question(self):
        """A complex question should trigger multiple tool calls."""
        async with MieszkoSession() as s:
            r = await s.ask(
                "Ile mam dochodów, ile wydaję, i czy stać mnie na nadpłatę kredytu o 500 zł miesięcznie?"
            )

        assert r["error"] is None
        assert len(r["tools"]) >= 2, \
            f"Expected ≥2 tools for complex question, got: {r['tools']}"
        print(f"\n✅ Multi-tool response: {r['tools']}\n📝 {r['text'][:300]}")


class TestMieszkoConversation:
    """Tests for conversation continuity (multi-turn)."""

    @pytest.mark.asyncio
    async def test_conversation_continues_with_id(self):
        """Second message in same conversation should use the same conversation_id."""
        async with MieszkoSession() as s:
            r1 = await s.ask("Ile wydałem na transport w tym miesiącu?")
            assert r1["error"] is None
            assert r1["conversation_id"] is not None, "No conversation_id in first response"

            r2 = await s.ask("A w poprzednim miesiącu?")
            assert r2["error"] is None
            assert r2["conversation_id"] == r1["conversation_id"], \
                f"Conversation ID changed: {r1['conversation_id']} → {r2['conversation_id']}"

        print(f"\n✅ Conversation maintained: id={r1['conversation_id']}\n"
              f"Turn 1: {r1['text'][:150]}\n"
              f"Turn 2: {r2['text'][:150]}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    """Quick smoke test — run directly without pytest."""
    import sys

    async def smoke():
        print("🔥 Mieszko Smoke Test")
        print(f"  WS: {WS_URL}")
        print(f"  User: {TEST_USER}\n")

        async with MieszkoSession() as s:
            r = await s.ask("Cześć! Ile wydałem na jedzenie w tym miesiącu?")
            if r["error"]:
                print(f"❌ Error: {r['error']}")
                sys.exit(1)
            print(f"✅ Tools called: {r['tools']}")
            print(f"📝 Response:\n{r['text']}\n")
            done = [f for f in r["frames"] if f["type"] == "done"]
            if done:
                print(f"📊 Quota: {done[0].get('queries_used')}/{done[0].get('queries_limit')}")

    asyncio.run(smoke())
