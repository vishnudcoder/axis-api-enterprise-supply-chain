from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import require_permission
from .models import AuditLog, COA, ProductionBatch
from .schemas import (
    CreateCOARequest,
    UpdateCOARequest,
    COAOut,
)


router = APIRouter(
    prefix="/api/coa",
    tags=["COA"],
)


TEST_STATUSES = [
    "Pending",
    "In Testing",
    "Passed",
    "Failed",
]

COA_STATUSES = [
    "Draft",
    "Testing",
    "QC Approved",
    "QA Approved",
    "Released",
    "Rejected",
]


def create_audit(
    db: Session,
    user,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
):
    audit = AuditLog(
        user_id=user.id,
        role=user.role.name if user.role else None,
        action=action,
        entity=entity_type,
        entity_id=entity_id,
    )

    db.add(audit)


def coa_response(item: COA) -> dict:
    return {
        "id": item.id,
        "coa_number": item.coa_number,
        "po_number": item.po_number,
        "customer": item.customer,
        "product": item.product,
        "cas_no": item.cas_no,
        "batch_number": item.batch_number,
        "quantity_kg": float(item.quantity_kg or 0),
        "test_status": item.test_status,
        "coa_status": item.coa_status,
        "qc_approved": item.qc_approved,
        "qa_approved": item.qa_approved,
        "test_date": item.test_date,
        "release_date": item.release_date,
        "tested_by": item.tested_by,
        "approved_by": item.approved_by,
        "document_reference": item.document_reference,
        "remarks": item.remarks,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get("", response_model=dict)
def list_coas(
    search: Optional[str] = Query(default=None),
    test_status: Optional[str] = Query(default=None),
    coa_status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_view")
    ),
):
    query = db.query(COA)

    if search:
        term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                COA.coa_number.ilike(term),
                COA.po_number.ilike(term),
                COA.customer.ilike(term),
                COA.product.ilike(term),
                COA.batch_number.ilike(term),
                COA.cas_no.ilike(term),
            )
        )

    if test_status:
        query = query.filter(
            COA.test_status == test_status
        )

    if coa_status:
        query = query.filter(
            COA.coa_status == coa_status
        )

    total = query.count()

    items = (
        query
        .order_by(COA.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            coa_response(item)
            for item in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (
            (total + page_size - 1) // page_size
            if total
            else 0
        ),
    }


@router.get("/summary", response_model=dict)
def coa_summary(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_view")
    ),
):
    total = (
        db.query(func.count(COA.id))
        .scalar()
        or 0
    )

    pending = (
        db.query(func.count(COA.id))
        .filter(COA.test_status == "Pending")
        .scalar()
        or 0
    )

    testing = (
        db.query(func.count(COA.id))
        .filter(COA.test_status == "In Testing")
        .scalar()
        or 0
    )

    passed = (
        db.query(func.count(COA.id))
        .filter(COA.test_status == "Passed")
        .scalar()
        or 0
    )

    failed = (
        db.query(func.count(COA.id))
        .filter(COA.test_status == "Failed")
        .scalar()
        or 0
    )

    released = (
        db.query(func.count(COA.id))
        .filter(COA.coa_status == "Released")
        .scalar()
        or 0
    )

    qc_pending = (
        db.query(func.count(COA.id))
        .filter(COA.qc_approved.is_(False))
        .scalar()
        or 0
    )

    qa_pending = (
        db.query(func.count(COA.id))
        .filter(COA.qa_approved.is_(False))
        .scalar()
        or 0
    )

    return {
        "total": total,
        "pending": pending,
        "testing": testing,
        "passed": passed,
        "failed": failed,
        "released": released,
        "qc_pending": qc_pending,
        "qa_pending": qa_pending,
    }


@router.get("/{coa_id}", response_model=COAOut)
def get_coa(
    coa_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_view")
    ),
):
    item = (
        db.query(COA)
        .filter(COA.id == coa_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="COA not found",
        )

    return coa_response(item)


@router.post(
    "",
    response_model=COAOut,
    status_code=201,
)
def create_coa(
    payload: CreateCOARequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_create")
    ),
):
    if payload.test_status not in TEST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid test status",
        )

    if payload.coa_status not in COA_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid COA status",
        )

    production_batch = (
        db.query(ProductionBatch)
        .filter(ProductionBatch.batch_number == payload.batch_number)
        .first()
    )

    if not production_batch:
        raise HTTPException(
            status_code=400,
            detail="COA can only be created for an existing production batch",
        )

    if production_batch.production_status != "Completed":
        raise HTTPException(
            status_code=400,
            detail="COA can only be created after production batch is Completed",
        )

    existing = (
        db.query(COA)
        .filter(
            COA.coa_number == payload.coa_number
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="COA number already exists",
        )

    item = COA(
        coa_number=payload.coa_number,
        po_number=payload.po_number,
        customer=payload.customer,
        product=payload.product,
        cas_no=payload.cas_no,
        batch_number=payload.batch_number,
        quantity_kg=payload.quantity_kg,
        test_status=payload.test_status,
        coa_status=payload.coa_status,
        qc_approved=payload.qc_approved,
        qa_approved=payload.qa_approved,
        test_date=payload.test_date,
        release_date=payload.release_date,
        tested_by=payload.tested_by,
        approved_by=payload.approved_by,
        document_reference=payload.document_reference,
        remarks=payload.remarks,
    )

    db.add(item)
    db.flush()

    create_audit(
        db,
        current_user,
        "CREATE",
        "COA",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return coa_response(item)


@router.put(
    "/{coa_id}",
    response_model=COAOut,
)
def update_coa(
    coa_id: int,
    payload: UpdateCOARequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_edit")
    ),
):
    item = (
        db.query(COA)
        .filter(COA.id == coa_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="COA not found",
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    if (
        "test_status" in data
        and data["test_status"] not in TEST_STATUSES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid test status",
        )

    if (
        "coa_status" in data
        and data["coa_status"] not in COA_STATUSES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid COA status",
        )

    if "coa_number" in data:
        duplicate = (
            db.query(COA)
            .filter(
                COA.coa_number == data["coa_number"],
                COA.id != coa_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="COA number already exists",
            )

    resulting_test_status = data.get("test_status", item.test_status)
    resulting_coa_status = data.get("coa_status", item.coa_status)
    resulting_qc = data.get("qc_approved", item.qc_approved)
    resulting_qa = data.get("qa_approved", item.qa_approved)

    if resulting_coa_status == "QC Approved" and resulting_test_status != "Passed":
        raise HTTPException(
            status_code=400,
            detail="COA must have Passed test status before QC Approval",
        )

    if resulting_coa_status in {"QA Approved", "Released"} and not resulting_qc:
        raise HTTPException(
            status_code=400,
            detail="QC approval is required before QA Approval",
        )

    if resulting_coa_status == "Released" and not resulting_qa:
        raise HTTPException(
            status_code=400,
            detail="QA approval is required before COA release",
        )

    if resulting_coa_status == "Released" and resulting_test_status != "Passed":
        raise HTTPException(
            status_code=400,
            detail="COA must have Passed test status before release",
        )

    for key, value in data.items():
        setattr(item, key, value)

    create_audit(
        db,
        current_user,
        "UPDATE",
        "COA",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return coa_response(item)


@router.patch(
    "/{coa_id}/status",
    response_model=COAOut,
)
def update_coa_status(
    coa_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_edit")
    ),
):
    item = (
        db.query(COA)
        .filter(COA.id == coa_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="COA not found",
        )

    if status not in COA_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid COA status",
        )

    if status == "QC Approved" and item.test_status != "Passed":
        raise HTTPException(status_code=400, detail="COA must have Passed test status before QC Approval")

    # Approval status transitions are authoritative workflow actions.
    # Persist the corresponding approval flag in the same transaction so
    # the next lifecycle step always sees the approved state.
    if status == "QC Approved":
        if item.test_status != "Passed":
            raise HTTPException(
                status_code=400,
                detail="COA must have Passed test status before QC Approval",
            )
        item.qc_approved = True

    elif status == "QA Approved":
        if not item.qc_approved:
            raise HTTPException(
                status_code=400,
                detail="QC approval is required before QA Approval",
            )
        item.qa_approved = True

    elif status == "Released":
        if not item.qc_approved or not item.qa_approved:
            raise HTTPException(
                status_code=400,
                detail="Both QC and QA approvals are required before COA release",
            )
        if item.test_status != "Passed":
            raise HTTPException(
                status_code=400,
                detail="COA must have Passed test status before release",
            )

    item.coa_status = status

    if status == "Released":
        item.release_date = datetime.now().astimezone()

    create_audit(
        db,
        current_user,
        "STATUS_UPDATE",
        "COA",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return coa_response(item)


@router.delete("/{coa_id}")
def delete_coa(
    coa_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("COA", "can_delete")
    ),
):
    item = (
        db.query(COA)
        .filter(COA.id == coa_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="COA not found",
        )

    create_audit(
        db,
        current_user,
        "DELETE",
        "COA",
        item.id,
    )

    db.delete(item)
    db.commit()

    return {
        "message": "COA deleted successfully"
    }