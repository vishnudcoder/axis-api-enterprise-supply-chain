from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .models import Role, User
from .security import decode_user_id


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.split(" ", 1)[1]

    try:
        user_id = decode_user_id(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions))
        .filter(User.id == user_id)
        .first()
    )

    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="User is inactive or missing")

    return user


def require_admin(user=Depends(get_current_user)):
    if user.role.name != "Plant Head / Admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


def _normalize_page(value: str | None) -> str:
    """
    Normalize permission page names so backend routers can use
    'leads', 'Leads', or 'LEADS' without breaking RBAC.
    """
    if not value:
        return ""

    return " ".join(
        str(value).strip().replace("_", " ").replace("-", " ").split()
    ).casefold()


def has_permission(user, page: str, action: str = "can_view") -> bool:
    # Admin remains the global backend administrator.
    if user.role.name == "Plant Head / Admin":
        return True

    requested_page = _normalize_page(page)

    permission = next(
        (
            item
            for item in user.role.permissions
            if _normalize_page(item.page) == requested_page
        ),
        None,
    )

    return bool(permission and getattr(permission, action, False))


def require_permission(page: str, action: str = "can_view"):
    def dependency(user=Depends(get_current_user)):
        if not has_permission(user, page, action):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied for {page}",
            )

        return user

    return dependency
