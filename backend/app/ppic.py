from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from .database import get_db
from .models import ProductionPlan
from .schemas import (
    CreateProductionPlanRequest,
    UpdateProductionPlanRequest,
    ProductionPlanOut,
)
from .dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/ppic", tags=["PPIC"])

PLAN_STATUSES = ["Draft", "Planned", "Released", "Completed", "Cancelled"]
MATERIAL_STATUSES = ["Pending", "Partial", "Ready", "Blocked"]
PRODUCTION_STATUSES = ["Not Started", "Planned", "Running", "Completed", "On Hold"]

def audit(db, user, action, entity_id, details=""):
    try:
        from .models import AuditLog
        db.add(AuditLog(
            user_id=user.id,
            action=action,
            entity_type="ProductionPlan",
            entity_id=str(entity_id),
            details=details,
        ))
    except Exception:
        pass

@router.get("", response_model=dict, dependencies=[Depends(require_permission("PPIC", "can_view"))])
def list_plans(
    search: str | None = Query(None),
    planning_status: str | None = Query(None),
    production_status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(ProductionPlan)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            ProductionPlan.plan_number.ilike(term),
            ProductionPlan.po_number.ilike(term),
            ProductionPlan.customer.ilike(term),
            ProductionPlan.product.ilike(term),
            ProductionPlan.batch_number.ilike(term),
        ))
    if planning_status and planning_status != "All":
        q = q.filter(ProductionPlan.planning_status == planning_status)
    if production_status and production_status != "All":
        q = q.filter(ProductionPlan.production_status == production_status)

    total = q.count()
    items = q.order_by(ProductionPlan.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [ProductionPlanOut.model_validate(x, from_attributes=True) for x in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 0,
    }

@router.get("/summary", response_model=dict, dependencies=[Depends(require_permission("PPIC", "can_view"))])
def summary(db: Session = Depends(get_db)):
    plans = db.query(ProductionPlan).all()
    active = [x for x in plans if x.planning_status != "Cancelled"]
    return {
        "total_plans": len(active),
        "planned_quantity_kg": sum(float(x.planned_quantity_kg or 0) for x in active),
        "draft": sum(x.planning_status == "Draft" for x in active),
        "planned": sum(x.planning_status == "Planned" for x in active),
        "released": sum(x.planning_status == "Released" for x in active),
        "running": sum(x.production_status == "Running" for x in active),
        "material_ready": sum(x.material_status == "Ready" for x in active),
        "material_blocked": sum(x.material_status == "Blocked" for x in active),
    }

@router.get("/{plan_id}", response_model=ProductionPlanOut, dependencies=[Depends(require_permission("PPIC", "can_view"))])
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    item = db.get(ProductionPlan, plan_id)
    if not item:
        raise HTTPException(404, "Production plan not found")
    return item

@router.post("", response_model=ProductionPlanOut, dependencies=[Depends(require_permission("PPIC", "can_create"))])
def create_plan(payload: CreateProductionPlanRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if db.query(ProductionPlan).filter(ProductionPlan.plan_number == payload.plan_number).first():
        raise HTTPException(409, "Plan number already exists")
    item = ProductionPlan(**payload.model_dump(exclude_none=True))
    db.add(item)
    db.commit()
    db.refresh(item)
    audit(db, user, "CREATE", item.id, item.plan_number)
    db.commit()
    return item

@router.put("/{plan_id}", response_model=ProductionPlanOut, dependencies=[Depends(require_permission("PPIC", "can_edit"))])
def update_plan(plan_id: int, payload: UpdateProductionPlanRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.get(ProductionPlan, plan_id)
    if not item:
        raise HTTPException(404, "Production plan not found")
    data = payload.model_dump(exclude_unset=True)
    if "plan_number" in data and data["plan_number"] != item.plan_number:
        exists = db.query(ProductionPlan).filter(
            ProductionPlan.plan_number == data["plan_number"],
            ProductionPlan.id != plan_id
        ).first()
        if exists:
            raise HTTPException(409, "Plan number already exists")
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    audit(db, user, "UPDATE", item.id, item.plan_number)
    db.commit()
    return item

@router.patch("/{plan_id}/status", response_model=ProductionPlanOut, dependencies=[Depends(require_permission("PPIC", "can_edit"))])
def update_plan_status(plan_id: int, status: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if status not in PLAN_STATUSES:
        raise HTTPException(400, f"Invalid planning status. Allowed: {', '.join(PLAN_STATUSES)}")
    item = db.get(ProductionPlan, plan_id)
    if not item:
        raise HTTPException(404, "Production plan not found")
    item.planning_status = status
    db.commit()
    db.refresh(item)
    audit(db, user, "STATUS", item.id, status)
    db.commit()
    return item

@router.delete("/{plan_id}", dependencies=[Depends(require_permission("PPIC", "can_delete"))])
def delete_plan(plan_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.get(ProductionPlan, plan_id)
    if not item:
        raise HTTPException(404, "Production plan not found")
    db.delete(item)
    db.commit()
    audit(db, user, "DELETE", plan_id, "")
    db.commit()
    return {"message": "Production plan deleted"}

