from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class PermissionOut(BaseModel):
    page: str
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool
    can_approve: bool

class RoleOut(BaseModel):
    id: int
    name: str
    description: str
    permissions: list[PermissionOut]

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    employee_id: str | None
    department: str | None
    phone: str | None
    status: str
    role: RoleOut
    created_at: datetime
    last_login: datetime | None

class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=150)
    employee_id: str | None = None
    department: str | None = None
    phone: str | None = None
    role_name: str



class LeadBase(BaseModel):
    enquiry_id: str = Field(min_length=2, max_length=40)
    customer: str = Field(min_length=2, max_length=180)
    product: str = Field(min_length=2, max_length=180)
    cas_no: str | None = None
    market: str = Field(min_length=2, max_length=30)
    regulatory_path: str | None = None
    tech_pack: str = "Pending"
    quantity_kg: float = Field(default=0, ge=0)
    value_usd: float = Field(default=0, ge=0)
    stage: str = "Lead"
    owner: str | None = None
    next_step: str | None = None
    development: bool = False


class CreateLeadRequest(LeadBase):
    pass


class UpdateLeadRequest(BaseModel):
    customer: str | None = None
    product: str | None = None
    cas_no: str | None = None
    market: str | None = None
    regulatory_path: str | None = None
    tech_pack: str | None = None
    quantity_kg: float | None = Field(default=None, ge=0)
    value_usd: float | None = Field(default=None, ge=0)
    stage: str | None = None
    owner: str | None = None
    next_step: str | None = None
    development: bool | None = None


class LeadOut(LeadBase):
    id: int
    created_at: datetime
    updated_at: datetime


class PurchaseOrderBase(BaseModel):
    po_number: str = Field(min_length=2, max_length=50)
    customer: str = Field(min_length=2, max_length=180)
    product: str = Field(min_length=2, max_length=180)
    cas_no: str | None = None

    quantity_kg: float = Field(
        default=0,
        ge=0,
    )

    value_usd: float = Field(
        default=0,
        ge=0,
    )

    order_date: datetime | None = None
    expected_delivery: datetime | None = None

    status: str = "Confirmed"

    assigned_reactor: str | None = None

    production_status: str = "Not Started"
    qc_status: str = "Pending"
    dispatch_status: str = "Pending"

    owner: str | None = None
    notes: str | None = None


class CreatePurchaseOrderRequest(PurchaseOrderBase):
    pass


class UpdatePurchaseOrderRequest(BaseModel):
    customer: str | None = None
    product: str | None = None
    cas_no: str | None = None

    quantity_kg: float | None = Field(
        default=None,
        ge=0,
    )

    value_usd: float | None = Field(
        default=None,
        ge=0,
    )

    order_date: datetime | None = None
    expected_delivery: datetime | None = None

    status: str | None = None

    assigned_reactor: str | None = None

    production_status: str | None = None
    qc_status: str | None = None
    dispatch_status: str | None = None

    owner: str | None = None
    notes: str | None = None


class PurchaseOrderOut(PurchaseOrderBase):
    id: int
    order_date: datetime
    created_at: datetime
    updated_at: datetime

class ProductionPlanBase(BaseModel):
    plan_number: str = Field(min_length=2, max_length=50)
    po_id: int | None = None
    po_number: str = Field(min_length=2, max_length=50)
    customer: str = Field(min_length=2, max_length=180)
    product: str = Field(min_length=2, max_length=180)
    batch_number: str | None = None
    required_quantity_kg: float = Field(default=0, ge=0)
    planned_quantity_kg: float = Field(default=0, ge=0)
    reactor: str | None = None
    planned_start: datetime | None = None
    target_completion: datetime | None = None
    material_status: str = "Pending"
    planning_status: str = "Draft"
    production_status: str = "Not Started"
    owner: str | None = None
    notes: str | None = None

class CreateProductionPlanRequest(ProductionPlanBase):
    pass

class UpdateProductionPlanRequest(BaseModel):
    plan_number: str | None = Field(default=None, min_length=2, max_length=50)
    po_id: int | None = None
    po_number: str | None = None
    customer: str | None = None
    product: str | None = None
    batch_number: str | None = None
    required_quantity_kg: float | None = Field(default=None, ge=0)
    planned_quantity_kg: float | None = Field(default=None, ge=0)
    reactor: str | None = None
    planned_start: datetime | None = None
    target_completion: datetime | None = None
    material_status: str | None = None
    planning_status: str | None = None
    production_status: str | None = None
    owner: str | None = None
    notes: str | None = None

class ProductionPlanOut(ProductionPlanBase):
    id: int
    created_at: datetime
    updated_at: datetime



class ReactorBase(BaseModel):
    reactor_code: str = Field(min_length=2, max_length=50)
    reactor_name: str = Field(min_length=2, max_length=120)
    capacity_kg: float = Field(default=0, ge=0)
    status: str = "Idle"
    current_batch: str | None = None
    current_po_number: str | None = None
    current_product: str | None = None
    utilization_percent: float = Field(default=0, ge=0, le=100)
    available_from: datetime | None = None
    location: str | None = None
    notes: str | None = None

class CreateReactorRequest(ReactorBase):
    pass

class UpdateReactorRequest(BaseModel):
    reactor_code: str | None = Field(default=None, min_length=2, max_length=50)
    reactor_name: str | None = None
    capacity_kg: float | None = Field(default=None, ge=0)
    status: str | None = None
    current_batch: str | None = None
    current_po_number: str | None = None
    current_product: str | None = None
    utilization_percent: float | None = Field(default=None, ge=0, le=100)
    available_from: datetime | None = None
    location: str | None = None
    notes: str | None = None

class ReactorOut(ReactorBase):
    id: int
    created_at: datetime
    updated_at: datetime

class EquipmentBase(BaseModel):
    equipment_code: str = Field(min_length=2, max_length=50)
    equipment_name: str = Field(min_length=2, max_length=180)
    equipment_type: str = Field(min_length=2, max_length=100)

    location: str | None = None

    capacity: float = Field(default=0, ge=0)
    capacity_unit: str = "kg"

    status: str = "Operational"
    maintenance_status: str = "Up to Date"

    last_maintenance: datetime | None = None
    next_maintenance: datetime | None = None

    utilization_percent: float = Field(
        default=0,
        ge=0,
        le=100
    )

    assigned_reactor: str | None = None

    manufacturer: str | None = None
    serial_number: str | None = None

    notes: str | None = None


class CreateEquipmentRequest(EquipmentBase):
    pass


class UpdateEquipmentRequest(BaseModel):
    equipment_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=50
    )

    equipment_name: str | None = None
    equipment_type: str | None = None
    location: str | None = None

    capacity: float | None = Field(default=None, ge=0)
    capacity_unit: str | None = None

    status: str | None = None
    maintenance_status: str | None = None

    last_maintenance: datetime | None = None
    next_maintenance: datetime | None = None

    utilization_percent: float | None = Field(
        default=None,
        ge=0,
        le=100
    )

    assigned_reactor: str | None = None
    manufacturer: str | None = None
    serial_number: str | None = None
    notes: str | None = None


class EquipmentOut(EquipmentBase):
    id: int
    created_at: datetime
    updated_at: datetime


class StockItemBase(BaseModel):
    material_code: str = Field(
        min_length=2,
        max_length=50
    )

    material_name: str = Field(
        min_length=2,
        max_length=180
    )

    material_type: str = Field(
        min_length=2,
        max_length=100
    )

    batch_number: str | None = None

    quantity: float = Field(
        default=0,
        ge=0
    )

    unit: str = "kg"

    warehouse: str | None = None

    location: str | None = None

    minimum_stock: float = Field(
        default=0,
        ge=0
    )

    reorder_level: float = Field(
        default=0,
        ge=0
    )

    status: str = "Available"

    expiry_date: datetime | None = None

    supplier: str | None = None

    last_received: datetime | None = None

    notes: str | None = None


class CreateStockItemRequest(StockItemBase):
    pass


class UpdateStockItemRequest(BaseModel):
    material_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=50
    )

    material_name: str | None = None

    material_type: str | None = None

    batch_number: str | None = None

    quantity: float | None = Field(
        default=None,
        ge=0
    )

    unit: str | None = None

    warehouse: str | None = None

    location: str | None = None

    minimum_stock: float | None = Field(
        default=None,
        ge=0
    )

    reorder_level: float | None = Field(
        default=None,
        ge=0
    )

    status: str | None = None

    expiry_date: datetime | None = None

    supplier: str | None = None

    last_received: datetime | None = None

    notes: str | None = None


class StockItemOut(StockItemBase):
    id: int
    created_at: datetime
    updated_at: datetime


# ============================================================
# SUPPLY CHAIN SCHEMAS
# ============================================================

class SupplyChainBase(BaseModel):
    shipment_number: str = Field(min_length=2, max_length=50)
    po_number: str | None = None
    customer: str | None = None
    material_name: str = Field(min_length=2, max_length=180)
    material_code: str | None = None
    quantity: float = Field(default=0, ge=0)
    unit: str = "kg"
    source_location: str | None = None
    destination: str | None = None
    carrier: str | None = None
    tracking_number: str | None = None
    transport_mode: str = "Road"
    priority: str = "Normal"
    status: str = "Planned"
    expected_dispatch: datetime | None = None
    expected_delivery: datetime | None = None
    actual_dispatch: datetime | None = None
    actual_delivery: datetime | None = None
    owner: str | None = None
    notes: str | None = None


class CreateSupplyChainRequest(SupplyChainBase):
    pass


class UpdateSupplyChainRequest(BaseModel):
    shipment_number: str | None = Field(
        default=None,
        min_length=2,
        max_length=50
    )
    po_number: str | None = None
    customer: str | None = None
    material_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=180
    )
    material_code: str | None = None
    quantity: float | None = Field(default=None, ge=0)
    unit: str | None = None
    source_location: str | None = None
    destination: str | None = None
    carrier: str | None = None
    tracking_number: str | None = None
    transport_mode: str | None = None
    priority: str | None = None
    status: str | None = None
    expected_dispatch: datetime | None = None
    expected_delivery: datetime | None = None
    actual_dispatch: datetime | None = None
    actual_delivery: datetime | None = None
    owner: str | None = None
    notes: str | None = None


class SupplyChainOut(SupplyChainBase):
    id: int
    created_at: datetime
    updated_at: datetime



# ============================================================
# COA SCHEMAS
# ============================================================

class COABase(BaseModel):
    coa_number: str = Field(min_length=2, max_length=50)
    po_number: str | None = None
    customer: str | None = None
    product: str = Field(min_length=2, max_length=180)
    cas_no: str | None = None
    batch_number: str = Field(min_length=2, max_length=80)
    quantity_kg: float = Field(default=0, ge=0)

    test_status: str = "Pending"
    coa_status: str = "Draft"

    qc_approved: bool = False
    qa_approved: bool = False

    test_date: datetime | None = None
    release_date: datetime | None = None

    tested_by: str | None = None
    approved_by: str | None = None

    document_reference: str | None = None
    remarks: str | None = None


class CreateCOARequest(COABase):
    pass


class UpdateCOARequest(BaseModel):
    coa_number: str | None = Field(
        default=None,
        min_length=2,
        max_length=50
    )
    po_number: str | None = None
    customer: str | None = None
    product: str | None = Field(
        default=None,
        min_length=2,
        max_length=180
    )
    cas_no: str | None = None
    batch_number: str | None = Field(
        default=None,
        min_length=2,
        max_length=80
    )
    quantity_kg: float | None = Field(
        default=None,
        ge=0
    )

    test_status: str | None = None
    coa_status: str | None = None

    qc_approved: bool | None = None
    qa_approved: bool | None = None

    test_date: datetime | None = None
    release_date: datetime | None = None

    tested_by: str | None = None
    approved_by: str | None = None

    document_reference: str | None = None
    remarks: str | None = None


class COAOut(COABase):
    id: int
    created_at: datetime
    updated_at: datetime

# ============================================================
# SAMPLE SCHEMAS
# ============================================================

class SampleBase(BaseModel):
    sample_number: str = Field(min_length=2, max_length=50)
    enquiry_id: str | None = None
    po_number: str | None = None
    customer: str | None = None
    product: str = Field(min_length=2, max_length=180)
    cas_no: str | None = None
    batch_number: str | None = None

    sample_quantity: float = Field(default=0, ge=0)
    unit: str = "g"
    sample_type: str = "Development"
    purpose: str | None = None

    status: str = "Requested"
    priority: str = "Normal"

    requested_date: datetime | None = None
    dispatch_date: datetime | None = None
    received_date: datetime | None = None

    dispatched_to: str | None = None
    courier: str | None = None
    tracking_number: str | None = None

    owner: str | None = None
    notes: str | None = None


class CreateSampleRequest(SampleBase):
    pass


class UpdateSampleRequest(BaseModel):
    sample_number: str | None = Field(
        default=None,
        min_length=2,
        max_length=50
    )
    enquiry_id: str | None = None
    po_number: str | None = None
    customer: str | None = None
    product: str | None = Field(
        default=None,
        min_length=2,
        max_length=180
    )
    cas_no: str | None = None
    batch_number: str | None = None

    sample_quantity: float | None = Field(
        default=None,
        ge=0
    )
    unit: str | None = None
    sample_type: str | None = None
    purpose: str | None = None

    status: str | None = None
    priority: str | None = None

    requested_date: datetime | None = None
    dispatch_date: datetime | None = None
    received_date: datetime | None = None

    dispatched_to: str | None = None
    courier: str | None = None
    tracking_number: str | None = None

    owner: str | None = None
    notes: str | None = None


class SampleOut(SampleBase):
    id: int
    created_at: datetime
    updated_at: datetime



class QuoteBase(BaseModel):
    quote_number: str = Field(min_length=2, max_length=50)

    enquiry_id: str | None = None

    customer: str = Field(min_length=2, max_length=180)

    product: str = Field(min_length=2, max_length=180)

    cas_no: str | None = None

    quantity_kg: float = Field(default=0, ge=0)

    unit_price_usd: float = Field(default=0, ge=0)

    total_value_usd: float = Field(default=0, ge=0)

    currency: str = "USD"

    payment_terms: str | None = None

    delivery_terms: str | None = None

    validity_days: int = Field(default=30, ge=1)

    status: str = "Draft"

    quote_date: datetime | None = None

    valid_until: datetime | None = None

    owner: str | None = None

    notes: str | None = None


class CreateQuoteRequest(QuoteBase):
    pass


class UpdateQuoteRequest(BaseModel):
    quote_number: str | None = Field(
        default=None,
        min_length=2,
        max_length=50,
    )

    enquiry_id: str | None = None
    customer: str | None = None
    product: str | None = None
    cas_no: str | None = None

    quantity_kg: float | None = Field(default=None, ge=0)

    unit_price_usd: float | None = Field(default=None, ge=0)

    total_value_usd: float | None = Field(default=None, ge=0)

    currency: str | None = None

    payment_terms: str | None = None
    delivery_terms: str | None = None

    validity_days: int | None = Field(default=None, ge=1)

    status: str | None = None

    quote_date: datetime | None = None
    valid_until: datetime | None = None

    owner: str | None = None
    notes: str | None = None


class QuoteOut(QuoteBase):
    id: int
    created_at: datetime
    updated_at: datetime


class ProductionBatchBase(BaseModel):
    batch_number: str = Field(min_length=2, max_length=80)
    plan_id: int | None = None
    po_number: str | None = None
    customer: str | None = None
    product: str = Field(min_length=2, max_length=180)
    reactor: str | None = None
    planned_quantity_kg: float = Field(default=0, ge=0)
    produced_quantity_kg: float = Field(default=0, ge=0)
    production_status: str = "Not Started"
    start_time: datetime | None = None
    completion_time: datetime | None = None
    operator: str | None = None
    remarks: str | None = None


class CreateProductionBatchRequest(ProductionBatchBase):
    pass


class UpdateProductionBatchRequest(BaseModel):
    batch_number: str | None = None
    plan_id: int | None = None
    po_number: str | None = None
    customer: str | None = None
    product: str | None = None
    reactor: str | None = None
    planned_quantity_kg: float | None = Field(default=None, ge=0)
    produced_quantity_kg: float | None = Field(default=None, ge=0)
    production_status: str | None = None
    start_time: datetime | None = None
    completion_time: datetime | None = None
    operator: str | None = None
    remarks: str | None = None


class ProductionBatchOut(ProductionBatchBase):
    id: int
    created_at: datetime
    updated_at: datetime