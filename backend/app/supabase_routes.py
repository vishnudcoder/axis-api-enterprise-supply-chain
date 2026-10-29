from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .schemas import LoginRequest
from .supabase_auth import (
    resolve_axis_identity,
    verify_supabase_credentials,
)
from .supabase_dependencies import get_supabase_current_identity
from .supabase_schemas import (
    SupabaseLoginResponse,
    SupabaseUserOut,
)
from .supabase_user_adapter import build_supabase_user_response

router = APIRouter(prefix="/api/auth", tags=["Supabase Auth"])


@router.post("/supabase-login", response_model=SupabaseLoginResponse)
def supabase_login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    try:
        auth = verify_supabase_credentials(
            payload.email,
            payload.password,
        )
        identity = resolve_axis_identity(db, auth["auth_user_id"])
        user = build_supabase_user_response(db, identity)

        return {
            "access_token": auth["access_token"],
            "token_type": "bearer",
            "user": user,
        }
    except ValueError as exc:
        message = str(exc)
        if message == "Invalid email or password":
            raise HTTPException(status_code=401, detail=message) from None
        raise HTTPException(
            status_code=403,
            detail="No single active approved AXIS role is assigned",
        ) from None


@router.get("/supabase-me", response_model=SupabaseUserOut)
def supabase_me(
    identity: dict = Depends(get_supabase_current_identity),
    db: Session = Depends(get_db),
):
    try:
        return build_supabase_user_response(db, identity)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="No approved AXIS role mapping is available",
        ) from None
