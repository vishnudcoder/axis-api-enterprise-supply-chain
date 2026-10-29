from uuid import UUID, uuid4
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .supabase_authorization import require_axis_permission
from .supabase_client import supabase

router = APIRouter(prefix="/api/leads", tags=["Commercial Leads"])


def rpc(name: str, params: dict[str, Any]) -> Any:
    try:
        result = supabase.schema("commercial").rpc(name, params).execute()
        return result.data
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Commercial workflow '{name}' failed: {str(exc)}",
        ) from exc


class LeadCreate(BaseModel):
    lead_number: str = Field(min_length=1, max_length=100)
    lead_status: str = "NEW"
    source: str | None = None
    owner_user_id: UUID | None = None
    opportunity_title: str = Field(min_length=1, max_length=250)
    opportunity_description: str | None = None
    opportunity_value: float | None = Field(default=None, ge=0)
    product_interest: str | None = None
    expected_annual_volume: float | None = Field(default=None, ge=0)
    expected_closing_date: str | None = None
    probability: float | None = Field(default=None, ge=0, le=100)
    lead_priority: str | None = None
    market_segment_id: UUID | None = None
    territory: str | None = None
    competitor: str | None = None
    next_action: str | None = None
    expected_customer_decision_date: str | None = None
    customer_id: UUID | None = None


class StatusChange(BaseModel):
    new_status: str = Field(min_length=1, max_length=50)
    reason: str | None = None


class QualificationCreate(BaseModel):
    qualification_checklist: dict[str, Any] = Field(default_factory=dict)
    business_potential: str | None = None
    customer_legitimacy: str | None = None
    product_fit: str | None = None
    regulatory_fit: str | None = None
    commercial_potential: str | None = None
    strategic_importance: str | None = None
    qualification_decision: str | None = None
    decision_maker_user_id: UUID | None = None
    qualification_comments: str | None = None
    rejection_archive_reason: str | None = None
    status: str = "PENDING"
    qualification_date: str | None = None


@router.get("/target-accounts")
def target_accounts(
    search: str | None = Query(default=None, max_length=150),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "VIEW")),
):
    data = rpc("search_target_accounts", {
        "p_search": search,
        "p_status": None,
        "p_market_research_id": None,
        "p_market_segment_id": None,
        "p_limit": limit,
        "p_offset": offset,
    })
    return {"items": data or [], "limit": limit, "offset": offset}


@router.get("")
def list_leads(
    search: str | None = Query(default=None, max_length=150),
    status: str | None = Query(default=None, max_length=50),
    market_segment_id: UUID | None = None,
    owner_user_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "VIEW")),
):
    data = rpc("search_leads", {
        "p_search": search,
        "p_status": status,
        "p_market_segment_id": str(market_segment_id) if market_segment_id else None,
        "p_owner_user_id": str(owner_user_id) if owner_user_id else None,
        "p_limit": limit,
        "p_offset": offset,
    })
    return {"items": data or [], "limit": limit, "offset": offset}


@router.get("/{lead_id}")
def get_lead(
    lead_id: UUID,
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "VIEW")),
):
    data = rpc("get_lead", {"p_lead_id": str(lead_id)})
    if not data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return data


@router.post("", status_code=201)
def create_lead(
    payload: LeadCreate,
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "CREATE")),
):
    values = payload.model_dump()
    values["owner_user_id"] = (
        str(values["owner_user_id"]) if values["owner_user_id"] else None
    )
    values["market_segment_id"] = (
        str(values["market_segment_id"]) if values["market_segment_id"] else None
    )
    values["customer_id"] = (
        str(values["customer_id"]) if values["customer_id"] else None
    )
    params = {"p_" + key: value for key, value in values.items()}
    params["p_request_id"] = str(uuid4())
    return rpc("create_lead", params)


@router.post("/{lead_id}/qualification", status_code=201)
def create_qualification(
    lead_id: UUID,
    payload: QualificationCreate,
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "SUBMIT")),
):
    values = payload.model_dump()
    values["decision_maker_user_id"] = (
        str(values["decision_maker_user_id"])
        if values["decision_maker_user_id"] else None
    )
    params = {"p_" + key: value for key, value in values.items()}
    params["p_lead_id"] = str(lead_id)
    params["p_request_id"] = str(uuid4())
    return rpc("create_lead_qualification", params)


@router.patch("/{lead_id}/status")
def transition_status(
    lead_id: UUID,
    payload: StatusChange,
    identity=Depends(require_axis_permission("COMMERCIAL_ENQUIRY", "SUBMIT")),
):
    return rpc("transition_lead_status", {
        "p_lead_id": str(lead_id),
        "p_new_status": payload.new_status,
        "p_reason": payload.reason,
        "p_request_id": str(uuid4()),
    })
