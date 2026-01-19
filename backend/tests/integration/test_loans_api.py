"""
Integration tests for loans API endpoints.

Tests the full HTTP request/response cycle for loan management
against the real FastAPI application.
"""
import pytest
from datetime import date


class TestListLoans:
    """Tests for GET /loans endpoint."""

    def test_returns_empty_list_for_new_user(self, client, test_user, auth_headers):
        """Empty list returned for user with no loans."""
        response = client.get("/loans", headers=auth_headers)

        assert response.status_code == 200
        assert response.json() == []

    def test_returns_user_loans(self, client, test_user, auth_headers):
        """All user's loans are returned."""
        # Create loans
        client.post(
            "/loans",
            headers=auth_headers,
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
            headers=auth_headers,
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

        response = client.get("/loans", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreateLoan:
    """Tests for POST /loans endpoint."""

    def test_creates_mortgage(self, client, test_user, auth_headers):
        """Mortgage loan is created successfully."""
        response = client.post(
            "/loans",
            headers=auth_headers,
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

    def test_creates_car_loan(self, client, test_user, auth_headers):
        """Car loan is created successfully."""
        response = client.post(
            "/loans",
            headers=auth_headers,
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

    def test_creates_student_loan(self, client, test_user, auth_headers):
        """Student loan is created successfully."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "student",
                "description": "Graduate school loan",
                "principal_amount": 50000,
                "remaining_balance": 48000,
                "interest_rate": 4.5,
                "monthly_payment": 450,
                "start_date": "2022-09-01",
                "term_months": 120
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["loan_type"] == "student"

    def test_creates_personal_loan(self, client, test_user, auth_headers):
        """Personal loan is created successfully."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "personal",
                "description": "Home improvement",
                "principal_amount": 15000,
                "remaining_balance": 14000,
                "interest_rate": 9.5,
                "monthly_payment": 350,
                "start_date": "2024-01-01",
                "term_months": 48
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["loan_type"] == "personal"

    def test_requires_authentication(self, client, test_user):
        """Request without auth header returns 401."""
        response = client.post(
            "/loans",
            json={
                "loan_type": "mortgage",
                "description": "Test",
                "principal_amount": 100000,
                "remaining_balance": 100000,
                "interest_rate": 5.0,
                "monthly_payment": 1000,
                "start_date": "2024-01-01",
                "term_months": 360
            }
        )

        assert response.status_code == 401


class TestUpdateLoan:
    """Tests for PUT /loans/{loan_id} endpoint."""

    def test_updates_loan(self, client, test_user, auth_headers):
        """Loan is updated successfully."""
        # Create a loan first
        create_response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "mortgage",
                "description": "Original description",
                "principal_amount": 200000,
                "remaining_balance": 200000,
                "interest_rate": 6.0,
                "monthly_payment": 1200,
                "start_date": "2024-01-01",
                "term_months": 360
            }
        )
        assert create_response.status_code == 200
        loan_id = create_response.json()["id"]

        # Update the loan
        response = client.put(
            f"/loans/{loan_id}",
            headers=auth_headers,
            json={
                "loan_type": "mortgage",
                "description": "Updated description",
                "principal_amount": 200000,
                "remaining_balance": 195000,
                "interest_rate": 6.0,
                "monthly_payment": 1200,
                "start_date": "2024-01-01",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description"
        assert data["remaining_balance"] == 195000

    def test_update_remaining_balance(self, client, test_user, auth_headers):
        """Remaining balance can be updated to track payments."""
        # Create a loan
        create_response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "car",
                "description": "Car loan",
                "principal_amount": 30000,
                "remaining_balance": 30000,
                "interest_rate": 5.0,
                "monthly_payment": 600,
                "start_date": "2024-01-01",
                "term_months": 60
            }
        )
        assert create_response.status_code == 200
        loan_id = create_response.json()["id"]

        # Update remaining balance after payment
        response = client.put(
            f"/loans/{loan_id}",
            headers=auth_headers,
            json={
                "loan_type": "car",
                "description": "Car loan",
                "principal_amount": 30000,
                "remaining_balance": 29400,  # After first payment
                "interest_rate": 5.0,
                "monthly_payment": 600,
                "start_date": "2024-01-01",
                "term_months": 60
            }
        )

        assert response.status_code == 200
        assert response.json()["remaining_balance"] == 29400

    def test_returns_404_for_nonexistent(self, client, test_user, auth_headers):
        """404 returned when loan doesn't exist."""
        response = client.put(
            "/loans/99999",
            headers=auth_headers,
            json={
                "loan_type": "mortgage",
                "description": "Test",
                "principal_amount": 100000,
                "remaining_balance": 100000,
                "interest_rate": 5.0,
                "monthly_payment": 1000,
                "start_date": "2024-01-01",
                "term_months": 360
            }
        )

        assert response.status_code == 404


class TestDeleteLoan:
    """Tests for DELETE /users/{user_id}/loans/{loan_id} endpoint."""

    def test_deletes_loan(self, client, test_user, auth_headers):
        """Loan is deleted successfully."""
        # Create a loan
        create_response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "personal",
                "description": "To be deleted",
                "principal_amount": 5000,
                "remaining_balance": 5000,
                "interest_rate": 10.0,
                "monthly_payment": 200,
                "start_date": "2024-01-01",
                "term_months": 24
            }
        )
        assert create_response.status_code == 200
        loan_id = create_response.json()["id"]

        # Delete the loan
        response = client.delete(
            f"/users/{test_user.id}/loans/{loan_id}",
            headers=auth_headers
        )

        assert response.status_code == 200

        # Verify it's gone
        list_response = client.get("/loans", headers=auth_headers)
        assert list_response.status_code == 200
        loans = list_response.json()
        assert not any(loan["id"] == loan_id for loan in loans)

    def test_returns_404_for_nonexistent(self, client, test_user, auth_headers):
        """404 returned when loan doesn't exist."""
        response = client.delete(
            f"/users/{test_user.id}/loans/99999",
            headers=auth_headers
        )

        assert response.status_code == 404

    def test_cannot_delete_other_user_loan(self, client, db_session, test_user, auth_headers):
        """Cannot delete another user's loan."""
        # Create another user
        from app import models
        other_user = models.User(
            id="other-user-id",
            email="other@example.com",
            name="Other User"
        )
        db_session.add(other_user)
        db_session.commit()

        # Create a loan for the other user
        other_loan = models.Loan(
            user_id=other_user.id,
            loan_type="personal",
            description="Other user's loan",
            principal_amount=10000,
            remaining_balance=10000,
            interest_rate=8.0,
            monthly_payment=300,
            start_date=date(2024, 1, 1),
            term_months=36
        )
        db_session.add(other_loan)
        db_session.commit()

        # Try to delete as our test user
        response = client.delete(
            f"/users/{test_user.id}/loans/{other_loan.id}",
            headers=auth_headers
        )

        # Should get 404 because loan doesn't belong to test_user
        assert response.status_code == 404


class TestLoanTypes:
    """Tests for various loan types."""

    @pytest.mark.parametrize("loan_type", [
        "mortgage", "car", "student", "personal", "credit_card", "other"
    ])
    def test_common_loan_types(self, client, test_user, auth_headers, loan_type):
        """Common loan types are accepted."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": loan_type,
                "description": f"Test {loan_type} loan",
                "principal_amount": 10000,
                "remaining_balance": 10000,
                "interest_rate": 5.0,
                "monthly_payment": 200,
                "start_date": "2024-01-01",
                "term_months": 60
            }
        )

        assert response.status_code == 200
        assert response.json()["loan_type"] == loan_type


class TestLoanAmounts:
    """Tests for various loan amount scenarios."""

    def test_handles_large_mortgage(self, client, test_user, auth_headers):
        """Large mortgage amounts are handled correctly."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "mortgage",
                "description": "Large mortgage",
                "principal_amount": 2500000,
                "remaining_balance": 2500000,
                "interest_rate": 5.5,
                "monthly_payment": 14000,
                "start_date": "2024-01-01",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        assert response.json()["principal_amount"] == 2500000

    def test_handles_decimal_amounts(self, client, test_user, auth_headers):
        """Decimal amounts are handled correctly."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "personal",
                "description": "Decimal test",
                "principal_amount": 5000.99,
                "remaining_balance": 4500.50,
                "interest_rate": 8.75,
                "monthly_payment": 150.25,
                "start_date": "2024-01-01",
                "term_months": 36
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["principal_amount"] == 5000.99
        assert data["remaining_balance"] == 4500.50

    def test_handles_small_loan(self, client, test_user, auth_headers):
        """Small loan amounts are handled correctly."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "personal",
                "description": "Small loan",
                "principal_amount": 500,
                "remaining_balance": 500,
                "interest_rate": 12.0,
                "monthly_payment": 50,
                "start_date": "2024-01-01",
                "term_months": 12
            }
        )

        assert response.status_code == 200
        assert response.json()["principal_amount"] == 500


class TestLoanTerms:
    """Tests for various loan term scenarios."""

    def test_short_term_loan(self, client, test_user, auth_headers):
        """Short term loans are handled correctly."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "personal",
                "description": "Short term",
                "principal_amount": 3000,
                "remaining_balance": 3000,
                "interest_rate": 10.0,
                "monthly_payment": 520,
                "start_date": "2024-01-01",
                "term_months": 6
            }
        )

        assert response.status_code == 200
        assert response.json()["term_months"] == 6

    def test_long_term_mortgage(self, client, test_user, auth_headers):
        """30-year mortgage terms are handled correctly."""
        response = client.post(
            "/loans",
            headers=auth_headers,
            json={
                "loan_type": "mortgage",
                "description": "30 year mortgage",
                "principal_amount": 350000,
                "remaining_balance": 350000,
                "interest_rate": 6.5,
                "monthly_payment": 2212,
                "start_date": "2024-01-01",
                "term_months": 360
            }
        )

        assert response.status_code == 200
        assert response.json()["term_months"] == 360


class TestDebtSnowballScenario:
    """Integration test for debt snowball scenario."""

    def test_multiple_loans_for_snowball(self, client, test_user, auth_headers, premium_subscription):
        """Multiple loans can be created for debt snowball strategy (requires premium)."""
        # Create multiple debts
        loans = [
            {
                "loan_type": "credit_card",
                "description": "Credit Card 1",
                "principal_amount": 5000,
                "remaining_balance": 4500,
                "interest_rate": 18.99,
                "monthly_payment": 150,
                "start_date": "2023-01-01",
                "term_months": 36
            },
            {
                "loan_type": "credit_card",
                "description": "Credit Card 2",
                "principal_amount": 8000,
                "remaining_balance": 7500,
                "interest_rate": 22.99,
                "monthly_payment": 200,
                "start_date": "2023-01-01",
                "term_months": 48
            },
            {
                "loan_type": "car",
                "description": "Car Loan",
                "principal_amount": 20000,
                "remaining_balance": 18000,
                "interest_rate": 5.9,
                "monthly_payment": 400,
                "start_date": "2022-06-01",
                "term_months": 60
            },
            {
                "loan_type": "student",
                "description": "Student Loan",
                "principal_amount": 35000,
                "remaining_balance": 32000,
                "interest_rate": 4.5,
                "monthly_payment": 350,
                "start_date": "2020-09-01",
                "term_months": 120
            }
        ]

        for loan in loans:
            response = client.post("/loans", headers=auth_headers, json=loan)
            assert response.status_code == 200

        # Verify all loans are returned
        response = client.get("/loans", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 4

        # Verify we can sort by balance for snowball method
        balances = [loan["remaining_balance"] for loan in data]
        assert sorted(balances) == [4500, 7500, 18000, 32000]
