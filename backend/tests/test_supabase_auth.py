from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.supabase_dependencies import get_supabase_current_identity


@pytest.fixture
def client():
    # Importing app.main may execute its existing SQLAlchemy create_all check.
    from app.main import app

    return TestClient(app)


def test_supabase_me_rejects_missing_token(client):
    response = client.get("/api/auth/supabase-me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_supabase_me_rejects_invalid_token(client):
    response = client.get(
        "/api/auth/supabase-me",
        headers={"Authorization": "Bearer invalid-test-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == (
        "Invalid or expired Supabase access token"
    )


def test_supabase_login_rejects_invalid_credentials(client):
    with patch(
        "app.supabase_routes.verify_supabase_credentials",
        side_effect=ValueError("Invalid email or password"),
    ):
        response = client.post(
            "/api/auth/supabase-login",
            json={
                "email": "invalid-test@example.com",
                "password": "not-a-real-password",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_supabase_login_rejects_user_without_active_axis_role(client):
    with (
        patch(
            "app.supabase_routes.verify_supabase_credentials",
            return_value={
                "auth_user_id": "00000000-0000-0000-0000-000000000001",
                "email": "test@example.com",
                "access_token": "mock-access-token",
            },
        ),
        patch(
            "app.supabase_routes.resolve_axis_identity",
            side_effect=ValueError(
                "No single active AXIS role assignment is available"
            ),
        ),
    ):
        response = client.post(
            "/api/auth/supabase-login",
            json={
                "email": "test@example.com",
                "password": "mock-password",
            },
        )

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "No single active approved AXIS role is assigned"
    )


def test_supabase_login_success(client):
    mock_user = {
        "id": "40000000-0000-0000-0000-000000000001",
        "email": "admin@example.com",
        "full_name": "Test Administrator",
        "employee_id": "EMP-TEST",
        "department": "IT & Security",
        "phone": None,
        "status": "active",
        "role": {
            "id": "ADMIN",
            "name": "Plant Head / Admin",
            "description": "",
            "permissions": [],
        },
        "created_at": "2026-10-16T10:00:00Z",
        "last_login": None,
    }

    with (
        patch(
            "app.supabase_routes.verify_supabase_credentials",
            return_value={
                "auth_user_id": "00000000-0000-0000-0000-000000000001",
                "email": "admin@example.com",
                "access_token": "mock-access-token",
            },
        ),
        patch(
            "app.supabase_routes.resolve_axis_identity",
            return_value={
                "user_id": mock_user["id"],
                "role_code": "ADMIN",
                "department_id": None,
                "email": "admin@example.com",
                "display_name": "Test Administrator",
                "employee_code": "EMP-TEST",
            },
        ),
        patch(
            "app.supabase_routes.build_supabase_user_response",
            return_value=mock_user,
        ),
    ):
        response = client.post(
            "/api/auth/supabase-login",
            json={
                "email": "admin@example.com",
                "password": "mock-password",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "mock-access-token"
    assert body["user"]["role"]["id"] == "ADMIN"
    assert body["user"]["role"]["name"] == "Plant Head / Admin"


def test_supabase_me_success_with_mocked_identity(client):
    mock_user = {
        "id": "40000000-0000-0000-0000-000000000001",
        "email": "admin@example.com",
        "full_name": "Test Administrator",
        "employee_id": "EMP-TEST",
        "department": "IT & Security",
        "phone": None,
        "status": "active",
        "role": {
            "id": "ADMIN",
            "name": "Plant Head / Admin",
            "description": "",
            "permissions": [],
        },
        "created_at": "2026-10-16T10:00:00Z",
        "last_login": None,
    }

    from app.supabase_routes import router

    from app.main import app

    app.dependency_overrides[get_supabase_current_identity] = lambda: {
        "user_id": mock_user["id"],
        "role_code": "ADMIN",
        "department_id": None,
        "email": "admin@example.com",
        "display_name": "Test Administrator",
        "employee_code": "EMP-TEST",
    }

    try:
        with patch(
            "app.supabase_routes.build_supabase_user_response",
            return_value=mock_user,
        ):
            response = client.get(
                "/api/auth/supabase-me",
                headers={"Authorization": "Bearer mock-access-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase_current_identity, None)

    assert response.status_code == 200
    assert response.json()["role"]["name"] == "Plant Head / Admin"
