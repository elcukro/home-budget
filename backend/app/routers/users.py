import logging
import os
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
from .. import models, database
from ..dependencies import get_or_create_current_user, get_current_user, INTERNAL_SERVICE_SECRET
from pydantic import BaseModel
from ..logging_utils import make_conditional_print

import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

logger = logging.getLogger(__name__)
print = make_conditional_print(__name__)

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

# Pydantic models
class UserBase(BaseModel):
    email: str
    name: str | None = None

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

class SettingsBase(BaseModel):
    language: str | None = "en"  # Default to English if not set
    currency: str | None = "USD"  # Default to USD if not set
    ai: dict | None = None
    emergency_fund_target: int | None = 1000  # Default to $1000 for Baby Step 1
    emergency_fund_months: int | None = 3     # Default to 3 months for Baby Step 3
    base_currency: str | None = "USD"         # Base currency for emergency fund target
    # Polish tax-specific settings
    employment_status: str | None = None      # employee, b2b, business, contract, freelancer, unemployed
    tax_form: str | None = None               # scale, linear, lumpsum, card
    birth_year: int | None = None             # For youth tax relief eligibility
    use_authors_costs: bool | None = False    # KUP 50% for creators
    ppk_enrolled: bool | None = None          # PPK enrollment status
    ppk_employee_rate: float | None = None    # PPK employee contribution (0.5% - 4%)
    ppk_employer_rate: float | None = None    # PPK employer contribution (1.5% - 4%)
    children_count: int | None = 0            # For child tax relief calculation
    # Onboarding status
    onboarding_completed: bool | None = False
    onboarding_completed_at: datetime | None = None

class Settings(SettingsBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

@router.get("/me", response_model=User)
def get_me(
    current_user: models.User = Depends(get_or_create_current_user),
):
    """Get or create current user. Uses X-User-ID + X-Internal-Secret headers."""
    # The user is already fetched/created by the dependency
    return current_user


@router.post("", response_model=User)
def create_user(user: UserBase, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Creating user: {user}")
        db_user = models.User(
            id=user.email,
            email=user.email,
            name=user.name
        )
        db.add(db_user)
        
        # Create default settings for the new user
        settings = models.Settings(
            user_id=user.email,
            language="en",
            currency="USD",
            ai={"apiKey": None},
            emergency_fund_target=1000,
            emergency_fund_months=3,
            base_currency="USD"
        )
        db.add(settings)
        
        try:
            db.commit()
            db.refresh(db_user)
            print(f"[FastAPI] Created user successfully: {db_user}")
            return db_user
        except Exception as e:
            db.rollback()
            print(f"[FastAPI] Error creating user: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")
    except Exception as e:
        print(f"[FastAPI] Error in create_user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{email}/settings", response_model=Settings)
def get_user_settings(
    email: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Get settings for a specific user.
    Uses X-User-ID + X-Internal-Secret headers or Bearer token for authentication.
    Users can only access their own settings.
    """
    # SECURITY: Verify user can only access their own settings
    if email != current_user.email and email != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    settings = db.query(models.Settings).filter(models.Settings.user_id == email).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/{email}/settings", response_model=Settings)
def update_user_settings(
    email: str,
    settings_update: SettingsBase,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Update settings for a specific user.
    Uses X-User-ID + X-Internal-Secret headers or Bearer token for authentication.
    Users can only update their own settings.
    """
    # SECURITY: Verify user can only update their own settings
    if email != current_user.email and email != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    settings = db.query(models.Settings).filter(models.Settings.user_id == email).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    for key, value in settings_update.dict().items():
        setattr(settings, key, value)
    settings.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(settings)
        return settings
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# Delete account models and endpoint
class DeleteAccountRequest(BaseModel):
    confirmation_phrase: str  # "USUŃ KONTO" (PL) or "DELETE ACCOUNT" (EN)


class DeleteAccountResponse(BaseModel):
    success: bool
    message: str


@router.delete("/me/account", response_model=DeleteAccountResponse)
async def delete_user_account(
    request: DeleteAccountRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Permanently delete user account and all associated data.
    Requires confirmation phrase: "USUŃ KONTO" (PL) or "DELETE ACCOUNT" (EN).
    If user has an active Stripe subscription (not lifetime), it will be cancelled.
    Uses X-User-ID + X-Internal-Secret headers for authentication.
    """
    # Validate confirmation phrase
    valid_phrases = ["USUŃ KONTO", "DELETE ACCOUNT"]
    if request.confirmation_phrase not in valid_phrases:
        raise HTTPException(
            status_code=400,
            detail="Invalid confirmation phrase. Please type 'USUŃ KONTO' or 'DELETE ACCOUNT' exactly."
        )

    user = current_user
    user_id = current_user.id

    try:
        # Check for active Stripe subscription and cancel if exists
        subscription = db.query(models.Subscription).filter(
            models.Subscription.user_id == user_id
        ).first()

        if subscription:
            # Cancel Stripe subscription if active and not lifetime
            if (subscription.stripe_subscription_id and
                subscription.status in ["active", "trialing", "past_due"] and
                not subscription.is_lifetime):
                try:
                    stripe.Subscription.cancel(subscription.stripe_subscription_id)
                    logger.info(f"Cancelled Stripe subscription {subscription.stripe_subscription_id} for user {user_id}")
                except stripe.error.StripeError as e:
                    # Log error but continue with account deletion
                    # Data protection takes priority over billing cleanup
                    logger.error(f"Failed to cancel Stripe subscription for user {user_id}: {e}")

        # Delete user (cascade will handle all related data due to relationship configuration)
        db.delete(user)
        db.commit()

        logger.info(f"Successfully deleted account for user {user_id}")
        return DeleteAccountResponse(
            success=True,
            message="Account deleted successfully"
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete account for user {user_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


# Onboarding Backup models and endpoints
class OnboardingBackupCreate(BaseModel):
    data: dict  # Full export data (income, expenses, loans, savings, etc.)
    reason: str | None = None  # "fresh_start", "manual", etc.


class OnboardingBackupResponse(BaseModel):
    id: int
    user_id: str
    data: dict
    reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class OnboardingBackupListItem(BaseModel):
    id: int
    reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/me/onboarding-backups", response_model=OnboardingBackupResponse)
async def create_onboarding_backup(
    backup: OnboardingBackupCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Create a backup of user's data before onboarding fresh start.
    Uses X-User-ID + X-Internal-Secret headers for authentication.
    """
    user_id = current_user.id

    try:
        db_backup = models.OnboardingBackup(
            user_id=user_id,
            data=backup.data,
            reason=backup.reason
        )
        db.add(db_backup)
        db.commit()
        db.refresh(db_backup)

        logger.info(f"Created onboarding backup {db_backup.id} for user {user_id}")
        return db_backup
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create onboarding backup for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {str(e)}")


@router.get("/me/onboarding-backups", response_model=List[OnboardingBackupListItem])
async def list_onboarding_backups(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    List all onboarding backups for the user (without full data, for performance).
    Uses X-User-ID + X-Internal-Secret headers for authentication.
    """
    user_id = current_user.id

    backups = db.query(models.OnboardingBackup).filter(
        models.OnboardingBackup.user_id == user_id
    ).order_by(models.OnboardingBackup.created_at.desc()).all()

    return backups


@router.get("/me/onboarding-backups/{backup_id}", response_model=OnboardingBackupResponse)
async def get_onboarding_backup(
    backup_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Get a specific onboarding backup with full data.
    Uses X-User-ID + X-Internal-Secret headers for authentication.
    """
    user_id = current_user.id
    backup = db.query(models.OnboardingBackup).filter(
        models.OnboardingBackup.id == backup_id,
        models.OnboardingBackup.user_id == user_id
    ).first()

    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    return backup


@router.delete("/me/onboarding-backups/{backup_id}")
async def delete_onboarding_backup(
    backup_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Delete a specific onboarding backup.
    Uses X-User-ID + X-Internal-Secret headers for authentication.
    """
    user_id = current_user.id
    backup = db.query(models.OnboardingBackup).filter(
        models.OnboardingBackup.id == backup_id,
        models.OnboardingBackup.user_id == user_id
    ).first()

    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    try:
        db.delete(backup)
        db.commit()
        return {"success": True, "message": "Backup deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete backup {backup_id} for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete backup: {str(e)}")
