from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .database import get_db
from .models import Equipment
from .schemas import (
    CreateEquipmentRequest,
    UpdateEquipmentRequest,
    EquipmentOut,
)
from .dependencies import get_current_user, require_permission


router = APIRouter(
    prefix="/api/equipment",
    tags=["Equipment & Utilities"],
)


EQUIPMENT_STATUSES = [
    "Operational",
    "Standby",
    "Under Maintenance",
    "Breakdown",
    "Offline",
]


MAINTENANCE_STATUSES = [
    "Up to Date",
    "Due Soon",
    "Overdue",
    "In Progress",
]


def equipment_to_dict(equipment: Equipment):
    return {
        "id": equipment.id,
        "equipment_code": equipment.equipment_code,
        "equipment_name": equipment.equipment_name,
        "equipment_type": equipment.equipment_type,
        "location": equipment.location,
        "capacity": float(equipment.capacity or 0),
        "capacity_unit": equipment.capacity_unit,
        "status": equipment.status,
        "maintenance_status": equipment.maintenance_status,
        "last_maintenance": equipment.last_maintenance,
        "next_maintenance": equipment.next_maintenance,
        "utilization_percent": float(
            equipment.utilization_percent or 0
        ),
        "assigned_reactor": equipment.assigned_reactor,
        "manufacturer": equipment.manufacturer,
        "serial_number": equipment.serial_number,
        "notes": equipment.notes,
        "created_at": equipment.created_at,
        "updated_at": equipment.updated_at,
    }


@router.get(
    "",
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_view",
            )
        )
    ],
)
def list_equipment(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    maintenance_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Equipment)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Equipment.equipment_code.ilike(term),
                Equipment.equipment_name.ilike(term),
                Equipment.equipment_type.ilike(term),
                Equipment.location.ilike(term),
                Equipment.assigned_reactor.ilike(term),
                Equipment.manufacturer.ilike(term),
                Equipment.serial_number.ilike(term),
            )
        )

    if status:
        query = query.filter(Equipment.status == status)

    if maintenance_status:
        query = query.filter(
            Equipment.maintenance_status == maintenance_status
        )

    total = query.count()

    items = (
        query.order_by(Equipment.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [equipment_to_dict(item) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/summary",
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_view",
            )
        )
    ],
)
def equipment_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items = db.query(Equipment).all()

    total = len(items)

    operational = sum(
        1 for e in items if e.status == "Operational"
    )

    maintenance = sum(
        1
        for e in items
        if e.status in ["Under Maintenance", "Breakdown"]
    )

    offline = sum(
        1 for e in items if e.status == "Offline"
    )

    overdue = sum(
        1
        for e in items
        if e.maintenance_status == "Overdue"
    )

    due_soon = sum(
        1
        for e in items
        if e.maintenance_status == "Due Soon"
    )

    avg_utilization = (
        sum(float(e.utilization_percent or 0) for e in items)
        / total
        if total
        else 0
    )

    return {
        "total_equipment": total,
        "operational": operational,
        "maintenance": maintenance,
        "offline": offline,
        "maintenance_overdue": overdue,
        "maintenance_due_soon": due_soon,
        "average_utilization": round(avg_utilization, 2),
    }


@router.get(
    "/{equipment_id}",
    response_model=EquipmentOut,
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_view",
            )
        )
    ],
)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    equipment = (
        db.query(Equipment)
        .filter(Equipment.id == equipment_id)
        .first()
    )

    if not equipment:
        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    return equipment


@router.post(
    "",
    response_model=EquipmentOut,
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_create",
            )
        )
    ],
)
def create_equipment(
    payload: CreateEquipmentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing = (
        db.query(Equipment)
        .filter(
            Equipment.equipment_code
            == payload.equipment_code
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Equipment code already exists",
        )

    equipment = Equipment(**payload.model_dump())

    db.add(equipment)
    db.commit()
    db.refresh(equipment)

    return equipment


@router.put(
    "/{equipment_id}",
    response_model=EquipmentOut,
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_edit",
            )
        )
    ],
)
def update_equipment(
    equipment_id: int,
    payload: UpdateEquipmentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    equipment = (
        db.query(Equipment)
        .filter(Equipment.id == equipment_id)
        .first()
    )

    if not equipment:
        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    updates = payload.model_dump(
        exclude_unset=True
    )

    if "equipment_code" in updates:
        duplicate = (
            db.query(Equipment)
            .filter(
                Equipment.equipment_code
                == updates["equipment_code"],
                Equipment.id != equipment_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Equipment code already exists",
            )

    for key, value in updates.items():
        setattr(equipment, key, value)

    db.commit()
    db.refresh(equipment)

    return equipment


@router.patch(
    "/{equipment_id}/status",
    response_model=EquipmentOut,
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_edit",
            )
        )
    ],
)
def update_equipment_status(
    equipment_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if status not in EQUIPMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid equipment status",
        )

    equipment = (
        db.query(Equipment)
        .filter(Equipment.id == equipment_id)
        .first()
    )

    if not equipment:
        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    equipment.status = status

    db.commit()
    db.refresh(equipment)

    return equipment


@router.delete(
    "/{equipment_id}",
    dependencies=[
        Depends(
            require_permission(
                "Equipment & Utilities",
                "can_delete",
            )
        )
    ],
)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    equipment = (
        db.query(Equipment)
        .filter(Equipment.id == equipment_id)
        .first()
    )

    if not equipment:
        raise HTTPException(
            status_code=404,
            detail="Equipment not found",
        )

    db.delete(equipment)
    db.commit()

    return {
        "message": "Equipment deleted successfully"
    }