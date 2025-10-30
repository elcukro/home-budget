from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.types import TIMESTAMP
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    incomes = relationship("Income", back_populates="user")
    expenses = relationship("Expense", back_populates="user")
    loans = relationship("Loan", back_populates="user")
    activities = relationship("Activity", back_populates="user")
    settings = relationship("Settings", back_populates="user", uselist=False)

class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    source = Column(String)
    amount = Column(Float)
    is_recurring = Column(Boolean, default=True)
    date = Column(Date)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="incomes")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)
    date = Column(Date)
    is_recurring = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="expenses")

class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    loan_type = Column(String)  # mortgage, car, personal, etc.
    description = Column(String)
    principal_amount = Column(Float)
    interest_rate = Column(Float)
    start_date = Column(Date)
    term_months = Column(Integer)
    monthly_payment = Column(Float)
    remaining_balance = Column(Float)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="loans")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    entity_type = Column(String)  # 'Income', 'Expense', or 'Loan'
    operation_type = Column(String)  # 'create', 'update', or 'delete'
    entity_id = Column(Integer)
    previous_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    timestamp = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="activities")

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    language = Column(String, default="en")
    currency = Column(String, default="USD")
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="settings")
