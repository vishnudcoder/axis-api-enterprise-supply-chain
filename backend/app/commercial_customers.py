from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .supabase_authorization import require_axis_permission
from .business_audit import write_business_audit

router = APIRouter(
    prefix="/api/commercial-customers",
    tags=["Commercial Customer Management"],
)


def _identity_user_id(identity: dict) -> str:
    value = identity.get("user_id")
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=401, detail="Valid AXIS user identity required")


def _customer_dict(row: Any) -> dict:
    return dict(row._mapping)


@router.get("")
def list_customers(
    search: str | None = Query(default=None, max_length=150),
    category: str | None = Query(default=None, max_length=100),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "VIEW")),
):
    filters = ["1 = 1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if search and search.strip():
        filters.append(
            "(c.customer_code ILIKE :search OR c.customer_name ILIKE :search "
            "OR c.contact_email ILIKE :search)"
        )
        params["search"] = f"%{search.strip()}%"

    if category:
        filters.append("p.customer_category = :category")
        params["category"] = category

    if is_active is not None:
        filters.append("c.is_active = :is_active")
        params["is_active"] = is_active

    where_sql = " AND ".join(filters)

    total = db.execute(
        text(f"""
            SELECT COUNT(*)
            FROM commercial.customer c
            LEFT JOIN commercial.customer_commercial_profile p
              ON p.customer_id = c.customer_id
            WHERE {where_sql}
        """),
        params,
    ).scalar_one()

    rows = db.execute(
        text(f"""
            SELECT c.customer_id, c.customer_code, c.customer_name,
                   c.country_code, c.contact_email, c.is_active,
                   c.created_at, c.updated_at,
                   p.customer_category, p.customer_industry, p.key_account_flag
            FROM commercial.customer c
            LEFT JOIN commercial.customer_commercial_profile p
              ON p.customer_id = c.customer_id
            WHERE {where_sql}
            ORDER BY c.customer_name, c.customer_code
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()

    return {
        "items": [_customer_dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{customer_id}")
def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "VIEW")),
):
    row = db.execute(
        text("""
            SELECT c.customer_id, c.customer_code, c.customer_name,
                   c.country_code, c.address, c.contact_email, c.is_active,
                   c.created_at, c.created_by, c.updated_at, c.updated_by,
                   p.customer_commercial_profile_id, p.customer_category,
                   p.customer_industry, p.regulatory_classification,
                   p.key_account_flag, p.payment_terms, p.credit_currency,
                   p.effective_from, p.effective_to
            FROM commercial.customer c
            LEFT JOIN commercial.customer_commercial_profile p
              ON p.customer_id = c.customer_id
            WHERE c.customer_id = :customer_id
            LIMIT 1
        """),
        {"customer_id": str(customer_id)},
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")

    return _customer_dict(row)


@router.post("", status_code=201)
def create_customer(
    payload: dict,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "CREATE")),
):
    allowed = {"customer_code", "customer_name", "country_code", "address", "contact_email", "is_active"}
    unknown = set(payload) - allowed
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unsupported fields: {', '.join(sorted(unknown))}")

    code = str(payload.get("customer_code", "")).strip()
    name = str(payload.get("customer_name", "")).strip()
    if not code or not name:
        raise HTTPException(status_code=422, detail="customer_code and customer_name are required")

    actor_id = _identity_user_id(identity)

    try:
        row = db.execute(
            text("""
                INSERT INTO commercial.customer
                    (customer_code, customer_name, country_code, address,
                     contact_email, is_active, created_by)
                VALUES
                    (:customer_code, :customer_name, :country_code, :address,
                     :contact_email, :is_active, CAST(:created_by AS uuid))
                RETURNING customer_id, customer_code, customer_name,
                          country_code, address, contact_email, is_active,
                          created_at, created_by, updated_at, updated_by
            """),
            {
                "customer_code": code,
                "customer_name": name,
                "country_code": payload.get("country_code"),
                "address": payload.get("address"),
                "contact_email": payload.get("contact_email"),
                "is_active": payload.get("is_active", True),
                "created_by": actor_id,
            },
        ).first()

        result = _customer_dict(row)
        write_business_audit(
            db,
            actor_user_id=actor_id,
            action_code="INSERT",
            record_schema="commercial",
            record_table="customer",
            record_key={"customer_id": str(result["customer_id"])},
            after_state=result,
            changed_fields=list(payload.keys()),
        )
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        if getattr(exc, "orig", None) is not None and getattr(exc.orig, "sqlstate", None) == "23505":
            raise HTTPException(status_code=409, detail="Customer code already exists")
        if isinstance(exc, HTTPException):
            raise
        raise


@router.patch("/{customer_id}")
def update_customer(
    customer_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "UPDATE")),
):
    allowed = {"customer_code", "customer_name", "country_code", "address", "contact_email", "is_active"}
    unknown = set(payload) - allowed
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unsupported fields: {', '.join(sorted(unknown))}")
    if not payload:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")

    actor_id = _identity_user_id(identity)
    before = db.execute(
        text("""
            SELECT customer_id, customer_code, customer_name, country_code,
                   address, contact_email, is_active
            FROM commercial.customer
            WHERE customer_id = :customer_id
            FOR UPDATE
        """),
        {"customer_id": str(customer_id)},
    ).first()

    if not before:
        raise HTTPException(status_code=404, detail="Customer not found")

    before_data = _customer_dict(before)
    values = dict(payload)
    for key in ("customer_code", "customer_name"):
        if key in values and values[key] is not None:
            values[key] = str(values[key]).strip()
            if not values[key]:
                raise HTTPException(status_code=422, detail=f"{key} cannot be blank")

    assignments = []
    params: dict[str, Any] = {"customer_id": str(customer_id), "updated_by": actor_id}
    for key, value in values.items():
        assignments.append(f"{key} = :{key}")
        params[key] = value
    assignments.extend(["updated_at = CURRENT_TIMESTAMP", "updated_by = CAST(:updated_by AS uuid)"])

    try:
        row = db.execute(
            text(f"""
                UPDATE commercial.customer
                SET {", ".join(assignments)}
                WHERE customer_id = :customer_id
                RETURNING customer_id, customer_code, customer_name, country_code,
                          address, contact_email, is_active, created_at, created_by,
                          updated_at, updated_by
            """),
            params,
        ).first()
        result = _customer_dict(row)
        write_business_audit(
            db,
            actor_user_id=actor_id,
            action_code="UPDATE",
            record_schema="commercial",
            record_table="customer",
            record_key={"customer_id": str(customer_id)},
            before_state=before_data,
            after_state=result,
            changed_fields=list(payload.keys()),
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.get("/{customer_id}/addresses")
def list_customer_addresses(
    customer_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "VIEW")),
):
    exists = db.execute(
        text("SELECT 1 FROM commercial.customer WHERE customer_id = :id"),
        {"id": str(customer_id)},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    rows = db.execute(
        text("""
            SELECT customer_address_id, customer_id, address_type,
                   address_line_1, address_line_2, city, state_province,
                   postal_code, country, is_primary_address, is_active,
                   created_at, updated_at
            FROM commercial.customer_address
            WHERE customer_id = :id
            ORDER BY is_primary_address DESC, address_type, created_at
        """),
        {"id": str(customer_id)},
    ).fetchall()
    return {"items": [_customer_dict(row) for row in rows]}


@router.get("/{customer_id}/contacts")
def list_customer_contacts(
    customer_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "VIEW")),
):
    exists = db.execute(
        text("SELECT 1 FROM commercial.customer WHERE customer_id = :id"),
        {"id": str(customer_id)},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Customer not found")

    rows = db.execute(
        text("""
            SELECT customer_contact_id, customer_id, contact_code,
                   first_name, last_name, job_title, department, email,
                   phone_number, mobile_number, is_primary_contact,
                   is_active, created_at, updated_at
            FROM commercial.customer_contact
            WHERE customer_id = :id
            ORDER BY is_primary_contact DESC, last_name, first_name
        """),
        {"id": str(customer_id)},
    ).fetchall()
    return {"items": [_customer_dict(row) for row in rows]}


@router.get("/{customer_id}/commercial-profile")
def get_commercial_profile(
    customer_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "VIEW")),
):
    row = db.execute(
        text("""
            SELECT customer_commercial_profile_id, customer_id,
                   payment_terms, credit_currency, customer_category,
                   customer_industry, regulatory_classification,
                   key_account_flag, effective_from, effective_to,
                   created_at, updated_at
            FROM commercial.customer_commercial_profile
            WHERE customer_id = :id
            ORDER BY effective_from DESC NULLS LAST
            LIMIT 1
        """),
        {"id": str(customer_id)},
    ).first()
    return _customer_dict(row) if row else None


@router.get("/{customer_id}/credit-profile")
def get_credit_profile(
    customer_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CREDIT", "VIEW")),
):
    row = db.execute(
        text("""
            SELECT credit_profile_id, customer_id, credit_limit,
                   credit_currency_code, current_exposure, available_credit,
                   credit_status, payment_risk_class, credit_hold_flag,
                   effective_from, effective_to, approved_by, approved_at,
                   created_at, created_by
            FROM commercial.customer_credit_profile
            WHERE customer_id = :id
            ORDER BY effective_from DESC
            LIMIT 1
        """),
        {"id": str(customer_id)},
    ).first()
    return _customer_dict(row) if row else None


@router.get("/{customer_id}/interactions")
def list_customer_interactions(
    customer_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_CUSTOMER", "VIEW")),
):
    rows = db.execute(
        text("""
            SELECT interaction_id, interaction_number, customer_id, contact_id,
                   interaction_type, subject, interaction_date, owner_user_id,
                   summary, outcome, next_action, next_action_due_date,
                   next_contact_date, related_quote_id,
                   related_document_version_id, created_at, updated_at
            FROM commercial.customer_interaction
            WHERE customer_id = :id
            ORDER BY interaction_date DESC
            LIMIT 200
        """),
        {"id": str(customer_id)},
    ).fetchall()
    return {"items": [_customer_dict(row) for row in rows]}
