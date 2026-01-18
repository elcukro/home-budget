"""
Integration tests for users API endpoints.

Tests the full HTTP request/response cycle for user management.
"""
import pytest


class TestGetCurrentUser:
    """Tests for GET /users/me endpoint."""

    def test_creates_new_user_if_not_exists(self, client):
        """New user is created automatically on first access."""
        response = client.get("/users/me", params={"user_id": "new@example.com"})

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "new@example.com"
        assert data["email"] == "new@example.com"
        assert data["name"] is None
        assert "created_at" in data

    def test_returns_existing_user(self, client, test_user):
        """Existing user is returned."""
        response = client.get("/users/me", params={"user_id": test_user.id})

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name

    def test_user_id_is_required(self, client):
        """Request without user_id returns validation error."""
        response = client.get("/users/me")

        assert response.status_code == 422  # Validation error


class TestCreateUser:
    """Tests for POST /users endpoint."""

    def test_creates_user_with_email(self, client):
        """User is created with provided email."""
        response = client.post(
            "/users",
            json={"email": "newuser@example.com", "name": "New User"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "New User"
        assert data["id"] == "newuser@example.com"

    def test_creates_user_without_name(self, client):
        """User can be created without name."""
        response = client.post(
            "/users",
            json={"email": "noname@example.com"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "noname@example.com"
        assert data["name"] is None

    def test_email_is_required(self, client):
        """Request without email returns validation error."""
        response = client.post("/users", json={"name": "Test"})

        assert response.status_code == 422


class TestGetUserSettings:
    """Tests for GET /users/{email}/settings endpoint."""

    def test_returns_settings(self, client, test_user_with_settings):
        """Settings are returned for existing user."""
        response = client.get(f"/users/{test_user_with_settings.id}/settings")

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user_with_settings.id
        assert data["language"] == "en"
        assert data["currency"] == "USD"

    def test_returns_404_for_nonexistent_user(self, client):
        """404 returned when settings don't exist."""
        response = client.get("/users/nonexistent@example.com/settings")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestUpdateUserSettings:
    """Tests for PUT /users/{email}/settings endpoint."""

    def test_updates_settings(self, client, test_user_with_settings):
        """Settings are updated successfully."""
        response = client.put(
            f"/users/{test_user_with_settings.id}/settings",
            json={
                "language": "pl",
                "currency": "PLN",
                "ai": {"apiKey": "test-key"},
                "emergency_fund_target": 5000,
                "emergency_fund_months": 6,
                "base_currency": "PLN"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "pl"
        assert data["currency"] == "PLN"
        assert data["ai"] == {"apiKey": "test-key"}
        assert data["emergency_fund_target"] == 5000
        assert data["emergency_fund_months"] == 6
        assert data["base_currency"] == "PLN"
        assert data["updated_at"] is not None

    def test_partial_update(self, client, test_user_with_settings):
        """Only provided fields are updated."""
        response = client.put(
            f"/users/{test_user_with_settings.id}/settings",
            json={
                "language": "de",
                "currency": "EUR"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "de"
        assert data["currency"] == "EUR"

    def test_returns_404_for_nonexistent_user(self, client):
        """404 returned when settings don't exist."""
        response = client.put(
            "/users/nonexistent@example.com/settings",
            json={"language": "en", "currency": "USD"}
        )

        assert response.status_code == 404


class TestDeleteUserAccount:
    """Tests for DELETE /users/me/account endpoint."""

    def test_deletes_account_with_english_phrase(self, client, test_user):
        """Account is deleted with English confirmation phrase."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            params={"user_id": test_user.id},
            json={"confirmation_phrase": "DELETE ACCOUNT"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "deleted" in data["message"].lower()

    def test_deletes_account_with_polish_phrase(self, client, test_user):
        """Account is deleted with Polish confirmation phrase."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            params={"user_id": test_user.id},
            json={"confirmation_phrase": "USUŃ KONTO"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_rejects_invalid_phrase(self, client, test_user):
        """Invalid confirmation phrase is rejected."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            params={"user_id": test_user.id},
            json={"confirmation_phrase": "wrong phrase"}
        )

        assert response.status_code == 400
        assert "invalid confirmation phrase" in response.json()["detail"].lower()

    def test_rejects_case_sensitive_phrase(self, client, test_user):
        """Confirmation phrase is case-sensitive."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            params={"user_id": test_user.id},
            json={"confirmation_phrase": "delete account"}  # lowercase
        )

        assert response.status_code == 400

    def test_returns_404_for_nonexistent_user(self, client):
        """404 returned when user doesn't exist."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            params={"user_id": "nonexistent@example.com"},
            json={"confirmation_phrase": "DELETE ACCOUNT"}
        )

        assert response.status_code == 404


class TestOnboardingBackups:
    """Tests for onboarding backup endpoints."""

    def test_create_backup(self, client, test_user):
        """Backup is created successfully."""
        backup_data = {
            "data": {"income": [{"amount": 5000}], "expenses": []},
            "reason": "fresh_start"
        }
        response = client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json=backup_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["data"] == backup_data["data"]
        assert data["reason"] == "fresh_start"
        assert "id" in data
        assert "created_at" in data

    def test_create_backup_without_reason(self, client, test_user):
        """Backup can be created without reason."""
        response = client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json={"data": {"test": "data"}}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["reason"] is None

    def test_list_backups(self, client, test_user):
        """Backups are listed in descending order."""
        # Create two backups
        client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json={"data": {"first": True}, "reason": "first"}
        )
        client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json={"data": {"second": True}, "reason": "second"}
        )

        response = client.get(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Most recent first
        assert data[0]["reason"] == "second"
        assert data[1]["reason"] == "first"

    def test_get_backup(self, client, test_user):
        """Single backup is retrieved with full data."""
        create_response = client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json={"data": {"full": "data", "nested": {"key": "value"}}}
        )
        backup_id = create_response.json()["id"]

        response = client.get(
            f"/users/me/onboarding-backups/{backup_id}",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == backup_id
        assert data["data"]["nested"]["key"] == "value"

    def test_get_backup_returns_404_for_wrong_user(self, client, test_user):
        """Cannot access other user's backup."""
        create_response = client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json={"data": {"private": True}}
        )
        backup_id = create_response.json()["id"]

        response = client.get(
            f"/users/me/onboarding-backups/{backup_id}",
            params={"user_id": "other@example.com"}
        )

        assert response.status_code == 404

    def test_delete_backup(self, client, test_user):
        """Backup is deleted successfully."""
        create_response = client.post(
            "/users/me/onboarding-backups",
            params={"user_id": test_user.id},
            json={"data": {"to_delete": True}}
        )
        backup_id = create_response.json()["id"]

        response = client.delete(
            f"/users/me/onboarding-backups/{backup_id}",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify it's deleted
        get_response = client.get(
            f"/users/me/onboarding-backups/{backup_id}",
            params={"user_id": test_user.id}
        )
        assert get_response.status_code == 404

    def test_delete_nonexistent_backup(self, client, test_user):
        """Deleting nonexistent backup returns 404."""
        response = client.delete(
            "/users/me/onboarding-backups/99999",
            params={"user_id": test_user.id}
        )

        assert response.status_code == 404

    def test_create_backup_for_nonexistent_user(self, client):
        """Creating backup for nonexistent user returns 404."""
        response = client.post(
            "/users/me/onboarding-backups",
            params={"user_id": "nonexistent@example.com"},
            json={"data": {}}
        )

        assert response.status_code == 404
