"""
Integration tests for loans API endpoints.

Tests the full HTTP request/response cycle for loan management.
"""
import pytest
from datetime import date


class TestListLoans:
    """Tests for GET /loans endpoint."""

    def test_returns_empty_list_for_new_user(self, client, test_user):
        """Empty list returned for user with no loans."""
        response = client.get("/loans", params={"user_id": test_user.id})

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_user_loans(self, client, test_user):
        """All user's loans are returned."""
        # Create loans
        client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Home mortgage",
                "principal_amount": 300000,
                "remaining_balance": 280000,
                "interest_rate": 5.5,
                "monthly_payment": 1800,
                "start_date": "2023-01-15",
                "term_months": 360
            }
        )
        client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "car",
                "description": "Car loan",
                "principal_amount": 25000,
                "remaining_balance": 20000,
                "interest_rate": 4.5,
                "monthly_payment": 450,
                "start_date": "2023-06-01",
                "term_months": 60
            }
        )

        response = client.get("/loans", params={"user_id": test_user.id})

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreateLoan:
    """Tests for POST /loans endpoint."""

    def test_creates_mortgage(self, client, test_user):
        """Mortgage loan is created successfully."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Primary residence mortgage",
                "principal_amount": 400000,
                "remaining_balance": 400000,
                "interest_rate": 6.25,
                "monthly_payment": 2463.75,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["loan_type"] == "mortgage"
        assert data["principal_amount"] == 400000
        assert data["remaining_balance"] == 400000
        assert data["interest_rate"] == 6.25
        assert data["term_months"] == 360
        assert "id" in data
        assert "created_at" in data

    def test_creates_car_loan(self, client, test_user):
        """Car loan is created successfully."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "car",
                "description": "2024 Tesla Model 3",
                "principal_amount": 45000,
                "remaining_balance": 45000,
                "interest_rate": 5.9,
                "monthly_payment": 870,
                "start_date": "2024-02-01",
                "term_months": 60
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["loan_type"] == "car"
        assert data["term_months"] == 60

    def test_creates_student_loan(self, client, test_user):
        """Student loan is created successfully."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "student",
                "description": "MBA student loan",
                "principal_amount": 80000,
                "remaining_balance": 75000,
                "interest_rate": 4.5,
                "monthly_payment": 500,
                "start_date": "2022-09-01",
                "term_months": 240
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["loan_type"] == "student"

    def test_creates_personal_loan(self, client, test_user):
        """Personal loan is created successfully."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "personal",
                "description": "Debt consolidation",
                "principal_amount": 15000,
                "remaining_balance": 12000,
                "interest_rate": 8.9,
                "monthly_payment": 350,
                "start_date": "2023-07-01",
                "term_months": 48
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["loan_type"] == "personal"


class TestGetLoan:
    """Tests for GET /loans/{loan_id} endpoint."""

    def test_returns_loan(self, client, test_user):
        """Single loan is retrieved."""
        create_response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Test mortgage",
                "principal_amount": 200000,
                "remaining_balance": 195000,
                "interest_rate": 5.0,
                "monthly_payment": 1200,
                "start_date": "2024-01-15",
                "term_months": 300
            }
        )
        loan_id = create_response.json()["id"]

        response = client.get(
            f"/loans/{loan_id}",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == loan_id
        assert data["description"] == "Test mortgage"

    def test_returns_404_for_nonexistent(self, client, test_user):
        """404 returned for nonexistent loan."""
        response = client.get(
            "/loans/99999",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 404

    def test_returns_404_for_other_user(self, client, test_user):
        """Cannot access other user's loan."""
        create_response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "personal",
                "description": "Private loan",
                "principal_amount": 10000,
                "remaining_balance": 9000,
                "interest_rate": 7.0,
                "monthly_payment": 300,
                "start_date": "2024-01-15",
                "term_months": 36
            }
        )
        loan_id = create_response.json()["id"]

        response = client.get(
            f"/loans/{loan_id}",
            params={"user_id": "other@example.com"}
        )

        assert response.status_code == 404


class TestUpdateLoan:
    """Tests for PUT /loans/{loan_id} endpoint."""

    def test_updates_loan(self, client, test_user):
        """Loan is updated successfully."""
        create_response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Original",
                "principal_amount": 200000,
                "remaining_balance": 200000,
                "interest_rate": 6.0,
                "monthly_payment": 1200,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )
        loan_id = create_response.json()["id"]

        response = client.put(
            f"/loans/{loan_id}",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Refinanced mortgage",
                "principal_amount": 200000,
                "remaining_balance": 190000,
                "interest_rate": 5.25,
                "monthly_payment": 1100,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Refinanced mortgage"
        assert data["remaining_balance"] == 190000
        assert data["interest_rate"] == 5.25
        assert data["updated_at"] is not None

    def test_update_remaining_balance(self, client, test_user):
        """Remaining balance can be updated after payment."""
        create_response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "car",
                "description": "Car loan",
                "principal_amount": 25000,
                "remaining_balance": 25000,
                "interest_rate": 5.0,
                "monthly_payment": 500,
                "start_date": "2024-01-15",
                "term_months": 60
            }
        )
        loan_id = create_response.json()["id"]

        # Simulate monthly payment reducing balance
        response = client.put(
            f"/loans/{loan_id}",
            params={"user_id": test_user.id},
            json={
                "loan_type": "car",
                "description": "Car loan",
                "principal_amount": 25000,
                "remaining_balance": 24500,  # After first payment
                "interest_rate": 5.0,
                "monthly_payment": 500,
                "start_date": "2024-01-15",
                "term_months": 60
            }
        )

        assert response.status_code == 200
        assert response.json()["remaining_balance"] == 24500

    def test_returns_404_for_nonexistent(self, client, test_user):
        """404 returned for nonexistent loan."""
        response = client.put(
            "/loans/99999",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Test",
                "principal_amount": 100000,
                "remaining_balance": 100000,
                "interest_rate": 5.0,
                "monthly_payment": 600,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )

        assert response.status_code == 404


class TestDeleteLoan:
    """Tests for DELETE /loans/{loan_id} endpoint."""

    def test_deletes_loan(self, client, test_user):
        """Loan is deleted successfully."""
        create_response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "personal",
                "description": "To delete",
                "principal_amount": 5000,
                "remaining_balance": 4000,
                "interest_rate": 10.0,
                "monthly_payment": 200,
                "start_date": "2024-01-15",
                "term_months": 24
            }
        )
        loan_id = create_response.json()["id"]

        response = client.delete(
            f"/loans/{loan_id}",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify deleted
        get_response = client.get(
            f"/loans/{loan_id}",
            params={"user_id": test_user.id}
        )
        assert get_response.status_code == 404

    def test_returns_404_for_nonexistent(self, client, test_user):
        """404 returned for nonexistent loan."""
        response = client.delete(
            "/loans/99999",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 404

    def test_cannot_delete_other_user_loan(self, client, test_user):
        """Cannot delete other user's loan."""
        create_response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Private",
                "principal_amount": 200000,
                "remaining_balance": 195000,
                "interest_rate": 5.5,
                "monthly_payment": 1200,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )
        loan_id = create_response.json()["id"]

        response = client.delete(
            f"/loans/{loan_id}",
            params={"user_id": "other@example.com"}
        )

        assert response.status_code == 404


class TestLoanTypes:
    """Tests for different loan types."""

    @pytest.mark.parametrize("loan_type", [
        "mortgage",
        "car",
        "student",
        "personal",
        "credit_card",
        "other"
    ])
    def test_common_loan_types(self, client, test_user, loan_type):
        """Common loan types are accepted."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": loan_type,
                "description": f"Test {loan_type}",
                "principal_amount": 10000,
                "remaining_balance": 10000,
                "interest_rate": 5.0,
                "monthly_payment": 300,
                "start_date": "2024-01-15",
                "term_months": 36
            }
        )

        assert response.status_code == 200
        assert response.json()["loan_type"] == loan_type


class TestLoanAmounts:
    """Tests for loan amount edge cases."""

    def test_handles_large_mortgage(self, client, test_user):
        """Large mortgage amounts are handled correctly."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "Luxury home",
                "principal_amount": 2500000,
                "remaining_balance": 2500000,
                "interest_rate": 6.5,
                "monthly_payment": 15800,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        assert response.json()["principal_amount"] == 2500000

    def test_handles_decimal_amounts(self, client, test_user):
        """Decimal amounts are preserved."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "personal",
                "description": "Precise loan",
                "principal_amount": 12345.67,
                "remaining_balance": 11234.56,
                "interest_rate": 7.89,
                "monthly_payment": 345.67,
                "start_date": "2024-01-15",
                "term_months": 36
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["principal_amount"] == 12345.67
        assert data["remaining_balance"] == 11234.56
        assert data["interest_rate"] == 7.89
        assert data["monthly_payment"] == 345.67

    def test_handles_small_loan(self, client, test_user):
        """Small loan amounts are accepted."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "personal",
                "description": "Small personal loan",
                "principal_amount": 500,
                "remaining_balance": 450,
                "interest_rate": 12.0,
                "monthly_payment": 50,
                "start_date": "2024-01-15",
                "term_months": 12
            }
        )

        assert response.status_code == 200
        assert response.json()["principal_amount"] == 500


class TestLoanTerms:
    """Tests for loan term scenarios."""

    def test_short_term_loan(self, client, test_user):
        """Short-term loan (12 months) is valid."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "personal",
                "description": "1-year loan",
                "principal_amount": 5000,
                "remaining_balance": 5000,
                "interest_rate": 8.0,
                "monthly_payment": 435,
                "start_date": "2024-01-15",
                "term_months": 12
            }
        )

        assert response.status_code == 200
        assert response.json()["term_months"] == 12

    def test_long_term_mortgage(self, client, test_user):
        """Long-term mortgage (30 years) is valid."""
        response = client.post(
            "/loans",
            params={"user_id": test_user.id},
            json={
                "loan_type": "mortgage",
                "description": "30-year mortgage",
                "principal_amount": 300000,
                "remaining_balance": 300000,
                "interest_rate": 6.0,
                "monthly_payment": 1800,
                "start_date": "2024-01-15",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        assert response.json()["term_months"] == 360


class TestDebtSnowballScenario:
    """Tests simulating debt snowball payoff strategy."""

    def test_multiple_loans_for_snowball(self, client, test_user):
        """User can have multiple loans of different types."""
        # Create multiple loans (typical debt snowball scenario)
        loans = [
            {"loan_type": "credit_card", "principal_amount": 5000, "remaining_balance": 4800, "interest_rate": 22.0, "monthly_payment": 150},
            {"loan_type": "car", "principal_amount": 15000, "remaining_balance": 12000, "interest_rate": 6.5, "monthly_payment": 300},
            {"loan_type": "student", "principal_amount": 35000, "remaining_balance": 30000, "interest_rate": 5.5, "monthly_payment": 400},
            {"loan_type": "mortgage", "principal_amount": 200000, "remaining_balance": 185000, "interest_rate": 5.0, "monthly_payment": 1100},
        ]

        for i, loan_data in enumerate(loans):
            response = client.post(
                "/loans",
                params={"user_id": test_user.id},
                json={
                    **loan_data,
                    "description": f"Loan {i+1}",
                    "start_date": "2024-01-15",
                    "term_months": 60
                }
            )
            assert response.status_code == 200

        # Verify all loans exist
        list_response = client.get("/loans", params={"user_id": test_user.id})
        assert len(list_response.json()) == 4
