from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint,Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(255), default="")

    users = relationship("User", back_populates="role")
    permissions = relationship(
        "Permission",
        back_populates="role",
        cascade="all, delete-orphan",
    )

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    employee_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    department: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="active")
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    role = relationship("Role", back_populates="users")

class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    page: Mapped[str] = mapped_column(String(100))
    can_view: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    can_approve: Mapped[bool] = mapped_column(Boolean, default=False)

    role = relationship("Role", back_populates="permissions")

    __table_args__ = (
        UniqueConstraint("role_id", "page", name="uq_role_page"),
    )

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(80))
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    enquiry_id: Mapped[str] = mapped_column(
        String(40),
        unique=True,
        index=True,
    )

    customer: Mapped[str] = mapped_column(String(180), index=True)

    product: Mapped[str] = mapped_column(String(180), index=True)

    cas_no: Mapped[str | None] = mapped_column(String(40))

    market: Mapped[str] = mapped_column(String(30), index=True)

    regulatory_path: Mapped[str | None] = mapped_column(String(180))

    tech_pack: Mapped[str] = mapped_column(
        String(30),
        default="Pending",
    )

    quantity_kg: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    value_usd: Mapped[float] = mapped_column(
        Numeric(14, 2),
        default=0,
    )

    stage: Mapped[str] = mapped_column(
        String(40),
        default="Lead",
        index=True,
    )

    owner: Mapped[str | None] = mapped_column(String(120))

    next_step: Mapped[str | None] = mapped_column(String(255))

    development: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    po_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
    )

    customer: Mapped[str] = mapped_column(
        String(180),
        index=True,
    )

    product: Mapped[str] = mapped_column(
        String(180),
        index=True,
    )

    cas_no: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
    )

    quantity_kg: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    value_usd: Mapped[float] = mapped_column(
        Numeric(14, 2),
        default=0,
    )

    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    expected_delivery: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="Confirmed",
        index=True,
    )

    assigned_reactor: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    production_status: Mapped[str] = mapped_column(
        String(50),
        default="Not Started",
    )

    qc_status: Mapped[str] = mapped_column(
        String(50),
        default="Pending",
    )

    dispatch_status: Mapped[str] = mapped_column(
        String(50),
        default="Pending",
    )

    owner: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class ProductionPlan(Base):
    __tablename__ = "production_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    po_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True, index=True)
    po_number: Mapped[str] = mapped_column(String(50), index=True)
    customer: Mapped[str] = mapped_column(String(180), index=True)
    product: Mapped[str] = mapped_column(String(180), index=True)
    batch_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    required_quantity_kg: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    planned_quantity_kg: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    reactor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    planned_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_completion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    material_status: Mapped[str] = mapped_column(String(50), default="Pending")
    planning_status: Mapped[str] = mapped_column(String(50), default="Draft", index=True)
    production_status: Mapped[str] = mapped_column(String(50), default="Not Started", index=True)
    owner: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Reactor(Base):
    __tablename__ = "reactors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reactor_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )
    reactor_name: Mapped[str] = mapped_column(String(120))
    capacity_kg: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(
        String(50), default="Idle", index=True
    )
    current_batch: Mapped[str | None] = mapped_column(
        String(80), nullable=True
    )
    current_po_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    current_product: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )
    utilization_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0
    )
    available_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    location: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )

class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )
    equipment_name: Mapped[str] = mapped_column(String(180), index=True)
    equipment_type: Mapped[str] = mapped_column(String(100), index=True)

    location: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    capacity: Mapped[float] = mapped_column(
        Numeric(12, 2), default=0
    )

    capacity_unit: Mapped[str] = mapped_column(
        String(30), default="kg"
    )

    status: Mapped[str] = mapped_column(
        String(50), default="Operational", index=True
    )

    maintenance_status: Mapped[str] = mapped_column(
        String(50), default="Up to Date", index=True
    )

    last_maintenance: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    next_maintenance: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    utilization_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), default=0
    )

    assigned_reactor: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    manufacturer: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    serial_number: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )


class StockItem(Base):
    __tablename__ = "stock_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    material_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )

    material_name: Mapped[str] = mapped_column(
        String(180), index=True
    )

    material_type: Mapped[str] = mapped_column(
        String(100), index=True
    )

    batch_number: Mapped[str | None] = mapped_column(
        String(80), nullable=True, index=True
    )

    quantity: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )

    unit: Mapped[str] = mapped_column(
        String(30), default="kg"
    )

    warehouse: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    location: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    minimum_stock: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )

    reorder_level: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )

    status: Mapped[str] = mapped_column(
        String(50), default="Available", index=True
    )

    expiry_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    supplier: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    last_received: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )

class SupplyChain(Base):
    __tablename__ = "supply_chain"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    shipment_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )

    po_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    customer: Mapped[str | None] = mapped_column(
        String(180), nullable=True, index=True
    )

    material_name: Mapped[str] = mapped_column(
        String(180), index=True
    )

    material_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    quantity: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )

    unit: Mapped[str] = mapped_column(
        String(30), default="kg"
    )

    source_location: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    destination: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    carrier: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    tracking_number: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    transport_mode: Mapped[str] = mapped_column(
        String(50), default="Road"
    )

    priority: Mapped[str] = mapped_column(
        String(30), default="Normal", index=True
    )

    status: Mapped[str] = mapped_column(
        String(50), default="Planned", index=True
    )

    expected_dispatch: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    expected_delivery: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    actual_dispatch: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    actual_delivery: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    owner: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )
class COA(Base):
    __tablename__ = "coas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    coa_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )

    po_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    customer: Mapped[str | None] = mapped_column(
        String(180), nullable=True, index=True
    )

    product: Mapped[str] = mapped_column(
        String(180), index=True
    )

    cas_no: Mapped[str | None] = mapped_column(
        String(40), nullable=True
    )

    batch_number: Mapped[str] = mapped_column(
        String(80), index=True
    )

    quantity_kg: Mapped[float] = mapped_column(
        Numeric(12, 2), default=0
    )

    test_status: Mapped[str] = mapped_column(
        String(50), default="Pending", index=True
    )

    coa_status: Mapped[str] = mapped_column(
        String(50), default="Draft", index=True
    )

    qc_approved: Mapped[bool] = mapped_column(
        Boolean, default=False
    )

    qa_approved: Mapped[bool] = mapped_column(
        Boolean, default=False
    )

    test_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    release_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tested_by: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    approved_by: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    document_reference: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    remarks: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )

class Sample(Base):
    __tablename__ = "samples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    sample_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )

    enquiry_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    po_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    customer: Mapped[str | None] = mapped_column(
        String(180), nullable=True, index=True
    )

    product: Mapped[str] = mapped_column(
        String(180), index=True
    )

    cas_no: Mapped[str | None] = mapped_column(
        String(40), nullable=True
    )

    batch_number: Mapped[str | None] = mapped_column(
        String(80), nullable=True
    )

    sample_quantity: Mapped[float] = mapped_column(
        Numeric(12, 2), default=0
    )

    unit: Mapped[str] = mapped_column(
        String(30), default="g"
    )

    sample_type: Mapped[str] = mapped_column(
        String(80), default="Development"
    )

    purpose: Mapped[str | None] = mapped_column(
        String(300), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(50), default="Requested", index=True
    )

    priority: Mapped[str] = mapped_column(
        String(30), default="Normal", index=True
    )

    requested_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    dispatch_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    received_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    dispatched_to: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    courier: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    tracking_number: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    owner: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )

class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)

    enquiry_id: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    customer: Mapped[str] = mapped_column(String(180), index=True)
    product: Mapped[str] = mapped_column(String(180), index=True)
    cas_no: Mapped[str | None] = mapped_column(String(40), nullable=True)

    quantity_kg: Mapped[float] = mapped_column(
        Numeric(12, 2), default=0
    )

    unit_price_usd: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )

    total_value_usd: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )

    currency: Mapped[str] = mapped_column(
        String(10), default="USD"
    )

    payment_terms: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    delivery_terms: Mapped[str | None] = mapped_column(
        String(180), nullable=True
    )

    validity_days: Mapped[int] = mapped_column(
        Integer, default=30
    )

    status: Mapped[str] = mapped_column(
        String(50), default="Draft", index=True
    )

    quote_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    owner: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

class ProductionBatch(Base):
    __tablename__ = "production_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    batch_number: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        index=True,
    )

    plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_plans.id"),
        nullable=True,
        index=True,
    )

    po_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    customer: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True,
    )

    product: Mapped[str] = mapped_column(
        String(180),
        index=True,
    )

    reactor: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    planned_quantity_kg: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    produced_quantity_kg: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
    )

    production_status: Mapped[str] = mapped_column(
        String(50),
        default="Not Started",
        index=True,
    )

    start_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completion_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    operator: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )