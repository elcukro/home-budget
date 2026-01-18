"""
Integration tests for savings API endpoints.

Tests the full HTTP request/response cycle for savings management.
"""
import pytest
from datetime import date


class TestListSavings:
    """Tests for GET /savings endpoint."""

    def test_returns_empty_list_for_new_user(self, client, test_user):
        """Empty list returned for user with no savings."""
        response = client.get("/savings", params={"user_id": test_user.id})

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_user_savings(self, client, test_user):
        """All user's savings are returned."""
        # Create savings
        client.post(
            "/savings",
            params={"user_id": test_user.id},
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
            params={"user_id": test_user.id},
            json={
                "category": "vacation",
                "description": "Summer trip",
                "amount": 200,
                "date": "2024-01-20",
                "saving_type": "deposit"
            }
        )

        response = client.get("/savings", params={"user_id": test_user.id})

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreateSaving:
    """Tests for POST /savings endpoint."""

    def test_creates_deposit(self, client, test_user):
        """Deposit saving is created successfully."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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

    def test_creates_withdrawal(self, client, test_user):
        """Withdrawal saving is created successfully."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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

    def test_creates_recurring_saving(self, client, test_user):
        """Recurring saving is created with end_date."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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

    def test_creates_saving_with_target(self, client, test_user):
        """Saving with target amount is created."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
            json={
                "category": "vacation",
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

    def test_creates_polish_retirement_saving(self, client, test_user):
        """Polish III pillar retirement accounts are supported."""
        account_types = ["ike", "ikze", "ppk"]

        for account_type in account_types:
            response = client.post(
                "/savings",
                params={"user_id": test_user.id},
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


class TestGetSaving:
    """Tests for GET /savings/{saving_id} endpoint."""

    def test_returns_saving(self, client, test_user):
        """Single saving is retrieved."""
        create_response = client.post(
            "/savings",
            params={"user_id": test_user.id},
            json={
                "category": "emergency_fund",
                "description": "Test saving",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )
        saving_id = create_response.json()["id"]

        response = client.get(
            f"/savings/{saving_id}",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == saving_id
        assert data["description"] == "Test saving"

    def test_returns_404_for_nonexistent(self, client, test_user):
        """404 returned for nonexistent saving."""
        response = client.get(
            "/savings/99999",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 404

    def test_returns_404_for_other_user(self, client, test_user, db_session):
        """Cannot access other user's saving."""
        # Create saving for test_user
        create_response = client.post(
            "/savings",
            params={"user_id": test_user.id},
            json={
                "category": "emergency_fund",
                "description": "Private saving",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )
        saving_id = create_response.json()["id"]

        # Try to access with different user
        response = client.get(
            f"/savings/{saving_id}",
            params={"user_id": "other@example.com"}
        )

        assert response.status_code == 404


class TestUpdateSaving:
    """Tests for PUT /savings/{saving_id} endpoint."""

    def test_updates_saving(self, client, test_user):
        """Saving is updated successfully."""
        create_response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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
            params={"user_id": test_user.id},
            json={
                "category": "vacation",
                "description": "Updated",
                "amount": 200,
                "date": "2024-02-01",
                "saving_type": "deposit"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "vacation"
        assert data["description"] == "Updated"
        assert data["amount"] == 200
        assert data["updated_at"] is not None

    def test_update_to_recurring(self, client, test_user):
        """One-time saving can be converted to recurring."""
        create_response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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
            params={"user_id": test_user.id},
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

    def test_returns_404_for_nonexistent(self, client, test_user):
        """404 returned for nonexistent saving."""
        response = client.put(
            "/savings/99999",
            params={"user_id": test_user.id},
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

    def test_deletes_saving(self, client, test_user):
        """Saving is deleted successfully."""
        create_response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deleted
        get_response = client.get(
            f"/savings/{saving_id}",
            params={"user_id": test_user.id}
        )
        assert get_response.status_code == 404

    def test_returns_404_for_nonexistent(self, client, test_user):
        """404 returned for nonexistent saving."""
        response = client.delete(
            "/savings/99999",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 404

    def test_cannot_delete_other_user_saving(self, client, test_user):
        """Cannot delete other user's saving."""
        create_response = client.post(
            "/savings",
            params={"user_id": test_user.id},
            json={
                "category": "emergency_fund",
                "description": "Private",
                "amount": 100,
                "date": "2024-01-15",
                "saving_type": "deposit"
            }
        )
        saving_id = create_response.json()["id"]

        response = client.delete(
            f"/savings/{saving_id}",
            params={"user_id": "other@example.com"}
        )

        assert response.status_code == 404


class TestSavingCategories:
    """Tests for different saving categories."""

    @pytest.mark.parametrize("category", [
        "emergency_fund",
        "vacation",
        "retirement",
        "education",
        "down_payment",
        "other"
    ])
    def test_common_categories(self, client, test_user, category):
        """Common saving categories are accepted."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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

    def test_handles_large_amounts(self, client, test_user):
        """Large amounts are handled correctly."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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

    def test_handles_decimal_amounts(self, client, test_user):
        """Decimal amounts are preserved."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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

    def test_handles_small_amounts(self, client, test_user):
        """Small amounts are accepted."""
        response = client.post(
            "/savings",
            params={"user_id": test_user.id},
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
