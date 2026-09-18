from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import require_permission
from .models import AuditLog, Sample
from .schemas import (
    CreateSampleRequest,
    UpdateSampleRequest,
    SampleOut,
)

router = APIRouter(
    prefix="/api/samples",
    tags=["Samples"],
)

STATUS_VALUES = [
    "Requested",
    "In Preparation",
    "Ready for Dispatch",
    "Dispatched",
    "Received",
    "Testing",
    "Completed",
    "Cancelled",
]

PRIORITY_VALUES = [
    "Low",
    "Normal",
    "High",
    "Urgent",
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


def sample_response(item: Sample) -> dict:
    return {
        "id": item.id,
        "sample_number": item.sample_number,
        "enquiry_id": item.enquiry_id,
        "po_number": item.po_number,
        "customer": item.customer,
        "product": item.product,
        "cas_no": item.cas_no,
        "batch_number": item.batch_number,
        "sample_quantity": float(
            item.sample_quantity or 0
        ),
        "unit": item.unit,
        "sample_type": item.sample_type,
        "purpose": item.purpose,
        "status": item.status,
        "priority": item.priority,
        "requested_date": item.requested_date,
        "dispatch_date": item.dispatch_date,
        "received_date": item.received_date,
        "dispatched_to": item.dispatched_to,
        "courier": item.courier,
        "tracking_number": item.tracking_number,
        "owner": item.owner,
        "notes": item.notes,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get("", response_model=dict)
def list_samples(
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_view")
    ),
):
    query = db.query(Sample)

    if search:
        term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Sample.sample_number.ilike(term),
                Sample.enquiry_id.ilike(term),
                Sample.po_number.ilike(term),
                Sample.customer.ilike(term),
                Sample.product.ilike(term),
                Sample.batch_number.ilike(term),
                Sample.cas_no.ilike(term),
                Sample.tracking_number.ilike(term),
            )
        )

    if status:
        query = query.filter(
            Sample.status == status
        )

    if priority:
        query = query.filter(
            Sample.priority == priority
        )

    total = query.count()

    items = (
        query
        .order_by(Sample.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            sample_response(item)
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
def samples_summary(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_view")
    ),
):
    total = (
        db.query(func.count(Sample.id))
        .scalar()
        or 0
    )

    requested = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "Requested"
        )
        .scalar()
        or 0
    )

    preparation = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "In Preparation"
        )
        .scalar()
        or 0
    )

    ready_dispatch = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "Ready for Dispatch"
        )
        .scalar()
        or 0
    )

    dispatched = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "Dispatched"
        )
        .scalar()
        or 0
    )

    received = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "Received"
        )
        .scalar()
        or 0
    )

    testing = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "Testing"
        )
        .scalar()
        or 0
    )

    completed = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.status == "Completed"
        )
        .scalar()
        or 0
    )

    urgent = (
        db.query(func.count(Sample.id))
        .filter(
            Sample.priority == "Urgent"
        )
        .scalar()
        or 0
    )

    return {
        "total": total,
        "requested": requested,
        "preparation": preparation,
        "ready_dispatch": ready_dispatch,
        "dispatched": dispatched,
        "received": received,
        "testing": testing,
        "completed": completed,
        "urgent": urgent,
    }


@router.get(
    "/{sample_id}",
    response_model=SampleOut,
)
def get_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_view")
    ),
):
    item = (
        db.query(Sample)
        .filter(Sample.id == sample_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Sample not found",
        )

    return sample_response(item)


@router.post(
    "",
    response_model=SampleOut,
    status_code=201,
)
def create_sample(
    payload: CreateSampleRequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_create")
    ),
):
    if payload.status not in STATUS_VALUES:
        raise HTTPException(
            status_code=400,
            detail="Invalid sample status",
        )

    if payload.priority not in PRIORITY_VALUES:
        raise HTTPException(
            status_code=400,
            detail="Invalid priority",
        )

    existing = (
        db.query(Sample)
        .filter(
            Sample.sample_number
            == payload.sample_number
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Sample number already exists",
        )

    item = Sample(
        sample_number=payload.sample_number,
        enquiry_id=payload.enquiry_id,
        po_number=payload.po_number,
        customer=payload.customer,
        product=payload.product,
        cas_no=payload.cas_no,
        batch_number=payload.batch_number,
        sample_quantity=payload.sample_quantity,
        unit=payload.unit,
        sample_type=payload.sample_type,
        purpose=payload.purpose,
        status=payload.status,
        priority=payload.priority,
        requested_date=payload.requested_date,
        dispatch_date=payload.dispatch_date,
        received_date=payload.received_date,
        dispatched_to=payload.dispatched_to,
        courier=payload.courier,
        tracking_number=payload.tracking_number,
        owner=payload.owner,
        notes=payload.notes,
    )

    db.add(item)
    db.flush()

    create_audit(
        db,
        current_user,
        "CREATE",
        "Samples",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return sample_response(item)


@router.put(
    "/{sample_id}",
    response_model=SampleOut,
)
def update_sample(
    sample_id: int,
    payload: UpdateSampleRequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_edit")
    ),
):
    item = (
        db.query(Sample)
        .filter(Sample.id == sample_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Sample not found",
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    if (
        "status" in data
        and data["status"] not in STATUS_VALUES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid sample status",
        )

    if (
        "priority" in data
        and data["priority"] not in PRIORITY_VALUES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid priority",
        )

    if "sample_number" in data:
        duplicate = (
            db.query(Sample)
            .filter(
                Sample.sample_number
                == data["sample_number"],
                Sample.id != sample_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Sample number already exists",
            )

    for key, value in data.items():
        setattr(item, key, value)

    create_audit(
        db,
        current_user,
        "UPDATE",
        "Samples",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return sample_response(item)


@router.patch(
    "/{sample_id}/status",
    response_model=SampleOut,
)
def update_sample_status(
    sample_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_edit")
    ),
):
    item = (
        db.query(Sample)
        .filter(Sample.id == sample_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Sample not found",
        )

    if status not in STATUS_VALUES:
        raise HTTPException(
            status_code=400,
            detail="Invalid sample status",
        )

    item.status = status

    if status == "Dispatched" and not item.dispatch_date:
        item.dispatch_date = datetime.now().astimezone()

    if status == "Received" and not item.received_date:
        item.received_date = datetime.now().astimezone()

    create_audit(
        db,
        current_user,
        "STATUS_UPDATE",
        "Samples",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return sample_response(item)


@router.delete("/{sample_id}")
def delete_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Samples", "can_delete")
    ),
):
    item = (
        db.query(Sample)
        .filter(Sample.id == sample_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Sample not found",
        )

    create_audit(
        db,
        current_user,
        "DELETE",
        "Samples",
        item.id,
    )

    db.delete(item)
    db.commit()

    return {
        "message": "Sample deleted successfully"
    }