from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import get_current_user, require_permission
from .models import AuditLog, SupplyChain, COA
from .schemas import (
    CreateSupplyChainRequest,
    SupplyChainOut,
    UpdateSupplyChainRequest,
)


router = APIRouter(
    prefix="/api/supply-chain",
    tags=["Supply Chain"],
)


STATUS_VALUES = [
    "Planned",
    "Ready for Dispatch",
    "Dispatched",
    "In Transit",
    "Delivered",
    "Delayed",
    "Cancelled",
]

PRIORITY_VALUES = [
    "Low",
    "Normal",
    "High",
    "Urgent",
]

TRANSPORT_MODES = [
    "Road",
    "Air",
    "Sea",
    "Rail",
    "Courier",
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


def supply_chain_response(item: SupplyChain) -> dict:
    return {
        "id": item.id,
        "shipment_number": item.shipment_number,
        "po_number": item.po_number,
        "customer": item.customer,
        "material_name": item.material_name,
        "material_code": item.material_code,
        "quantity": float(item.quantity or 0),
        "unit": item.unit,
        "source_location": item.source_location,
        "destination": item.destination,
        "carrier": item.carrier,
        "tracking_number": item.tracking_number,
        "transport_mode": item.transport_mode,
        "priority": item.priority,
        "status": item.status,
        "expected_dispatch": item.expected_dispatch,
        "expected_delivery": item.expected_delivery,
        "actual_dispatch": item.actual_dispatch,
        "actual_delivery": item.actual_delivery,
        "owner": item.owner,
        "notes": item.notes,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get(
    "",
    response_model=dict,
)
def list_supply_chain(
    search: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    transport_mode: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_view")
    ),
):
    query = db.query(SupplyChain)

    if search:
        search_term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                SupplyChain.shipment_number.ilike(search_term),
                SupplyChain.po_number.ilike(search_term),
                SupplyChain.customer.ilike(search_term),
                SupplyChain.material_name.ilike(search_term),
                SupplyChain.material_code.ilike(search_term),
                SupplyChain.carrier.ilike(search_term),
                SupplyChain.tracking_number.ilike(search_term),
                SupplyChain.destination.ilike(search_term),
            )
        )

    if status:
        query = query.filter(SupplyChain.status == status)

    if priority:
        query = query.filter(SupplyChain.priority == priority)

    if transport_mode:
        query = query.filter(
            SupplyChain.transport_mode == transport_mode
        )

    total = query.count()

    items = (
        query
        .order_by(SupplyChain.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            supply_chain_response(item)
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
)
def supply_chain_summary(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_view")
    ),
):
    total_shipments = (
        db.query(func.count(SupplyChain.id))
        .scalar()
        or 0
    )

    total_quantity = (
        db.query(func.coalesce(func.sum(SupplyChain.quantity), 0))
        .scalar()
        or 0
    )

    planned = (
        db.query(func.count(SupplyChain.id))
        .filter(SupplyChain.status == "Planned")
        .scalar()
        or 0
    )

    ready_dispatch = (
        db.query(func.count(SupplyChain.id))
        .filter(
            SupplyChain.status == "Ready for Dispatch"
        )
        .scalar()
        or 0
    )

    in_transit = (
        db.query(func.count(SupplyChain.id))
        .filter(SupplyChain.status == "In Transit")
        .scalar()
        or 0
    )

    delivered = (
        db.query(func.count(SupplyChain.id))
        .filter(SupplyChain.status == "Delivered")
        .scalar()
        or 0
    )

    delayed = (
        db.query(func.count(SupplyChain.id))
        .filter(SupplyChain.status == "Delayed")
        .scalar()
        or 0
    )

    urgent = (
        db.query(func.count(SupplyChain.id))
        .filter(SupplyChain.priority == "Urgent")
        .scalar()
        or 0
    )

    return {
        "total_shipments": total_shipments,
        "total_quantity": float(total_quantity),
        "planned": planned,
        "ready_dispatch": ready_dispatch,
        "in_transit": in_transit,
        "delivered": delivered,
        "delayed": delayed,
        "urgent": urgent,
    }


@router.get(
    "/{shipment_id}",
    response_model=SupplyChainOut,
)
def get_supply_chain(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_view")
    ),
):
    item = (
        db.query(SupplyChain)
        .filter(SupplyChain.id == shipment_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    return supply_chain_response(item)


@router.post(
    "",
    response_model=SupplyChainOut,
    status_code=201,
)
def create_supply_chain(
    payload: CreateSupplyChainRequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_create")
    ),
):
    if payload.status not in STATUS_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(STATUS_VALUES)}",
        )

    if payload.priority not in PRIORITY_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Allowed: {', '.join(PRIORITY_VALUES)}",
        )

    if payload.transport_mode not in TRANSPORT_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transport mode. Allowed: {', '.join(TRANSPORT_MODES)}",
        )

    if not payload.po_number:
        raise HTTPException(status_code=400, detail="PO number is required before creating a shipment")

    released_coa = (
        db.query(COA)
        .filter(
            COA.po_number == payload.po_number,
            COA.coa_status == "Released",
        )
        .first()
    )

    if not released_coa:
        raise HTTPException(
            status_code=400,
            detail="Shipment can only be created after the COA for this PO is Released",
        )

    existing = (
        db.query(SupplyChain)
        .filter(
            SupplyChain.shipment_number
            == payload.shipment_number
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Shipment number already exists",
        )

    item = SupplyChain(
        shipment_number=payload.shipment_number,
        po_number=payload.po_number,
        customer=payload.customer,
        material_name=payload.material_name,
        material_code=payload.material_code,
        quantity=payload.quantity,
        unit=payload.unit,
        source_location=payload.source_location,
        destination=payload.destination,
        carrier=payload.carrier,
        tracking_number=payload.tracking_number,
        transport_mode=payload.transport_mode,
        priority=payload.priority,
        status=payload.status,
        expected_dispatch=payload.expected_dispatch,
        expected_delivery=payload.expected_delivery,
        actual_dispatch=payload.actual_dispatch,
        actual_delivery=payload.actual_delivery,
        owner=payload.owner,
        notes=payload.notes,
    )

    db.add(item)
    db.flush()

    create_audit(
        db,
        current_user,
        "CREATE",
        "Supply Chain",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return supply_chain_response(item)


@router.put(
    "/{shipment_id}",
    response_model=SupplyChainOut,
)
def update_supply_chain(
    shipment_id: int,
    payload: UpdateSupplyChainRequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_edit")
    ),
):
    item = (
        db.query(SupplyChain)
        .filter(SupplyChain.id == shipment_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    data = payload.model_dump(
        exclude_unset=True
    )

    if "status" in data and data["status"] not in STATUS_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(STATUS_VALUES)}",
        )

    if "status" in data and data["status"] != item.status:
        allowed_next = {
            "Planned": {"Ready for Dispatch", "Cancelled"},
            "Ready for Dispatch": {"Dispatched", "Cancelled"},
            "Dispatched": {"In Transit", "Delayed", "Cancelled"},
            "In Transit": {"Delivered", "Delayed", "Cancelled"},
            "Delivered": set(),
            "Delayed": {"Ready for Dispatch", "Cancelled"},
            "Cancelled": set(),
        }
        if data["status"] not in allowed_next.get(item.status, set()):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid shipment transition: {item.status} -> {data['status']}",
            )

    if "priority" in data and data["priority"] not in PRIORITY_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid priority. Allowed: {', '.join(PRIORITY_VALUES)}",
        )

    if (
        "transport_mode" in data
        and data["transport_mode"] not in TRANSPORT_MODES
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transport mode. Allowed: {', '.join(TRANSPORT_MODES)}",
        )

    if "shipment_number" in data:
        duplicate = (
            db.query(SupplyChain)
            .filter(
                SupplyChain.shipment_number
                == data["shipment_number"],
                SupplyChain.id != shipment_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Shipment number already exists",
            )

    for key, value in data.items():
        setattr(item, key, value)

    create_audit(
        db,
        current_user,
        "UPDATE",
        "Supply Chain",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return supply_chain_response(item)


@router.patch(
    "/{shipment_id}/status",
    response_model=SupplyChainOut,
)
def update_supply_chain_status(
    shipment_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_edit")
    ),
):
    item = (
        db.query(SupplyChain)
        .filter(SupplyChain.id == shipment_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    if status not in STATUS_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(STATUS_VALUES)}",
        )

    allowed_next = {
        "Planned": {"Ready for Dispatch", "Cancelled"},
        "Ready for Dispatch": {"Dispatched", "Cancelled"},
        "Dispatched": {"In Transit", "Delayed", "Cancelled"},
        "In Transit": {"Delivered", "Delayed", "Cancelled"},
        "Delivered": set(),
        "Delayed": {"Ready for Dispatch", "Cancelled"},
        "Cancelled": set(),
    }

    if status != item.status and status not in allowed_next.get(item.status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid shipment transition: {item.status} -> {status}",
        )

    item.status = status

    if status == "Dispatched" and not item.actual_dispatch:
        item.actual_dispatch = datetime.now().astimezone()

    if status == "Delivered" and not item.actual_delivery:
        item.actual_delivery = datetime.now().astimezone()

    create_audit(
        db,
        current_user,
        "STATUS_UPDATE",
        "Supply Chain",
        item.id,
    )

    db.commit()
    db.refresh(item)

    return supply_chain_response(item)


@router.delete(
    "/{shipment_id}",
)
def delete_supply_chain(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("Supply Chain", "can_delete")
    ),
):
    item = (
        db.query(SupplyChain)
        .filter(SupplyChain.id == shipment_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    create_audit(
        db,
        current_user,
        "DELETE",
        "Supply Chain",
        item.id,
    )

    db.delete(item)
    db.commit()

    return {
        "message": "Shipment deleted successfully"
    }