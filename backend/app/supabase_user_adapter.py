from datetime import datetime, timezone

from sqlalchemy import text

from .supabase_auth import ROLE_MAP
from .supabase_permissions import get_supabase_frontend_permissions


def build_supabase_user_response(db, identity: dict) -> dict:
    """Build the existing frontend user shape from an approved AXIS identity."""
    role_code = identity["role_code"]

    if role_code not in ROLE_MAP:
        raise ValueError("No approved frontend role mapping")

    role_name = ROLE_MAP[role_code]
    permissions = get_supabase_frontend_permissions(db, role_code)

    department = None
    department_id = identity.get("department_id")

    if department_id:
        result = db.execute(
            text("""
                SELECT department_name
                FROM security.department
                WHERE department_id = :department_id AND is_active = TRUE
                LIMIT 1
            """),
            {"department_id": department_id},
        ).mappings().first()

        if result:
            department = result["department_name"]

    created_at = identity.get("created_at")
    if created_at is None:
        created_at = datetime.now(timezone.utc)

    return {
        "id": identity["user_id"],
        "email": identity.get("email") or "",
        "full_name": identity.get("display_name") or "",
        "employee_id": identity.get("employee_code"),
        "department": department,
        "phone": None,
        "status": "active",
        "role": {
            "id": role_code,
            "name": role_name,
            "description": "",
            "permissions": permissions,
        },
        "created_at": created_at,
        "last_login": None,
    }

