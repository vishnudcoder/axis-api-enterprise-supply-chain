from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .supabase_authorization import require_axis_permission
from .supabase_dependencies import get_supabase_current_identity
from .business_audit import write_business_audit
from .models import Lead
from .schemas import CreateLeadRequest, UpdateLeadRequest


router = APIRouter(
    prefix="/api/leads",
    tags=["Leads"],
)


# ============================================================
# VALID VALUES
# ============================================================

VALID_STAGES = {
    "Lead",
    "COA Shared",
    "Sample Sent",
    "Quote Sent",
    "PO Received",
}

VALID_MARKETS = {
    "US",
    "EU",
    "Japan",
    "ROW",
}


# ============================================================
# RESPONSE HELPER
# ============================================================

def lead_response(lead: Lead) -> dict:
    """
    Convert SQLAlchemy Lead object into a JSON-friendly dictionary.
    """

    return {
        "id": lead.id,
        "enquiry_id": lead.enquiry_id,
        "customer": lead.customer,
        "product": lead.product,
        "cas_no": lead.cas_no,
        "market": lead.market,
        "regulatory_path": lead.regulatory_path,
        "tech_pack": lead.tech_pack,
        "quantity_kg": float(lead.quantity_kg or 0),
        "value_usd": float(lead.value_usd or 0),
        "stage": lead.stage,
        "owner": lead.owner,
        "next_step": lead.next_step,
        "development": lead.development,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
    }


# ============================================================
# LEADS SUMMARY
# ============================================================
# IMPORTANT:
# This endpoint MUST be before /{lead_id}.
#
# Otherwise:
# /api/leads/summary
# could be interpreted as:
# lead_id = "summary"
# ============================================================

@router.get(
    "/summary",
    response_model=dict,
)
def leads_summary(
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "VIEW")),
):
    """
    Return live Leads statistics for the dashboard.

    Includes:
    - total enquiries
    - pipeline value
    - regulated markets
    - tech-pack pending
    - development enquiries
    - commercial funnel
    """

    leads = (
        db.query(Lead)
        .order_by(Lead.created_at.desc())
        .all()
    )

    # --------------------------------------------------------
    # TOTAL ACTIVE ENQUIRIES
    # --------------------------------------------------------

    total_enquiries = len(leads)

    # --------------------------------------------------------
    # PIPELINE VALUE
    # --------------------------------------------------------

    pipeline_value = sum(
        float(lead.value_usd or 0)
        for lead in leads
    )

    # --------------------------------------------------------
    # REGULATED MARKETS
    #
    # US, EU and Japan are treated as regulated markets.
    # ROW is not counted here.
    # --------------------------------------------------------

    regulated_markets = sum(
        1
        for lead in leads
        if lead.market in {
            "US",
            "EU",
            "Japan",
        }
    )

    # --------------------------------------------------------
    # TECH PACK PENDING
    # --------------------------------------------------------

    tech_pack_pending = sum(
        1
        for lead in leads
        if (lead.tech_pack or "").strip().lower() == "pending"
    )

    # --------------------------------------------------------
    # DEVELOPMENT ENQUIRIES
    # --------------------------------------------------------

    development_enquiries = sum(
        1
        for lead in leads
        if lead.development is True
    )

    # --------------------------------------------------------
    # COMMERCIAL FUNNEL
    # --------------------------------------------------------

    funnel = []

    stages = [
        "Lead",
        "COA Shared",
        "Sample Sent",
        "Quote Sent",
        "PO Received",
    ]

    for stage in stages:

        stage_leads = [
            lead
            for lead in leads
            if lead.stage == stage
        ]

        stage_value = sum(
            float(lead.value_usd or 0)
            for lead in stage_leads
        )

        funnel.append(
            {
                "label": stage,
                "count": len(stage_leads),
                "value": stage_value,
            }
        )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "total_enquiries": total_enquiries,
        "pipeline_value": pipeline_value,
        "regulated_markets": regulated_markets,
        "tech_pack_pending": tech_pack_pending,
        "development_enquiries": development_enquiries,
        "funnel": funnel,
    }


# ============================================================
# LIST LEADS
# ============================================================

@router.get(
    "",
    response_model=list,
)
def list_leads(
    search: str | None = Query(
        default=None,
        description="Search enquiry ID, customer, product or owner",
    ),
    stage: str | None = Query(
        default=None,
        description="Filter by commercial stage",
    ),
    market: str | None = Query(
        default=None,
        description="Filter by market",
    ),
    page: int = Query(
        default=1,
        ge=1,
        description="Page number",
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Number of records per page",
    ),
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "VIEW")),
):
    """
    Return Leads with optional search, stage and market filters.
    """

    query = db.query(Lead)

    # --------------------------------------------------------
    # SEARCH
    # --------------------------------------------------------

    if search and search.strip():

        term = f"%{search.strip()}%"

        query = query.filter(
            Lead.enquiry_id.ilike(term)
            | Lead.customer.ilike(term)
            | Lead.product.ilike(term)
            | Lead.owner.ilike(term)
        )

    # --------------------------------------------------------
    # STAGE FILTER
    # --------------------------------------------------------

    if stage:

        if stage not in VALID_STAGES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid stage. Allowed values: "
                    + ", ".join(sorted(VALID_STAGES))
                ),
            )

        query = query.filter(
            Lead.stage == stage
        )

    # --------------------------------------------------------
    # MARKET FILTER
    # --------------------------------------------------------

    if market:

        if market not in VALID_MARKETS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid market. Allowed values: "
                    + ", ".join(sorted(VALID_MARKETS))
                ),
            )

        query = query.filter(
            Lead.market == market
        )

    # --------------------------------------------------------
    # PAGINATION
    # --------------------------------------------------------

    leads = (
        query
        .order_by(
            Lead.created_at.desc()
        )
        .offset(
            (page - 1) * page_size
        )
        .limit(page_size)
        .all()
    )

    return [
        lead_response(lead)
        for lead in leads
    ]


# ============================================================
# GET SINGLE LEAD
# ============================================================

@router.get(
    "/{lead_id}",
    response_model=dict,
)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "VIEW")),
):
    """
    Return one Lead by database ID.
    """

    lead = (
        db.query(Lead)
        .filter(
            Lead.id == lead_id
        )
        .first()
    )

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    return lead_response(lead)


# ============================================================
# CREATE LEAD
# ============================================================

@router.post(
    "",
    response_model=dict,
    status_code=201,
)
def create_lead(
    payload: CreateLeadRequest,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "CREATE")),
):
    """
    Create a new customer enquiry.
    """

    # --------------------------------------------------------
    # VALIDATE STAGE
    # --------------------------------------------------------

    if payload.stage not in VALID_STAGES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid stage. Allowed: "
                + ", ".join(sorted(VALID_STAGES))
            ),
        )

    # --------------------------------------------------------
    # VALIDATE MARKET
    # --------------------------------------------------------

    if payload.market not in VALID_MARKETS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid market. Allowed: "
                + ", ".join(sorted(VALID_MARKETS))
            ),
        )

    # --------------------------------------------------------
    # CHECK DUPLICATE ENQUIRY ID
    # --------------------------------------------------------

    existing = (
        db.query(Lead)
        .filter(
            Lead.enquiry_id == payload.enquiry_id
        )
        .first()
    )

    if existing:

        raise HTTPException(
            status_code=409,
            detail="Enquiry ID already exists",
        )

    # --------------------------------------------------------
    # CREATE LEAD
    # --------------------------------------------------------

    lead = Lead(
        enquiry_id=payload.enquiry_id,
        customer=payload.customer,
        product=payload.product,
        cas_no=payload.cas_no,
        market=payload.market,
        regulatory_path=payload.regulatory_path,
        tech_pack=payload.tech_pack,
        quantity_kg=payload.quantity_kg,
        value_usd=payload.value_usd,
        stage=payload.stage,
        owner=payload.owner,
        next_step=payload.next_step,
        development=payload.development,
    )

    db.add(lead)

    # Generate database ID
    db.flush()

    # --------------------------------------------------------
    # AUDIT LOG
    # --------------------------------------------------------

    write_business_audit(
        db,
        actor_user_id=identity["user_id"],
        action_code="INSERT",
        record_schema="public",
        record_table="leads",
        record_key={"id": lead.id},
        after_state=lead_response(lead),
        changed_fields=[
            "enquiry_id", "customer", "product", "cas_no", "market",
            "regulatory_path", "tech_pack", "quantity_kg", "value_usd",
            "stage", "owner", "next_step", "development",
        ],
    )

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    db.commit()

    db.refresh(lead)

    return lead_response(lead)


# ============================================================
# UPDATE LEAD
# ============================================================

@router.put(
    "/{lead_id}",
    response_model=dict,
)
def update_lead(
    lead_id: int,
    payload: UpdateLeadRequest,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "UPDATE")),
):
    """
    Update an existing Lead.
    """

    # --------------------------------------------------------
    # FIND LEAD
    # --------------------------------------------------------

    lead = (
        db.query(Lead)
        .filter(
            Lead.id == lead_id
        )
        .first()
    )

    if not lead:

        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    # --------------------------------------------------------
    # GET ONLY PROVIDED FIELDS
    # --------------------------------------------------------

    data = payload.model_dump(
        exclude_unset=True
    )

    # --------------------------------------------------------
    # VALIDATE STAGE
    # --------------------------------------------------------

    if (
        "stage" in data
        and data["stage"] not in VALID_STAGES
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid stage. Allowed: "
                + ", ".join(sorted(VALID_STAGES))
            ),
        )

    # --------------------------------------------------------
    # VALIDATE MARKET
    # --------------------------------------------------------

    if (
        "market" in data
        and data["market"] not in VALID_MARKETS
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid market. Allowed: "
                + ", ".join(sorted(VALID_MARKETS))
            ),
        )

    # --------------------------------------------------------
    # UPDATE FIELDS
    # --------------------------------------------------------

    for field, value in data.items():
        setattr(
            lead,
            field,
            value,
        )

    lead.updated_at = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # AUDIT LOG
    # --------------------------------------------------------

    write_business_audit(
        db,
        actor_user_id=identity["user_id"],
        action_code="UPDATE",
        record_schema="public",
        record_table="leads",
        record_key={"id": lead.id},
        after_state=lead_response(lead),
        changed_fields=list(data.keys()),
    )

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    db.commit()

    db.refresh(lead)

    return lead_response(lead)


# ============================================================
# CHANGE LEAD STAGE
# ============================================================

@router.patch(
    "/{lead_id}/stage",
    response_model=dict,
)
def change_lead_stage(
    lead_id: int,
    stage: str = Query(
        ...,
        description="New commercial stage",
    ),
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "UPDATE")),
):
    """
    Change only the commercial stage of a Lead.
    """

    # --------------------------------------------------------
    # VALIDATE STAGE
    # --------------------------------------------------------

    if stage not in VALID_STAGES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid stage. Allowed: "
                + ", ".join(sorted(VALID_STAGES))
            ),
        )

    # --------------------------------------------------------
    # FIND LEAD
    # --------------------------------------------------------

    lead = (
        db.query(Lead)
        .filter(
            Lead.id == lead_id
        )
        .first()
    )

    if not lead:

        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    # --------------------------------------------------------
    # STORE OLD STAGE
    # --------------------------------------------------------

    old_stage = lead.stage

    # --------------------------------------------------------
    # UPDATE STAGE
    # --------------------------------------------------------

    lead.stage = stage

    lead.updated_at = datetime.now(
        timezone.utc
    )

    # --------------------------------------------------------
    # AUDIT LOG
    # --------------------------------------------------------

    write_business_audit(
        db,
        actor_user_id=identity["user_id"],
        action_code="UPDATE",
        record_schema="public",
        record_table="leads",
        record_key={"id": lead.id},
        before_state={"stage": old_stage},
        after_state={"stage": lead.stage},
        changed_fields=["stage"],
    )

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    db.commit()

    db.refresh(lead)

    return {
        "message": "Lead stage updated",
        "old_stage": old_stage,
        "new_stage": lead.stage,
        "lead": lead_response(lead),
    }


# ============================================================
# DELETE LEAD
# ============================================================

@router.delete(
    "/{lead_id}",
)
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "DELETE")),
):
    """
    Delete a Lead.
    """

    # --------------------------------------------------------
    # FIND LEAD
    # --------------------------------------------------------

    lead = (
        db.query(Lead)
        .filter(
            Lead.id == lead_id
        )
        .first()
    )

    if not lead:

        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    # --------------------------------------------------------
    # AUDIT LOG
    #
    # Store the ID before deleting the SQLAlchemy object.
    # --------------------------------------------------------

    lead_id_string = str(
        lead.id
    )

    write_business_audit(
        db,
        actor_user_id=identity["user_id"],
        action_code="DELETE",
        record_schema="public",
        record_table="leads",
        record_key={"id": lead_id_string},
        before_state=lead_response(lead),
    )

    # --------------------------------------------------------
    # DELETE
    # --------------------------------------------------------

    db.delete(lead)

    # --------------------------------------------------------
    # COMMIT
    # --------------------------------------------------------

    db.commit()

    return {
        "message": "Lead deleted",
        "lead_id": lead_id,
    }