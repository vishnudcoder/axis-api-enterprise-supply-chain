from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from .supabase_dependencies import get_supabase_current_identity
from .business_audit import write_business_audit


router = APIRouter(prefix="/api/customers", tags=["Customers"])

ALLOWED_ROLES = {"Managing Director", "Sales & Marketing"}

CUSTOMER_FIELDS = {
    "customer_code",
    "customer_name",
    "country_code",
    "address",
    "contact_email",
    "is_active",
}


def require_customer_access(
    current_user=Depends(get_supabase_current_identity),
):
    if current_user.get("axis_role_name") not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Access denied for Customers",
        )
    return current_user


def _user_uuid(user: dict) -> str:
    try:
        return str(UUID(str(user["user_id"])))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(
            status_code=401,
            detail="Authenticated user has an invalid user ID",
        )


def _response(row: Any) -> dict:
    data = dict(row._mapping)

    # Compatibility aliases for the previous customer API.
    data["id"] = data["customer_id"]
    data["email"] = data.get("contact_email")
    data["country"] = data.get("country_code")
    data["status"] = (
        "Active" if data.get("is_active") else "Inactive"
    )
    data["customer_type"] = data.get("customer_category")

    return data


def _row_dict(row: Any) -> dict:
    return dict(row._mapping)


def _validate_payload(payload: dict, *, allow_empty: bool = False) -> None:
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=422,
            detail="Request body must be a JSON object",
        )

    unknown = set(payload) - CUSTOMER_FIELDS
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported fields: {', '.join(sorted(unknown))}",
        )

    if not allow_empty and not payload:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one field",
        )

    for field in ("customer_code", "customer_name"):
        if field in payload:
            value = payload[field]
            if value is None or not str(value).strip():
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} cannot be blank",
                )


def _normalise_payload(payload: dict) -> dict:
    values = dict(payload)

    for field in ("customer_code", "customer_name"):
        if field in values:
            values[field] = str(values[field]).strip()

    return values


def _handle_database_error(exc: Exception) -> None:
    if isinstance(exc, IntegrityError):
        original = getattr(exc, "orig", None)
        sqlstate = (
            getattr(original, "sqlstate", None)
            or getattr(original, "pgcode", None)
        )

        if sqlstate == "23505":
            raise HTTPException(
                status_code=409,
                detail="Customer code already exists",
            ) from exc

    raise exc


@router.get("")
def list_customers(
    search: str | None = Query(default=None, max_length=200),
    status: str | None = Query(default=None, max_length=50),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_customer_access),
):
    filters = ["1 = 1"]
    params: dict[str, Any] = {}

    if search and search.strip():
        filters.append(
            """
            (
                c.customer_code ILIKE :term
                OR c.customer_name ILIKE :term
                OR c.contact_email ILIKE :term
            )
            """
        )
        params["term"] = f"%{search.strip()}%"

    if status:
        normalised_status = status.strip().lower()

        if normalised_status not in {
            "active", "inactive", "true", "false", "1", "0"
        }:
            raise HTTPException(
                status_code=422,
                detail="status must be Active or Inactive",
            )

        params["status_active"] = normalised_status in {
            "active", "true", "1"
        }
        filters.append("c.is_active = :status_active")

    if is_active is not None:
        filters.append("c.is_active = :is_active")
        params["is_active"] = is_active

    where_clause = " AND ".join(filters)

    rows = db.execute(
        text(
            f"""
            SELECT
                c.customer_id,
                c.customer_code,
                c.customer_name,
                c.country_code,
                c.address,
                c.contact_email,
                c.is_active,
                c.created_at,
                c.created_by,
                c.updated_at,
                c.updated_by,
                p.customer_category,
                p.customer_industry,
                p.key_account_flag
            FROM commercial.customer AS c
            LEFT JOIN commercial.customer_commercial_profile AS p
                ON p.customer_id = c.customer_id
            WHERE {where_clause}
            ORDER BY c.created_at DESC, c.customer_name
            """
        ),
        params,
    ).fetchall()

    return [_response(row) for row in rows]


@router.get("/{customer_id}")
def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_customer_access),
):
    row = db.execute(
        text(
            """
            SELECT
                c.customer_id,
                c.customer_code,
                c.customer_name,
                c.country_code,
                c.address,
                c.contact_email,
                c.is_active,
                c.created_at,
                c.created_by,
                c.updated_at,
                c.updated_by,
                p.customer_category,
                p.customer_industry,
                p.key_account_flag
            FROM commercial.customer AS c
            LEFT JOIN commercial.customer_commercial_profile AS p
                ON p.customer_id = c.customer_id
            WHERE c.customer_id = :customer_id
            LIMIT 1
            """
        ),
        {"customer_id": str(customer_id)},
    ).first()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    return _response(row)


@router.post("", status_code=201)
def create_customer(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_customer_access),
):
    _validate_payload(payload, allow_empty=False)

    code = str(payload.get("customer_code", "")).strip()
    name = str(payload.get("customer_name", "")).strip()

    if not code or not name:
        raise HTTPException(
            status_code=422,
            detail="customer_code and customer_name are required",
        )

    user_id = _user_uuid(current_user)

    try:
        row = db.execute(
            text(
                """
                INSERT INTO commercial.customer (
                    customer_code,
                    customer_name,
                    country_code,
                    address,
                    contact_email,
                    is_active,
                    created_by,
                    updated_by
                )
                VALUES (
                    :code,
                    :name,
                    :country,
                    :address,
                    :email,
                    :active,
                    CAST(:user_id AS uuid),
                    CAST(:user_id AS uuid)
                )
                RETURNING
                    customer_id,
                    customer_code,
                    customer_name,
                    country_code,
                    address,
                    contact_email,
                    is_active,
                    created_at,
                    created_by,
                    updated_at,
                    updated_by
                """
            ),
            {
                "code": code,
                "name": name,
                "country": payload.get("country_code"),
                "address": payload.get("address"),
                "email": payload.get("contact_email"),
                "active": payload.get("is_active", True),
                "user_id": user_id,
            },
        ).first()

        if not row:
            raise RuntimeError("Customer insert returned no record")

        result = _row_dict(row)

        write_business_audit(
            db,
            actor_user_id=user_id,
            action_code="INSERT",
            record_schema="commercial",
            record_table="customer",
            record_key={
                "customer_id": str(result["customer_id"])
            },
            after_state=result,
            changed_fields=list(payload.keys()),
        )

        db.commit()
        return _response(row)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        _handle_database_error(exc)


@router.put("/{customer_id}")
def update_customer(
    customer_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_customer_access),
):
    _validate_payload(payload, allow_empty=False)

    values = _normalise_payload(payload)
    user_id = _user_uuid(current_user)

    try:
        before = db.execute(
            text(
                """
                SELECT
                    customer_id,
                    customer_code,
                    customer_name,
                    country_code,
                    address,
                    contact_email,
                    is_active
                FROM commercial.customer
                WHERE customer_id = :customer_id
                FOR UPDATE
                """
            ),
            {"customer_id": str(customer_id)},
        ).first()

        if not before:
            raise HTTPException(
                status_code=404,
                detail="Customer not found",
            )

        before_data = _row_dict(before)

        assignments = [
            f"{field} = :{field}"
            for field in values
        ]

        values["customer_id"] = str(customer_id)
        values["user_id"] = user_id

        row = db.execute(
            text(
                f"""
                UPDATE commercial.customer
                SET
                    {", ".join(assignments)},
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = CAST(:user_id AS uuid)
                WHERE customer_id = CAST(:customer_id AS uuid)
                RETURNING
                    customer_id,
                    customer_code,
                    customer_name,
                    country_code,
                    address,
                    contact_email,
                    is_active,
                    created_at,
                    created_by,
                    updated_at,
                    updated_by
                """
            ),
            values,
        ).first()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Customer not found",
            )

        result = _row_dict(row)

        write_business_audit(
            db,
            actor_user_id=user_id,
            action_code="UPDATE",
            record_schema="commercial",
            record_table="customer",
            record_key={
                "customer_id": str(customer_id)
            },
            before_state=before_data,
            after_state=result,
            changed_fields=list(payload.keys()),
        )

        db.commit()
        return _response(row)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        _handle_database_error(exc)


@router.delete("/{customer_id}")
def deactivate_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_customer_access),
):
    """
    Soft-delete a customer by marking it inactive.
    The commercial.customer record is not physically deleted.
    """
    user_id = _user_uuid(current_user)

    try:
        before = db.execute(
            text(
                """
                SELECT
                    customer_id,
                    customer_code,
                    customer_name,
                    country_code,
                    address,
                    contact_email,
                    is_active
                FROM commercial.customer
                WHERE customer_id = :customer_id
                FOR UPDATE
                """
            ),
            {"customer_id": str(customer_id)},
        ).first()

        if not before:
            raise HTTPException(
                status_code=404,
                detail="Customer not found",
            )

        before_data = _row_dict(before)

        row = db.execute(
            text(
                """
                UPDATE commercial.customer
                SET
                    is_active = FALSE,
                    updated_at = CURRENT_TIMESTAMP,
                    updated_by = CAST(:user_id AS uuid)
                WHERE customer_id = CAST(:customer_id AS uuid)
                RETURNING
                    customer_id,
                    customer_code,
                    customer_name,
                    country_code,
                    address,
                    contact_email,
                    is_active,
                    created_at,
                    created_by,
                    updated_at,
                    updated_by
                """
            ),
            {
                "customer_id": str(customer_id),
                "user_id": user_id,
            },
        ).first()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Customer not found",
            )

        result = _row_dict(row)

        write_business_audit(
            db,
            actor_user_id=user_id,
            action_code="UPDATE",
            record_schema="commercial",
            record_table="customer",
            record_key={
                "customer_id": str(customer_id)
            },
            before_state=before_data,
            after_state=result,
            changed_fields=["is_active"],
            reason="Customer deactivated",
        )

        db.commit()

        return {
            "message": "Customer deactivated successfully",
            "customer_id": str(customer_id),
            "is_active": False,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
