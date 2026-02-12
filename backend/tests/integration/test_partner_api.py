"""
Integration tests for the Partner Access System.

Tests the complete partner invitation flow:
- Creating invitations
- Validating tokens
- Preflight data check
- Accepting invitations
- Partner status queries
- Unlinking partners
- Security guards (settings write restrictions, access control)
"""
import pytest
from datetime import datetime, timedelta
from app import models


@pytest.fixture
def partner_user(db_session):
    """Create a second user to act as partner."""
    user = models.User(
        id="partner-user-id",
        email="partner@example.com",
        name="Partner User"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def partner_auth_headers(partner_user):
    """Auth headers for the partner user."""
    return {
        "X-User-ID": partner_user.email,
        "X-Internal-Secret": "test-internal-secret"
    }


@pytest.fixture
def partner_with_data(db_session, partner_user):
    """Partner user with some existing financial data."""
    from datetime import date
    expenses = [
        models.Expense(
            user_id=partner_user.id,
            category="food",
            description=f"Expense {i}",
            amount=100.0 + i,
            date=date(2026, 1, 15),
        )
        for i in range(5)
    ]
    db_session.add_all(expenses)

    loan = models.Loan(
        user_id=partner_user.id,
        loan_type="personal",
        description="Test loan",
        principal_amount=10000,
        remaining_balance=8000,
        interest_rate=5.0,
        monthly_payment=500,
        start_date=date(2025, 1, 1),
        term_months=24,
    )
    db_session.add(loan)
    db_session.commit()
    return partner_user


class TestPartnerInvite:
    """Tests for POST /partner/invite"""

    def test_create_invitation(self, client, test_user, auth_headers):
        response = client.post(
            "/partner/invite",
            json={"email": "partner@example.com"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["email"] == "partner@example.com"
        assert "expires_at" in data

    def test_create_invitation_without_email(self, client, test_user, auth_headers):
        response = client.post(
            "/partner/invite",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["email"] is None

    def test_partner_cannot_invite(self, client, db_session, test_user, partner_user, partner_auth_headers):
        """Partners should not be able to invite others."""
        # Create a partner link first
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        response = client.post(
            "/partner/invite",
            json={},
            headers=partner_auth_headers,
        )
        assert response.status_code == 403
        assert "Partners cannot invite" in response.json()["detail"]

    def test_cannot_invite_when_partner_exists(self, client, db_session, test_user, partner_user, auth_headers):
        """Cannot invite when already has a linked partner."""
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        response = client.post(
            "/partner/invite",
            json={},
            headers=auth_headers,
        )
        assert response.status_code == 409


class TestPartnerValidateToken:
    """Tests for GET /partner/invite/{token}"""

    def test_validate_valid_token(self, client, db_session, test_user, auth_headers):
        # Create invitation
        resp = client.post("/partner/invite", json={}, headers=auth_headers)
        token = resp.json()["token"]

        # Validate (public, no auth)
        response = client.get(f"/partner/invite/{token}")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["inviter_name"] == test_user.name
        assert data["expired"] is False

    def test_validate_invalid_token(self, client):
        response = client.get("/partner/invite/nonexistent-token")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False

    def test_validate_expired_token(self, client, db_session, test_user):
        """Expired tokens should show as invalid."""
        invitation = models.PartnerInvitation(
            inviter_user_id=test_user.id,
            token="expired-token-123",
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        db_session.add(invitation)
        db_session.commit()

        response = client.get("/partner/invite/expired-token-123")
        data = response.json()
        assert data["valid"] is False
        assert data["expired"] is True


class TestPartnerPreflight:
    """Tests for GET /partner/accept/{token}/preflight"""

    def test_preflight_no_data(self, client, db_session, test_user, partner_user, partner_auth_headers, auth_headers):
        # Create invitation
        resp = client.post("/partner/invite", json={}, headers=auth_headers)
        token = resp.json()["token"]

        response = client.get(
            f"/partner/accept/{token}/preflight",
            headers=partner_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_existing_data"] is False
        assert data["expense_count"] == 0

    def test_preflight_with_data(self, client, db_session, test_user, partner_with_data, partner_auth_headers, auth_headers):
        resp = client.post("/partner/invite", json={}, headers=auth_headers)
        token = resp.json()["token"]

        response = client.get(
            f"/partner/accept/{token}/preflight",
            headers=partner_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_existing_data"] is True
        assert data["expense_count"] == 5
        assert data["loan_count"] == 1


class TestPartnerAccept:
    """Tests for POST /partner/accept/{token}"""

    def test_accept_invitation(self, client, db_session, test_user, partner_user, partner_auth_headers, auth_headers):
        # Create invitation
        resp = client.post("/partner/invite", json={}, headers=auth_headers)
        token = resp.json()["token"]

        # Accept
        response = client.post(
            f"/partner/accept/{token}",
            headers=partner_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["household_id"] == test_user.id

    def test_cannot_accept_own_invitation(self, client, db_session, test_user, auth_headers):
        resp = client.post("/partner/invite", json={}, headers=auth_headers)
        token = resp.json()["token"]

        response = client.post(
            f"/partner/accept/{token}",
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "own invitation" in response.json()["detail"]

    def test_cannot_accept_expired_invitation(self, client, db_session, test_user, partner_user, partner_auth_headers):
        invitation = models.PartnerInvitation(
            inviter_user_id=test_user.id,
            token="expired-accept-token",
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        db_session.add(invitation)
        db_session.commit()

        response = client.post(
            "/partner/accept/expired-accept-token",
            headers=partner_auth_headers,
        )
        assert response.status_code == 410

    def test_cannot_accept_wrong_email(self, client, db_session, test_user, partner_user, partner_auth_headers, auth_headers):
        """Invitation restricted to specific email should reject other users."""
        resp = client.post(
            "/partner/invite",
            json={"email": "someone-else@example.com"},
            headers=auth_headers,
        )
        token = resp.json()["token"]

        response = client.post(
            f"/partner/accept/{token}",
            headers=partner_auth_headers,
        )
        assert response.status_code == 403
        assert "different email" in response.json()["detail"]

    def test_already_linked_partner_cannot_accept(self, client, db_session, test_user, partner_user, partner_auth_headers, auth_headers):
        """A user already linked as partner cannot accept another invitation."""
        # Create existing link
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        # Try to accept another invitation
        other_user = models.User(id="other-user", email="other@example.com", name="Other")
        db_session.add(other_user)
        db_session.commit()

        invitation = models.PartnerInvitation(
            inviter_user_id=other_user.id,
            token="other-invite-token",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db_session.add(invitation)
        db_session.commit()

        response = client.post(
            "/partner/accept/other-invite-token",
            headers=partner_auth_headers,
        )
        assert response.status_code == 409


class TestPartnerExport:
    """Tests for GET /partner/accept/{token}/export"""

    def test_export_own_data(self, client, db_session, test_user, partner_with_data, partner_auth_headers, auth_headers):
        resp = client.post("/partner/invite", json={}, headers=auth_headers)
        token = resp.json()["token"]

        response = client.get(
            f"/partner/accept/{token}/export",
            headers=partner_auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reason"] == "pre_partner_join_backup"
        assert data["user_email"] == "partner@example.com"
        assert len(data["expenses"]) == 5
        assert len(data["loans"]) == 1
        assert "exported_at" in data


class TestPartnerStatus:
    """Tests for GET /partner/status"""

    def test_status_no_partner(self, client, test_user, auth_headers):
        response = client.get("/partner/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_partner"] is False
        assert data["has_partner"] is False
        assert data["household_id"] == test_user.id

    def test_status_primary_with_partner(self, client, db_session, test_user, partner_user, auth_headers):
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        response = client.get("/partner/status", headers=auth_headers)
        data = response.json()
        assert data["is_partner"] is False
        assert data["has_partner"] is True
        assert data["partner_email"] == partner_user.email

    def test_status_as_partner(self, client, db_session, test_user, partner_user, partner_auth_headers):
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        response = client.get("/partner/status", headers=partner_auth_headers)
        data = response.json()
        assert data["is_partner"] is True
        assert data["household_id"] == test_user.id
        assert data["primary_email"] == test_user.email

    def test_status_with_pending_invitation(self, client, db_session, test_user, auth_headers):
        invitation = models.PartnerInvitation(
            inviter_user_id=test_user.id,
            token="pending-token",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        db_session.add(invitation)
        db_session.commit()

        response = client.get("/partner/status", headers=auth_headers)
        data = response.json()
        assert data["pending_invitation"] is True


class TestPartnerUnlink:
    """Tests for DELETE /partner/link"""

    def test_primary_can_unlink(self, client, db_session, test_user, partner_user, auth_headers):
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        response = client.delete("/partner/link", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify unlinked
        status = client.get("/partner/status", headers=auth_headers).json()
        assert status["has_partner"] is False

    def test_partner_cannot_unlink(self, client, db_session, test_user, partner_user, partner_auth_headers):
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        response = client.delete("/partner/link", headers=partner_auth_headers)
        assert response.status_code == 403

    def test_unlink_when_no_partner(self, client, test_user, auth_headers):
        response = client.delete("/partner/link", headers=auth_headers)
        assert response.status_code == 404


class TestPartnerDataAccess:
    """Tests that partners can access household data."""

    def test_partner_sees_primary_expenses(self, client, db_session, test_user, partner_user, partner_auth_headers, auth_headers):
        from datetime import date
        # Create data under primary user
        expense = models.Expense(
            user_id=test_user.id,
            category="food",
            description="Primary's expense",
            amount=50.0,
            date=date(2026, 1, 15),
        )
        db_session.add(expense)

        # Link partner
        link = models.PartnerLink(
            primary_user_id=test_user.id,
            partner_user_id=partner_user.id,
        )
        db_session.add(link)
        db_session.commit()

        # Partner reads primary's expenses
        response = client.get(
            f"/users/{test_user.id}/expenses",
            headers=partner_auth_headers,
        )
        assert response.status_code == 200
        expenses = response.json()
        assert len(expenses) >= 1
        assert any(e["description"] == "Primary's expense" for e in expenses)

    def test_unlinked_partner_cannot_access(self, client, db_session, test_user, partner_user, partner_auth_headers):
        """Without a partner link, accessing primary's data should fail."""
        response = client.get(
            f"/users/{test_user.id}/expenses",
            headers=partner_auth_headers,
        )
        assert response.status_code == 403
