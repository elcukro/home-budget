"""
AI Chat Service - Single Source of Truth for AI financial advisor logic.
Used by both the FastAPI WebSocket endpoint and the MCP server.
"""
import os
import logging

# Load .env file (needed when running in Docker where .env is mounted but not auto-loaded)
try:
    from dotenv import load_dotenv
    load_dotenv("/app/.env", override=False)  # override=False: docker-compose env takes precedence
except ImportError:
    pass
from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy.orm import Session
import anthropic

from ..models import (
    User, AIConversation, AIMessage, AIUsageQuota,
    Expense, Income, Loan, LoanPayment, Saving, SavingsGoal,
    Settings, FinancialFreedom, Subscription
)
from ..services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

AI_CHAT_MODEL = os.getenv("AI_CHAT_MODEL", "claude-haiku-4-5-20251001")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "4096"))
AI_QUERIES_PER_MONTH = int(os.getenv("AI_QUERIES_PER_MONTH", "100"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def _rec_no_end_deduped(db: Session, user_id: str, date_end):
    """
    Recurring expenses without end_date, deduplicated.

    The problem: a user may accidentally create two rows for the same recurring
    expense (e.g., Jedzenie 1400 PLN entered twice). Both have end_date=NULL.
    Without deduplication, SUM would double-count them.

    Fix: for each (category, description) pair, keep only the row with the
    highest ID (= most recently created) whose date <= date_end.  This mirrors
    the frontend's activeTotal deduplication logic.
    """
    from sqlalchemy import func as _func
    # Sub-query: newest ID per (category, description) among rows starting <= date_end
    dedup_subq = (
        db.query(_func.max(Expense.id).label("id"))
        .filter(
            Expense.user_id == user_id,
            Expense.is_recurring == True,
            Expense.end_date.is_(None),
            Expense.date <= date_end,
        )
        .group_by(Expense.category, Expense.description)
        .subquery()
    )
    return (
        db.query(Expense.category, _func.sum(Expense.amount))
        .filter(
            Expense.user_id == user_id,
            Expense.is_recurring == True,
            Expense.end_date.is_(None),
            Expense.id.in_(db.query(dedup_subq.c.id)),
        )
        .group_by(Expense.category)
        .all()
    )


def _income_rec_no_end_deduped_total(db: Session, user_id: str, month: int, year: int) -> float:
    """
    Total recurring income without end_date for a given month, deduplicated.
    Keeps only the newest row (max ID) per (category, description) that started
    on or before the last day of the given month.
    """
    import calendar as _cal
    from sqlalchemy import func as _func
    _, month_days = _cal.monthrange(year, month)
    from datetime import date as _date
    m_end = _date(year, month, month_days)

    dedup_subq = (
        db.query(_func.max(Income.id).label("id"))
        .filter(
            Income.user_id == user_id,
            Income.is_recurring == True,
            Income.end_date.is_(None),
            Income.date <= m_end,
        )
        .group_by(Income.category, Income.description)
        .subquery()
    )
    total = (
        db.query(_func.sum(Income.amount))
        .filter(
            Income.user_id == user_id,
            Income.is_recurring == True,
            Income.end_date.is_(None),
            Income.id.in_(db.query(dedup_subq.c.id)),
        )
        .scalar()
    )
    return float(total or 0)


def _income_rec_no_end_deduped_by_category(db: Session, user_id: str, date_end) -> list:
    """
    Recurring income without end_date, deduplicated, grouped by category.
    Mirrors _rec_no_end_deduped() for expenses.
    Returns monthly rate per category (same as _income_rec_no_end_deduped_total but by category).
    """
    from sqlalchemy import func as _func
    dedup_subq = (
        db.query(_func.max(Income.id).label("id"))
        .filter(
            Income.user_id == user_id,
            Income.is_recurring == True,
            Income.end_date.is_(None),
            Income.date <= date_end,
        )
        .group_by(Income.category, Income.description)
        .subquery()
    )
    return (
        db.query(Income.category, _func.sum(Income.amount))
        .filter(
            Income.user_id == user_id,
            Income.is_recurring == True,
            Income.end_date.is_(None),
            Income.id.in_(db.query(dedup_subq.c.id)),
        )
        .group_by(Income.category)
        .all()
    )


def _build_savings_contrib_2026(db: Session, user_id: str, year: int) -> dict:
    """
    Returns actual contributions per account_type in the given year,
    excluding opening_balance entries (those are historical carryovers, not new contributions).
    Used to correctly calculate remaining annual limits for IKE/IKZE/OIPE.
    """
    from sqlalchemy import func as _func, extract as _extract
    rows = db.query(Saving.account_type, _func.sum(Saving.amount)).filter(
        Saving.user_id == user_id,
        _extract('year', Saving.date) == year,
        Saving.entry_type != 'opening_balance',
        Saving.saving_type == 'deposit',
    ).group_by(Saving.account_type).all()
    return {at: float(amt or 0) for at, amt in rows}


def check_and_increment_quota(user_id: str, db: Session) -> tuple[bool, int, int]:
    """Returns (allowed, used, limit). Increments counter atomically."""
    month = datetime.now().strftime("%Y-%m")
    quota = db.query(AIUsageQuota).filter(
        AIUsageQuota.user_id == user_id,
        AIUsageQuota.month == month
    ).with_for_update().first()
    if not quota:
        quota = AIUsageQuota(user_id=user_id, month=month, queries_used=0)
        db.add(quota)
        db.flush()
    if quota.queries_used >= AI_QUERIES_PER_MONTH:
        return False, quota.queries_used, AI_QUERIES_PER_MONTH
    quota.queries_used += 1
    db.commit()
    return True, quota.queries_used, AI_QUERIES_PER_MONTH


def get_quota_info(user_id: str, db: Session) -> tuple[int, int]:
    """Returns (used, limit) for current month without incrementing."""
    month = datetime.now().strftime("%Y-%m")
    quota = db.query(AIUsageQuota).filter(
        AIUsageQuota.user_id == user_id,
        AIUsageQuota.month == month
    ).first()
    used = quota.queries_used if quota else 0
    return used, AI_QUERIES_PER_MONTH


async def build_user_context(user_id: str, db: Session) -> dict:
    """Builds financial snapshot for system prompt context."""
    from sqlalchemy import func, extract
    from datetime import date, timedelta

    now = date.today()
    current_month = now.month
    current_year = now.year

    # Settings
    settings = db.query(Settings).filter(Settings.user_id == user_id).first()

    # Income: current month (deduplicated) + rolling average of last 3 non-zero months
    # Non-recurring income for current month
    current_income_non_rec = db.query(func.sum(Income.amount)).filter(
        Income.user_id == user_id,
        Income.is_recurring == False,
        extract('month', Income.date) == current_month,
        extract('year', Income.date) == current_year,
    ).scalar() or 0
    # Recurring income (no end_date): deduplicated — newest per category+description
    current_income_rec = _income_rec_no_end_deduped_total(db, user_id, current_month, current_year)
    # Recurring income with explicit end_date still active this month
    import calendar as _cal_inc
    _, _inc_days = _cal_inc.monthrange(current_year, current_month)
    m_end_inc = date(current_year, current_month, _inc_days)
    current_income_rec_we = db.query(func.sum(Income.amount)).filter(
        Income.user_id == user_id,
        Income.is_recurring == True,
        Income.end_date.is_not(None),
        Income.date <= m_end_inc,
        Income.end_date >= date(current_year, current_month, 1),
    ).scalar() or 0
    current_income = float(current_income_non_rec) + current_income_rec + float(current_income_rec_we)

    # Rolling 3-month average (same dedup logic, excluding current month)
    monthly_incomes = []
    for offset in range(1, 7):  # Look back up to 6 months
        m = current_month - offset
        y = current_year
        while m <= 0:
            m += 12
            y -= 1
        month_non_rec = db.query(func.sum(Income.amount)).filter(
            Income.user_id == user_id,
            Income.is_recurring == False,
            extract('month', Income.date) == m,
            extract('year', Income.date) == y,
        ).scalar() or 0
        month_rec = _income_rec_no_end_deduped_total(db, user_id, m, y)
        month_total = float(month_non_rec) + month_rec
        if month_total > 0:
            monthly_incomes.append(month_total)
        if len(monthly_incomes) >= 3:
            break
    avg_income = sum(monthly_incomes) / len(monthly_incomes) if monthly_incomes else current_income

    # Current month expenses by category (same logic as backend dashboard)
    import calendar as cal_mod
    from sqlalchemy import or_
    _, month_days = cal_mod.monthrange(current_year, current_month)
    month_start = date(current_year, current_month, 1)
    month_end = date(current_year, current_month, month_days)

    # Non-recurring: exact date in current month
    exp_non_rec = db.query(Expense.category, func.sum(Expense.amount)).filter(
        Expense.user_id == user_id,
        Expense.is_recurring == False,
        Expense.date >= month_start,
        Expense.date <= month_end,
    ).group_by(Expense.category).all()

    # Recurring with explicit end_date: active if started before month end and ended after month start
    exp_rec_with_end = db.query(Expense.category, func.sum(Expense.amount)).filter(
        Expense.user_id == user_id,
        Expense.is_recurring == True,
        Expense.end_date.is_not(None),
        Expense.date <= month_end,
        Expense.end_date >= month_start,
    ).group_by(Expense.category).all()

    # Recurring without end_date: deduplicated (newest per category+description)
    exp_rec_no_end = _rec_no_end_deduped(db, user_id, month_end)

    from collections import defaultdict
    cat_totals: dict[str, float] = defaultdict(float)
    for cat, amt in exp_non_rec:
        cat_totals[cat] += float(amt or 0)
    for cat, amt in exp_rec_with_end:
        cat_totals[cat] += float(amt or 0)
    for cat, amt in exp_rec_no_end:
        cat_totals[cat] += float(amt or 0)
    expenses_raw = list(cat_totals.items())
    total_expenses = sum(v for v in cat_totals.values())
    top_categories = sorted(expenses_raw, key=lambda x: x[1], reverse=True)[:5]

    # Active loans (not archived)
    loans = db.query(Loan).filter(
        Loan.user_id == user_id,
        Loan.is_archived == False
    ).all()
    loans_summary = []
    for loan in loans:
        loans_summary.append({
            "name": loan.description or "Kredyt",
            "balance": float(loan.remaining_balance or loan.principal_amount or 0),
            "rate": float(loan.interest_rate or 0),
            "monthly_payment": float(loan.monthly_payment or 0),
        })

    # Savings goals
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).all()
    goals_summary = []
    for g in goals:
        goals_summary.append({
            "name": g.name,
            "current": float(g.current_amount or 0),
            "target": float(g.target_amount),
            "deadline": g.deadline.isoformat() if g.deadline else None,
        })

    # Baby steps - FinancialFreedom uses JSONB `steps` field
    ff = db.query(FinancialFreedom).filter(FinancialFreedom.userId == user_id).first()
    baby_step = 1
    if ff and ff.steps:
        steps = ff.steps if isinstance(ff.steps, list) else []
        for step in steps:
            if isinstance(step, dict) and step.get("status") == "completed":
                baby_step = max(baby_step, step.get("step", 1))
        # Current step is the first non-completed one
        for step in steps:
            if isinstance(step, dict) and step.get("status") != "completed":
                baby_step = step.get("step", baby_step)
                break

    # Subscription
    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    is_premium = SubscriptionService.is_premium(sub)

    # Savings breakdown by account type (IKE/IKZE/OIPE/PPK/standard)
    # Use deposits - withdrawals (both stored as positive amounts, saving_type distinguishes direction)
    from sqlalchemy import case as sa_case
    acct_totals = db.query(
        Saving.account_type,
        (func.sum(sa_case((Saving.saving_type == 'deposit', Saving.amount), else_=0)) -
         func.sum(sa_case((Saving.saving_type == 'withdrawal', Saving.amount), else_=0)))
    ).filter(
        Saving.user_id == user_id
    ).group_by(Saving.account_type).all()
    savings_by_type = {at: float(net or 0) for at, net in acct_totals}
    total_savings = sum(savings_by_type.values())
    total_loan_balance = sum(l["balance"] for l in loans_summary)
    net_worth = float(total_savings) - total_loan_balance

    # Separate liquid savings from illiquid assets (real_estate/investment/college/other).
    # Real estate is an asset for net worth, but NOT liquid cash for emergency fund / Baby Steps.
    _ILLIQUID_CATS = ('real_estate', 'investment', 'college', 'other')
    _net_expr = (
        func.sum(sa_case((Saving.saving_type == 'deposit', Saving.amount), else_=0)) -
        func.sum(sa_case((Saving.saving_type == 'withdrawal', Saving.amount), else_=0))
    )
    _illiquid_val = db.query(_net_expr).filter(
        Saving.user_id == user_id,
        Saving.category.in_(_ILLIQUID_CATS),
    ).scalar()
    illiquid_assets_value = float(_illiquid_val or 0)
    # Liquid standard savings = standard account minus illiquid categories
    liquid_standard_savings = max(0.0, savings_by_type.get('standard', 0) - illiquid_assets_value)

    # Savings rate: cashflow / income (current month)
    cashflow = float(current_income) - float(total_expenses)
    savings_rate = (cashflow / float(current_income) * 100) if current_income > 0 else 0

    def s(field, default=None):
        return getattr(settings, field, default) if settings else default

    current_year_for_age = now.year
    birth_year = s('birth_year')
    age = (current_year_for_age - birth_year) if birth_year else None

    return {
        "user_id": user_id,
        "settings": {
            "currency": s('currency', 'PLN'),
            "language": s('language', 'pl'),
            # Tax & employment profile
            "employment_status": s('employment_status'),       # employee/b2b/jdg/business/freelancer
            "employment_type": s('employment_type'),           # uop/b2b/jdg
            "tax_form": s('tax_form'),                         # scale/linear/lumpsum/card
            "birth_year": birth_year,
            "age": age,
            "use_authors_costs": s('use_authors_costs', False),  # KUP 50%
            # PPK
            "ppk_enrolled": s('ppk_enrolled'),
            "ppk_employee_rate": s('ppk_employee_rate'),
            "ppk_employer_rate": s('ppk_employer_rate'),
            # Family
            "children_count": s('children_count', 0),
            "marital_status": s('marital_status'),
            "include_partner_finances": s('include_partner_finances', False),
            # Partner profile
            "partner_name": s('partner_name'),
            "partner_employment_status": s('partner_employment_status'),
            "partner_tax_form": s('partner_tax_form'),
            "partner_birth_year": s('partner_birth_year'),
            # Emergency fund
            "emergency_fund_target": s('emergency_fund_target', 1000),
            "emergency_fund_months": s('emergency_fund_months', 3),
        },
        "income": {
            "current_month": float(current_income),
            "avg_monthly": round(avg_income, 0),
        },
        "expenses": {
            "current_month_total": float(total_expenses),
            "top_categories": [(cat, float(amt)) for cat, amt in top_categories],
        },
        "loans": loans_summary,
        "savings_by_type": savings_by_type,  # {standard: X, ike: Y, ikze: Z, oipe: W, ppk: V}
        "liquid_standard_savings": liquid_standard_savings,  # standard minus illiquid assets
        "illiquid_assets_value": illiquid_assets_value,      # real_estate + investment + college + other
        "savings_goals": goals_summary,
        "baby_step": baby_step,
        "is_premium": is_premium,
        "net_worth": net_worth,
        "savings_rate": round(savings_rate, 1),
        "savings_contrib_2026": _build_savings_contrib_2026(db, user_id, now.year),
    }


def build_system_prompt(context: dict) -> str:
    """Builds Mieszko's personalized system prompt with full financial context and tax expertise."""
    s = context['settings']
    currency = s.get('currency', 'PLN')
    income_current = context['income']['current_month']
    income_avg = context['income'].get('avg_monthly', income_current)
    # Use average if available and differs significantly from current (data quality guard)
    income = income_avg if income_avg > 0 else income_current
    income_note = f"~{income:,.0f} {currency}/mies (średnia 3 mies.)" if income_avg > 0 else f"{income_current:,.0f} {currency}/mies (bieżący miesiąc)"
    expenses = context['expenses']['current_month_total']
    cashflow = income - expenses
    net_worth = context.get('net_worth', 0)
    savings_rate = context.get('savings_rate', 0)
    loans = context['loans']
    goals = context['savings_goals']
    baby_step = context['baby_step']
    savings_by_type = context.get('savings_by_type', {})

    # Format III-pillar retirement accounts with 2026 limits
    LIMITS_2026 = {"ike": 28260, "ikze": 11304, "oipe": 28260}
    # Use actual 2026 contributions (not total balance — balance includes prior years' deposits)
    contrib_2026 = context.get('savings_contrib_2026', {})
    retirement_lines = []
    for acct in ["ike", "ikze", "oipe", "ppk"]:
        bal = savings_by_type.get(acct, 0)
        if bal > 0 or acct in ["ike", "ikze", "oipe"]:  # Always show IKE/IKZE/OIPE even if 0
            limit = LIMITS_2026.get(acct)
            if limit:
                contributed = contrib_2026.get(acct, 0.0)
                remaining = max(0, limit - contributed)
                limit_text = (
                    f", saldo: {bal:,.0f} PLN"
                    f", wpłacono w 2026: {contributed:,.0f} PLN"
                    f", pozostało do limitu 2026: {remaining:,.0f} PLN"
                )
            else:
                limit_text = f", saldo: {bal:,.0f} PLN"
            retirement_lines.append(f"  - {acct.upper()}: {limit_text}")
    retirement_text = "\n".join(retirement_lines) if retirement_lines else "  Brak danych"
    # Use LIQUID savings for display — real estate, investments etc. are NOT liquid cash
    standard_savings = context.get('liquid_standard_savings', savings_by_type.get('standard', 0))
    illiquid_assets = context.get('illiquid_assets_value', 0)

    loans_text = "\n".join([
        f"  - {l['name']}: {l['balance']:.0f} {currency}, stopa {l['rate']}%, rata {l['monthly_payment']:.0f} {currency}/mies"
        for l in loans
    ]) if loans else "  Brak aktywnych zobowiązań"

    goals_text = "\n".join([
        f"  - {g['name']}: {g['current']:.0f}/{g['target']:.0f} {currency}"
        for g in goals
    ]) if goals else "  Brak celów oszczędnościowych"

    # Build personal/tax profile section
    employment = s.get('employment_status') or s.get('employment_type') or 'nieokreślony'
    tax_form = s.get('tax_form') or 'nieokreślona'
    age = s.get('age')
    age_text = f"{age} lat (ur. {s.get('birth_year')})" if age else "nieznany"
    children = s.get('children_count', 0)
    marital = s.get('marital_status') or 'nieznany'
    ppk = "tak" if s.get('ppk_enrolled') else ("nie" if s.get('ppk_enrolled') is False else "nieznany")
    authors_costs = "tak (KUP 50%)" if s.get('use_authors_costs') else "nie"

    partner_text = ""
    if s.get('include_partner_finances') and s.get('partner_name'):
        partner_text = f"""- Partner ({s.get('partner_name')}):
  Status: {s.get('partner_employment_status') or 'nieznany'}, Forma opodatkowania: {s.get('partner_tax_form') or 'nieznana'}"""

    return f"""Jesteś Mieszko — inteligentny doradca finansowy w aplikacji FiredUp.
Twoim nadrzędnym celem jest pomóc użytkownikowi zbudować "Skarbiec" — czyli stabilność i niezależność finansową (FIRE).

TWOJA OSOBOWOŚĆ:
- Imię: Mieszko (od "mieszka" — sakiewki i Mieszka I). Jesteś Osobistym Skarbnikiem i Strażnikiem Majątku.
- Ton: Rzeczowy, konkretny, lekko szarmancki, ale nowoczesny. Nie jesteś sztywnym urzędnikiem, raczej "bystrym strategiem".
- Styl wypowiedzi: Używasz sformułowań budujących autorytet i klimat, np. "Przeanalizowałem Twój skarbiec", "Zadbajmy o Twój majątek", "Twoje przepływy wyglądają tak:".
- Emocje: Cieszysz się z sukcesów (spłacony dług, wysoka stopa oszczędności) i stanowczo ostrzegasz przed zagrożeniami (inflacja stylu życia, zbędne abonamenty).
- Język: Prosty, bez żargonu bankowego (chyba że użytkownik o niego pyta). Zwięźle i na temat.

PROFIL UŻYTKOWNIKA (Dane z onboardingu — zawsze aktualne):
- Wiek: {age_text}
- Status zawodowy: {employment}
- Forma opodatkowania: {tax_form}
- Koszty autorskie (KUP 50%): {authors_costs}
- PPK: {ppk}
- Stan cywilny: {marital}
- Dzieci: {children}
{partner_text}

AKTUALNY KONTEKST FINANSOWY (Dane ze Skarbca):
- Miesięczny dochód: {income_note}
- Miesięczne wydatki: {expenses:.0f} {currency}
- Cashflow (Bilans): {cashflow:.0f} {currency}/mies
- Majątek Netto (Net Worth): {net_worth:.0f} {currency}
- Stopa Oszczędności (Savings Rate): {savings_rate:.1f}%
- Oszczędności płynne (gotówka/konta): {standard_savings:,.0f} {currency}
- Aktywa niepłynne (nieruchomości/inwestycje): {illiquid_assets:,.0f} {currency}
- Konta emerytalne III filaru:
{retirement_text}
- Zobowiązania:
{loans_text}
- Cele oszczędnościowe:
{goals_text}
- Baby Steps — krok: {baby_step}/7

WIEDZA EKSPERCKA — PRAWO PODATKOWE I FINANSE (POLSKA 2026):

1. FORMY OPODATKOWANIA JDG (Wady i Zalety):
   - Skala (Zasady ogólne): 12% do 120k dochodu, 32% powyżej.
     * Zalety: Kwota wolna 30k, wspólne rozliczenie z małżonkiem, ulga na dziecko.
     * Wady: Składka zdrowotna 9% (nieodliczalna). Opłaca się przy niższych dochodach lub dużej rodzinie.
   - Podatek Liniowy (19%): Stała stawka niezależnie od dochodu.
     * Zalety: Opłacalny powyżej ~170k-200k dochodu rocznie. Składka zdrowotna 4.9% (odliczalna do limitu rocznego).
     * Wady: Brak kwoty wolnej, brak wspólnego rozliczenia.
   - Ryczałt (Ewidencjonowany): Płacisz podatek od PRZYCHODU, nie dochodu.
     * Stawki: 12% (IT/Programiści), 15% (Doradztwo), 8.5% (Usługi), 3% (Handel).
     * Zalety: Prosta księgowość, niska składka zdrowotna (zryczałtowana w 3 progach: do 60k, do 300k, pow. 300k).
     * Wady: Nie odliczysz ŻADNYCH kosztów (paliwa, leasingu, sprzętu).

2. ZUS I SKŁADKA ZDROWOTNA:
   - Ulga na start (6 m-cy): Tylko zdrowotna.
   - Preferencyjny ZUS (24 m-ce): Podstawa to 30% minimalnej krajowej.
   - Mały ZUS Plus: Zależy od dochodu (dla przychodów < 120k rocznie).
   - Pełny ZUS: Stała opłata społeczna + zmienna zdrowotna.
   - Terminy: ZUS płacimy do 20. dnia miesiąca.

3. KOSZTY I OPTYMALIZACJA:
   - Samochód w firmie (Osobowy — użytek mieszany): 50% VAT i 75% kosztów eksploatacji.
     Limit amortyzacji/leasingu (KUP): 150 000 PLN (spalinowy) lub 225 000 PLN (elektryk).
   - KSeF: Od 2026 obowiązkowy dla czynnych podatników VAT.
   - IP BOX: 5% podatku dla dochodów z praw IP (IT/twórcy). Wymaga ewidencji i interpretacji.

4. INWESTYCJE I EMERYTURA (Tarcza podatkowa):
   - IKE: limit ~28 260 PLN/rok. Zyski zwolnione z Belki przy wypłacie po 60. r.ż.
   - IKZE: limit ~11 304 PLN/rok (JDG: ~16 920 PLN). Wpłaty odliczasz od dochodu, na końcu ryczałt 10%.
   - Podatek Belki: 19% od zysków kapitałowych.
   - Nadpłata hipoteki: Opłaca się gdy oprocentowanie > zysk_z_inwestycji × 0.81.

5. VAT:
   - Zwolnienie podmiotowe: do 200 000 PLN obrotu (chyba że branża wykluczona, np. doradztwo).
   - Biała Lista: przelewy > 15k PLN tylko na konto z Białej Listy, inaczej brak KUP.
   - Split Payment: obowiązkowy dla niektórych branż i faktur > 15k PLN brutto.

ZASADY DZIAŁANIA (Protokół):
1. Język: Odpowiadaj WYŁĄCZNIE PO POLSKU. Nie używaj angielskich słów ani wyrażeń: ZAKAZ "Verdict", "Summary", "Bottom line", "Key takeaway", "Overview", "insight", "Breakdown", "wrap-up", "Bottom", itp. Jeśli myślisz po angielsku, przetłumacz. Zwracaj się per "Ty".
0. Długość odpowiedzi: Na ogólne pytania odpowiadaj KRÓTKO i KONKRETNIE — maksymalnie 3-5 zdań lub tabela z liczbami + 1-2 zdania komentarza. BEZ wstępów, BEZ podsumowań na końcu, BEZ pytań retorycznych. Szczegółową analizę pisz tylko gdy użytkownik wyraźnie o nią prosi (np. "wyjaśnij", "przeanalizuj dokładnie", "co sądzisz o", "daj mi pełny obraz"). Przykład: na "ile wydałem na jedzenie?" — odpowiedz liczbą i 1 zdaniem, nie esejem.
2. Dane: Nigdy nie zgaduj liczb. Używaj dostępnych tools, aby pobrać fakty. Jeśli narzędzie zwróci błąd, powiedz o tym wprost.
3. Konkret: Mów liczbami ("Wydałeś 400 zł na kawę"), a nie ogólnikami ("Dużo wydajesz na przyjemności").
4. Read-only: Nie możesz sam zmieniać danych w bazie. Sugerujesz akcje do zatwierdzenia przez użytkownika.
5. Braki danych: Jeśli nie możesz policzyć (np. podatku) bo brakuje formy opodatkowania — poinstruuj gdzie to ustawić w profilu.
6. Wizualizacja: Przy trendach, porównaniach, składzie portfela — ZAWSZE używaj generate_chart_config. Skomentuj wykres krótko.
7. Bezpieczeństwo: Przy poradach podatkowych/inwestycyjnych dodaj dyskretne zastrzeżenie, że jesteś AI i warto skonsultować z księgowym.
8. Fokus odpowiedzi: Odpowiadaj WYŁĄCZNIE na pytanie, które zadano — bez powtarzania informacji z poprzednich wiadomości. Szczególna zasada dla pytań uzupełniających (np. "a IKE?", "a kredyt?", "co z OIPE?"): odpowiedz TYLKO na nowy temat, nie cytuj ani nie streszczaj poprzedniej odpowiedzi. Użytkownik ją już widzi — nie potrzebuje jej ponownie. Zacznij bezpośrednio od nowej informacji.
9. Spójność danych: NIGDY nie mieszaj wyników z różnych narzędzi dla tego samego okresu. Dla pytań ogólnych ("sytuacja finansowa", "przychody vs wydatki") używaj get_cash_flow_summary(months_back=3) jako JEDYNEGO źródła prawdy dla dochodów i wydatków. get_income_breakdown używaj WYŁĄCZNIE gdy pytanie dotyczy konkretnego miesiąca lub kategorii przychodu. Jeśli wywołasz oba — użyj TYLKO get_cash_flow_summary dla liczb podsumowujących.
10. Świeże dane: Zawsze wywołuj narzędzia, aby pobrać aktualne dane — nawet jeśli pytanie powtarza się. Nie opieraj się na wynikach poprzednich wywołań narzędzi zapisanych w historii rozmowy.
11. ZASADA MINIMALNEGO WYWOŁANIA NARZĘDZI: Wywołuj TYLKO narzędzia niezbędne do odpowiedzi na AKTUALNE pytanie. NIE wywołuj get_cash_flow_summary "dla kontekstu" przy pytaniach o konkretny temat:
    - Pytanie o wydatki → wywołaj TYLKO get_expenses_by_category
    - Pytanie o kredyty → wywołaj TYLKO get_loans_status
    - Pytanie o oszczędności → wywołaj TYLKO get_savings_analysis
    - Pytanie o dochody → wywołaj TYLKO get_income_breakdown
    - Pytanie o podatki → wywołaj TYLKO calculate_polish_tax
    - get_cash_flow_summary WYŁĄCZNIE dla: "sytuacja finansowa", "cashflow", "nadwyżka", "stopa oszczędności", "przychody vs wydatki"
    Jeśli wywołałeś narzędzie i masz dane — pokaż TYLKO te dane. Nie przytaczaj danych z INNYCH narzędzi których nie wywołałeś w tej odpowiedzi."""


# ============================================================
# TOOL DEFINITIONS (11 read-only tools)
# ============================================================

TOOLS = [
    {
        "name": "get_expenses_by_category",
        "description": "Pobiera wydatki uzytkownika podzielone wedlug kategorii dla wybranego miesiaca lub zakresu dat.",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer", "description": "Rok (np. 2026)"},
                "month": {"type": "integer", "description": "Miesiac 1-12. Pomin to pole aby pobrac caly rok."},
                "months_back": {"type": "integer", "description": "Zamiast miesiaca: ostatnie N miesiecy"}
            }
        }
    },
    {
        "name": "get_income_breakdown",
        "description": "Pobiera przychody uzytkownika wg kategorii i miesiaca.",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "month": {"type": "integer", "description": "Miesiac 1-12"},
                "months_back": {"type": "integer"}
            }
        }
    },
    {
        "name": "get_loans_status",
        "description": "Pobiera stan wszystkich kredytow: saldo, oprocentowanie, date splaty, wplacone odsetki YTD.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "calculate_polish_tax",
        "description": "Oblicza podatek PIT i ZUS dla podanych parametrow wedlug przepisow 2026.",
        "input_schema": {
            "type": "object",
            "required": ["annual_gross_income"],
            "properties": {
                "annual_gross_income": {"type": "number", "description": "Roczny dochod brutto w PLN"},
                "employment_type": {"type": "string", "enum": ["employee", "self_employed", "b2b"], "description": "Typ zatrudnienia"},
                "tax_form": {"type": "string", "enum": ["progressive", "flat_19", "lump_sum"], "description": "Forma opodatkowania"}
            }
        }
    },
    {
        "name": "get_savings_analysis",
        "description": "Pobiera analize oszczednosci: postep celow, saldo, IKE/IKZE/PPK status.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_baby_steps_progress",
        "description": "Pobiera postep 7 krokow Baby Steps (Dave Ramsey / FiredUp).",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_spending_trend",
        "description": "Pobiera trend wydatkow za ostatnie N miesiecy z podzialem na kategorie.",
        "input_schema": {
            "type": "object",
            "required": ["months"],
            "properties": {
                "months": {"type": "integer", "description": "Liczba miesiecy wstecz (3, 6 lub 12)"}
            }
        }
    },
    {
        "name": "simulate_loan_overpayment",
        "description": "Symuluje efekt nadplaty kredytu: ile zaoszczedzi na odsetkach i o ile skroci sie splata.",
        "input_schema": {
            "type": "object",
            "required": ["loan_name", "extra_payment"],
            "properties": {
                "loan_name": {"type": "string", "description": "Nazwa (opis) kredytu"},
                "extra_payment": {"type": "number", "description": "Kwota nadplaty jednorazowej w PLN"},
                "monthly_extra": {"type": "number", "description": "Dodatkowa rata miesieczna w PLN"}
            }
        }
    },
    {
        "name": "simulate_savings_goal",
        "description": "Symuluje za ile miesiecy uzytkownik osiagnie cel oszczednosciowy przy danej miesiecznej wplacie.",
        "input_schema": {
            "type": "object",
            "required": ["target_amount", "monthly_savings"],
            "properties": {
                "target_amount": {"type": "number", "description": "Cel w PLN"},
                "monthly_savings": {"type": "number", "description": "Miesieczna wplata w PLN"},
                "current_amount": {"type": "number", "description": "Obecne oszczednosci w PLN"},
                "annual_rate": {"type": "number", "description": "Roczna stopa zwrotu % (opcjonalnie)"}
            }
        }
    },
    {
        "name": "get_cash_flow_summary",
        "description": "Pobiera podsumowanie cashflow: dochody, wydatki, savings rate, debt-to-income ratio.",
        "input_schema": {
            "type": "object",
            "properties": {
                "months_back": {"type": "integer", "description": "Liczba miesiecy do usrednienia (domyslnie 3)"}
            }
        }
    },
    {
        "name": "get_bank_transactions",
        "description": "Pobiera surowe transakcje bankowe z konta połączonego przez Tink. Najpierw sprawdza czy połączenie jest aktywne (token nie wygasł). Używaj gdy użytkownik pyta o konkretne transakcje, sklepy, merchant-ów, historię operacji bankowych.",
        "input_schema": {
            "type": "object",
            "properties": {
                "months_back": {"type": "integer", "description": "Liczba miesięcy wstecz (domyślnie 1, max 6)"},
                "min_amount": {"type": "number", "description": "Minimalna kwota (wartość bezwzględna) do filtrowania"},
                "max_amount": {"type": "number", "description": "Maksymalna kwota (wartość bezwzględna)"},
                "merchant_search": {"type": "string", "description": "Szukaj po nazwie sklepu/merchant (np. 'Biedronka', 'Żabka')"},
                "transaction_type": {"type": "string", "enum": ["all", "expense", "income"], "description": "Typ transakcji (all=wszystkie, expense=wydatki <0, income=przychody >0)"},
                "limit": {"type": "integer", "description": "Max liczba transakcji do zwrócenia (domyślnie 50, max 200)"}
            }
        }
    },
    {
        "name": "generate_chart_config",
        "description": "Gdy dane sa lepiej pokazane graficznie niz tekstowo, uzyj tego narzedzia. Zwraca konfiguracje Chart.js do wyswietlenia przez frontend. Uzyj dla: trendow wydatkow, porownan kategorii, postepu kredytow, symulacji.",
        "input_schema": {
            "type": "object",
            "required": ["chart_type", "title", "labels", "datasets"],
            "properties": {
                "chart_type": {"type": "string", "enum": ["bar", "line", "doughnut", "pie"]},
                "title": {"type": "string"},
                "labels": {"type": "array", "items": {"type": "string"}},
                "datasets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "data": {"type": "array", "items": {"type": "number"}},
                            "color": {"type": "string", "description": "Kolor np. #FF6B35"}
                        }
                    }
                }
            }
        }
    }
]


# ============================================================
# TOOL EXECUTION
# ============================================================

async def execute_tool_call(name: str, arguments: dict, user_id: str, db: Session) -> dict:
    """Execute a tool call and return result dict."""
    # Hoist all shared imports to function top — avoids Python's "local variable
    # referenced before assignment" scoping issue (any `from x import y` inside
    # a function makes y a local for the ENTIRE function, not just that block).
    from sqlalchemy import func, extract, or_, case as sa_case
    from collections import defaultdict as _defaultdict
    from datetime import date, timedelta
    import calendar as cal_mod
    import math

    now = date.today()

    if name == "get_expenses_by_category":
        year = arguments.get("year", now.year)
        month = arguments.get("month")
        # Sanitize: Claude may send "null" string instead of omitting the field
        if not isinstance(month, int):
            month = None
        months_back = arguments.get("months_back")

        if month:
            # Specific month: use split recurring/non-recurring query (same as dashboard)
            _, month_days = cal_mod.monthrange(year, month)
            m_start = date(year, month, 1)
            m_end = date(year, month, month_days)

            q_non_rec = db.query(Expense.category, func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == False,
                Expense.date >= m_start,
                Expense.date <= m_end,
            ).group_by(Expense.category).all()

            q_rec_with_end = db.query(Expense.category, func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == True,
                Expense.end_date.is_not(None),
                Expense.date <= m_end,
                Expense.end_date >= m_start,
            ).group_by(Expense.category).all()

            q_rec_no_end = _rec_no_end_deduped(db, user_id, m_end)

            cat_totals: dict = _defaultdict(float)
            for cat, amt in q_non_rec:
                cat_totals[cat] += float(amt or 0)
            for cat, amt in q_rec_with_end:
                cat_totals[cat] += float(amt or 0)
            for cat, amt in q_rec_no_end:
                cat_totals[cat] += float(amt or 0)
            results = sorted(cat_totals.items(), key=lambda x: -x[1])
            period_label = f"{year}-{month:02d}"
        elif months_back:
            cutoff = now - timedelta(days=months_back * 30)
            # Non-recurring in range: capped at today to exclude future planned expenses
            # (e.g. "Wakacje July 2026" entered today should not inflate the historical average)
            q_non_rec = db.query(Expense.category, func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == False,
                Expense.date >= cutoff,
                Expense.date <= now,
            ).group_by(Expense.category).all()
            # Recurring with end_date still active during range
            q_rec_we = db.query(Expense.category, func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == True,
                Expense.end_date.is_not(None),
                Expense.date <= now,
                Expense.end_date >= cutoff,
            ).group_by(Expense.category).all()
            # Recurring without end_date: monthly rate × months_back (mirrors get_cash_flow_summary logic)
            q_rec_ne = _rec_no_end_deduped(db, user_id, now)
            cat_totals = _defaultdict(float)
            for cat, amt in q_non_rec:
                cat_totals[cat] += float(amt or 0)
            for cat, amt in q_rec_we:
                cat_totals[cat] += float(amt or 0)
            for cat, amt in q_rec_ne:
                cat_totals[cat] += float(amt or 0) * months_back
            results = sorted(cat_totals.items(), key=lambda x: -x[1])
            period_label = f"ostatnie {months_back} miesiecy"
        else:
            # Full year
            y_start = date(year, 1, 1)
            y_end = date(year, 12, 31)
            q_non_rec = db.query(Expense.category, func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == False,
                Expense.date >= y_start,
                Expense.date <= y_end,
            ).group_by(Expense.category).all()
            q_rec_with_end = db.query(Expense.category, func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == True,
                Expense.end_date.is_not(None),
                Expense.date <= y_end,
                Expense.end_date >= y_start,
            ).group_by(Expense.category).all()
            q_rec_no_end = _rec_no_end_deduped(db, user_id, y_end)
            cat_totals = _defaultdict(float)
            for cat, amt in q_non_rec:
                cat_totals[cat] += float(amt or 0)
            for cat, amt in q_rec_with_end:
                cat_totals[cat] += float(amt or 0)
            for cat, amt in q_rec_no_end:
                cat_totals[cat] += float(amt or 0)
            results = sorted(cat_totals.items(), key=lambda x: -x[1])
            period_label = str(year)

        return {
            "categories": [{"category": cat, "amount": float(amt)} for cat, amt in results],
            "total": float(sum(amt for _, amt in results)),
            "period": period_label
        }

    elif name == "get_income_breakdown":
        year = arguments.get("year", now.year)
        month = arguments.get("month")
        if not isinstance(month, int):
            month = None
        months_back = arguments.get("months_back")

        if months_back and isinstance(months_back, int) and months_back > 0:
            # Rolling N-month average — mirrors get_cash_flow_summary income logic
            # CRITICAL: do NOT filter by year (cutoff may cross year boundary)
            cutoff_date = now - timedelta(days=months_back * 30)
            cat_totals = _defaultdict(float)

            # 1. Non-recurring income in the period (date <= now to exclude future entries)
            q_non_rec = db.query(Income.category, func.sum(Income.amount)).filter(
                Income.user_id == user_id,
                Income.is_recurring == False,
                Income.date >= cutoff_date,
                Income.date <= now,
            ).group_by(Income.category).all()
            for cat, amt in q_non_rec:
                cat_totals[cat] += float(amt or 0)

            # 2. Recurring income with end_date overlapping the period
            q_rec_we = db.query(Income.category, func.sum(Income.amount)).filter(
                Income.user_id == user_id,
                Income.is_recurring == True,
                Income.end_date.is_not(None),
                Income.date <= now,
                Income.end_date >= cutoff_date,
            ).group_by(Income.category).all()
            for cat, amt in q_rec_we:
                cat_totals[cat] += float(amt or 0)

            # 3. Recurring income without end_date (deduplicated) × months_back
            q_rec_ne = _income_rec_no_end_deduped_by_category(db, user_id, now)
            for cat, amt in q_rec_ne:
                cat_totals[cat] += float(amt or 0) * months_back

            total = sum(cat_totals.values())
            monthly_avg = total / months_back if months_back > 0 else total
            results_sorted = sorted(cat_totals.items(), key=lambda x: -x[1])
            return {
                "sources": [{"category": cat, "amount": round(float(amt) / months_back, 2)} for cat, amt in results_sorted],
                "total": round(monthly_avg, 2),
                "period": f"miesięczna średnia z ostatnich {months_back} miesięcy",
            }
        elif month:
            # Single month — use proper dedup logic for recurring entries
            import calendar as _cal_ib
            _, month_days = _cal_ib.monthrange(year, month)
            from datetime import date as _date_ib
            m_start = _date_ib(year, month, 1)
            m_end = _date_ib(year, month, month_days)

            cat_totals = _defaultdict(float)

            # Non-recurring income in the month
            q_non_rec = db.query(Income.category, func.sum(Income.amount)).filter(
                Income.user_id == user_id,
                Income.is_recurring == False,
                Income.date >= m_start,
                Income.date <= m_end,
            ).group_by(Income.category).all()
            for cat, amt in q_non_rec:
                cat_totals[cat] += float(amt or 0)

            # Recurring income with end_date active during the month
            q_rec_we = db.query(Income.category, func.sum(Income.amount)).filter(
                Income.user_id == user_id,
                Income.is_recurring == True,
                Income.end_date.is_not(None),
                Income.date <= m_end,
                Income.end_date >= m_start,
            ).group_by(Income.category).all()
            for cat, amt in q_rec_we:
                cat_totals[cat] += float(amt or 0)

            # Recurring income without end_date (deduplicated)
            q_rec_ne = _income_rec_no_end_deduped_by_category(db, user_id, m_end)
            for cat, amt in q_rec_ne:
                cat_totals[cat] += float(amt or 0)

            results_sorted = sorted(cat_totals.items(), key=lambda x: -x[1])
            total = sum(cat_totals.values())
            return {
                "sources": [{"category": cat, "amount": round(float(amt), 2)} for cat, amt in results_sorted],
                "total": round(total, 2),
                "period": f"{year}-{month:02d}",
            }
        else:
            # Full year (unchanged behaviour)
            query = db.query(Income.category, func.sum(Income.amount)).filter(
                Income.user_id == user_id,
                extract('year', Income.date) == year,
            )
            results = query.group_by(Income.category).all()
            return {
                "sources": [{"category": cat, "amount": float(amt)} for cat, amt in results],
                "total": float(sum(amt for _, amt in results)),
                "period": str(year),
            }

    elif name == "get_loans_status":
        loans = db.query(Loan).filter(Loan.user_id == user_id, Loan.is_archived == False).all()
        result = []
        for loan in loans:
            balance = float(loan.remaining_balance or loan.principal_amount or 0)
            rate = float(loan.interest_rate or 0) / 12 / 100
            payment = float(loan.monthly_payment or 0)
            months_remaining = None
            if payment > 0 and rate > 0:
                try:
                    months_remaining = -math.log(1 - (balance * rate) / payment) / math.log(1 + rate)
                    months_remaining = round(months_remaining)
                except (ValueError, ZeroDivisionError):
                    months_remaining = None
            result.append({
                "name": loan.description or "Kredyt",
                "type": loan.loan_type,
                "principal_amount": float(loan.principal_amount or 0),
                "remaining_balance": balance,
                "interest_rate": float(loan.interest_rate or 0),
                "monthly_payment": payment,
                "months_remaining": months_remaining,
                "is_archived": loan.is_archived,
            })
        return {"loans": result, "count": len(result)}

    elif name == "calculate_polish_tax":
        gross = float(arguments["annual_gross_income"])
        emp_type = arguments.get("employment_type", "employee")

        result = {}
        if emp_type == "employee":
            zus_emerytalne = gross * 0.0976
            zus_rentowe = gross * 0.015
            zus_chorobowe = gross * 0.0245
            zus_total = zus_emerytalne + zus_rentowe + zus_chorobowe
            nfz_base = gross - zus_total
            nfz = nfz_base * 0.09
            taxable = max(0, gross - zus_total - 30000)
            if taxable <= 120000:
                pit = taxable * 0.12
            else:
                pit = 120000 * 0.12 + (taxable - 120000) * 0.32
            pit = max(0, pit - nfz * 0.775)
            net = gross - zus_total - nfz - pit
            result = {
                "gross": gross, "zus_employee": round(zus_total, 2),
                "nfz": round(nfz, 2), "pit": round(pit, 2),
                "net_annual": round(net, 2), "net_monthly": round(net / 12, 2),
                "effective_rate": round((1 - net / gross) * 100, 1)
            }
        else:
            pit = gross * 0.19
            zus_approx = 12 * 1600
            net = gross - pit - zus_approx
            result = {
                "gross": gross, "pit": round(pit, 2),
                "zus_approx": zus_approx, "net_annual": round(net, 2),
                "net_monthly": round(net / 12, 2),
                "effective_rate": round((1 - net / gross) * 100, 1),
                "note": "Uproszczone obliczenie -- skonsultuj z ksiegowym"
            }
        return result

    elif name == "get_savings_analysis":
        goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == user_id).all()
        # Aggregate NET balance (deposits - withdrawals) per account type
        _net = (
            func.sum(sa_case((Saving.saving_type == 'deposit', Saving.amount), else_=0)) -
            func.sum(sa_case((Saving.saving_type == 'withdrawal', Saving.amount), else_=0))
        )
        acct_totals = db.query(
            Saving.account_type, _net
        ).filter(
            Saving.user_id == user_id
        ).group_by(Saving.account_type).all()
        acct_map = {at: float(net or 0) for at, net in acct_totals}
        total_assets = sum(acct_map.values())

        # Separate liquid from illiquid (real_estate/investment/college/other)
        _ILLIQUID = ('real_estate', 'investment', 'college', 'other')
        illiquid_val = db.query(_net).filter(
            Saving.user_id == user_id,
            Saving.category.in_(_ILLIQUID),
        ).scalar()
        illiquid_value = float(illiquid_val or 0)
        liquid_savings = max(0.0, total_assets - illiquid_value)

        # 2026 contribution limits
        LIMITS_2026 = {"ike": 28260, "ikze": 11304, "oipe": 28260}

        # Actual 2026 contributions per account (exclude opening_balance — those are carryovers from prior years)
        from datetime import date as _date_lim
        current_year = _date_lim.today().year
        contrib_rows = db.query(Saving.account_type, func.sum(Saving.amount)).filter(
            Saving.user_id == user_id,
            Saving.account_type.in_(list(LIMITS_2026.keys())),
            extract('year', Saving.date) == current_year,
            Saving.entry_type != 'opening_balance',
        ).group_by(Saving.account_type).all()
        contrib_2026 = {at: float(amt or 0) for at, amt in contrib_rows}

        accounts = {}
        for at, bal in acct_map.items():
            entry = {"balance": bal}
            if at in LIMITS_2026:
                contributed = contrib_2026.get(at, 0.0)
                entry["annual_limit_2026"] = LIMITS_2026[at]
                entry["contributed_2026"] = round(contributed, 2)
                entry["remaining_limit"] = round(max(0, LIMITS_2026[at] - contributed), 2)
            accounts[at] = entry
        # Always include IKE/IKZE/OIPE even when no DB records (0 balance)
        for at in LIMITS_2026.keys():
            if at not in accounts:
                contributed = contrib_2026.get(at, 0.0)
                accounts[at] = {
                    "balance": 0.0,
                    "annual_limit_2026": LIMITS_2026[at],
                    "contributed_2026": round(contributed, 2),
                    "remaining_limit": round(LIMITS_2026[at] - contributed, 2),
                }
        goals_data = []
        for g in goals:
            current = float(g.current_amount or 0)
            target = float(g.target_amount)
            progress = (current / target * 100) if target > 0 else 0
            goals_data.append({
                "name": g.name, "current": current, "target": target,
                "progress_pct": round(progress, 1),
                "remaining": round(target - current, 2),
                "deadline": g.deadline.isoformat() if g.deadline else None,
            })
        return {
            "liquid_savings": round(liquid_savings, 2),       # cash/bank accounts — can be moved to goals
            "illiquid_assets": round(illiquid_value, 2),      # real estate / investments — NOT movable
            "total_assets": round(total_assets, 2),           # sum of everything (for net worth)
            "accounts_by_type": accounts,
            "goals": goals_data,
            "limits_2026": LIMITS_2026,
            "note": "liquid_savings = only cash/bank savings that can be allocated to goals",
        }

    elif name == "get_baby_steps_progress":
        ff = db.query(FinancialFreedom).filter(FinancialFreedom.userId == user_id).first()
        if not ff:
            return {"current_step": 1, "message": "Brak danych Baby Steps -- uzupelnij w sekcji Financial Freedom"}
        steps = ff.steps if isinstance(ff.steps, list) else []
        current_step = 1
        for step in steps:
            if isinstance(step, dict) and step.get("status") != "completed":
                current_step = step.get("step", 1)
                break
        return {
            "current_step": current_step,
            "steps": steps,
        }

    elif name == "get_spending_trend":
        months = int(arguments.get("months", 3))
        results = []
        for i in range(months - 1, -1, -1):
            m = now.month - i
            y = now.year
            while m <= 0:
                m += 12
                y -= 1
            _, month_days = cal_mod.monthrange(y, m)
            m_start = date(y, m, 1)
            m_end = date(y, m, month_days)
            non_rec = db.query(func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == False,
                Expense.date >= m_start,
                Expense.date <= m_end,
            ).scalar() or 0
            rec_we = db.query(func.sum(Expense.amount)).filter(
                Expense.user_id == user_id,
                Expense.is_recurring == True,
                Expense.end_date.is_not(None),
                Expense.date <= m_end,
                Expense.end_date >= m_start,
            ).scalar() or 0
            # Deduplicated recurring without end_date
            rec_ne_rows = _rec_no_end_deduped(db, user_id, m_end)
            rec_ne = sum(float(amt or 0) for _, amt in rec_ne_rows)
            results.append({"month": f"{y}-{m:02d}", "total": float(non_rec) + float(rec_we) + rec_ne})
        return {"trend": results, "months": months}

    elif name == "get_bank_transactions":
        from ..models import BankingConnection, BankTransaction

        # 1. Determine connection status (informational, not a hard gate)
        now_utc = datetime.now(timezone.utc)
        connection = db.query(BankingConnection).filter(
            BankingConnection.user_id == user_id,
            BankingConnection.is_active == True,
        ).order_by(BankingConnection.created_at.desc()).first()

        if not connection:
            connection_status = "no_connection"
            bank_name = None
            connection_note = "Brak aktywnego połączenia z bankiem (Ustawienia → Integracje). Dane historyczne mogą być niekompletne."
        else:
            expires_at = connection.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < now_utc:
                days_ago = (now_utc - expires_at).days
                connection_status = "token_expired"
                bank_name = connection.institution_name
                connection_note = f"Token {connection.institution_name} wygasł {days_ago} dni temu — dane mogą być nieaktualne. Odśwież w Ustawienia → Integracje."
            else:
                connection_status = "ok"
                bank_name = connection.institution_name
                connection_note = None

        # 2. Query transactions regardless of connection status
        months_back = min(int(arguments.get("months_back", 1)), 6)
        cutoff = date.today() - timedelta(days=30 * months_back)
        txn_limit = min(int(arguments.get("limit", 50)), 200)

        q = db.query(BankTransaction).filter(
            BankTransaction.user_id == user_id,
            BankTransaction.date >= cutoff,
            BankTransaction.is_duplicate == False,
        )

        txn_type = arguments.get("transaction_type", "all")
        if txn_type == "expense":
            q = q.filter(BankTransaction.amount < 0)
        elif txn_type == "income":
            q = q.filter(BankTransaction.amount > 0)

        min_amount = arguments.get("min_amount")
        max_amount = arguments.get("max_amount")
        if min_amount is not None:
            q = q.filter(func.abs(BankTransaction.amount) >= float(min_amount))
        if max_amount is not None:
            q = q.filter(func.abs(BankTransaction.amount) <= float(max_amount))

        merchant_search = arguments.get("merchant_search", "").strip()
        if merchant_search:
            pattern = f"%{merchant_search}%"
            q = q.filter(
                or_(
                    BankTransaction.merchant_name.ilike(pattern),
                    BankTransaction.description_display.ilike(pattern),
                )
            )

        txns = q.order_by(BankTransaction.date.desc()).limit(txn_limit).all()

        if not txns and connection_status == "no_connection":
            return {
                "status": "no_connection",
                "message": "Brak połączenia z bankiem i brak danych historycznych. Podłącz konto w Ustawienia → Integracje.",
            }

        transactions = [
            {
                "date": t.date.isoformat(),
                "amount": round(t.amount, 2),
                "description": t.description_display,
                "merchant": t.merchant_name,
                "category": t.suggested_category or t.tink_category_name,
                "status": t.status,
            }
            for t in txns
        ]

        # Only surface connection warnings when token is expired (sync stopped).
        # "no_connection" + existing transactions = local/test setup, don't warn.
        show_note = connection_note and connection_status == "token_expired"

        result = {
            "status": "ok" if transactions else connection_status,
            "period": f"ostatnie {months_back} mies.",
            "returned": len(transactions),
            "total_matching": q.count(),
            "transactions": transactions,
        }
        if bank_name:
            result["bank"] = bank_name
        if show_note:
            result["connection_note"] = connection_note
        return result

    elif name == "simulate_loan_overpayment":
        loan_name = arguments["loan_name"]
        extra_payment = float(arguments.get("extra_payment", 0))
        monthly_extra = float(arguments.get("monthly_extra", 0))

        loan = db.query(Loan).filter(
            Loan.user_id == user_id,
            Loan.description.ilike(f"%{loan_name}%"),
            Loan.is_archived == False
        ).first()
        if not loan:
            return {"error": f"Kredyt '{loan_name}' nie znaleziony"}

        balance = float(loan.remaining_balance or loan.principal_amount or 0)
        rate = float(loan.interest_rate or 0) / 12 / 100
        payment = float(loan.monthly_payment or 0)

        def calc_total_interest(bal, r, pmt):
            total_paid = 0
            months = 0
            while bal > 0 and months < 600:
                interest = bal * r
                principal = min(pmt - interest, bal)
                if principal <= 0:
                    break
                bal -= principal
                total_paid += interest
                months += 1
            return total_paid, months

        orig_interest, orig_months = calc_total_interest(balance, rate, payment)
        new_balance = max(0, balance - extra_payment)
        new_payment = payment + monthly_extra
        new_interest, new_months = calc_total_interest(new_balance, rate, max(payment, new_payment))

        return {
            "loan_name": loan.description,
            "current_balance": balance,
            "extra_payment": extra_payment,
            "monthly_extra": monthly_extra,
            "months_saved": orig_months - new_months,
            "interest_saved": round(orig_interest - new_interest, 2),
            "original_payoff_months": orig_months,
            "new_payoff_months": new_months,
        }

    elif name == "simulate_savings_goal":
        target = float(arguments["target_amount"])
        monthly = float(arguments["monthly_savings"])
        current = float(arguments.get("current_amount", 0))
        annual_rate = float(arguments.get("annual_rate", 0)) / 100

        if monthly <= 0:
            return {"error": "Miesieczna wplata musi byc wieksza niz 0"}

        remaining = target - current
        if remaining <= 0:
            return {"months_needed": 0, "message": "Cel juz osiagniety!"}

        if annual_rate > 0:
            r = annual_rate / 12
            months = math.log(1 + remaining * r / monthly) / math.log(1 + r)
        else:
            months = remaining / monthly

        months = math.ceil(months)
        return {
            "target": target, "current": current, "monthly_savings": monthly,
            "months_needed": months,
            "years_needed": round(months / 12, 1),
            "total_deposited": round(monthly * months, 2),
            "interest_earned": round(monthly * months - remaining, 2) if annual_rate > 0 else 0,
        }

    elif name == "get_cash_flow_summary":
        months_back = int(arguments.get("months_back", 3))
        cutoff_date = now - timedelta(days=months_back * 30)

        # Income: non-recurring (raw, capped at today) + deduplicated recurring × months
        # date <= now prevents future planned income from distorting the historical average
        inc_non_rec = db.query(func.sum(Income.amount)).filter(
            Income.user_id == user_id,
            Income.is_recurring == False,
            Income.date >= cutoff_date,
            Income.date <= now,
        ).scalar() or 0
        # Deduplicated recurring monthly amount × months_back
        inc_monthly_rec = _income_rec_no_end_deduped_total(db, user_id, now.month, now.year)
        total_income = float(inc_non_rec) + inc_monthly_rec * months_back

        # Split recurring/non-recurring to apply end_date filter correctly
        # date <= now prevents future planned expenses from distorting the historical average
        # (e.g. "Wakacje July 2026" entered today should not inflate the 3-month average)
        exp_non_rec = db.query(func.sum(Expense.amount)).filter(
            Expense.user_id == user_id,
            Expense.is_recurring == False,
            Expense.date >= cutoff_date,
            Expense.date <= now,
        ).scalar() or 0
        exp_rec_we = db.query(func.sum(Expense.amount)).filter(
            Expense.user_id == user_id,
            Expense.is_recurring == True,
            Expense.end_date.is_not(None),
            Expense.date <= now,
            Expense.end_date >= cutoff_date,
        ).scalar() or 0
        exp_rec_ne_rows = _rec_no_end_deduped(db, user_id, now)
        exp_rec_ne = sum(float(amt or 0) for _, amt in exp_rec_ne_rows)
        # Multiply recurring-without-end by months_back to mirror income calculation:
        # income uses: inc_monthly_rec * months_back + inc_non_rec
        # expenses must use: exp_rec_ne * months_back + exp_non_rec + exp_rec_we
        total_expenses = float(exp_non_rec) + float(exp_rec_we) + exp_rec_ne * months_back

        avg_income = float(total_income) / months_back
        avg_expenses = float(total_expenses) / months_back
        avg_cashflow = avg_income - avg_expenses
        savings_rate = (avg_cashflow / avg_income * 100) if avg_income > 0 else 0

        loans = db.query(Loan).filter(Loan.user_id == user_id, Loan.is_archived == False).all()
        total_debt_payments = sum(float(l.monthly_payment or 0) for l in loans)
        dti = (total_debt_payments / avg_income * 100) if avg_income > 0 else 0

        return {
            "period_months": months_back,
            "avg_monthly_income": round(avg_income, 2),
            "avg_monthly_expenses": round(avg_expenses, 2),
            "avg_monthly_cashflow": round(avg_cashflow, 2),
            "savings_rate_pct": round(savings_rate, 1),
            "total_monthly_debt_payments": round(total_debt_payments, 2),
            "debt_to_income_ratio_pct": round(dti, 1),
        }

    elif name == "generate_chart_config":
        return {
            "chart_type": arguments["chart_type"],
            "title": arguments["title"],
            "labels": arguments["labels"],
            "datasets": arguments["datasets"],
        }

    else:
        return {"error": f"Unknown tool: {name}"}


# ============================================================
# STREAMING CLAUDE RESPONSE
# ============================================================

async def stream_claude_response(
    user: User,
    message_content: str,
    conversation_history: list,
    db: Session,
) -> AsyncGenerator[dict, None]:
    """
    Stream Claude response with tool use support.
    Yields JSON-serializable frame dicts.
    """
    if not ANTHROPIC_API_KEY:
        yield {"type": "error", "message": "ANTHROPIC_API_KEY not configured"}
        return

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    context = await build_user_context(user.id, db)
    system_prompt = build_system_prompt(context)

    messages = conversation_history + [{"role": "user", "content": message_content}]

    # Tool use loop (max 5 iterations to prevent infinite loops)
    for iteration in range(5):
        full_text = ""
        tool_calls = []

        with client.messages.stream(
            model=AI_CHAT_MODEL,
            max_tokens=AI_MAX_TOKENS,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        ) as stream:
            for event in stream:
                if hasattr(event, 'type'):
                    if event.type == 'content_block_start':
                        if hasattr(event, 'content_block'):
                            if event.content_block.type == 'tool_use':
                                tool_name = event.content_block.name
                                tool_id = event.content_block.id
                                labels = {
                                    "get_expenses_by_category": "Sprawdzam wydatki...",
                                    "get_income_breakdown": "Sprawdzam przychody...",
                                    "get_loans_status": "Sprawdzam kredyty...",
                                    "calculate_polish_tax": "Obliczam podatek...",
                                    "get_savings_analysis": "Sprawdzam oszczednosci...",
                                    "get_baby_steps_progress": "Sprawdzam Baby Steps...",
                                    "get_spending_trend": "Analizuje trend wydatkow...",
                                    "simulate_loan_overpayment": "Symuluje nadplate...",
                                    "simulate_savings_goal": "Symuluje cel oszczednosciowy...",
                                    "get_cash_flow_summary": "Analizuje cashflow...",
                                    "generate_chart_config": "Przygotowuje wykres...",
                                    "get_bank_transactions": "Sprawdzam transakcje bankowe...",
                                }
                                label = labels.get(tool_name, f"Uzywam narzedzia {tool_name}...")
                                yield {"type": "tool_start", "tool": tool_name, "label": label}
                                tool_calls.append({"id": tool_id, "name": tool_name, "input": ""})

                    elif event.type == 'content_block_delta':
                        if hasattr(event, 'delta'):
                            if event.delta.type == 'text_delta':
                                full_text += event.delta.text
                                yield {"type": "token", "content": event.delta.text}
                            elif event.delta.type == 'input_json_delta':
                                if tool_calls:
                                    tool_calls[-1]["input"] += event.delta.partial_json

        final_message = stream.get_final_message()
        stop_reason = final_message.stop_reason

        if stop_reason == "end_turn" or not tool_calls:
            break

        # Execute tool calls
        tool_results = []
        for tc in tool_calls:
            import json as json_lib
            try:
                input_data = json_lib.loads(tc["input"]) if tc["input"] else {}
            except Exception:
                input_data = {}

            result = await execute_tool_call(tc["name"], input_data, user.id, db)
            yield {"type": "tool_result", "tool": tc["name"]}

            if tc["name"] == "generate_chart_config":
                yield {"type": "chart", "chart_config": result}

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tc["id"],
                "content": str(result),
            })

        # Serialize only API-accepted fields (model_dump() includes internal SDK fields like parsed_output)
        assistant_content = []
        for block in final_message.content:
            if block.type == "text":
                assistant_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                assistant_content.append({"type": "tool_use", "id": block.id, "name": block.name, "input": block.input})
        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})


def get_or_create_conversation(user_id: str, conversation_id: int | None, db: Session) -> AIConversation:
    """Get existing conversation or create a new one."""
    if conversation_id:
        conv = db.query(AIConversation).filter(
            AIConversation.id == conversation_id,
            AIConversation.user_id == user_id
        ).first()
        if conv:
            return conv
    conv = AIConversation(user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def save_messages(conv: AIConversation, user_content: str, assistant_content: str, db: Session):
    """Save user and assistant messages to conversation."""
    if not conv.title:
        conv.title = user_content[:60] + ("..." if len(user_content) > 60 else "")

    user_msg = AIMessage(conversation_id=conv.id, role="user", content=user_content)
    asst_msg = AIMessage(conversation_id=conv.id, role="assistant", content=assistant_content)
    db.add(user_msg)
    db.add(asst_msg)
    db.commit()


def get_conversation_history(conv: AIConversation, db: Session, max_messages: int = 20) -> list:
    """Get conversation history formatted for Claude API."""
    messages = db.query(AIMessage).filter(
        AIMessage.conversation_id == conv.id
    ).order_by(AIMessage.created_at.desc()).limit(max_messages).all()
    messages.reverse()
    return [{"role": m.role, "content": m.content} for m in messages]
