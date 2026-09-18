from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .database import get_db
from .models import Reactor
from .schemas import CreateReactorRequest, UpdateReactorRequest, ReactorOut
from .dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/reactors", tags=["Reactors"])

REACTOR_STATUSES = [
    "Idle", "Cleaning", "Charging", "Reaction",
    "Distillation", "Maintenance", "Offline"
]

def audit(db, user, action, entity_id, details=""):
    try:
        from .models import AuditLog
        db.add(AuditLog(
            user_id=user.id,
            action=action,
            entity_type="Reactor",
            entity_id=str(entity_id),
            details=details,
        ))
    except Exception:
        pass

@router.get("", response_model=dict, dependencies=[Depends(require_permission("Reactors", "can_view"))])
def list_reactors(
    search: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Reactor)

    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(
            Reactor.reactor_code.ilike(term),
            Reactor.reactor_name.ilike(term),
            Reactor.current_batch.ilike(term),
            Reactor.current_po_number.ilike(term),
            Reactor.current_product.ilike(term),
            Reactor.location.ilike(term),
        ))

    if status and status != "All":
        q = q.filter(Reactor.status == status)

    total = q.count()
    items = q.order_by(Reactor.id.asc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [ReactorOut.model_validate(x, from_attributes=True) for x in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if total else 0,
    }

@router.get("/summary", response_model=dict, dependencies=[Depends(require_permission("Reactors", "can_view"))])
def summary(db: Session = Depends(get_db)):
    reactors = db.query(Reactor).all()
    return {
        "total": len(reactors),
        "idle": sum(x.status == "Idle" for x in reactors),
        "active": sum(x.status in ["Charging", "Reaction", "Distillation"] for x in reactors),
        "cleaning": sum(x.status == "Cleaning" for x in reactors),
        "maintenance": sum(x.status == "Maintenance" for x in reactors),
        "offline": sum(x.status == "Offline" for x in reactors),
        "engaged": sum(bool(x.current_batch) for x in reactors),
        "average_utilization": round(
            sum(float(x.utilization_percent or 0) for x in reactors) / len(reactors), 1
        ) if reactors else 0,
    }

@router.get("/{reactor_id}", response_model=ReactorOut, dependencies=[Depends(require_permission("Reactors", "can_view"))])
def get_reactor(reactor_id: int, db: Session = Depends(get_db)):
    item = db.get(Reactor, reactor_id)
    if not item:
        raise HTTPException(404, "Reactor not found")
    return item

@router.post("", response_model=ReactorOut, dependencies=[Depends(require_permission("Reactors", "can_create"))])
def create_reactor(payload: CreateReactorRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if payload.status not in REACTOR_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {', '.join(REACTOR_STATUSES)}")
    if db.query(Reactor).filter(Reactor.reactor_code == payload.reactor_code).first():
        raise HTTPException(409, "Reactor code already exists")

    item = Reactor(**payload.model_dump(exclude_none=True))
    db.add(item)
    db.commit()
    db.refresh(item)
    audit(db, user, "CREATE", item.id, item.reactor_code)
    db.commit()
    return item

@router.put("/{reactor_id}", response_model=ReactorOut, dependencies=[Depends(require_permission("Reactors", "can_edit"))])
def update_reactor(
    reactor_id: int,
    payload: UpdateReactorRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    item = db.get(Reactor, reactor_id)
    if not item:
        raise HTTPException(404, "Reactor not found")

    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] not in REACTOR_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {', '.join(REACTOR_STATUSES)}")

    if "reactor_code" in data and data["reactor_code"] != item.reactor_code:
        exists = db.query(Reactor).filter(
            Reactor.reactor_code == data["reactor_code"],
            Reactor.id != reactor_id,
        ).first()
        if exists:
            raise HTTPException(409, "Reactor code already exists")

    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    audit(db, user, "UPDATE", item.id, item.reactor_code)
    db.commit()
    return item

@router.patch("/{reactor_id}/status", response_model=ReactorOut, dependencies=[Depends(require_permission("Reactors", "can_edit"))])
def update_status(
    reactor_id: int,
    status: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if status not in REACTOR_STATUSES:
        raise HTTPException(400, f"Invalid status. Allowed: {', '.join(REACTOR_STATUSES)}")

    item = db.get(Reactor, reactor_id)
    if not item:
        raise HTTPException(404, "Reactor not found")

    item.status = status
    db.commit()
    db.refresh(item)
    audit(db, user, "STATUS", item.id, status)
    db.commit()
    return item

@router.delete("/{reactor_id}", dependencies=[Depends(require_permission("Reactors", "can_delete"))])
def delete_reactor(reactor_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.get(Reactor, reactor_id)
    if not item:
        raise HTTPException(404, "Reactor not found")

    db.delete(item)
    db.commit()
    audit(db, user, "DELETE", reactor_id, "")
    db.commit()
    return {"message": "Reactor deleted"}
