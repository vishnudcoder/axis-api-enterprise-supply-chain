from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from .axis_authorization import has_axis_permission
from .database import get_db
from .supabase_dependencies import get_supabase_current_identity


def require_axis_permission(screen_code: str, action: str):
    def dependency(
        identity: dict = Depends(get_supabase_current_identity),
        db: Session = Depends(get_db),
    ):
        role_code = identity.get("role_code")

        if not has_axis_permission(
            db=db,
            role_code=role_code,
            screen_code=screen_code,
            action=action,
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action",
            )

        return identity

    return dependency
