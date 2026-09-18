from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload

from .config import CORS_ORIGINS
from .database import Base, engine, get_db
from .dependencies import get_current_user, require_admin
from .models import AuditLog, Lead, Permission, Role, User ,PurchaseOrder
from .schemas import CreateUserRequest, LoginRequest, LoginResponse, UserOut
from .security import create_access_token, hash_password, verify_password
from .purchase_orders import router as purchase_orders_router
from .ppic import router as ppic_router
from .reactors import router as reactors_router
from .equipment import router as equipment_router
from .stock import router as stock_router
from .supply_chain import router as supply_chain_router
from .leads import router as leads_router
from .coa import router as coa_router
from .samples import router as samples_router
from .quotes import router as quotes_router
from .production import router as production_router
from .user_management import router as user_management_router
from .order_management import router as order_management_router

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

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AXIS API",
    version="1.0.0",
    description="AXIS API — Lead → PO → Plant",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(purchase_orders_router)
app.include_router(leads_router)
app.include_router(ppic_router)
app.include_router(reactors_router)
app.include_router(equipment_router)
app.include_router(stock_router)
app.include_router(supply_chain_router)
app.include_router(coa_router)
app.include_router(samples_router)
app.include_router(quotes_router)
app.include_router(production_router)
app.include_router(user_management_router)
app.include_router(order_management_router)
def role_response(role: Role):
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "permissions": [
            {
                "page": p.page,
                "can_view": p.can_view,
                "can_create": p.can_create,
                "can_edit": p.can_edit,
                "can_delete": p.can_delete,
                "can_approve": p.can_approve,
            }
            for p in role.permissions
        ],
    }

def user_response(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "employee_id": user.employee_id,
        "department": user.department,
        "phone": user.phone,
        "status": user.status,
        "role": role_response(user.role),
        "created_at": user.created_at,
        "last_login": user.last_login,
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "application": "AXIS API"}

@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions))
        .filter(User.email == payload.email.lower())
        .first()
    )

    if (
        not user
        or user.status != "active"
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login = datetime.now(timezone.utc)

    db.add(
        AuditLog(
            user_id=user.id,
            role=user.role.name,
            action="LOGIN",
            entity="auth",
            entity_id=str(user.id),
        )
    )
    db.commit()

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_response(user),
    }

@app.get("/api/auth/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return user_response(user)

@app.get("/api/roles")
def list_roles(db: Session = Depends(get_db), _=Depends(require_admin)):
    return [
        {
            "id": role.id,
            "name": role.name,
            "description": role.description,
        }
        for role in db.query(Role).order_by(Role.id).all()
    ]

@app.get("/api/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions))
        .order_by(User.full_name)
        .all()
    )
    return [user_response(user) for user in users]

@app.post("/api/users", response_model=UserOut)
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    email = payload.email.lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already exists")

    role = db.query(Role).filter(Role.name == payload.role_name).first()

    if not role:
        raise HTTPException(status_code=400, detail="Unknown role")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        employee_id=payload.employee_id,
        department=payload.department,
        phone=payload.phone,
        role_id=role.id,
    )

    db.add(user)
    db.flush()

    db.add(
        AuditLog(
            user_id=admin.id,
            role=admin.role.name,
            action="CREATE_USER",
            entity="user",
            entity_id=str(user.id),
        )
    )

    db.commit()

    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions))
        .filter(User.id == user.id)
        .first()
    )

    return user_response(user)

@app.get("/api/admin/check")
def admin_check(_=Depends(require_admin)):
    return {"authorized": True}
