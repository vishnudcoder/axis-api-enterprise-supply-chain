from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import require_permission
from .models import ProductionBatch
from .schemas import (
    CreateProductionBatchRequest,
    ProductionBatchOut,
    UpdateProductionBatchRequest,
)

router = APIRouter(
    prefix="/api/production",
    tags=["Production"],
)

PRODUCTION_STATUSES = [
    "Not Started",
    "Running",
    "Paused",
    "Completed",
    "Rejected",
    "Cancelled",
]


def utcnow():
    return datetime.now(timezone.utc)


def batch_response(batch: ProductionBatch) -> ProductionBatchOut:
    return ProductionBatchOut(
        id=batch.id,
        batch_number=batch.batch_number,
        plan_id=batch.plan_id,
        po_number=batch.po_number,
        customer=batch.customer,
        product=batch.product,
        reactor=batch.reactor,
        planned_quantity_kg=float(batch.planned_quantity_kg or 0),
        produced_quantity_kg=float(batch.produced_quantity_kg or 0),
        production_status=batch.production_status,
        start_time=batch.start_time,
        completion_time=batch.completion_time,
        operator=batch.operator,
        remarks=batch.remarks,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )


@router.get(
    "",
    response_model=dict,
    dependencies=[Depends(require_permission("Production", "can_view"))],
)
def list_production_batches(
    search: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(ProductionBatch)

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                ProductionBatch.batch_number.ilike(term),
                ProductionBatch.po_number.ilike(term),
                ProductionBatch.customer.ilike(term),
                ProductionBatch.product.ilike(term),
                ProductionBatch.reactor.ilike(term),
            )
        )

    if status:
        stmt = stmt.where(
            ProductionBatch.production_status == status
        )

    count_stmt = select(
        func.count()
    ).select_from(stmt.subquery())

    total = db.scalar(count_stmt) or 0

    stmt = (
        stmt.order_by(
            ProductionBatch.created_at.desc()
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    batches = db.scalars(stmt).all()

    return {
        "items": [
            batch_response(batch)
            for batch in batches
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get(
    "/summary",
    response_model=dict,
    dependencies=[Depends(require_permission("Production", "can_view"))],
)
def production_summary(
    db: Session = Depends(get_db),
):
    total = db.scalar(
        select(func.count(ProductionBatch.id))
    ) or 0

    running = db.scalar(
        select(func.count(ProductionBatch.id)).where(
            ProductionBatch.production_status == "Running"
        )
    ) or 0

    completed = db.scalar(
        select(func.count(ProductionBatch.id)).where(
            ProductionBatch.production_status == "Completed"
        )
    ) or 0

    not_started = db.scalar(
        select(func.count(ProductionBatch.id)).where(
            ProductionBatch.production_status == "Not Started"
        )
    ) or 0

    return {
        "total_batches": total,
        "running": running,
        "completed": completed,
        "not_started": not_started,
    }


@router.get(
    "/{batch_id}",
    response_model=ProductionBatchOut,
    dependencies=[Depends(require_permission("Production", "can_view"))],
)
def get_production_batch(
    batch_id: int,
    db: Session = Depends(get_db),
):
    batch = db.get(ProductionBatch, batch_id)

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Production batch not found",
        )

    return batch_response(batch)


@router.post(
    "",
    response_model=ProductionBatchOut,
    dependencies=[Depends(require_permission("Production", "can_create"))],
)
def create_production_batch(
    payload: CreateProductionBatchRequest,
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(ProductionBatch).where(
            ProductionBatch.batch_number
            == payload.batch_number
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Batch number already exists",
        )

    batch = ProductionBatch(
        **payload.model_dump()
    )

    db.add(batch)
    db.commit()
    db.refresh(batch)

    return batch_response(batch)


@router.put(
    "/{batch_id}",
    response_model=ProductionBatchOut,
    dependencies=[Depends(require_permission("Production", "can_edit"))],
)
def update_production_batch(
    batch_id: int,
    payload: UpdateProductionBatchRequest,
    db: Session = Depends(get_db),
):
    batch = db.get(ProductionBatch, batch_id)

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Production batch not found",
        )

    data = payload.model_dump(exclude_unset=True)

    if "batch_number" in data:
        duplicate = db.scalar(
            select(ProductionBatch).where(
                ProductionBatch.batch_number
                == data["batch_number"],
                ProductionBatch.id != batch_id,
            )
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Batch number already exists",
            )

    for key, value in data.items():
        setattr(batch, key, value)

    db.commit()
    db.refresh(batch)

    return batch_response(batch)


@router.patch(
    "/{batch_id}/status",
    response_model=ProductionBatchOut,
    dependencies=[Depends(require_permission("Production", "can_edit"))],
)
def change_production_status(
    batch_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
):
    if status not in PRODUCTION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid production status: {status}",
        )

    batch = db.get(ProductionBatch, batch_id)

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Production batch not found",
        )

    batch.production_status = status

    if status == "Running" and not batch.start_time:
        batch.start_time = utcnow()

    if status == "Completed" and not batch.completion_time:
        batch.completion_time = utcnow()

    db.commit()
    db.refresh(batch)

    return batch_response(batch)


@router.delete(
    "/{batch_id}",
    dependencies=[Depends(require_permission("Production", "can_delete"))],
)
def delete_production_batch(
    batch_id: int,
    db: Session = Depends(get_db),
):
    batch = db.get(ProductionBatch, batch_id)

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Production batch not found",
        )

    db.delete(batch)
    db.commit()

    return {
        "message": "Production batch deleted successfully"
    }