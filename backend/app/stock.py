from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import get_current_user, require_permission
from .models import AuditLog, StockItem
from .schemas import (
    CreateStockItemRequest,
    StockItemOut,
    UpdateStockItemRequest,
)


router = APIRouter(
    prefix="/api/stock",
    tags=["Stock Management"],
)


STOCK_STATUSES = [
    "Available",
    "Low Stock",
    "Out of Stock",
    "Reserved",
    "Blocked",
    "Expired",
]


def utcnow():
    return datetime.now(timezone.utc)


def stock_response(item: StockItem):
    return {
        "id": item.id,
        "material_code": item.material_code,
        "material_name": item.material_name,
        "material_type": item.material_type,
        "batch_number": item.batch_number,
        "quantity": float(item.quantity or 0),
        "unit": item.unit,
        "warehouse": item.warehouse,
        "location": item.location,
        "minimum_stock": float(item.minimum_stock or 0),
        "reorder_level": float(item.reorder_level or 0),
        "status": item.status,
        "expiry_date": item.expiry_date,
        "supplier": item.supplier,
        "last_received": item.last_received,
        "notes": item.notes,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


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


@router.get(
    "",
    response_model=dict,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_view",
            )
        )
    ],
)
def list_stock(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    material_type: str | None = Query(default=None),
    warehouse: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    query = db.query(StockItem)

    if search:
        pattern = f"%{search.strip()}%"

        query = query.filter(
            or_(
                StockItem.material_code.ilike(pattern),
                StockItem.material_name.ilike(pattern),
                StockItem.material_type.ilike(pattern),
                StockItem.batch_number.ilike(pattern),
                StockItem.supplier.ilike(pattern),
            )
        )

    if status:
        query = query.filter(
            StockItem.status == status
        )

    if material_type:
        query = query.filter(
            StockItem.material_type == material_type
        )

    if warehouse:
        query = query.filter(
            StockItem.warehouse == warehouse
        )

    total = query.count()

    items = (
        query.order_by(
            StockItem.updated_at.desc()
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            stock_response(item)
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


@router.get(
    "/summary",
    response_model=dict,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_view",
            )
        )
    ],
)
def stock_summary(
    db: Session = Depends(get_db),
):
    total_items = db.query(
        func.count(StockItem.id)
    ).scalar() or 0

    total_quantity = db.query(
        func.coalesce(
            func.sum(StockItem.quantity),
            0,
        )
    ).scalar() or 0

    low_stock = db.query(
        func.count(StockItem.id)
    ).filter(
        StockItem.quantity <= StockItem.reorder_level,
        StockItem.quantity > 0,
    ).scalar() or 0

    out_of_stock = db.query(
        func.count(StockItem.id)
    ).filter(
        StockItem.quantity <= 0
    ).scalar() or 0

    blocked = db.query(
        func.count(StockItem.id)
    ).filter(
        StockItem.status == "Blocked"
    ).scalar() or 0

    expired = db.query(
        func.count(StockItem.id)
    ).filter(
        StockItem.status == "Expired"
    ).scalar() or 0

    return {
        "total_items": total_items,
        "total_quantity": float(total_quantity),
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "blocked": blocked,
        "expired": expired,
    }


@router.get(
    "/{stock_id}",
    response_model=StockItemOut,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_view",
            )
        )
    ],
)
def get_stock(
    stock_id: int,
    db: Session = Depends(get_db),
):
    item = db.get(StockItem, stock_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Stock item not found",
        )

    return stock_response(item)


@router.post(
    "",
    response_model=StockItemOut,
    status_code=201,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_create",
            )
        )
    ],
)
def create_stock(
    payload: CreateStockItemRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    existing = (
        db.query(StockItem)
        .filter(
            StockItem.material_code
            == payload.material_code
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Material code already exists",
        )

    item = StockItem(
        **payload.model_dump()
    )

    db.add(item)
    db.flush()

    create_audit(
        db,
        user,
        "CREATE",
        item.id,
        f"Created stock item {item.material_code}",
    )

    db.commit()
    db.refresh(item)

    return stock_response(item)


@router.put(
    "/{stock_id}",
    response_model=StockItemOut,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_edit",
            )
        )
    ],
)
def update_stock(
    stock_id: int,
    payload: UpdateStockItemRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    item = db.get(StockItem, stock_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Stock item not found",
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    if "material_code" in data:
        duplicate = (
            db.query(StockItem)
            .filter(
                StockItem.material_code
                == data["material_code"],
                StockItem.id != stock_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Material code already exists",
            )

    for key, value in data.items():
        setattr(item, key, value)

    item.updated_at = utcnow()

    create_audit(
        db,
        user,
        "UPDATE",
        item.id,
        f"Updated stock item {item.material_code}",
    )

    db.commit()
    db.refresh(item)

    return stock_response(item)


@router.patch(
    "/{stock_id}/status",
    response_model=StockItemOut,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_edit",
            )
        )
    ],
)
def update_stock_status(
    stock_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    item = db.get(StockItem, stock_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Stock item not found",
        )

    status = payload.get("status")

    if status not in STOCK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(STOCK_STATUSES)}",
        )

    item.status = status
    item.updated_at = utcnow()

    create_audit(
        db,
        user,
        "STATUS_CHANGE",
        item.id,
        f"Changed stock status to {status}",
    )

    db.commit()
    db.refresh(item)

    return stock_response(item)


@router.delete(
    "/{stock_id}",
    status_code=204,
    dependencies=[
        Depends(
            require_permission(
                "Stock Management",
                "can_delete",
            )
        )
    ],
)
def delete_stock(
    stock_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    item = db.get(StockItem, stock_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Stock item not found",
        )

    material_code = item.material_code

    create_audit(
        db,
        user,
        "DELETE",
        item.id,
        f"Deleted stock item {material_code}",
    )

    db.delete(item)
    db.commit()

    return None