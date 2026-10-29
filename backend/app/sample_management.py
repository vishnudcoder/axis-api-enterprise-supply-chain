import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from .business_audit import write_business_audit
from .database import get_db
from .schemas import (
    CustomerSampleCreateRequest,
    CustomerSampleUpdateRequest,
    QualitySampleCreateRequest,
    TestAttemptCreateRequest,
    TestAttemptUpdateRequest,
    TestRequestCreateRequest,
)
from .supabase_authorization import require_axis_permission

router = APIRouter(
    prefix="/api/sample-management",
    tags=["Sample Management"],
)


def _identity_user_id(identity: dict) -> str:
    try:
        return str(UUID(str(identity["user_id"])))
    except (KeyError, ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=401,
            detail="Valid AXIS user identity required",
        ) from None


def _row_dict(row: Any) -> dict:
    return dict(row._mapping)


def _audit(
    db: Session,
    identity: dict,
    action: str,
    schema: str,
    table: str,
    key: dict,
    before: dict | None,
    after: dict | None,
    changed_fields: list[str],
) -> None:
    write_business_audit(
        db,
        actor_user_id=_identity_user_id(identity),
        action_code=action,
        record_schema=schema,
        record_table=table,
        record_key=key,
        before_state=before,
        after_state=after,
        changed_fields=changed_fields,
    )


def _raise_write_error(exc: Exception, duplicate_detail: str) -> None:
    if getattr(getattr(exc, "orig", None), "sqlstate", None) == "23505":
        raise HTTPException(status_code=409, detail=duplicate_detail) from exc
    raise exc


def _validate_customer_request_links(
    db: Session,
    customer_id: UUID | None,
    lead_id: UUID | None,
    product_id: UUID,
) -> None:
    if customer_id is None and lead_id is None:
        raise HTTPException(
            status_code=422,
            detail="Select a customer or a lead/prospect",
        )

    product = db.execute(
        text("""
            SELECT 1
            FROM product.product
            WHERE product_id = :product_id
              AND is_active = TRUE
              AND is_sellable = TRUE
        """),
        {"product_id": str(product_id)},
    ).first()
    if not product:
        raise HTTPException(
            status_code=422,
            detail="Select an active sellable product",
        )

    if customer_id:
        customer = db.execute(
            text("""
                SELECT 1
                FROM commercial.customer
                WHERE customer_id = :customer_id
                  AND is_active = TRUE
            """),
            {"customer_id": str(customer_id)},
        ).first()
        if not customer:
            raise HTTPException(
                status_code=422,
                detail="Select an active customer",
            )

    if lead_id:
        lead = db.execute(
            text("""
                SELECT customer_id
                FROM commercial.lead
                WHERE lead_id = :lead_id
            """),
            {"lead_id": str(lead_id)},
        ).first()
        if not lead:
            raise HTTPException(
                status_code=422,
                detail="Select an existing lead",
            )
        if customer_id and lead.customer_id and lead.customer_id != customer_id:
            raise HTTPException(
                status_code=422,
                detail="The selected lead belongs to a different customer",
            )


def _customer_request(db: Session, sample_id: UUID) -> dict | None:
    row = db.execute(
        text("""
            SELECT cs.sample_id, cs.sample_number, cs.sample_status,
                   cs.customer_id, c.customer_name, cs.lead_id, l.lead_number,
                   cs.product_id, p.product_code, p.product_name,
                   cs.requested_at, cs.dispatched_at, cs.coa_required,
                   cs.created_at, cs.created_by
            FROM commercial.customer_sample AS cs
            LEFT JOIN commercial.customer AS c
              ON c.customer_id = cs.customer_id
            LEFT JOIN commercial.lead AS l
              ON l.lead_id = cs.lead_id
            JOIN product.product AS p
              ON p.product_id = cs.product_id
            WHERE cs.sample_id = :sample_id
        """),
        {"sample_id": str(sample_id)},
    ).first()
    return _row_dict(row) if row else None


@router.get("/customer-requests/lookups")
def customer_request_lookups(
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "VIEW")
    ),
):
    customers = db.execute(text("""
        SELECT customer_id, customer_code, customer_name
        FROM commercial.customer
        WHERE is_active = TRUE
        ORDER BY customer_name, customer_code
    """)).fetchall()
    leads = db.execute(text("""
        SELECT lead_id, lead_number, lead_status, customer_id,
               opportunity_title
        FROM commercial.lead
        ORDER BY created_at DESC
        LIMIT 500
    """)).fetchall()
    products = db.execute(text("""
        SELECT product_id, product_code, product_name, cas_number
        FROM product.product
        WHERE is_active = TRUE AND is_sellable = TRUE
        ORDER BY product_code
    """)).fetchall()

    return {
        "customers": [_row_dict(row) for row in customers],
        "leads": [_row_dict(row) for row in leads],
        "products": [_row_dict(row) for row in products],
    }


@router.get("/customer-requests/statuses")
def customer_request_statuses(
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "VIEW")
    ),
):
    rows = db.execute(text("""
        SELECT DISTINCT sample_status
        FROM commercial.customer_sample
        ORDER BY sample_status
    """)).fetchall()
    return {"items": [row.sample_status for row in rows]}


@router.get("/customer-requests")
def list_customer_requests(
    search: str | None = Query(default=None, max_length=150),
    status: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "VIEW")
    ),
):
    filters = ["1 = 1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if search and search.strip():
        filters.append("""
            (cs.sample_number ILIKE :search
             OR c.customer_name ILIKE :search
             OR l.lead_number ILIKE :search
             OR p.product_code ILIKE :search
             OR p.product_name ILIKE :search)
        """)
        params["search"] = f"%{search.strip()}%"
    if status:
        filters.append("cs.sample_status = :status")
        params["status"] = status
    where_sql = " AND ".join(filters)

    total = db.execute(
        text(f"""
            SELECT COUNT(*)
            FROM commercial.customer_sample AS cs
            LEFT JOIN commercial.customer AS c
              ON c.customer_id = cs.customer_id
            LEFT JOIN commercial.lead AS l
              ON l.lead_id = cs.lead_id
            JOIN product.product AS p
              ON p.product_id = cs.product_id
            WHERE {where_sql}
        """),
        params,
    ).scalar_one()
    rows = db.execute(
        text(f"""
            SELECT cs.sample_id, cs.sample_number, cs.sample_status,
                   cs.customer_id, c.customer_name, cs.lead_id, l.lead_number,
                   cs.product_id, p.product_code, p.product_name,
                   cs.requested_at, cs.dispatched_at, cs.coa_required
            FROM commercial.customer_sample AS cs
            LEFT JOIN commercial.customer AS c
              ON c.customer_id = cs.customer_id
            LEFT JOIN commercial.lead AS l
              ON l.lead_id = cs.lead_id
            JOIN product.product AS p
              ON p.product_id = cs.product_id
            WHERE {where_sql}
            ORDER BY cs.requested_at DESC, cs.sample_id
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()
    return {
        "items": [_row_dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/customer-requests/{sample_id}")
def get_customer_request(
    sample_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "VIEW")
    ),
):
    item = _customer_request(db, sample_id)
    if not item:
        raise HTTPException(status_code=404, detail="Customer sample request not found")
    return item


@router.post("/customer-requests", status_code=201)
def create_customer_request(
    payload: CustomerSampleCreateRequest,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "CREATE")
    ),
):
    _validate_customer_request_links(
        db, payload.customer_id, payload.lead_id, payload.product_id
    )
    actor_id = _identity_user_id(identity)
    values = payload.model_dump(exclude_unset=True)
    sample_number = payload.sample_number.strip()
    if not sample_number:
        raise HTTPException(status_code=422, detail="Sample number cannot be blank")
    columns = ["sample_number", "product_id", "customer_id", "lead_id", "created_by"]
    if "coa_required" in payload.model_fields_set:
        columns.append("coa_required")
    params = {
        "sample_number": sample_number,
        "product_id": str(payload.product_id),
        "customer_id": str(payload.customer_id) if payload.customer_id else None,
        "lead_id": str(payload.lead_id) if payload.lead_id else None,
        "coa_required": payload.coa_required,
        "created_by": actor_id,
    }
    try:
        row = db.execute(
            text(f"""
                INSERT INTO commercial.customer_sample ({", ".join(columns)})
                VALUES (
                    :sample_number,
                    CAST(:product_id AS uuid),
                    CAST(:customer_id AS uuid),
                    CAST(:lead_id AS uuid),
                    CAST(:created_by AS uuid)
                    {", :coa_required" if "coa_required" in columns else ""}
                )
                RETURNING sample_id
            """),
            params,
        ).first()
        sample_id = row.sample_id
        result = _customer_request(db, sample_id)
        _audit(
            db, identity, "INSERT", "commercial", "customer_sample",
            {"sample_id": str(sample_id)}, None, result, list(values.keys()),
        )
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        _raise_write_error(exc, "Customer sample number already exists")


@router.post("/customer-requests/{sample_id}/dispatch")
def record_customer_request_dispatch(
    sample_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "UPDATE")
    ),
):
    locked = db.execute(
        text("""
            SELECT sample_id
            FROM commercial.customer_sample
            WHERE sample_id = :sample_id
            FOR UPDATE
        """),
        {"sample_id": str(sample_id)},
    ).first()
    if not locked:
        raise HTTPException(status_code=404, detail="Customer sample request not found")
    before = _customer_request(db, sample_id)
    if before["dispatched_at"] is not None:
        raise HTTPException(status_code=409, detail="Dispatch is already recorded")
    try:
        db.execute(
            text("""
                UPDATE commercial.customer_sample
                SET dispatched_at = CURRENT_TIMESTAMP
                WHERE sample_id = CAST(:sample_id AS uuid)
            """),
            {"sample_id": str(sample_id)},
        )
        result = _customer_request(db, sample_id)
        _audit(
            db, identity, "UPDATE", "commercial", "customer_sample",
            {"sample_id": str(sample_id)}, before, result, ["dispatched_at"],
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.patch("/customer-requests/{sample_id}")
def update_customer_request(
    sample_id: UUID,
    payload: CustomerSampleUpdateRequest,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("COMMERCIAL_SAMPLE_REQUESTS", "UPDATE")
    ),
):
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")

    before_row = db.execute(
        text("""
            SELECT sample_id
            FROM commercial.customer_sample
            WHERE sample_id = :sample_id
            FOR UPDATE
        """),
        {"sample_id": str(sample_id)},
    ).first()
    if not before_row:
        raise HTTPException(status_code=404, detail="Customer sample request not found")
    before = _customer_request(db, sample_id)

    merged = {
        "customer_id": values.get("customer_id", before["customer_id"]),
        "lead_id": values.get("lead_id", before["lead_id"]),
        "product_id": values.get("product_id", before["product_id"]),
    }
    if merged["product_id"] is None:
        raise HTTPException(status_code=422, detail="Product is required")
    _validate_customer_request_links(
        db,
        merged["customer_id"],
        merged["lead_id"],
        merged["product_id"],
    )
    if "sample_number" in values:
        values["sample_number"] = (
            values["sample_number"].strip()
            if values["sample_number"] is not None else None
        )
        if not values["sample_number"]:
            raise HTTPException(status_code=422, detail="Sample number cannot be blank")
    for field in ("product_id", "customer_id", "lead_id"):
        if field in values and values[field] is not None:
            values[field] = str(values[field])

    assignments = []
    params: dict[str, Any] = {"sample_id": str(sample_id)}
    for field, value in values.items():
        assignments.append(
            f"{field} = CAST(:{field} AS uuid)"
            if field in {"product_id", "customer_id", "lead_id"}
            else f"{field} = :{field}"
        )
        params[field] = value

    try:
        db.execute(
            text(f"""
                UPDATE commercial.customer_sample
                SET {", ".join(assignments)}
                WHERE sample_id = CAST(:sample_id AS uuid)
            """),
            params,
        )
        result = _customer_request(db, sample_id)
        _audit(
            db, identity, "UPDATE", "commercial", "customer_sample",
            {"sample_id": str(sample_id)}, before, result, list(values.keys()),
        )
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        _raise_write_error(exc, "Customer sample number already exists")


def _quality_sample(db: Session, sample_id: UUID) -> dict | None:
    row = db.execute(
        text("""
            SELECT qs.quality_sample_id, qs.sample_number, qs.product_id,
                   p.product_code, p.product_name, qs.sample_type,
                   qs.collected_at, qs.collected_by, qs.status,
                   qs.batch_id, b.batch_number, qs.material_lot_id,
                   ml.lot_number, qs.customer_sample_id,
                   cs.sample_number AS customer_sample_number,
                   qs.created_at
            FROM quality.sample AS qs
            JOIN product.product AS p ON p.product_id = qs.product_id
            LEFT JOIN production.manufacturing_batch AS b
              ON b.batch_id = qs.batch_id
            LEFT JOIN inventory.material_lot AS ml
              ON ml.material_lot_id = qs.material_lot_id
            LEFT JOIN commercial.customer_sample AS cs
              ON cs.sample_id = qs.customer_sample_id
            WHERE qs.quality_sample_id = :sample_id
        """),
        {"sample_id": str(sample_id)},
    ).first()
    return _row_dict(row) if row else None


@router.get("/quality-samples/lookups")
def quality_sample_lookups(
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_SAMPLES", "VIEW")
    ),
):
    products = db.execute(text("""
        SELECT product_id, product_code, product_name, cas_number
        FROM product.product
        WHERE is_active = TRUE
        ORDER BY product_code
    """)).fetchall()
    batches = db.execute(text("""
        SELECT batch_id, batch_number, product_id, batch_status
        FROM production.manufacturing_batch
        ORDER BY created_at DESC
        LIMIT 500
    """)).fetchall()
    lots = db.execute(text("""
        SELECT material_lot_id, lot_number, internal_lot_number,
               product_id, quality_status
        FROM inventory.material_lot
        ORDER BY created_at DESC
        LIMIT 500
    """)).fetchall()
    customer_samples = db.execute(text("""
        SELECT cs.sample_id, cs.sample_number, cs.sample_status,
               cs.product_id, p.product_code, p.product_name
        FROM commercial.customer_sample AS cs
        JOIN product.product AS p ON p.product_id = cs.product_id
        ORDER BY cs.requested_at DESC, cs.sample_id
        LIMIT 500
    """)).fetchall()
    sample_types = db.execute(text("""
        SELECT sample_type_code, sample_type_name
        FROM quality.sample_type_catalog
        WHERE is_active = TRUE
          AND approval_status = 'APPROVED'
        ORDER BY sample_type_code
    """)).fetchall()
    return {
        "products": [_row_dict(row) for row in products],
        "batches": [_row_dict(row) for row in batches],
        "material_lots": [_row_dict(row) for row in lots],
        "customer_samples": [_row_dict(row) for row in customer_samples],
        "sample_types": [_row_dict(row) for row in sample_types],
    }


@router.get("/quality-samples/statuses")
def quality_sample_statuses(
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_SAMPLES", "VIEW")
    ),
):
    rows = db.execute(text("""
        SELECT DISTINCT status FROM quality.sample ORDER BY status
    """)).fetchall()
    return {"items": [row.status for row in rows]}


@router.get("/quality-samples")
def list_quality_samples(
    search: str | None = Query(default=None, max_length=150),
    status: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_SAMPLES", "VIEW")
    ),
):
    filters = ["1 = 1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if search and search.strip():
        filters.append("""
            (qs.sample_number ILIKE :search OR p.product_code ILIKE :search
             OR p.product_name ILIKE :search OR b.batch_number ILIKE :search
             OR ml.lot_number ILIKE :search
             OR cs.sample_number ILIKE :search)
        """)
        params["search"] = f"%{search.strip()}%"
    if status:
        filters.append("qs.status = :status")
        params["status"] = status
    where_sql = " AND ".join(filters)
    joins = """
        FROM quality.sample AS qs
        JOIN product.product AS p ON p.product_id = qs.product_id
        LEFT JOIN production.manufacturing_batch AS b ON b.batch_id = qs.batch_id
        LEFT JOIN inventory.material_lot AS ml ON ml.material_lot_id = qs.material_lot_id
        LEFT JOIN commercial.customer_sample AS cs ON cs.sample_id = qs.customer_sample_id
    """
    total = db.execute(
        text(f"SELECT COUNT(*) {joins} WHERE {where_sql}"), params
    ).scalar_one()
    rows = db.execute(
        text(f"""
            SELECT qs.quality_sample_id, qs.sample_number, qs.product_id,
                   p.product_code, p.product_name, qs.sample_type,
                   qs.collected_at, qs.status, qs.batch_id, b.batch_number,
                   qs.material_lot_id, ml.lot_number,
                   qs.customer_sample_id,
                   cs.sample_number AS customer_sample_number
            {joins}
            WHERE {where_sql}
            ORDER BY qs.collected_at DESC, qs.quality_sample_id
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()
    return {
        "items": [_row_dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/quality-samples/{sample_id}")
def get_quality_sample(
    sample_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_SAMPLES", "VIEW")
    ),
):
    item = _quality_sample(db, sample_id)
    if not item:
        raise HTTPException(status_code=404, detail="Quality sample not found")
    return item


@router.post("/quality-samples", status_code=201)
def create_quality_sample(
    payload: QualitySampleCreateRequest,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_SAMPLES", "CREATE")
    ),
):
    sample_type = payload.sample_type.strip()
    if not sample_type:
        raise HTTPException(status_code=422, detail="Select an approved sample type")
    if (payload.batch_id is None) == (payload.material_lot_id is None):
        raise HTTPException(
            status_code=422,
            detail="Select exactly one manufacturing batch or material lot",
        )
    auth_user_id = str(UUID(str(identity["auth_user_id"])))
    claims = json.dumps({"sub": auth_user_id, "role": "authenticated"})
    try:
        db.execute(
            text("""
                SELECT
                    set_config('request.jwt.claim.sub', :auth_user_id, true),
                    set_config('request.jwt.claim.role', 'authenticated', true),
                    set_config('request.jwt.claims', :claims, true)
            """),
            {"auth_user_id": auth_user_id, "claims": claims},
        )
        row = db.execute(
            text("""
                SELECT quality.create_sample(
                    CAST(:product_id AS uuid),
                    :sample_type,
                    :collected_at,
                    CAST(:batch_id AS uuid),
                    CAST(:material_lot_id AS uuid),
                    CAST(:customer_sample_id AS uuid),
                    CAST(:request_id AS uuid)
                ) AS response
            """),
            {
                "product_id": str(payload.product_id),
                "sample_type": sample_type,
                "collected_at": payload.collected_at,
                "batch_id": str(payload.batch_id) if payload.batch_id else None,
                "material_lot_id": (
                    str(payload.material_lot_id) if payload.material_lot_id else None
                ),
                "customer_sample_id": (
                    str(payload.p_customer_sample_id)
                    if payload.p_customer_sample_id else None
                ),
                "request_id": str(payload.request_id),
            },
        ).first()
        rpc_result = row.response
        sample_data = rpc_result.get("data") if isinstance(rpc_result, dict) else None
        if not isinstance(sample_data, dict) or not sample_data.get("quality_sample_id"):
            raise HTTPException(
                status_code=502,
                detail="Quality sample creation returned an invalid response",
            )
        sample_id = UUID(str(sample_data["quality_sample_id"]))
        result = _quality_sample(db, sample_id)
        if result is None:
            raise HTTPException(
                status_code=502,
                detail="Created Quality sample could not be loaded",
            )
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        if isinstance(exc, HTTPException):
            raise
        message = getattr(getattr(exc, "orig", None), "diag", None)
        message = getattr(message, "message_primary", "")
        known_errors = {
            "CUSTOMER_SAMPLE_NOT_FOUND_OR_PRODUCT_MISMATCH": (
                422,
                "Customer sample request does not exist or its product does not match",
            ),
            "SAMPLE_TYPE_NOT_APPROVED_OR_INACTIVE": (
                422,
                "Select an active, approved sample type",
            ),
            "BATCH_NOT_FOUND_OR_PRODUCT_MISMATCH": (
                422,
                "Manufacturing batch does not exist or its product does not match",
            ),
            "MATERIAL_LOT_NOT_FOUND_OR_PRODUCT_MISMATCH": (
                422,
                "Material lot does not exist or its product does not match",
            ),
            "AUTHENTICATION_REQUIRED": (401, "Authentication required"),
            "FORBIDDEN": (403, "You do not have permission to create this sample"),
        }
        if message in known_errors:
            status_code, detail = known_errors[message]
            raise HTTPException(status_code=status_code, detail=detail) from exc
        _raise_write_error(exc, "Quality sample number already exists")


def _test_request(db: Session, request_id: UUID) -> dict | None:
    row = db.execute(
        text("""
            SELECT tr.test_request_id, tr.quality_sample_id, qs.sample_number,
                   qs.customer_sample_id,
                   cs.sample_number AS customer_sample_number,
                   qs.product_id, p.product_code, p.product_name,
                   tr.specification_revision_id, sr.revision_no,
                   tr.test_panel_code, tr.requested_at, tr.status,
                   tr.requested_by
            FROM quality.test_request AS tr
            JOIN quality.sample AS qs
              ON qs.quality_sample_id = tr.quality_sample_id
            LEFT JOIN commercial.customer_sample AS cs
              ON cs.sample_id = qs.customer_sample_id
            JOIN product.product AS p ON p.product_id = qs.product_id
            JOIN product.specification_revision AS sr
              ON sr.specification_revision_id = tr.specification_revision_id
            WHERE tr.test_request_id = :request_id
        """),
        {"request_id": str(request_id)},
    ).first()
    if not row:
        return None

    result = _row_dict(row)
    attempts = db.execute(
        text("""
            SELECT test_attempt_id, test_request_id, attempt_no, test_code,
                   started_at, completed_at, result_status, result_value,
                   result_text, result_data, result_uom_id, analyst_user_id,
                   created_at
            FROM quality.test_attempt
            WHERE test_request_id = :request_id
            ORDER BY attempt_no, test_code
        """),
        {"request_id": str(request_id)},
    ).fetchall()
    result["attempts"] = [_row_dict(attempt) for attempt in attempts]
    return result


@router.get("/test-requests/lookups")
def test_request_lookups(
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "VIEW")
    ),
):
    samples = db.execute(text("""
        SELECT qs.quality_sample_id, qs.sample_number, qs.product_id,
               p.product_code, p.product_name, qs.customer_sample_id,
               cs.sample_number AS customer_sample_number
        FROM quality.sample AS qs
        JOIN product.product AS p ON p.product_id = qs.product_id
        LEFT JOIN commercial.customer_sample AS cs
          ON cs.sample_id = qs.customer_sample_id
        ORDER BY qs.collected_at DESC
        LIMIT 500
    """)).fetchall()
    revisions = db.execute(text("""
        SELECT sr.specification_revision_id, sr.specification_id,
               s.product_id, p.product_code, p.product_name,
               s.specification_code, s.specification_name, sr.revision_no,
               sr.effective_from, sr.effective_to, sr.status
        FROM product.specification_revision AS sr
        JOIN product.specification AS s
          ON s.specification_id = sr.specification_id
        JOIN product.product AS p ON p.product_id = s.product_id
        WHERE s.is_active = TRUE
          AND sr.approved_by IS NOT NULL
          AND sr.approved_at IS NOT NULL
          AND (sr.effective_from IS NULL OR sr.effective_from <= CURRENT_TIMESTAMP)
          AND (sr.effective_to IS NULL OR sr.effective_to > CURRENT_TIMESTAMP)
        ORDER BY p.product_code, sr.revision_no DESC
    """)).fetchall()
    uoms = db.execute(text("""
        SELECT uom_id, uom_code, uom_name, dimension_id
        FROM reference.uom
        WHERE is_active = TRUE
        ORDER BY uom_code
    """)).fetchall()
    return {
        "quality_samples": [_row_dict(row) for row in samples],
        "specification_revisions": [_row_dict(row) for row in revisions],
        "uoms": [_row_dict(row) for row in uoms],
    }


@router.get("/test-requests/statuses")
def test_request_statuses(
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "VIEW")
    ),
):
    requests = db.execute(text("""
        SELECT DISTINCT status FROM quality.test_request ORDER BY status
    """)).fetchall()
    results = db.execute(text("""
        SELECT DISTINCT result_status FROM quality.test_attempt
        ORDER BY result_status
    """)).fetchall()
    return {
        "request_statuses": [row.status for row in requests],
        "result_statuses": [row.result_status for row in results],
    }


@router.get("/test-requests")
def list_test_requests(
    search: str | None = Query(default=None, max_length=150),
    status: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "VIEW")
    ),
):
    filters = ["1 = 1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if search and search.strip():
        filters.append("""
            (qs.sample_number ILIKE :search OR p.product_code ILIKE :search
             OR p.product_name ILIKE :search OR tr.test_panel_code ILIKE :search
             OR cs.sample_number ILIKE :search
             OR tr.test_request_id::text ILIKE :search)
        """)
        params["search"] = f"%{search.strip()}%"
    if status:
        filters.append("tr.status = :status")
        params["status"] = status
    where_sql = " AND ".join(filters)
    joins = """
        FROM quality.test_request AS tr
        JOIN quality.sample AS qs ON qs.quality_sample_id = tr.quality_sample_id
        JOIN product.product AS p ON p.product_id = qs.product_id
        LEFT JOIN commercial.customer_sample AS cs
          ON cs.sample_id = qs.customer_sample_id
    """
    total = db.execute(
        text(f"SELECT COUNT(*) {joins} WHERE {where_sql}"), params
    ).scalar_one()
    rows = db.execute(
        text(f"""
            SELECT tr.test_request_id, tr.quality_sample_id, qs.sample_number,
                   qs.customer_sample_id,
                   cs.sample_number AS customer_sample_number,
                   p.product_code, p.product_name, tr.specification_revision_id,
                   tr.test_panel_code, tr.requested_at, tr.status
            {joins}
            WHERE {where_sql}
            ORDER BY tr.requested_at DESC, tr.test_request_id
            LIMIT :limit OFFSET :offset
        """),
        params,
    ).fetchall()
    return {
        "items": [_row_dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/test-requests/{request_id}")
def get_test_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "VIEW")
    ),
):
    item = _test_request(db, request_id)
    if not item:
        raise HTTPException(status_code=404, detail="Test request not found")
    return item


@router.post("/test-requests", status_code=201)
def create_test_request(
    payload: TestRequestCreateRequest,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "CREATE")
    ),
):
    test_panel_code = payload.test_panel_code.strip()
    if not test_panel_code:
        raise HTTPException(status_code=422, detail="Test panel code cannot be blank")
    source = db.execute(
        text("""
            SELECT product_id
            FROM quality.sample
            WHERE quality_sample_id = :sample_id
        """),
        {"sample_id": str(payload.quality_sample_id)},
    ).first()
    if not source:
        raise HTTPException(status_code=422, detail="Select an existing Quality sample")
    revision = db.execute(
        text("""
            SELECT s.product_id
            FROM product.specification_revision AS sr
            JOIN product.specification AS s
              ON s.specification_id = sr.specification_id
            WHERE sr.specification_revision_id = :revision_id
              AND s.is_active = TRUE
              AND sr.approved_by IS NOT NULL
              AND sr.approved_at IS NOT NULL
              AND (sr.effective_from IS NULL OR sr.effective_from <= CURRENT_TIMESTAMP)
              AND (sr.effective_to IS NULL OR sr.effective_to > CURRENT_TIMESTAMP)
        """),
        {"revision_id": str(payload.specification_revision_id)},
    ).first()
    if not revision:
        raise HTTPException(
            status_code=422,
            detail="Select an approved, currently effective specification revision",
        )
    if source.product_id != revision.product_id:
        raise HTTPException(
            status_code=422,
            detail="Specification revision product does not match the Quality sample",
        )

    actor_id = _identity_user_id(identity)
    try:
        row = db.execute(
            text("""
                INSERT INTO quality.test_request
                    (quality_sample_id, specification_revision_id,
                     test_panel_code, requested_by)
                VALUES
                    (CAST(:quality_sample_id AS uuid),
                     CAST(:specification_revision_id AS uuid),
                     :test_panel_code, CAST(:requested_by AS uuid))
                RETURNING test_request_id
            """),
            {
                "quality_sample_id": str(payload.quality_sample_id),
                "specification_revision_id": str(payload.specification_revision_id),
                "test_panel_code": test_panel_code,
                "requested_by": actor_id,
            },
        ).first()
        request_id = row.test_request_id
        result = _test_request(db, request_id)
        _audit(
            db, identity, "INSERT", "quality", "test_request",
            {"test_request_id": str(request_id)}, None, result,
            list(payload.model_dump().keys()) + ["requested_by"],
        )
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        _raise_write_error(exc, "Matching test request already exists")


@router.post("/test-requests/{request_id}/attempts", status_code=201)
def start_test_attempt(
    request_id: UUID,
    payload: TestAttemptCreateRequest,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "EXECUTE")
    ),
):
    test_code = payload.test_code.strip()
    if not test_code:
        raise HTTPException(status_code=422, detail="Test code cannot be blank")
    if not _test_request(db, request_id):
        raise HTTPException(status_code=404, detail="Test request not found")
    actor_id = _identity_user_id(identity)
    try:
        row = db.execute(
            text("""
                INSERT INTO quality.test_attempt
                    (test_request_id, attempt_no, test_code,
                     started_at, analyst_user_id)
                VALUES
                    (CAST(:request_id AS uuid), :attempt_no, :test_code,
                     CURRENT_TIMESTAMP, CAST(:analyst_user_id AS uuid))
                RETURNING test_attempt_id, test_request_id, attempt_no,
                          test_code, started_at, completed_at, result_status,
                          result_value, result_text, result_data, result_uom_id,
                          analyst_user_id, created_at
            """),
            {
                "request_id": str(request_id),
                "attempt_no": payload.attempt_no,
                "test_code": test_code,
                "analyst_user_id": actor_id,
            },
        ).first()
        result = _row_dict(row)
        _audit(
            db, identity, "INSERT", "quality", "test_attempt",
            {"test_attempt_id": str(result["test_attempt_id"])},
            None, result, list(payload.model_dump().keys()) + ["started_at", "analyst_user_id"],
        )
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        _raise_write_error(exc, "Test attempt number and code already exist")


@router.post("/test-requests/{request_id}/attempts/{attempt_id}/complete")
def complete_test_attempt(
    request_id: UUID,
    attempt_id: UUID,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "SUBMIT")
    ),
):
    before_row = db.execute(
        text("""
            SELECT test_attempt_id, test_request_id, attempt_no, test_code,
                   started_at, completed_at, result_status, result_value,
                   result_text, result_data, result_uom_id, analyst_user_id,
                   created_at
            FROM quality.test_attempt
            WHERE test_attempt_id = :attempt_id
              AND test_request_id = :request_id
            FOR UPDATE
        """),
        {"attempt_id": str(attempt_id), "request_id": str(request_id)},
    ).first()
    if not before_row:
        raise HTTPException(status_code=404, detail="Test attempt not found")
    before = _row_dict(before_row)
    if before["completed_at"] is not None:
        raise HTTPException(status_code=409, detail="Test attempt is already complete")
    if before["started_at"] is None:
        raise HTTPException(status_code=409, detail="Test attempt has not been started")
    if all(
        before[field] is None
        for field in ("result_value", "result_text", "result_data")
    ):
        raise HTTPException(
            status_code=422,
            detail="Enter a result before completing the attempt",
        )

    try:
        row = db.execute(
            text("""
                UPDATE quality.test_attempt
                SET completed_at = CURRENT_TIMESTAMP
                WHERE test_attempt_id = CAST(:attempt_id AS uuid)
                  AND test_request_id = CAST(:request_id AS uuid)
                RETURNING test_attempt_id, test_request_id, attempt_no,
                          test_code, started_at, completed_at, result_status,
                          result_value, result_text, result_data, result_uom_id,
                          analyst_user_id, created_at
            """),
            {"attempt_id": str(attempt_id), "request_id": str(request_id)},
        ).first()
        result = _row_dict(row)
        _audit(
            db, identity, "UPDATE", "quality", "test_attempt",
            {"test_attempt_id": str(attempt_id)}, before, result, ["completed_at"],
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.patch("/test-requests/{request_id}/attempts/{attempt_id}")
def update_test_attempt(
    request_id: UUID,
    attempt_id: UUID,
    payload: TestAttemptUpdateRequest,
    db: Session = Depends(get_db),
    identity=Depends(
        require_axis_permission("QUALITY_TESTS_PENDING", "UPDATE")
    ),
):
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=422, detail="Provide at least one result field")

    before_row = db.execute(
        text("""
            SELECT test_attempt_id, test_request_id, attempt_no, test_code,
                   started_at, completed_at, result_status, result_value,
                   result_text, result_data, result_uom_id, analyst_user_id,
                   created_at
            FROM quality.test_attempt
            WHERE test_attempt_id = :attempt_id
              AND test_request_id = :request_id
            FOR UPDATE
        """),
        {"attempt_id": str(attempt_id), "request_id": str(request_id)},
    ).first()
    if not before_row:
        raise HTTPException(status_code=404, detail="Test attempt not found")
    before = _row_dict(before_row)
    if before["completed_at"] is not None:
        raise HTTPException(
            status_code=409,
            detail="Completed attempts cannot be edited; start a new attempt for retesting",
        )
    if "result_text" in values and values["result_text"] is not None:
        values["result_text"] = values["result_text"].strip() or None

    if "result_uom_id" in values and values["result_uom_id"] is not None:
        uom = db.execute(
            text("SELECT 1 FROM reference.uom WHERE uom_id = :uom_id AND is_active = TRUE"),
            {"uom_id": str(values["result_uom_id"])},
        ).first()
        if not uom:
            raise HTTPException(status_code=422, detail="Select an active result unit")
        values["result_uom_id"] = str(values["result_uom_id"])

    result_fields = (
        values.get("result_value", before["result_value"]),
        values.get("result_text", before["result_text"]),
        values.get("result_data", before["result_data"]),
    )
    if all(value is None for value in result_fields):
        raise HTTPException(
            status_code=422,
            detail="Provide a numeric, text, or structured result",
        )

    params: dict[str, Any] = {
        "attempt_id": str(attempt_id),
        "request_id": str(request_id),
    }
    assignments = []
    for field, value in values.items():
        if field == "result_data":
            params[field] = json.dumps(value) if value is not None else None
            assignments.append(f"{field} = CAST(:{field} AS jsonb)")
        elif field == "result_uom_id":
            params[field] = value
            assignments.append(f"{field} = CAST(:{field} AS uuid)")
        else:
            params[field] = value
            assignments.append(f"{field} = :{field}")

    try:
        row = db.execute(
            text(f"""
                UPDATE quality.test_attempt
                SET {", ".join(assignments)}
                WHERE test_attempt_id = CAST(:attempt_id AS uuid)
                  AND test_request_id = CAST(:request_id AS uuid)
                RETURNING test_attempt_id, test_request_id, attempt_no,
                          test_code, started_at, completed_at, result_status,
                          result_value, result_text, result_data, result_uom_id,
                          analyst_user_id, created_at
            """),
            params,
        ).first()
        result = _row_dict(row)
        _audit(
            db, identity, "UPDATE", "quality", "test_attempt",
            {"test_attempt_id": str(attempt_id)}, before, result, list(values.keys()),
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise




