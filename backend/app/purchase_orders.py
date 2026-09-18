from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import require_permission
from .models import AuditLog, PurchaseOrder
from .schemas import (
    CreatePurchaseOrderRequest,
    PurchaseOrderOut,
    UpdatePurchaseOrderRequest,
)


router = APIRouter(
    prefix="/api/purchase-orders",
    tags=["Purchase Orders"],
)


STATUSES = [
    "Confirmed",
    "Planning",
    "In Production",
    "QC Release",
    "Ready for Dispatch",
    "Dispatched",
    "Completed",
    "Cancelled",
]

PRODUCTION_STATUSES = [
    "Not Started",
    "Planned",
    "Running",
    "Completed",
]

QC_STATUSES = [
    "Pending",
    "In Testing",
    "Released",
    "Rejected",
]

DISPATCH_STATUSES = [
    "Pending",
    "Ready",
    "Dispatched",
]


def po_response(po: PurchaseOrder):
    return {
        "id": po.id,
        "po_number": po.po_number,
        "customer": po.customer,
        "product": po.product,
        "cas_no": po.cas_no,
        "quantity_kg": float(po.quantity_kg or 0),
        "value_usd": float(po.value_usd or 0),
        "order_date": po.order_date,
        "expected_delivery": po.expected_delivery,
        "status": po.status,
        "assigned_reactor": po.assigned_reactor,
        "production_status": po.production_status,
        "qc_status": po.qc_status,
        "dispatch_status": po.dispatch_status,
        "owner": po.owner,
        "notes": po.notes,
        "created_at": po.created_at,
        "updated_at": po.updated_at,
    }


def create_audit(
    db: Session,
    user,
    action: str,
    po: PurchaseOrder,
):
    db.add(
        AuditLog(
            user_id=user.id,
            role=user.role.name,
            action=action,
            entity="purchase_order",
            entity_id=str(po.id),
        )
    )


@router.get(
    "",
    response_model=list[PurchaseOrderOut],
)
def list_purchase_orders(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(require_permission("Purchase Orders", "can_view")),
):
    query = db.query(PurchaseOrder)

    if search and search.strip():
        search_value = f"%{search.strip()}%"

        query = query.filter(
            PurchaseOrder.po_number.ilike(search_value)
            | PurchaseOrder.customer.ilike(search_value)
            | PurchaseOrder.product.ilike(search_value)
            | PurchaseOrder.owner.ilike(search_value)
        )

    if status and status != "All":
        query = query.filter(
            PurchaseOrder.status == status
        )

    offset = (page - 1) * page_size

    return (
        query
        .order_by(PurchaseOrder.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )


@router.get(
    "/summary",
)
def purchase_order_summary(
    db: Session = Depends(get_db),
    _=Depends(require_permission("Purchase Orders", "can_view")),
):
    orders = db.query(PurchaseOrder).all()

    total_orders = len(orders)

    confirmed_value = sum(
        float(po.value_usd or 0)
        for po in orders
        if po.status != "Cancelled"
    )

    in_production = sum(
        1
        for po in orders
        if po.production_status == "Running"
    )

    qc_pending = sum(
        1
        for po in orders
        if po.qc_status in {"Pending", "In Testing"}
    )

    ready_dispatch = sum(
        1
        for po in orders
        if po.dispatch_status == "Ready"
    )

    status_counts = {}

    for po in orders:
        status_counts[po.status] = (
            status_counts.get(po.status, 0) + 1
        )

    return {
        "total_orders": total_orders,
        "pipeline_value": confirmed_value,
        "in_production": in_production,
        "qc_pending": qc_pending,
        "ready_dispatch": ready_dispatch,
        "status_counts": status_counts,
    }


@router.get(
    "/{po_id}",
    response_model=PurchaseOrderOut,
)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission("Purchase Orders", "can_view")),
):
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id)
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    return po


@router.post(
    "",
    response_model=PurchaseOrderOut,
)
def create_purchase_order(
    payload: CreatePurchaseOrderRequest,
    db: Session = Depends(get_db),
    user=Depends(
        require_permission(
            "Purchase Orders",
            "can_create",
        )
    ),
):
    existing = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.po_number
            == payload.po_number.strip()
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="PO number already exists",
        )

    if payload.status not in STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid PO status. Allowed values: {', '.join(STATUSES)}",
        )

    if payload.production_status not in PRODUCTION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid production status",
        )

    if payload.qc_status not in QC_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid QC status",
        )

    if payload.dispatch_status not in DISPATCH_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid dispatch status",
        )

    po = PurchaseOrder(
        po_number=payload.po_number.strip(),
        customer=payload.customer.strip(),
        product=payload.product.strip(),
        cas_no=payload.cas_no,
        quantity_kg=payload.quantity_kg,
        value_usd=payload.value_usd,
        order_date=payload.order_date
        or datetime.now(timezone.utc),
        expected_delivery=payload.expected_delivery,
        status=payload.status,
        assigned_reactor=payload.assigned_reactor,
        production_status=payload.production_status,
        qc_status=payload.qc_status,
        dispatch_status=payload.dispatch_status,
        owner=payload.owner,
        notes=payload.notes,
    )

    db.add(po)
    db.flush()

    create_audit(
        db,
        user,
        "CREATE_PURCHASE_ORDER",
        po,
    )

    db.commit()
    db.refresh(po)

    return po


@router.put(
    "/{po_id}",
    response_model=PurchaseOrderOut,
)
def update_purchase_order(
    po_id: int,
    payload: UpdatePurchaseOrderRequest,
    db: Session = Depends(get_db),
    user=Depends(
        require_permission(
            "Purchase Orders",
            "can_edit",
        )
    ),
):
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id)
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    if "status" in data and data["status"] not in STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid PO status",
        )

    if (
        "production_status" in data
        and data["production_status"]
        not in PRODUCTION_STATUSES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid production status",
        )

    if (
        "qc_status" in data
        and data["qc_status"]
        not in QC_STATUSES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid QC status",
        )

    if (
        "dispatch_status" in data
        and data["dispatch_status"]
        not in DISPATCH_STATUSES
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid dispatch status",
        )

    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()

        setattr(po, field, value)

    create_audit(
        db,
        user,
        "UPDATE_PURCHASE_ORDER",
        po,
    )

    db.commit()
    db.refresh(po)

    return po


@router.patch(
    "/{po_id}/status",
    response_model=PurchaseOrderOut,
)
def update_purchase_order_status(
    po_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
    user=Depends(
        require_permission(
            "Purchase Orders",
            "can_edit",
        )
    ),
):
    if status not in STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(STATUSES)}",
        )

    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id)
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    po.status = status

    create_audit(
        db,
        user,
        "CHANGE_PO_STATUS",
        po,
    )

    db.commit()
    db.refresh(po)

    return po


@router.delete(
    "/{po_id}",
)
def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    user=Depends(
        require_permission(
            "Purchase Orders",
            "can_delete",
        )
    ),
):
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id)
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    po_number = po.po_number

    create_audit(
        db,
        user,
        "DELETE_PURCHASE_ORDER",
        po,
    )

    db.delete(po)
    db.commit()

    return {
        "message": "Purchase order deleted successfully",
        "po_number": po_number,
    }