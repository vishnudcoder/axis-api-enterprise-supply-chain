from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import require_permission
from .models import AuditLog, COA, ProductionBatch, ProductionPlan, PurchaseOrder, SupplyChain

router = APIRouter(
    prefix="/api/order-management",
    tags=["Order Management"],
)

STATUS_VALUES = [
    "Confirmed",
    "Planning",
    "In Production",
    "QC Release",
    "Ready for Dispatch",
    "Dispatched",
    "Completed",
    "Cancelled",
]

STATUS_PROGRESS = {
    "Confirmed": 0,
    "Planning": 20,
    "In Production": 45,
    "QC Release": 65,
    "Ready for Dispatch": 80,
    "Dispatched": 95,
    "Completed": 100,
    "Cancelled": 0,
}

NEXT_ACTIONS = {
    "Confirmed": "Move order to production planning",
    "Planning": "Start production execution",
    "In Production": "Complete production and move to QC",
    "QC Release": "Complete QA/QC release",
    "Ready for Dispatch": "Dispatch the completed order",
    "Dispatched": "Confirm customer delivery",
    "Completed": "Order lifecycle completed",
    "Cancelled": "No further action",
}

ALLOWED_TRANSITIONS = {
    "Confirmed": {"Planning", "Cancelled"},
    "Planning": {"In Production", "Cancelled"},
    "In Production": {"QC Release", "Cancelled"},
    "QC Release": {"Ready for Dispatch", "Cancelled"},
    "Ready for Dispatch": {"Dispatched", "Cancelled"},
    "Dispatched": {"Completed"},
    "Completed": set(),
    "Cancelled": set(),
}


def utcnow():
    return datetime.now(timezone.utc)


def create_audit(db: Session, user, action: str, entity_id: int):
    db.add(
        AuditLog(
            user_id=user.id,
            role=user.role.name if user.role else None,
            action=action,
            entity="Order Management",
            entity_id=str(entity_id),
            timestamp=utcnow(),
        )
    )


def order_response(order: PurchaseOrder) -> dict:
    status = order.status or "Confirmed"
    return {
        "id": order.id,
        "po_number": order.po_number,
        "customer": order.customer,
        "product": order.product,
        "cas_no": order.cas_no,
        "quantity_kg": float(order.quantity_kg or 0),
        "value_usd": float(order.value_usd or 0),
        "order_date": order.order_date,
        "expected_delivery": order.expected_delivery,
        "status": status,
        "assigned_reactor": order.assigned_reactor,
        "production_status": order.production_status,
        "qc_status": order.qc_status,
        "dispatch_status": order.dispatch_status,
        "owner": order.owner,
        "notes": order.notes,
        "progress_percent": STATUS_PROGRESS.get(status, 0),
        "next_action": NEXT_ACTIONS.get(status, "Review order"),
        "created_at": order.created_at,
        "updated_at": order.updated_at,
    }


def apply_filters(query, search: str | None, status: str | None):
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                PurchaseOrder.po_number.ilike(term),
                PurchaseOrder.customer.ilike(term),
                PurchaseOrder.product.ilike(term),
                PurchaseOrder.cas_no.ilike(term),
                PurchaseOrder.assigned_reactor.ilike(term),
                PurchaseOrder.owner.ilike(term),
            )
        )

    if status:
        if status not in STATUS_VALUES:
            raise HTTPException(status_code=400, detail="Invalid order status")
        query = query.filter(PurchaseOrder.status == status)

    return query


@router.get("", response_model=dict)
def list_orders(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Order Management", "can_view")
    ),
):
    query = apply_filters(db.query(PurchaseOrder), search, status)

    total = query.count()

    items = (
        query
        .order_by(PurchaseOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [order_response(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 0,
    }


@router.get("/summary", response_model=dict)
def order_summary(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Order Management", "can_view")
    ),
):
    orders = db.query(PurchaseOrder).all()
    active = [order for order in orders if order.status != "Cancelled"]

    status_counts = {status: 0 for status in STATUS_VALUES}
    for order in orders:
        if order.status in status_counts:
            status_counts[order.status] += 1

    return {
        "total_orders": len(active),
        "total_records": len(orders),
        "order_value_usd": sum(
            float(order.value_usd or 0) for order in active
        ),
        "planning": sum(
            order.status == "Planning" for order in active
        ),
        "in_production": sum(
            order.status == "In Production" for order in active
        ),
        "qc_release": sum(
            order.status == "QC Release" for order in active
        ),
        "ready_for_dispatch": sum(
            order.status == "Ready for Dispatch" for order in active
        ),
        "dispatched": sum(
            order.status == "Dispatched" for order in active
        ),
        "completed": sum(
            order.status == "Completed" for order in active
        ),
        "status_counts": status_counts,
    }


@router.get("/{order_id}", response_model=dict)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Order Management", "can_view")
    ),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return order_response(order)


@router.get("/{order_id}/lifecycle", response_model=dict)
def get_order_lifecycle(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Order Management", "can_view")
    ),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    plans = (
        db.query(ProductionPlan)
        .filter(ProductionPlan.po_number == order.po_number)
        .order_by(ProductionPlan.created_at.desc())
        .all()
    )

    batches = (
        db.query(ProductionBatch)
        .filter(ProductionBatch.po_number == order.po_number)
        .order_by(ProductionBatch.created_at.desc())
        .all()
    )

    coas = (
        db.query(COA)
        .filter(COA.po_number == order.po_number)
        .order_by(COA.created_at.desc())
        .all()
    )

    shipments = (
        db.query(SupplyChain)
        .filter(SupplyChain.po_number == order.po_number)
        .order_by(SupplyChain.created_at.desc())
        .all()
    )

    def plan_item(item):
        return {
            "id": item.id,
            "plan_number": item.plan_number,
            "po_number": item.po_number,
            "customer": item.customer,
            "product": item.product,
            "batch_number": item.batch_number,
            "reactor": item.reactor,
            "required_quantity_kg": float(item.required_quantity_kg or 0),
            "planned_quantity_kg": float(item.planned_quantity_kg or 0),
            "material_status": item.material_status,
            "planning_status": item.planning_status,
            "production_status": item.production_status,
            "planned_start": item.planned_start,
            "target_completion": item.target_completion,
        }

    def batch_item(item):
        return {
            "id": item.id,
            "batch_number": item.batch_number,
            "plan_id": item.plan_id,
            "po_number": item.po_number,
            "customer": item.customer,
            "product": item.product,
            "reactor": item.reactor,
            "planned_quantity_kg": float(item.planned_quantity_kg or 0),
            "produced_quantity_kg": float(item.produced_quantity_kg or 0),
            "production_status": item.production_status,
            "start_time": item.start_time,
            "completion_time": item.completion_time,
            "operator": item.operator,
        }

    def coa_item(item):
        return {
            "id": item.id,
            "coa_number": item.coa_number,
            "po_number": item.po_number,
            "product": item.product,
            "batch_number": item.batch_number,
            "quantity_kg": float(item.quantity_kg or 0),
            "test_status": item.test_status,
            "coa_status": item.coa_status,
            "qc_approved": item.qc_approved,
            "qa_approved": item.qa_approved,
            "test_date": item.test_date,
            "release_date": item.release_date,
        }

    def shipment_item(item):
        return {
            "id": item.id,
            "shipment_number": item.shipment_number,
            "po_number": item.po_number,
            "customer": item.customer,
            "material_name": item.material_name,
            "quantity": float(item.quantity or 0),
            "unit": item.unit,
            "destination": item.destination,
            "carrier": item.carrier,
            "tracking_number": item.tracking_number,
            "status": item.status,
            "expected_delivery": item.expected_delivery,
            "actual_dispatch": item.actual_dispatch,
            "actual_delivery": item.actual_delivery,
        }

    return {
        "order": order_response(order),
        "ppic_plans": [plan_item(item) for item in plans],
        "production_batches": [batch_item(item) for item in batches],
        "coas": [coa_item(item) for item in coas],
        "shipments": [shipment_item(item) for item in shipments],
    }


@router.patch("/{order_id}/status", response_model=dict)
def update_order_status(
    order_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Order Management", "can_edit")
    ),
):
    if status not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid order status")

    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_status = order.status or "Confirmed"

    if status == current_status:
        return order_response(order)

    if status not in ALLOWED_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid order transition: {current_status} → {status}",
        )

    order.status = status

    # Keep the operational sub-status fields aligned with the
    # central order lifecycle without inventing QC/dispatch approvals.
    if status == "Planning":
        order.production_status = "Planned"
    elif status == "In Production":
        order.production_status = "Running"
    elif status == "QC Release":
        order.production_status = "Completed"
        order.qc_status = "In Testing"
    elif status == "Ready for Dispatch":
        order.qc_status = "Approved"
        order.dispatch_status = "Ready"
    elif status == "Dispatched":
        order.dispatch_status = "Dispatched"
    elif status == "Completed":
        order.dispatch_status = "Delivered"

    create_audit(
        db,
        current_user,
        "STATUS_UPDATE",
        order.id,
    )

    db.commit()
    db.refresh(order)

    return order_response(order)
