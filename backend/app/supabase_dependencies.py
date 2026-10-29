from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .supabase_auth import (
    resolve_axis_identity,
    verify_supabase_access_token,
)


def get_supabase_current_identity(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Validate a Supabase token and resolve its active AXIS identity."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    access_token = authorization.split(" ", 1)[1].strip()

    try:
        auth_identity = verify_supabase_access_token(access_token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Supabase access token",
        ) from None

    try:
        axis_identity = resolve_axis_identity(
            db,
            auth_identity["auth_user_id"],
        )
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="No single active approved AXIS role is assigned",
        ) from None

    return {
        **axis_identity,
        "auth_user_id": auth_identity["auth_user_id"],
        "email": auth_identity["email"],
    }

def require_supabase_admin(
    identity=Depends(get_supabase_current_identity),
):
    if identity.get("role_code") != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )
    return identity
