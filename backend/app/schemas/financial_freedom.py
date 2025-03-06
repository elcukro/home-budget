from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

class BabyStep(BaseModel):
    id: int
    titleKey: str
    descriptionKey: str
    isCompleted: bool = False
    progress: float = 0
    targetAmount: Optional[float] = None
    currentAmount: Optional[float] = None
    completionDate: Optional[datetime] = None
    notes: Optional[str] = ""

class FinancialFreedomBase(BaseModel):
    steps: List[BabyStep]
    
class FinancialFreedomCreate(FinancialFreedomBase):
    userId: str
    startDate: datetime
    lastUpdated: datetime

class FinancialFreedomUpdate(BaseModel):
    steps: List[BabyStep]
    startDate: Optional[datetime] = None

class FinancialFreedomResponse(BaseModel):
    userId: str
    steps: List[BabyStep]
    startDate: datetime
    lastUpdated: datetime

    class Config:
        from_attributes = True
        populate_by_name = True  # Allow both snake_case and camelCase 