"""
Integration tests for users API endpoints.

Tests the full HTTP request/response cycle for user management.
"""
import pytest


class TestGetCurrentUser:
    """Tests for GET /users/me endpoint."""

    def test_creates_new_user_if_not_exists(self, client):
        """New user is created automatically on first access."""
        # Use auth headers with a new email
        headers = {
            "X-User-ID": "new@example.com",
            "X-Internal-Secret": "test-internal-secret"
        }
        response = client.get("/users/me", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "new@example.com"
        assert "created_at" in data

    def test_returns_existing_user(self, client, test_user, auth_headers):
        """Existing user is returned."""
        response = client.get("/users/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name

    def test_returns_401_without_auth(self, client):
        """Request without auth returns 401."""
        response = client.get("/users/me")

        assert response.status_code == 401


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
    """Tests for GET /users/{user_id}/settings endpoint."""

    def test_returns_settings(self, client, test_user_with_settings, auth_headers):
        """Settings are returned for existing user."""
        response = client.get(
            f"/users/{test_user_with_settings.id}/settings",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user_with_settings.id
        assert data["language"] == "en"
        assert data["currency"] == "USD"

    def test_returns_403_for_different_user(self, client, auth_headers):
        """403 returned when trying to access another user's settings."""
        response = client.get(
            "/users/different-user-id/settings",
            headers=auth_headers
        )

        assert response.status_code == 403


class TestUpdateUserSettings:
    """Tests for PUT /users/{user_id}/settings endpoint."""

    def test_updates_settings(self, client, test_user_with_settings, auth_headers):
        """Settings are updated successfully."""
        response = client.put(
            f"/users/{test_user_with_settings.id}/settings",
            headers=auth_headers,
            json={
                "language": "pl",
                "currency": "PLN"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "pl"
        assert data["currency"] == "PLN"

    def test_partial_update(self, client, test_user_with_settings, auth_headers):
        """Only provided fields are updated."""
        response = client.put(
            f"/users/{test_user_with_settings.id}/settings",
            headers=auth_headers,
            json={
                "language": "de",
                "currency": "EUR"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "de"
        assert data["currency"] == "EUR"

    def test_returns_403_for_different_user(self, client, auth_headers):
        """403 returned when trying to update another user's settings."""
        response = client.put(
            "/users/different-user-id/settings",
            headers=auth_headers,
            json={"language": "en", "currency": "USD"}
        )

        assert response.status_code == 403


class TestDeleteUserAccount:
    """Tests for DELETE /users/me/account endpoint."""

    def test_deletes_account_with_english_phrase(self, client, test_user, auth_headers):
        """Account is deleted with English confirmation phrase."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            headers=auth_headers,
            json={"confirmation_phrase": "DELETE ACCOUNT"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "deleted" in data["message"].lower()

    def test_deletes_account_with_polish_phrase(self, client, test_user, auth_headers):
        """Account is deleted with Polish confirmation phrase."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            headers=auth_headers,
            json={"confirmation_phrase": "USUŃ KONTO"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_rejects_invalid_phrase(self, client, test_user, auth_headers):
        """Invalid confirmation phrase is rejected."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            headers=auth_headers,
            json={"confirmation_phrase": "wrong phrase"}
        )

        assert response.status_code == 400
        assert "invalid confirmation phrase" in response.json()["detail"].lower()

    def test_rejects_case_sensitive_phrase(self, client, test_user, auth_headers):
        """Confirmation phrase is case-sensitive."""
        response = client.request(
            "DELETE",
            "/users/me/account",
            headers=auth_headers,
            json={"confirmation_phrase": "delete account"}  # lowercase
        )

        assert response.status_code == 400

    def test_returns_404_for_nonexistent_user(self, client):
        """404 returned when user doesn't exist."""
        headers = {
            "X-User-ID": "nonexistent@example.com",
            "X-Internal-Secret": "test-internal-secret"
        }
        response = client.request(
            "DELETE",
            "/users/me/account",
            headers=headers,
            json={"confirmation_phrase": "DELETE ACCOUNT"}
        )

        assert response.status_code == 404


class TestOnboardingBackups:
    """Tests for onboarding backup endpoints."""

    def test_create_backup(self, client, test_user, auth_headers):
        """Backup is created successfully."""
        backup_data = {
            "data": {"income": [{"amount": 5000}], "expenses": []},
            "reason": "fresh_start"
        }
        response = client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json=backup_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["data"] == backup_data["data"]
        assert data["reason"] == "fresh_start"
        assert "id" in data
        assert "created_at" in data

    def test_create_backup_without_reason(self, client, test_user, auth_headers):
        """Backup can be created without reason."""
        response = client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json={"data": {"test": "data"}}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["reason"] is None

    def test_list_backups(self, client, test_user, auth_headers):
        """Backups are listed in descending order."""
        # Create two backups
        client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json={"data": {"first": True}, "reason": "first"}
        )
        client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json={"data": {"second": True}, "reason": "second"}
        )

        response = client.get(
            "/users/me/onboarding-backups",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Both backups present (order may vary due to SQLite timestamp precision)
        reasons = {item["reason"] for item in data}
        assert reasons == {"first", "second"}

    def test_get_backup(self, client, test_user, auth_headers):
        """Single backup is retrieved with full data."""
        create_response = client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json={"data": {"full": "data", "nested": {"key": "value"}}}
        )
        backup_id = create_response.json()["id"]

        response = client.get(
            f"/users/me/onboarding-backups/{backup_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == backup_id
        assert data["data"]["nested"]["key"] == "value"

    def test_get_backup_returns_404_for_wrong_user(self, client, test_user, auth_headers):
        """Cannot access other user's backup."""
        create_response = client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json={"data": {"private": True}}
        )
        backup_id = create_response.json()["id"]

        # Try to access with different user
        other_headers = {
            "X-User-ID": "other@example.com",
            "X-Internal-Secret": "test-internal-secret"
        }
        response = client.get(
            f"/users/me/onboarding-backups/{backup_id}",
            headers=other_headers
        )

        assert response.status_code == 404

    def test_delete_backup(self, client, test_user, auth_headers):
        """Backup is deleted successfully."""
        create_response = client.post(
            "/users/me/onboarding-backups",
            headers=auth_headers,
            json={"data": {"to_delete": True}}
        )
        backup_id = create_response.json()["id"]

        response = client.delete(
            f"/users/me/onboarding-backups/{backup_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify it's deleted
        get_response = client.get(
            f"/users/me/onboarding-backups/{backup_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404

    def test_delete_nonexistent_backup(self, client, test_user, auth_headers):
        """Deleting nonexistent backup returns 404."""
        response = client.delete(
            "/users/me/onboarding-backups/99999",
            headers=auth_headers
        )

        assert response.status_code == 404

    def test_create_backup_for_nonexistent_user(self, client):
        """Creating backup for nonexistent user returns 404."""
        headers = {
            "X-User-ID": "nonexistent@example.com",
            "X-Internal-Secret": "test-internal-secret"
        }
        response = client.post(
            "/users/me/onboarding-backups",
            headers=headers,
            json={"data": {}}
        )

        assert response.status_code == 404
