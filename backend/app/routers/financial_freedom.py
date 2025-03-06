from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging

from ..database import get_db
from ..models import User, FinancialFreedom, Settings
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
            logger.info(f"No existing data found for user {current_user.id}, retrieving settings and creating default data")
            
            # Get user settings for financial freedom configuration
            user_settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
            
            # Default values if settings don't exist
            emergency_fund_target = 1000
            emergency_fund_months = 3
            
            # Use user settings if they exist
            if user_settings:
                emergency_fund_target = user_settings.emergency_fund_target
                emergency_fund_months = user_settings.emergency_fund_months
            
            logger.info(f"Using settings: emergency_fund_target={emergency_fund_target}, emergency_fund_months={emergency_fund_months}")
            
            return FinancialFreedomResponse(
                userId=current_user.id,
                steps=[
                    {
                        "id": 1,
                        "titleKey": "financialFreedom.steps.step1.title",
                        "descriptionKey": "financialFreedom.steps.step1.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": emergency_fund_target,
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
        
        # Get existing financial freedom data to compare with updates
        existing_ff = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.id
        ).first()
        
        # Get user settings for steps 1-3 reference values
        user_settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
        
        # Prevent manual updates to steps 1-3 which are auto-calculated
        # We'll preserve the steps from the database when they're available
        if existing_ff:
            existing_steps = existing_ff.steps
            updated_steps = []
            
            for step in financial_freedom_data.steps:
                # For steps 1-3, we never accept client-side updates as they're fully automated
                if step.id <= 3 and existing_steps:
                    # Find the matching existing step and preserve it
                    existing_step = next((s for s in existing_steps if s["id"] == step.id), None)
                    if existing_step:
                        # Keep existing step data without changes
                        updated_steps.append(existing_step)
                    else:
                        # If the step doesn't exist in the database (unlikely), use the default
                        logger.warning(f"Step {step.id} not found in existing data, using client data")
                        updated_steps.append(step.dict())
                else:
                    # For steps 4-7, allow all updates
                    updated_steps.append(step.dict())
            
            # Create or update the financial freedom record
            if not existing_ff:
                logger.info(f"Creating new financial freedom record for user {current_user.id}")
                financial_freedom = FinancialFreedom(
                    userId=current_user.id,
                    steps=updated_steps,
                    startDate=financial_freedom_data.startDate or datetime.now(),
                    lastUpdated=datetime.now()
                )
                db.add(financial_freedom)
            else:
                logger.info(f"Updating existing record for user {current_user.id}")
                existing_ff.steps = updated_steps
                existing_ff.lastUpdated = datetime.now()
                financial_freedom = existing_ff
            
            db.commit()
            db.refresh(financial_freedom)
            logger.info(f"Successfully updated data for user {current_user.id}")
            
            return financial_freedom
        else:
            # If no existing record, create a new one (should be rare since GET creates a default)
            logger.info(f"Creating new financial freedom record for user {current_user.id}")
            financial_freedom = FinancialFreedom(
                userId=current_user.id,
                steps=[step.dict() for step in financial_freedom_data.steps],
                startDate=financial_freedom_data.startDate or datetime.now(),
                lastUpdated=datetime.now()
            )
            db.add(financial_freedom)
            db.commit()
            db.refresh(financial_freedom)
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