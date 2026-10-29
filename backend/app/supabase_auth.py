import os

from dotenv import load_dotenv
from sqlalchemy import text
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

ROLE_MAP = {
    "ADMIN": "Plant Head / Admin",
    "MANAGING_DIRECTOR": "Managing Director",
    "COMMERCIAL": "Sales & Marketing",
    "QA": "QC / QA",
    "PPIC": "PPIC Planner",
    "PRODUCTION": "Production / Plant",
    "INVENTORY": "Stores & Supply Chain",
}


def get_supabase_auth_client() -> Client:
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is required")
    if not SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_ANON_KEY is required")

    # Use the public/publishable key for password authentication.
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def verify_supabase_credentials(email: str, password: str) -> dict:
    """Verify credentials with Supabase Auth; never log the password or token."""
    try:
        client = get_supabase_auth_client()
        response = client.auth.sign_in_with_password(
            {
                "email": email.strip().lower(),
                "password": password,
            }
        )
        auth_user = response.user
        session = response.session

        if not auth_user or not session:
            raise ValueError("Invalid email or password")

        return {
            "auth_user_id": str(auth_user.id),
            "email": (auth_user.email or email).strip().lower(),
            "access_token": session.access_token,
        }
    except ValueError:
        raise
    except Exception:
        # Avoid returning provider internals or sensitive authentication data.
        raise ValueError("Invalid email or password") from None


def resolve_axis_identity(db, auth_user_id: str) -> dict:
    """Resolve one active AXIS user and their effective role, without writing."""
    query = text(
        """
        SELECT
            u.user_id::text AS user_id,
            u.employee_code,
            u.display_name,
            u.email,
            u.department_id::text AS department_id,
            r.role_code,
            r.role_name
        FROM security.app_user AS u
        JOIN security.user_role AS ur
            ON ur.user_id = u.user_id
        JOIN security.role AS r
            ON r.role_id = ur.role_id
        WHERE u.auth_user_id = :auth_user_id
          AND u.is_active = TRUE
          AND ur.is_active = TRUE
          AND r.is_active = TRUE
          AND ur.effective_from <= CURRENT_TIMESTAMP
          AND (
              ur.effective_to IS NULL
              OR ur.effective_to > CURRENT_TIMESTAMP
          )
        """
    )

    rows = db.execute(
        query, {"auth_user_id": auth_user_id}
    ).mappings().all()

    if len(rows) != 1:
        raise ValueError(
            "No single active AXIS role assignment is available"
        )

    record = dict(rows[0])
    role_code = record["role_code"]

    if role_code not in ROLE_MAP:
        raise ValueError("This Supabase role has no approved AXIS mapping")

    record["axis_role_name"] = ROLE_MAP[role_code]
    return record

def verify_supabase_access_token(access_token: str) -> dict:
    """Validate a Supabase access token with Supabase Auth."""
    if not access_token or not access_token.strip():
        raise ValueError("Invalid or expired Supabase access token")

    try:
        client = get_supabase_auth_client()
        response = client.auth.get_user(access_token)
        auth_user = response.user

        if not auth_user or not auth_user.id:
            raise ValueError("Invalid or expired Supabase access token")

        return {
            "auth_user_id": str(auth_user.id),
            "email": (auth_user.email or "").strip().lower(),
        }
    except Exception:
        raise ValueError(
            "Invalid or expired Supabase access token"
        ) from None
