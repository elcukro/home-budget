from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.database import Base

class SavingCategory(str, enum.Enum):
    EMERGENCY_FUND = "emergency_fund"
    RETIREMENT = "retirement"
    COLLEGE = "college"
    GENERAL = "general"
    INVESTMENT = "investment"
    OTHER = "other"

class SavingType(str, enum.Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"

class Saving(Base):
    __tablename__ = "savings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(Enum(SavingCategory), nullable=False)
    description = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    date = Column(DateTime, nullable=False)
    is_recurring = Column(Boolean, default=False)
    target_amount = Column(Float, nullable=True)
    saving_type = Column(Enum(SavingType), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with User model
    user = relationship("User", back_populates="savings")

    def __repr__(self):
        return f"<Saving(id={self.id}, user_id={self.user_id}, category={self.category}, amount={self.amount})>" 