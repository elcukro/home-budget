from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Boolean, JSON, UniqueConstraint, Table, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Changed to String for Google OAuth ID
    email = Column(String, unique=True, index=True)
    name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    loans = relationship("Loan", back_populates="user")
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
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    payment_history = relationship("PaymentHistory", back_populates="user", cascade="all, delete-orphan")

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
    # Polish prepayment regulations (since 2022, banks cannot charge fees for first 3 years)
    overpayment_fee_percent = Column(Float, nullable=True, default=0)  # Fee percentage for prepayment (0-3%)
    overpayment_fee_waived_until = Column(Date, nullable=True)  # Date until prepayment fees are waived
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="loans")

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

    # Relationship
    user = relationship("User", back_populates="expenses")
    bank_transaction = relationship("BankTransaction", foreign_keys=[bank_transaction_id])

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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="income")
    bank_transaction = relationship("BankTransaction", foreign_keys=[bank_transaction_id])

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
    children_count = Column(Integer, default=0)            # For child tax relief calculation

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

    # Relationship
    user = relationship("User", back_populates="banking_connections")

    __table_args__ = (
        Index('idx_banking_connections_user_id', 'user_id'),
        Index('idx_banking_connections_requisition_id', 'requisition_id'),
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

    # Raw data from Tink (for debugging/audit)
    raw_data = Column(JSONB, nullable=True)

    # Metadata
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
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