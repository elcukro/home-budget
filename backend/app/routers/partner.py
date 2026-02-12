"""
Partner Access Router

Handles partner invitation flow, link management, and status queries.
Allows primary users to invite a partner who can then access shared household data.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, database
from ..dependencies import get_current_user
from ..models import PartnerLink, PartnerInvitation

logger = logging.getLogger(__name__)


def _utcnow():
    """Return current UTC time as timezone-aware datetime.
    PostgreSQL with DateTime(timezone=True) returns aware datetimes."""
    return datetime.now(timezone.utc)


def _ensure_aware(dt):
    """Ensure a datetime is timezone-aware (UTC). Handles SQLite naive datetimes."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


router = APIRouter(
    prefix="/partner",
    tags=["partner"],
)


# --- Pydantic models ---

class PartnerInviteRequest(BaseModel):
    email: str | None = None  # Optional: restrict invitation to specific email


class PartnerInviteResponse(BaseModel):
    token: str
    expires_at: datetime
    email: str | None = None


class PartnerInviteValidation(BaseModel):
    valid: bool
    inviter_name: str | None = None
    inviter_email: str | None = None
    email: str | None = None
    expired: bool = False


class PartnerPreflightResponse(BaseModel):
    has_existing_data: bool
    expense_count: int = 0
    income_count: int = 0
    loan_count: int = 0
    saving_count: int = 0


class PartnerAcceptResponse(BaseModel):
    success: bool
    household_id: str
    primary_user_name: str | None = None


class PartnerStatusResponse(BaseModel):
    is_partner: bool
    household_id: str
    partner_email: str | None = None  # For primary: shows partner's email
    partner_name: str | None = None   # For primary: shows partner's name
    primary_email: str | None = None  # For partner: shows primary's email
    primary_name: str | None = None   # For partner: shows primary's name
    linked_at: datetime | None = None
    has_partner: bool = False         # For primary: whether a partner is linked
    pending_invitation: bool = False  # For primary: whether an invitation is pending


# --- Endpoints ---

@router.post("/invite", response_model=PartnerInviteResponse)
def create_invitation(
    request: PartnerInviteRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Create a partner invitation link.
    Only primary users (non-partners) can invite.
    One partner per household.
    """
    # Partners cannot invite others
    if current_user.is_partner:
        raise HTTPException(status_code=403, detail="Partners cannot invite other partners")

    # Check if already has a partner
    existing_link = db.query(PartnerLink).filter(
        PartnerLink.primary_user_id == current_user.id
    ).first()
    if existing_link:
        raise HTTPException(
            status_code=409,
            detail="You already have a linked partner. Remove the existing link first."
        )

    # Invalidate any existing pending invitations
    db.query(PartnerInvitation).filter(
        PartnerInvitation.inviter_user_id == current_user.id,
        PartnerInvitation.accepted_at == None,
    ).update({"expires_at": _utcnow()})

    # Create new invitation
    token = str(uuid.uuid4())
    expires_at = _utcnow() + timedelta(days=7)

    invitation = PartnerInvitation(
        inviter_user_id=current_user.id,
        token=token,
        email=request.email.lower().strip() if request.email else None,
        expires_at=expires_at,
    )
    db.add(invitation)
    db.commit()

    # Send invitation email if email provided
    if request.email:
        try:
            from ..services.email_service import send_partner_invitation_email
            send_partner_invitation_email(
                to_email=request.email,
                inviter_name=current_user.name,
                token=token,
            )
        except Exception as e:
            logger.error(f"Failed to send partner invitation email: {e}")
            # Don't fail the invitation creation if email fails

    logger.info(f"Partner invitation created by {current_user.id}, token: {token[:8]}...")
    return PartnerInviteResponse(
        token=token,
        expires_at=expires_at,
        email=request.email,
    )


@router.get("/invite/{token}", response_model=PartnerInviteValidation)
def validate_invitation(
    token: str,
    db: Session = Depends(database.get_db),
):
    """
    Validate an invitation token. Public endpoint (no auth required).
    Used by the frontend to show invitation details before sign-in.
    """
    invitation = db.query(PartnerInvitation).filter(
        PartnerInvitation.token == token,
    ).first()

    if not invitation:
        return PartnerInviteValidation(valid=False)

    if invitation.accepted_at is not None:
        return PartnerInviteValidation(valid=False)

    if _ensure_aware(invitation.expires_at) < _utcnow():
        return PartnerInviteValidation(valid=False, expired=True)

    inviter = db.query(models.User).filter(
        models.User.id == invitation.inviter_user_id
    ).first()

    return PartnerInviteValidation(
        valid=True,
        inviter_name=inviter.name if inviter else None,
        inviter_email=inviter.email if inviter else None,
        email=invitation.email,
    )


@router.get("/accept/{token}/preflight", response_model=PartnerPreflightResponse)
def accept_preflight(
    token: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Check if the accepting user has existing financial data.
    Called before accept to warn users they'll lose visibility of their own data.
    """
    # Validate token exists and is valid (same checks as accept)
    invitation = db.query(PartnerInvitation).filter(
        PartnerInvitation.token == token,
        PartnerInvitation.accepted_at == None,
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")
    if _ensure_aware(invitation.expires_at) < _utcnow():
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # Count user's existing data
    expense_count = db.query(models.Expense).filter(
        models.Expense.user_id == current_user.id
    ).count()
    income_count = db.query(models.Income).filter(
        models.Income.user_id == current_user.id
    ).count()
    loan_count = db.query(models.Loan).filter(
        models.Loan.user_id == current_user.id
    ).count()
    saving_count = db.query(models.Saving).filter(
        models.Saving.user_id == current_user.id
    ).count()

    total = expense_count + income_count + loan_count + saving_count

    return PartnerPreflightResponse(
        has_existing_data=total > 0,
        expense_count=expense_count,
        income_count=income_count,
        loan_count=loan_count,
        saving_count=saving_count,
    )


@router.get("/accept/{token}/export")
def export_own_data(
    token: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Export the user's OWN data (by current_user.id, not household_id)
    before joining a partner's household. Returns JSON download.
    """
    # Validate token
    invitation = db.query(PartnerInvitation).filter(
        PartnerInvitation.token == token,
        PartnerInvitation.accepted_at == None,
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")
    if _ensure_aware(invitation.expires_at) < _utcnow():
        raise HTTPException(status_code=410, detail="Invitation has expired")

    uid = current_user.id  # Always own data, never household_id

    expenses = db.query(models.Expense).filter(models.Expense.user_id == uid).all()
    incomes = db.query(models.Income).filter(models.Income.user_id == uid).all()
    loans = db.query(models.Loan).filter(models.Loan.user_id == uid).all()
    loan_payments = db.query(models.LoanPayment).filter(models.LoanPayment.user_id == uid).all()
    savings = db.query(models.Saving).filter(models.Saving.user_id == uid).all()
    savings_goals = db.query(models.SavingsGoal).filter(models.SavingsGoal.user_id == uid).all()
    settings = db.query(models.Settings).filter(models.Settings.user_id == uid).first()

    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_email": current_user.email,
        "reason": "pre_partner_join_backup",
        "settings": {
            "language": settings.language if settings else None,
            "currency": settings.currency if settings else None,
            "emergency_fund_target": settings.emergency_fund_target if settings else None,
            "employment_status": settings.employment_status if settings else None,
            "tax_form": settings.tax_form if settings else None,
        } if settings else None,
        "expenses": [
            {
                "category": e.category,
                "description": e.description,
                "amount": float(e.amount),
                "date": str(e.date),
                "is_recurring": e.is_recurring,
                "source": e.source,
            }
            for e in expenses
        ],
        "income": [
            {
                "category": i.category,
                "description": i.description,
                "amount": float(i.amount),
                "date": str(i.date),
                "is_recurring": i.is_recurring,
                "source": i.source,
            }
            for i in incomes
        ],
        "loans": [
            {
                "loan_type": l.loan_type,
                "description": l.description,
                "principal_amount": float(l.principal_amount),
                "remaining_balance": float(l.remaining_balance),
                "interest_rate": float(l.interest_rate),
                "monthly_payment": float(l.monthly_payment),
                "start_date": str(l.start_date),
                "term_months": l.term_months,
            }
            for l in loans
        ],
        "loan_payments": [
            {
                "loan_id": p.loan_id,
                "amount": float(p.amount),
                "date": str(p.date),
                "payment_type": p.payment_type,
            }
            for p in loan_payments
        ],
        "savings": [
            {
                "category": s.category,
                "description": s.description,
                "amount": float(s.amount),
                "date": str(s.date),
                "is_recurring": s.is_recurring,
            }
            for s in savings
        ],
        "savings_goals": [
            {
                "name": g.name,
                "target_amount": float(g.target_amount),
                "current_amount": float(g.current_amount) if g.current_amount else 0,
                "deadline": str(g.deadline) if g.deadline else None,
            }
            for g in savings_goals
        ],
    }

    logger.info(f"Partner pre-join export for {current_user.id}: {len(expenses)} expenses, {len(incomes)} income, {len(loans)} loans")

    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": f'attachment; filename="firedup-backup-{current_user.email}.json"',
        },
    )


@router.post("/accept/{token}", response_model=PartnerAcceptResponse)
def accept_invitation(
    token: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Accept a partner invitation. Creates the PartnerLink.
    Requires authentication (partner must be signed in).
    """
    # Check if user is already linked as partner
    existing_link = db.query(PartnerLink).filter(
        PartnerLink.partner_user_id == current_user.id
    ).first()
    if existing_link:
        raise HTTPException(status_code=409, detail="You are already linked as a partner")

    # Find and validate invitation
    invitation = db.query(PartnerInvitation).filter(
        PartnerInvitation.token == token,
        PartnerInvitation.accepted_at == None,
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")

    if _ensure_aware(invitation.expires_at) < _utcnow():
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # If invitation was restricted to specific email, validate
    if invitation.email and invitation.email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=403,
            detail="This invitation was sent to a different email address"
        )

    # Cannot link to yourself
    if invitation.inviter_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot accept your own invitation")

    # Check if inviter already has a partner
    existing_primary_link = db.query(PartnerLink).filter(
        PartnerLink.primary_user_id == invitation.inviter_user_id
    ).first()
    if existing_primary_link:
        raise HTTPException(
            status_code=409,
            detail="The inviting user already has a linked partner"
        )

    # Create partner link
    link = PartnerLink(
        primary_user_id=invitation.inviter_user_id,
        partner_user_id=current_user.id,
    )
    db.add(link)

    # Mark invitation as accepted
    invitation.accepted_at = _utcnow()
    db.commit()

    # Get inviter info for response
    inviter = db.query(models.User).filter(
        models.User.id == invitation.inviter_user_id
    ).first()

    logger.info(
        f"Partner link created: {current_user.id} -> {invitation.inviter_user_id}"
    )

    return PartnerAcceptResponse(
        success=True,
        household_id=invitation.inviter_user_id,
        primary_user_name=inviter.name if inviter else None,
    )


@router.get("/status", response_model=PartnerStatusResponse)
def get_partner_status(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Get partner link status for the current user.
    Works for both primary users and partners.
    """
    # Check if current user IS a partner
    if current_user.is_partner:
        link = current_user.partner_link_as_partner
        primary = db.query(models.User).filter(
            models.User.id == link.primary_user_id
        ).first()
        return PartnerStatusResponse(
            is_partner=True,
            household_id=current_user.household_id,
            primary_email=primary.email if primary else None,
            primary_name=primary.name if primary else None,
            linked_at=link.created_at,
        )

    # Check if current user HAS a partner
    link = db.query(PartnerLink).filter(
        PartnerLink.primary_user_id == current_user.id
    ).first()

    if link:
        partner = db.query(models.User).filter(
            models.User.id == link.partner_user_id
        ).first()
        return PartnerStatusResponse(
            is_partner=False,
            household_id=current_user.id,
            partner_email=partner.email if partner else None,
            partner_name=partner.name if partner else None,
            linked_at=link.created_at,
            has_partner=True,
        )

    # Check for pending invitation
    pending = db.query(PartnerInvitation).filter(
        PartnerInvitation.inviter_user_id == current_user.id,
        PartnerInvitation.accepted_at == None,
        PartnerInvitation.expires_at > _utcnow(),
    ).first()

    return PartnerStatusResponse(
        is_partner=False,
        household_id=current_user.id,
        pending_invitation=pending is not None,
    )


@router.delete("/link")
def remove_partner_link(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """
    Remove partner link. Only the primary user can unlink.
    Immediately revokes partner's access to household data.
    """
    if current_user.is_partner:
        raise HTTPException(
            status_code=403,
            detail="Only the primary account holder can remove the partner link"
        )

    link = db.query(PartnerLink).filter(
        PartnerLink.primary_user_id == current_user.id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="No partner link found")

    partner_id = link.partner_user_id
    db.delete(link)
    db.commit()

    logger.info(f"Partner link removed: {current_user.id} unlinked {partner_id}")

    return {"success": True, "message": "Partner link removed"}
