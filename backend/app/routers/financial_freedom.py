from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging

from ..database import get_db
from ..models import User, FinancialFreedom
from ..schemas.financial_freedom import FinancialFreedomCreate, FinancialFreedomResponse, FinancialFreedomUpdate
from ..dependencies import get_current_user

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/financial-freedom",
    tags=["financial-freedom"],
    responses={404: {"description": "Not found"}},
)

@router.get("", response_model=FinancialFreedomResponse)
async def get_financial_freedom(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the financial freedom data for the current user."""
    try:
        logger.info(f"Getting financial freedom data for user: {current_user.id}")
        financial_freedom = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.id
        ).first()
        
        if not financial_freedom:
            logger.info(f"No existing data found for user {current_user.id}, returning default data")
            return FinancialFreedomResponse(
                userId=current_user.id,
                steps=[
                    {
                        "id": 1,
                        "titleKey": "financialFreedom.steps.step1.title",
                        "descriptionKey": "financialFreedom.steps.step1.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": 3000,
                        "currentAmount": 0,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 2,
                        "titleKey": "financialFreedom.steps.step2.title",
                        "descriptionKey": "financialFreedom.steps.step2.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 3,
                        "titleKey": "financialFreedom.steps.step3.title",
                        "descriptionKey": "financialFreedom.steps.step3.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": 0,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 4,
                        "titleKey": "financialFreedom.steps.step4.title",
                        "descriptionKey": "financialFreedom.steps.step4.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 5,
                        "titleKey": "financialFreedom.steps.step5.title",
                        "descriptionKey": "financialFreedom.steps.step5.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 6,
                        "titleKey": "financialFreedom.steps.step6.title",
                        "descriptionKey": "financialFreedom.steps.step6.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 7,
                        "titleKey": "financialFreedom.steps.step7.title",
                        "descriptionKey": "financialFreedom.steps.step7.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    }
                ],
                startDate=datetime.now(),
                lastUpdated=datetime.now()
            )
        
        logger.info(f"Found existing data for user {current_user.id}")
        return financial_freedom
    except Exception as e:
        logger.error(f"Error in get_financial_freedom: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching financial freedom data: {str(e)}"
        )

@router.put("", response_model=FinancialFreedomResponse)
async def update_financial_freedom(
    financial_freedom_data: FinancialFreedomUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the financial freedom data for the current user."""
    try:
        logger.info(f"Updating financial freedom data for user: {current_user.id}")
        financial_freedom = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.id
        ).first()
        
        if not financial_freedom:
            logger.info(f"Creating new financial freedom record for user {current_user.id}")
            # Create new record if it doesn't exist
            financial_freedom = FinancialFreedom(
                userId=current_user.id,
                steps=[step.dict() for step in financial_freedom_data.steps],
                startDate=financial_freedom_data.startDate or datetime.now(),
                lastUpdated=datetime.now()
            )
            db.add(financial_freedom)
        else:
            logger.info(f"Updating existing record for user {current_user.id}")
            # Update existing record
            financial_freedom.steps = [step.dict() for step in financial_freedom_data.steps]
            financial_freedom.lastUpdated = datetime.now()
        
        db.commit()
        db.refresh(financial_freedom)
        logger.info(f"Successfully updated data for user {current_user.id}")
        
        return financial_freedom
    except Exception as e:
        logger.error(f"Error in update_financial_freedom: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating financial freedom data: {str(e)}"
        )

@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def reset_financial_freedom(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reset the financial freedom data for the current user."""
    try:
        logger.info(f"Resetting financial freedom data for user: {current_user.id}")
        financial_freedom = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.id
        ).first()
        
        if financial_freedom:
            db.delete(financial_freedom)
            db.commit()
            logger.info(f"Successfully reset data for user {current_user.id}")
        else:
            logger.info(f"No data found to reset for user {current_user.id}")
        
        return None
    except Exception as e:
        logger.error(f"Error in reset_financial_freedom: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting financial freedom data: {str(e)}"
        ) 