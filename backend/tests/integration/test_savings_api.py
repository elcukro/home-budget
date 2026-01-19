"""
Integration tests for savings API endpoints.

Tests the full HTTP request/response cycle for savings management
against the real FastAPI application.
"""
import pytest
from datetime import date


class TestListSavings:
    """Tests for GET /savings endpoint."""

    def test_returns_empty_list_for_new_user(self, client, test_user, auth_headers):
        """Empty list returned for user with no savings."""
        response = client.get("/savings", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_user_savings(self, client, test_user, auth_headers):
        """All user's savings are returned."""
        # Create savings
        client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Emergency fund deposit",
                "amount": 500,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )
        client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "general",
                "description": "Summer trip",
                "amount": 200,
                "date": "2024-01-20",
                "saving_type": "deposit"
            }
        )

        response = client.get("/savings", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreateSaving:
    """Tests for POST /savings endpoint."""

    def test_creates_deposit(self, client, test_user, auth_headers):
        """Deposit saving is created successfully."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Monthly emergency fund",
                "amount": 1000.50,
                "date": "2024-01-15",
                "saving_type": "deposit",
                "account_type": "standard"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["category"] == "emergency_fund"
        assert data["amount"] == 1000.50
        assert data["saving_type"] == "deposit"
        assert data["account_type"] == "standard"
        assert "id" in data
        assert "created_at" in data

    def test_creates_withdrawal(self, client, test_user, auth_headers):
        """Withdrawal saving is created successfully."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Emergency withdrawal",
                "amount": 500,
                "date": "2024-02-01",
                "saving_type": "withdrawal"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["saving_type"] == "withdrawal"

    def test_creates_recurring_saving(self, client, test_user, auth_headers):
        """Recurring saving is created with end_date."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "retirement",
                "description": "Monthly IKE contribution",
                "amount": 500,
                "date": "2024-01-01",
                "end_date": "2024-12-01",
                "is_recurring": True,
                "saving_type": "deposit",
                "account_type": "ike"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_recurring"] is True
        assert data["end_date"] == "2024-12-01"
        assert data["account_type"] == "ike"

    def test_creates_saving_with_target(self, client, test_user, auth_headers):
        """Saving with target amount is created."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "general",
                "description": "Hawaii trip fund",
                "amount": 1000,
                "date": "2024-01-15",
                "target_amount": 5000,
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["target_amount"] == 5000

    def test_creates_polish_retirement_saving(self, client, test_user, auth_headers):
        """Polish III pillar retirement accounts are supported."""
        account_types = ["ike", "ikze", "ppk"]

        for account_type in account_types:
            response = client.post(
                "/savings",
                headers=auth_headers,
                json={
                    "category": "retirement",
                    "description": f"{account_type.upper()} contribution",
                    "amount": 500,
                    "date": "2024-01-15",
                    "saving_type": "deposit",
                    "account_type": account_type
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["account_type"] == account_type

    def test_requires_authentication(self, client, test_user):
        """Request without auth header returns 401."""
        response = client.post(
            "/savings",
            json={
                "category": "emergency_fund",
                "description": "Test",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 401


class TestUpdateSaving:
    """Tests for PUT /savings/{saving_id} endpoint."""

    def test_updates_saving(self, client, test_user, auth_headers):
        """Saving is updated successfully."""
        create_response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Original",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )
        saving_id = create_response.json()["id"]

        response = client.put(
            f"/savings/{saving_id}",
            headers=auth_headers,
            json={
                "category": "general",
                "description": "Updated",
                "amount": 200,
                "date": "2024-02-01",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "general"
        assert data["description"] == "Updated"
        assert data["amount"] == 200

    def test_update_to_recurring(self, client, test_user, auth_headers):
        """One-time saving can be converted to recurring."""
        create_response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "One-time",
                "amount": 100,
                "date": "2024-01-15",
                "is_recurring": False,
                "saving_type": "deposit"
            }
        )
        saving_id = create_response.json()["id"]

        response = client.put(
            f"/savings/{saving_id}",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Now recurring",
                "amount": 100,
                "date": "2024-01-15",
                "end_date": "2024-12-31",
                "is_recurring": True,
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_recurring"] is True
        assert data["end_date"] == "2024-12-31"

    def test_returns_404_for_nonexistent(self, client, test_user, auth_headers):
        """404 returned for nonexistent saving."""
        response = client.put(
            "/savings/99999",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Test",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 404


class TestDeleteSaving:
    """Tests for DELETE /savings/{saving_id} endpoint."""

    def test_deletes_saving(self, client, test_user, auth_headers):
        """Saving is deleted successfully."""
        create_response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "To delete",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )
        saving_id = create_response.json()["id"]

        response = client.delete(
            f"/savings/{saving_id}",
            headers=auth_headers
        )

        # Real app returns 204 No Content on delete
        assert response.status_code == 204

        # Verify deleted - should return 401 because we're now using get_current_user
        # and the saving doesn't exist for this user
        list_response = client.get("/savings", headers=auth_headers)
        assert list_response.status_code == 200
        assert len(list_response.json()) == 0

    def test_returns_404_for_nonexistent(self, client, test_user, auth_headers):
        """404 returned for nonexistent saving."""
        response = client.delete(
            "/savings/99999",
            headers=auth_headers
        )

        assert response.status_code == 404

    def test_cannot_delete_other_user_saving(self, client, db_session, test_user, auth_headers):
        """Cannot delete other user's saving."""
        # Create another user
        from app import models
        other_user = models.User(
            id="other-user-id",
            email="other@example.com",
            name="Other User"
        )
        db_session.add(other_user)
        db_session.commit()

        # Create saving for the other user
        other_saving = models.Saving(
            user_id=other_user.id,
            category="emergency_fund",
            description="Other user's saving",
            amount=100,
            date=date(2024, 1, 15),
            saving_type="deposit"
        )
        db_session.add(other_saving)
        db_session.commit()

        # Try to delete as our test user
        response = client.delete(
            f"/savings/{other_saving.id}",
            headers=auth_headers
        )

        # Should get 404 because saving doesn't belong to test_user
        assert response.status_code == 404


class TestSavingCategories:
    """Tests for different saving categories."""

    @pytest.mark.parametrize("category", [
        "emergency_fund",
        "six_month_fund",
        "retirement",
        "college",
        "general",
        "investment",
        "real_estate",
        "other"
    ])
    def test_common_categories(self, client, test_user, auth_headers, category):
        """Common saving categories are accepted (per SavingCategory enum)."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": category,
                "description": f"Test {category}",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        assert response.json()["category"] == category


class TestSavingAmounts:
    """Tests for saving amount edge cases."""

    def test_handles_large_amounts(self, client, test_user, auth_headers):
        """Large amounts are handled correctly."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "retirement",
                "description": "Large deposit",
                "amount": 1000000.00,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        assert response.json()["amount"] == 1000000.00

    def test_handles_decimal_amounts(self, client, test_user, auth_headers):
        """Decimal amounts are preserved."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Precise amount",
                "amount": 123.45,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        assert response.json()["amount"] == 123.45

    def test_handles_small_amounts(self, client, test_user, auth_headers):
        """Small amounts are accepted."""
        response = client.post(
            "/savings",
            headers=auth_headers,
            json={
                "category": "emergency_fund",
                "description": "Small deposit",
                "amount": 0.01,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        assert response.json()["amount"] == 0.01
