from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .dependencies import require_admin
from .models import AuditLog, Role, User
from .schemas import CreateUserRequest
from .security import hash_password


router = APIRouter(
    prefix="/api/admin/users",
    tags=["User Management"],
)


class UpdateUserRequest(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8)
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    employee_id: str | None = None
    department: str | None = None
    phone: str | None = None
    role_name: str | None = None
    status: str | None = None


class UpdateUserStatusRequest(BaseModel):
    status: str


def user_response(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "employee_id": user.employee_id,
        "department": user.department,
        "phone": user.phone,
        "status": user.status,
        "role": {
            "id": user.role.id,
            "name": user.role.name,
            "description": user.role.description,
            "permissions": [
                {
                    "page": permission.page,
                    "can_view": permission.can_view,
                    "can_create": permission.can_create,
                    "can_edit": permission.can_edit,
                    "can_delete": permission.can_delete,
                    "can_approve": permission.can_approve,
                }
                for permission in user.role.permissions
            ],
        },
        "created_at": user.created_at,
        "last_login": user.last_login,
    }


def get_user_with_role(
    db: Session,
    user_id: int,
):
    return (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.permissions)
        )
        .filter(User.id == user_id)
        .first()
    )
@router.post("")
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    email = payload.email.lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=409,
            detail="Email already exists",
        )

    if payload.employee_id:
        if (
            db.query(User)
            .filter(User.employee_id == payload.employee_id)
            .first()
        ):
            raise HTTPException(
                status_code=409,
                detail="Employee ID already exists",
            )

    role = (
        db.query(Role)
        .filter(Role.name == payload.role_name)
        .first()
    )

    if not role:
        raise HTTPException(
            status_code=400,
            detail="Unknown role",
        )

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        employee_id=payload.employee_id,
        department=payload.department,
        phone=payload.phone,
        role_id=role.id,
        status="active",
    )

    db.add(user)
    db.flush()

    db.add(
        AuditLog(
            user_id=admin.id,
            role=admin.role.name,
            action="CREATE_USER",
            entity="user",
            entity_id=str(user.id),
        )
    )

    db.commit()

    created_user = get_user_with_role(
        db,
        user.id,
    )

    return user_response(created_user)


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    users = (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.permissions)
        )
        .order_by(User.full_name)
        .all()
    )

    return [user_response(user) for user in users]


@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    user = get_user_with_role(db, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user_response(user)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        email = data["email"].lower()

        duplicate = (
            db.query(User)
            .filter(
                User.email == email,
                User.id != user_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Email already exists",
            )

        user.email = email

    if "role_name" in data:
        role = (
            db.query(Role)
            .filter(Role.name == data["role_name"])
            .first()
        )

        if not role:
            raise HTTPException(
                status_code=400,
                detail="Unknown role",
            )

        user.role_id = role.id

    if "password" in data:
        user.password_hash = hash_password(
            data["password"]
        )

    if "full_name" in data:
        user.full_name = data["full_name"]

    if "employee_id" in data:
        if data["employee_id"]:
            duplicate_employee = (
                db.query(User)
                .filter(
                    User.employee_id == data["employee_id"],
                    User.id != user_id,
                )
                .first()
            )

            if duplicate_employee:
                raise HTTPException(
                    status_code=409,
                    detail="Employee ID already exists",
                )

        user.employee_id = data["employee_id"]

    if "department" in data:
        user.department = data["department"]

    if "phone" in data:
        user.phone = data["phone"]

    if "status" in data:
        if data["status"] not in {
            "active",
            "inactive",
        }:
            raise HTTPException(
                status_code=400,
                detail="Status must be active or inactive",
            )

        # Prevent admin from accidentally disabling themselves.
        if user.id == admin.id and data["status"] == "inactive":
            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account",
            )

        user.status = data["status"]

    db.add(
        AuditLog(
            user_id=admin.id,
            role=admin.role.name,
            action="UPDATE_USER",
            entity="user",
            entity_id=str(user.id),
        )
    )

    db.commit()

    updated_user = get_user_with_role(
        db,
        user.id,
    )

    return user_response(updated_user)


@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UpdateUserStatusRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if payload.status not in {
        "active",
        "inactive",
    }:
        raise HTTPException(
            status_code=400,
            detail="Status must be active or inactive",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.id == admin.id and payload.status == "inactive":
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account",
        )

    user.status = payload.status

    db.add(
        AuditLog(
            user_id=admin.id,
            role=admin.role.name,
            action="UPDATE_USER_STATUS",
            entity="user",
            entity_id=str(user.id),
        )
    )

    db.commit()

    updated_user = get_user_with_role(
        db,
        user.id,
    )

    return user_response(updated_user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account",
        )

    db.add(
        AuditLog(
            user_id=admin.id,
            role=admin.role.name,
            action="DELETE_USER",
            entity="user",
            entity_id=str(user.id),
        )
    )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully",
        "user_id": user_id,
    }