from sqlalchemy.orm import relationship

class User:
    expenses = relationship("Expense", back_populates="user")
    incomes = relationship("Income", back_populates="user")
    savings = relationship("Saving", back_populates="user") 