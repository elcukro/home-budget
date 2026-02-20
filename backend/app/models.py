from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Boolean, JSON, UniqueConstraint, Table, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base, IS_TEST_MODE
from datetime import datetime
from typing import TYPE_CHECKING

# Use JSON for SQLite (test mode), JSONB for PostgreSQL (production)
if IS_TEST_MODE:
    JSONB = JSON
else:
    from sqlalchemy.dialects.postgresql import JSONB

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Changed to String for Google OAuth ID
    email = Column(String, unique=True, index=True)
    name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # First login tracking (for onboarding redirect)
    is_first_login = Column(Boolean, default=True, nullable=False, server_default="true")
    # Email tracking
    welcome_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    trial_ending_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    trial_ended_email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    loans = relationship("Loan", back_populates="user")
    loan_payments = relationship("LoanPayment", back_populates="user", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user")
    income = relationship("Income", back_populates="user")
    settings = relationship("Settings", back_populates="user", uselist=False)
    activities = relationship("Activity", back_populates="user")
    insights_caches = relationship("InsightsCache", back_populates="user", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    financial_freedom = relationship("FinancialFreedom", back_populates="user", uselist=False)
    savings = relationship("Saving", back_populates="user", cascade="all, delete-orphan")
    savings_goals = relationship("SavingsGoal", back_populates="user", cascade="all, delete-orphan")
    banking_connections = relationship("BankingConnection", back_populates="user", cascade="all, delete-orphan")
    tink_connections = relationship("TinkConnection", back_populates="user", cascade="all, delete-orphan")
    bank_transactions = relationship("BankTransaction", back_populates="user", cascade="all, delete-orphan")
    enable_banking_connections = relationship("EnableBankingConnection", back_populates="user", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    payment_history = relationship("PaymentHistory", back_populates="user", cascade="all, delete-orphan")
    onboarding_backups = relationship("OnboardingBackup", back_populates="user", cascade="all, delete-orphan")
    budget_years = relationship("BudgetYear", back_populates="user", cascade="all, delete-orphan")
    data_export_backups = relationship("DataExportBackup", back_populates="user", cascade="all, delete-orphan")
    # Gamification relationships
    gamification_stats = relationship("UserGamificationStats", back_populates="user", uselist=False, cascade="all, delete-orphan")
    achievements = relationship("Achievement", back_populates="user", cascade="all, delete-orphan")
    streak_history = relationship("StreakHistory", back_populates="user", cascade="all, delete-orphan")
    gamification_events = relationship("GamificationEvent", back_populates="user", cascade="all, delete-orphan")
    # AI Chat relationships
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
    ai_usage_quotas = relationship("AIUsageQuota", back_populates="user", cascade="all, delete-orphan")

    # Partner access relationships
    partner_link_as_partner = relationship(
        "PartnerLink",
        foreign_keys="PartnerLink.partner_user_id",
        uselist=False,
        lazy="joined",
    )
    partner_link_as_primary = relationship(
        "PartnerLink",
        foreign_keys="PartnerLink.primary_user_id",
        uselist=False,
    )

    @property
    def household_id(self) -> str:
        """Returns primary user's ID if this is a partner, else own ID."""
        if self.partner_link_as_partner:
            return self.partner_link_as_partner.primary_user_id
        return self.id

    @property
    def is_partner(self) -> bool:
        """Returns True if this user is linked as a partner to another user."""
        return self.partner_link_as_partner is not None

class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))  # Changed to String to match User.id
    loan_type = Column(String)
    description = Column(String)
    principal_amount = Column(Float)
    remaining_balance = Column(Float)
    interest_rate = Column(Float)
    monthly_payment = Column(Float)
    start_date = Column(Date)
    term_months = Column(Integer)
    due_day = Column(Integer, nullable=True, default=1)  # Day of month when payment is due (1-31)
    # Polish prepayment regulations (since 2022, banks cannot charge fees for first 3 years)
    overpayment_fee_percent = Column(Float, nullable=True, default=0)  # Fee percentage for prepayment (0-3%)
    overpayment_fee_waived_until = Column(Date, nullable=True)  # Date until prepayment fees are waived
    is_archived = Column(Boolean, default=False)  # Archived loans are hidden from active list
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="loans")
    payments = relationship("LoanPayment", back_populates="loan", cascade="all, delete-orphan")


class LoanPayment(Base):
    """Tracks individual loan payments (regular and overpayments)."""
    __tablename__ = "loan_payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    amount = Column(Float, nullable=False)  # Payment amount
    payment_date = Column(Date, nullable=False)  # Date of payment
    payment_type = Column(String, nullable=False)  # 'regular' or 'overpayment'

    # For tracking which month this payment covers (for regular payments)
    covers_month = Column(Integer, nullable=True)  # Month number (1-12)
    covers_year = Column(Integer, nullable=True)  # Year

    notes = Column(String, nullable=True)  # Optional notes

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    loan = relationship("Loan", back_populates="payments")
    user = relationship("User", back_populates="loan_payments")

    __table_args__ = (
        Index('idx_loan_payments_loan_id', 'loan_id'),
        Index('idx_loan_payments_user_id', 'user_id'),
        Index('idx_loan_payments_payment_date', 'payment_date'),
        Index('idx_loan_payments_covers', 'covers_year', 'covers_month'),
    )


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)
    is_recurring = Column(Boolean, default=False)
    date = Column(Date)  # Start date (for recurring) or occurrence date (for one-off)
    end_date = Column(Date, nullable=True)  # Optional end date for recurring items (null = forever)
    source = Column(String, default="manual")  # "manual" or "bank_import"
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Reconciliation fields for bank/manual deduplication
    owner = Column(String, nullable=True)  # "self", "partner" (null = "self" for backwards compat)

    # Reconciliation fields for bank/manual deduplication
    reconciliation_status = Column(
        String,
        default="unreviewed",
        nullable=False,
        comment="unreviewed | bank_backed | manual_confirmed | duplicate_of_bank | pre_bank_era"
    )
    duplicate_bank_transaction_id = Column(
        Integer,
        ForeignKey("bank_transactions.id"),
        nullable=True,
        comment="If marked as duplicate, links to the bank transaction it duplicates"
    )
    reconciliation_note = Column(String, nullable=True)
    reconciliation_reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("User", back_populates="expenses")
    bank_transaction = relationship("BankTransaction", foreign_keys=[bank_transaction_id])
    duplicate_bank_transaction = relationship("BankTransaction", foreign_keys=[duplicate_bank_transaction_id])

    __table_args__ = (
        Index('idx_expenses_reconciliation_status', 'reconciliation_status'),
        Index('idx_expenses_source_status', 'source', 'reconciliation_status'),
    )

class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)  # Net amount (after tax) - netto
    is_recurring = Column(Boolean, default=False)
    date = Column(Date)  # Start date (for recurring) or occurrence date (for one-off)
    end_date = Column(Date, nullable=True)  # Optional end date for recurring items (null = forever)
    source = Column(String, default="manual")  # "manual" or "bank_import"
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    # Polish employment types for tax calculation
    employment_type = Column(String, nullable=True)  # uop, b2b, zlecenie, dzielo, other
    gross_amount = Column(Float, nullable=True)  # Brutto (gross) amount before tax
    is_gross = Column(Boolean, default=False)  # Whether amount entered was gross (true) or net (false)
    kup_type = Column(String, nullable=True)  # "standard", "author_50", "none" (null = use global setting)
    owner = Column(String, nullable=True)  # "self", "partner" (null = "self" for backwards compat)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Reconciliation fields for bank/manual deduplication
    reconciliation_status = Column(
        String,
        default="unreviewed",
        nullable=False,
        comment="unreviewed | bank_backed | manual_confirmed | duplicate_of_bank | pre_bank_era"
    )
    duplicate_bank_transaction_id = Column(
        Integer,
        ForeignKey("bank_transactions.id"),
        nullable=True,
        comment="If marked as duplicate, links to the bank transaction it duplicates"
    )
    reconciliation_note = Column(String, nullable=True)
    reconciliation_reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("User", back_populates="income")
    bank_transaction = relationship("BankTransaction", foreign_keys=[bank_transaction_id])
    duplicate_bank_transaction = relationship("BankTransaction", foreign_keys=[duplicate_bank_transaction_id])

    __table_args__ = (
        Index('idx_income_reconciliation_status', 'reconciliation_status'),
        Index('idx_income_source_status', 'source', 'reconciliation_status'),
    )

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    language = Column(String, default="en")
    currency = Column(String, default="USD")
    ai = Column(JSON)
    # Financial Freedom settings
    emergency_fund_target = Column(Integer, default=1000)  # Target for Baby Step 1
    emergency_fund_months = Column(Integer, default=3)     # Months for Baby Step 3
    base_currency = Column(String, default="USD")          # Base currency for emergency fund target
    banking = Column(JSON)                                # Banking settings

    # Polish tax-specific settings (from onboarding)
    employment_status = Column(String, nullable=True)      # employee, b2b, business, contract, freelancer, unemployed
    tax_form = Column(String, nullable=True)               # scale, linear, lumpsum, card
    birth_year = Column(Integer, nullable=True)            # For youth tax relief eligibility
    use_authors_costs = Column(Boolean, default=False)     # KUP 50% for creators
    ppk_enrolled = Column(Boolean, nullable=True)          # PPK enrollment status
    ppk_employee_rate = Column(Float, nullable=True)       # PPK employee contribution (0.5% - 4%)
    ppk_employer_rate = Column(Float, nullable=True)       # PPK employer contribution (1.5% - 4%)
    ppk_enrollment_date = Column(Date, nullable=True)      # Date when user enrolled in PPK (employment contract start)
    employment_type = Column(String, nullable=True)        # Employment type: 'uop' (Umowa o pracę), 'b2b', 'jdg', etc.
    children_count = Column(Integer, default=0)            # For child tax relief calculation

    # Onboarding status
    onboarding_completed = Column(Boolean, default=False)
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)

    # Life data from onboarding
    marital_status = Column(String, nullable=True)
    housing_type = Column(String, nullable=True)
    children_age_range = Column(String, nullable=True)
    include_partner_finances = Column(Boolean, nullable=True)

    # Partner tax profile (separate person for tax calculations)
    partner_name = Column(String, nullable=True)
    partner_employment_status = Column(String, nullable=True)
    partner_tax_form = Column(String, nullable=True)
    partner_birth_year = Column(Integer, nullable=True)
    partner_use_authors_costs = Column(Boolean, default=False)
    partner_ppk_enrolled = Column(Boolean, nullable=True)
    partner_ppk_employee_rate = Column(Float, nullable=True)
    partner_ppk_employer_rate = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="settings")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    entity_type = Column(String)  # 'Income', 'Expense', or 'Loan'
    operation_type = Column(String)  # 'create', 'update', or 'delete'
    entity_id = Column(Integer)
    previous_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="activities")

class InsightsCache(Base):
    __tablename__ = "insights_cache"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    language = Column(String, default="en")  # Store the language of the insights
    insights = Column(JSON)
    financial_snapshot = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_stale = Column(Boolean, default=False)
    # New fields for caching strategy
    last_refresh_date = Column(DateTime, default=datetime.utcnow)
    total_income = Column(Float, default=0)
    total_expenses = Column(Float, default=0)
    total_loans = Column(Float, default=0)

    user = relationship("User", back_populates="insights_caches")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    provider_account_id = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    expires_at = Column(Integer, nullable=True)
    token_type = Column(String, nullable=True)
    scope = Column(String, nullable=True)
    id_token = Column(String, nullable=True)
    session_state = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="accounts")

    __table_args__ = (UniqueConstraint('provider', 'provider_account_id', name='provider_account_id_unique'),)

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    session_token = Column(String, unique=True, nullable=False)
    expires = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="sessions")

class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    identifier = Column(String, nullable=False)
    token = Column(String, primary_key=True)
    expires = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('identifier', 'token', name='token_identifier_unique'),)

class FinancialFreedom(Base):
    __tablename__ = "financial_freedom"

    id = Column(Integer, primary_key=True, index=True)
    userId = Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"))  # Map user_id column to userId
    steps = Column(JSONB)
    startDate = Column("start_date", DateTime(timezone=True), server_default=func.now())  # Map start_date column to startDate
    lastUpdated = Column("last_updated", DateTime(timezone=True), server_default=func.now(), onupdate=func.now())  # Map last_updated column to lastUpdated

    user = relationship("User", back_populates="financial_freedom")

    __table_args__ = (
        Index('idx_financial_freedom_user_id', 'user_id'),
        Index('idx_financial_freedom_steps', 'steps', postgresql_using='gin'),
    )

class SavingsGoal(Base):
    """Dedicated savings goals - separate from individual transactions."""
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)  # e.g., "Wakacje 2026", "Nowy samochód"
    category = Column(String, nullable=False)  # Links to SavingCategory enum
    target_amount = Column(Float, nullable=False)  # Goal amount
    current_amount = Column(Float, default=0)  # Cached sum of linked deposits (updated on save)
    deadline = Column(Date, nullable=True)  # Optional target date
    icon = Column(String, nullable=True)  # Optional icon identifier
    color = Column(String, nullable=True)  # Optional color for UI
    status = Column(String, default='active')  # active, completed, paused, abandoned
    priority = Column(Integer, default=0)  # For sorting (higher = more important)
    notes = Column(String, nullable=True)  # User notes about the goal
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)  # When goal was marked complete

    user = relationship("User", back_populates="savings_goals")
    savings = relationship("Saving", back_populates="goal", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_savings_goals_user_id', 'user_id'),
        Index('idx_savings_goals_category', 'category'),
        Index('idx_savings_goals_status', 'status'),
    )


class Saving(Base):
    __tablename__ = "savings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    goal_id = Column(Integer, ForeignKey("savings_goals.id", ondelete="SET NULL"), nullable=True)  # Link to goal
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)  # Start date (for recurring) or occurrence date (for one-off)
    end_date = Column(Date, nullable=True)  # Optional end date for recurring items (null = forever)
    is_recurring = Column(Boolean, default=False)
    target_amount = Column(Float, nullable=True)  # Deprecated - use goal.target_amount instead
    saving_type = Column(String, nullable=False)  # 'deposit' or 'withdrawal'
    # Polish III Pillar retirement accounts
    account_type = Column(String, default='standard')  # standard, ike, ikze, ppk, oipe
    annual_return_rate = Column(Float, nullable=True)  # Expected annual return rate for compound interest (e.g., 0.05 for 5%)
    owner = Column(String, nullable=True)  # "self", "partner" (null = "self" for backwards compat)
    entry_type = Column(String, default='contribution', nullable=False)  # 'contribution', 'opening_balance', 'correction'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="savings")
    goal = relationship("SavingsGoal", back_populates="savings")

    __table_args__ = (
        Index('idx_savings_user_id', 'user_id'),
        Index('idx_savings_category', 'category'),
        Index('idx_savings_date', 'date'),
        Index('idx_savings_account_type', 'account_type'),
        Index('idx_savings_goal_id', 'goal_id'),
        Index('idx_savings_entry_type', 'entry_type'),
    )

class BankingConnection(Base):
    __tablename__ = "banking_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    institution_id = Column(String, nullable=False)
    institution_name = Column(String, nullable=False)
    requisition_id = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    accounts = Column(JSON)  # List of account IDs
    account_names = Column(JSON)  # Map of account ID to account name
    last_sync_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("User", back_populates="banking_connections")

    __table_args__ = (
        Index('idx_banking_connections_user_id', 'user_id'),
        Index('idx_banking_connections_requisition_id', 'requisition_id'),
    )


class TinkPendingAuth(Base):
    """Stores pending Tink authorization flows (replaces in-memory storage)."""
    __tablename__ = "tink_pending_auth"

    id = Column(Integer, primary_key=True, index=True)
    state_token = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Tink flow data
    tink_user_id = Column(String, nullable=True)
    authorization_code = Column(String(500), nullable=True)

    # Expiration and status
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)

    __table_args__ = (
        Index('idx_tink_pending_auth_state', 'state_token'),
        Index('idx_tink_pending_auth_expires', 'expires_at'),
    )


class TinkConnection(Base):
    """Stores Tink API connections and OAuth tokens per user."""
    __tablename__ = "tink_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Tink OAuth tokens
    tink_user_id = Column(String, unique=True, nullable=False)  # Tink's internal user ID
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expires_at = Column(DateTime(timezone=True), nullable=False)

    # Tink authorization metadata
    authorization_code = Column(String, nullable=True)
    credentials_id = Column(String, nullable=True)  # Credentials ID from Tink Link callback
    scopes = Column(String, default="accounts:read,transactions:read")

    # Connected accounts
    accounts = Column(JSON)  # List of Tink account IDs
    account_details = Column(JSON)  # Map of account_id → {name, iban, currency}

    # Status
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="tink_connections")

    __table_args__ = (
        Index('idx_tink_connections_user_id', 'user_id'),
        Index('idx_tink_connections_tink_user_id', 'tink_user_id'),
    )


class EnableBankingConnection(Base):
    """Stores Enable Banking PSD2 connections (session-based, JWT auth)."""
    __tablename__ = "enable_banking_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Enable Banking session (long-lived credential from POST /sessions)
    session_id = Column(String, unique=True, nullable=False)

    # Bank info (from ASPSP)
    aspsp_name = Column(String, nullable=False)      # e.g., "ING Bank Śląski"
    aspsp_country = Column(String, nullable=False)    # e.g., "PL"

    # Consent validity (from access.valid_until in session response)
    valid_until = Column(DateTime(timezone=True), nullable=False)

    # Accounts (list of {uid, iban, name, currency} from session creation)
    accounts = Column(JSON)

    # Status
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="enable_banking_connections")

    __table_args__ = (
        Index('idx_eb_connections_user_id', 'user_id'),
        Index('idx_eb_connections_session_id', 'session_id'),
    )


class BankTransaction(Base):
    """Stores raw transactions fetched from Tink before they're accepted as Income/Expense."""
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Tink transaction identifiers
    tink_transaction_id = Column(String, unique=True, nullable=False, index=True)
    tink_account_id = Column(String, nullable=False)
    provider_transaction_id = Column(String, nullable=True)

    # Transaction details
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="PLN")
    date = Column(Date, nullable=False, index=True)
    booked_datetime = Column(DateTime(timezone=True), nullable=True)

    # Descriptions
    description_display = Column(String, nullable=False)  # "Tesco"
    description_original = Column(String, nullable=True)  # "TESCO STORES 3297"
    description_detailed = Column(String, nullable=True)  # Full unstructured text

    # Merchant info
    merchant_name = Column(String, nullable=True)
    merchant_category_code = Column(String, nullable=True)

    # Categorization (from Tink)
    tink_category_id = Column(String, nullable=True)
    tink_category_name = Column(String, nullable=True)

    # Our categorization
    suggested_type = Column(String, nullable=True)  # "income" or "expense"
    suggested_category = Column(String, nullable=True)  # "Groceries", "Salary", etc.
    confidence_score = Column(Float, default=0.0)  # 0.0 to 1.0

    # Status workflow
    # - "pending": Awaiting user review
    # - "accepted": User accepted, converted to Income/Expense
    # - "rejected": User rejected (not relevant)
    # - "ignored": System flagged as duplicate/irrelevant
    status = Column(String, default="pending", nullable=False)

    # Linkage to Income/Expense
    linked_income_id = Column(Integer, ForeignKey("income.id"), nullable=True)
    linked_expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)

    # Provider identification
    provider = Column(String, default="tink")  # "tink" or "gocardless"

    # Raw data from provider (for debugging/audit)
    raw_data = Column(JSONB, nullable=True)

    # Metadata
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    duplicate_confidence = Column(Float, nullable=True)  # 0.0-1.0, confidence that this is a duplicate
    duplicate_reason = Column(String, nullable=True)  # Reason for duplicate flag (e.g., "same_account_exact_match")
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="bank_transactions")
    linked_income = relationship("Income", foreign_keys=[linked_income_id])
    linked_expense = relationship("Expense", foreign_keys=[linked_expense_id])

    __table_args__ = (
        Index('idx_bank_transactions_user_id', 'user_id'),
        Index('idx_bank_transactions_status', 'status'),
        Index('idx_bank_transactions_date', 'date'),
        # Composite index for duplicate detection performance
        Index('idx_bank_tx_duplicate_lookup', 'user_id', 'date', 'currency'),
        Index('idx_bank_transactions_is_duplicate', 'is_duplicate'),
    )


class Subscription(Base):
    """Tracks user subscription status and Stripe integration."""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    # Stripe identifiers
    stripe_customer_id = Column(String, unique=True, nullable=True, index=True)
    stripe_subscription_id = Column(String, unique=True, nullable=True)
    stripe_price_id = Column(String, nullable=True)

    # Subscription status: "trialing", "active", "past_due", "canceled", "incomplete", "free"
    status = Column(String, default="trialing", nullable=False)

    # Plan type: "free", "trial", "monthly", "annual", "lifetime"
    plan_type = Column(String, default="trial", nullable=False)

    # Trial tracking
    trial_start = Column(DateTime(timezone=True), nullable=True)
    trial_end = Column(DateTime(timezone=True), nullable=True)

    # Billing period
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)

    # Lifetime flag (for one-time purchases)
    is_lifetime = Column(Boolean, default=False)
    lifetime_purchased_at = Column(DateTime(timezone=True), nullable=True)

    # Cancellation
    cancel_at_period_end = Column(Boolean, default=False)
    canceled_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="subscription")

    __table_args__ = (
        Index('idx_subscriptions_user_id', 'user_id'),
        Index('idx_subscriptions_stripe_customer_id', 'stripe_customer_id'),
        Index('idx_subscriptions_status', 'status'),
    )


class PaymentHistory(Base):
    """Tracks all payment events for audit and customer support."""
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Stripe identifiers
    stripe_payment_intent_id = Column(String, nullable=True)
    stripe_invoice_id = Column(String, nullable=True)
    stripe_checkout_session_id = Column(String, nullable=True)

    # Payment details
    amount = Column(Integer, nullable=False)  # In minor units (grosze for PLN)
    currency = Column(String, default="pln")
    status = Column(String, nullable=False)  # "succeeded", "failed", "pending", "refunded"

    # Plan info
    plan_type = Column(String, nullable=True)  # "monthly", "annual", "lifetime"

    # Metadata
    description = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    receipt_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="payment_history")

    __table_args__ = (
        Index('idx_payment_history_user_id', 'user_id'),
        Index('idx_payment_history_created_at', 'created_at'),
    )

class OnboardingBackup(Base):
    __tablename__ = "onboarding_backups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    data = Column(JSON, nullable=False)  # Full export data
    reason = Column(String, nullable=True)  # "fresh_start", "manual", etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="onboarding_backups")

    __table_args__ = (
        Index('idx_onboarding_backups_user_id', 'user_id'),
        Index('idx_onboarding_backups_created_at', 'created_at'),
    )


class DataExportBackup(Base):
    """Stores user data export backups for later retrieval."""
    __tablename__ = "data_export_backups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    data = Column(JSON, nullable=False)  # Full export data in JSON format
    format = Column(String, nullable=False, default="json")  # "json", "csv", "xlsx" - original export format
    filename = Column(String, nullable=False)  # Original filename
    size_bytes = Column(Integer, nullable=True)  # Size of the export data
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="data_export_backups")

    __table_args__ = (
        Index('idx_data_export_backups_user_id', 'user_id'),
        Index('idx_data_export_backups_created_at', 'created_at'),
    )


# ==========================================
# GAMIFICATION MODELS
# ==========================================

class UserGamificationStats(Base):
    """Tracks user's gamification progress: streaks, XP, level."""
    __tablename__ = "user_gamification_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    # Streak tracking
    current_streak = Column(Integer, default=0)  # Current consecutive days
    longest_streak = Column(Integer, default=0)  # Best streak ever
    last_activity_date = Column(Date, nullable=True)  # Last day user was active

    # XP and Level system
    total_xp = Column(Integer, default=0)
    level = Column(Integer, default=1)

    # Activity counts (for stats display)
    total_expenses_logged = Column(Integer, default=0)
    total_savings_deposits = Column(Integer, default=0)
    total_loan_payments = Column(Integer, default=0)
    total_checkins = Column(Integer, default=0)

    # Savings milestones
    total_debt_paid = Column(Float, default=0)  # Cumulative debt paid off
    months_with_savings = Column(Integer, default=0)  # Consecutive months saving

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="gamification_stats")

    __table_args__ = (
        Index('idx_user_gamification_stats_user_id', 'user_id'),
    )


class Achievement(Base):
    """Stores unlocked achievements/badges for users."""
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Achievement identification
    badge_id = Column(String, nullable=False)  # e.g., "first_thousand", "week_control"
    badge_category = Column(String, nullable=False)  # "emergency_fund", "debt", "savings", "consistency", "fire"

    # When unlocked
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())

    # XP awarded for this achievement
    xp_awarded = Column(Integer, default=0)

    # Optional: data at time of unlock (for celebration display)
    unlock_data = Column(JSON, nullable=True)  # e.g., {"amount": 1000, "days": 7}

    # Relationship
    user = relationship("User", back_populates="achievements")

    __table_args__ = (
        UniqueConstraint('user_id', 'badge_id', name='unique_user_badge'),
        Index('idx_achievements_user_id', 'user_id'),
        Index('idx_achievements_badge_id', 'badge_id'),
        Index('idx_achievements_unlocked_at', 'unlocked_at'),
    )


class StreakHistory(Base):
    """Historical record of daily activity for streak calculation."""
    __tablename__ = "streak_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Activity tracking
    date = Column(Date, nullable=False)
    streak_type = Column(String, nullable=False)  # "daily_checkin", "expense_logging", "savings"

    # What triggered the streak for this day
    activity_count = Column(Integer, default=1)  # Number of activities on this day
    streak_count = Column(Integer, default=1)  # Streak count as of this day

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="streak_history")

    __table_args__ = (
        UniqueConstraint('user_id', 'date', 'streak_type', name='unique_user_date_streak'),
        Index('idx_streak_history_user_id', 'user_id'),
        Index('idx_streak_history_date', 'date'),
        Index('idx_streak_history_type', 'streak_type'),
    )


class GamificationEvent(Base):
    """Log of all gamification events for analytics and debugging."""
    __tablename__ = "gamification_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Event details
    event_type = Column(String, nullable=False)  # "xp_earned", "badge_unlocked", "level_up", "streak_milestone"
    event_data = Column(JSON, nullable=True)  # Event-specific data

    # XP changes
    xp_change = Column(Integer, default=0)  # Positive for gain, negative for loss

    # Trigger info
    trigger_entity = Column(String, nullable=True)  # "expense", "saving", "checkin", etc.
    trigger_entity_id = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="gamification_events")

    __table_args__ = (
        Index('idx_gamification_events_user_id', 'user_id'),
        Index('idx_gamification_events_type', 'event_type'),
        Index('idx_gamification_events_created_at', 'created_at'),
    )


class BudgetYear(Base):
    __tablename__ = "budget_years"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    year = Column(Integer, nullable=False)
    status = Column(String, default="active")  # active, closed
    source = Column(String, default="manual")  # onboarding, rollover, manual
    template_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="budget_years")
    entries = relationship("BudgetEntry", back_populates="budget_year", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('user_id', 'year', name='unique_user_year'),
        Index('idx_budget_years_user_id', 'user_id'),
    )


class BudgetEntry(Base):
    __tablename__ = "budget_entries"

    id = Column(Integer, primary_key=True, index=True)
    budget_year_id = Column(Integer, ForeignKey("budget_years.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    month = Column(Integer, nullable=False)  # 1-12
    entry_type = Column(String, nullable=False)  # income, expense, loan_payment
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    planned_amount = Column(Float, nullable=False)
    actual_amount = Column(Float, nullable=True)
    is_recurring = Column(Boolean, default=False)
    source_onboarding_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    budget_year = relationship("BudgetYear", back_populates="entries")
    user = relationship("User")

    __table_args__ = (
        Index('idx_budget_entries_year_month', 'budget_year_id', 'month'),
        Index('idx_budget_entries_user_id', 'user_id'),
        Index('idx_budget_entries_type', 'entry_type'),
    )


class ProcessedWebhookEvent(Base):
    """
    Tracks processed webhook events for idempotency.
    Prevents duplicate processing of the same webhook event.
    """
    __tablename__ = "processed_webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, nullable=False)  # The unique event ID from the provider
    provider = Column(String, nullable=False, default="stripe")  # stripe, tink, etc.
    event_type = Column(String, nullable=True)  # Optional: type of event for logging
    processed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('event_id', 'provider', name='uq_webhook_event_provider'),
        Index('idx_processed_webhooks_event_id', 'event_id'),
        Index('idx_processed_webhooks_processed_at', 'processed_at'),
    )


# ==========================================
# TINK AUDIT LOGGING
# ==========================================

class TinkAuditLog(Base):
    """
    Audit log for all Tink banking integration operations.
    Provides security compliance, debugging, and data access accountability.
    """
    __tablename__ = "tink_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    tink_connection_id = Column(Integer, ForeignKey("tink_connections.id", ondelete="SET NULL"), nullable=True, index=True)

    # Action classification
    # Values: connect_initiated, connection_created, connection_failed,
    #         connection_disconnected, token_refreshed, transactions_synced,
    #         transaction_reviewed, debug_access, data_refreshed
    action_type = Column(String(50), nullable=False, index=True)

    # Result of the action: success, failure, partial
    result = Column(String(20), nullable=False)

    # HTTP request metadata
    request_method = Column(String(10), nullable=True)
    request_path = Column(String(200), nullable=True)
    status_code = Column(Integer, nullable=True)

    # Client identification
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)

    # Sanitized additional context (no PII/tokens!)
    # Examples: account_count, transactions_synced, error_category
    details = Column(JSONB, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index('idx_tink_audit_logs_user_id', 'user_id'),
        Index('idx_tink_audit_logs_action_type', 'action_type'),
        Index('idx_tink_audit_logs_connection_id', 'tink_connection_id'),
        Index('idx_tink_audit_logs_created_at', 'created_at'),
        # Composite for common queries
        Index('idx_tink_audit_logs_user_date', 'user_id', 'created_at'),
    )


# ==========================================
# PARTNER ACCESS MODELS
# ==========================================

class PartnerLink(Base):
    """Links a partner user to a primary (household owner) user."""
    __tablename__ = "partner_links"

    id = Column(Integer, primary_key=True)
    primary_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    partner_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    role = Column(String, default="partner")  # future: "child", "advisor"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    primary_user = relationship("User", foreign_keys=[primary_user_id])
    partner_user = relationship("User", foreign_keys=[partner_user_id])

    __table_args__ = (
        UniqueConstraint('partner_user_id', name='uq_partner_link'),
        Index('idx_partner_links_primary_user_id', 'primary_user_id'),
        Index('idx_partner_links_partner_user_id', 'partner_user_id'),
    )


class PartnerInvitation(Base):
    """Stores pending partner invitations with secure tokens."""
    __tablename__ = "partner_invitations"

    id = Column(Integer, primary_key=True)
    inviter_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)  # optional: restrict to specific email
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inviter = relationship("User", foreign_keys=[inviter_user_id])

    __table_args__ = (
        Index('idx_partner_invitations_token', 'token'),
        Index('idx_partner_invitations_inviter', 'inviter_user_id'),
    )


# ==========================================
# AI CHAT MODELS
# ==========================================

class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")
    user = relationship("User", back_populates="ai_conversations")

    __table_args__ = (
        Index('idx_ai_conversations_user_id', 'user_id'),
    )


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    conversation = relationship("AIConversation", back_populates="messages")

    __table_args__ = (
        Index('idx_ai_messages_conversation_id', 'conversation_id'),
    )


class AIUsageQuota(Base):
    __tablename__ = "ai_usage_quotas"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    month = Column(String, index=True)  # "2026-02" format
    queries_used = Column(Integer, default=0)

    user = relationship("User", back_populates="ai_usage_quotas")

    __table_args__ = (
        UniqueConstraint("user_id", "month", name="uq_ai_quota_user_month"),
        Index('idx_ai_usage_quotas_user_id', 'user_id'),
        Index('idx_ai_usage_quotas_month', 'month'),
    )