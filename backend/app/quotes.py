from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import get_current_user, require_permission
from .models import AuditLog, Quote, PurchaseOrder
from .schemas import (
    CreateQuoteRequest,
    UpdateQuoteRequest,
    QuoteOut,
)


router = APIRouter(
    prefix="/api/quotes",
    tags=["Quotes"],
)


STATUS_OPTIONS = [
    "Draft",
    "Sent",
    "Negotiation",
    "Accepted",
    "Rejected",
    "Expired",
    "Converted to PO",
    "Cancelled",
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


def quote_response(quote: Quote):
    return QuoteOut(
        id=quote.id,
        quote_number=quote.quote_number,
        enquiry_id=quote.enquiry_id,
        customer=quote.customer,
        product=quote.product,
        cas_no=quote.cas_no,
        quantity_kg=float(quote.quantity_kg or 0),
        unit_price_usd=float(quote.unit_price_usd or 0),
        total_value_usd=float(quote.total_value_usd or 0),
        currency=quote.currency,
        payment_terms=quote.payment_terms,
        delivery_terms=quote.delivery_terms,
        validity_days=quote.validity_days,
        status=quote.status,
        quote_date=quote.quote_date,
        valid_until=quote.valid_until,
        owner=quote.owner,
        notes=quote.notes,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )


@router.get(
    "",
    response_model=dict,
    dependencies=[Depends(require_permission("Quotes", "can_view"))],
)
def list_quotes(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Quote)

    if search:
        term = f"%{search.strip()}%"

        query = query.filter(
            or_(
                Quote.quote_number.ilike(term),
                Quote.enquiry_id.ilike(term),
                Quote.customer.ilike(term),
                Quote.product.ilike(term),
            )
        )

    if status:
        query = query.filter(Quote.status == status)

    total = query.count()

    quotes = (
        query.order_by(Quote.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [quote_response(q) for q in quotes],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/summary",
    response_model=dict,
    dependencies=[Depends(require_permission("Quotes", "can_view"))],
)
def quote_summary(
    db: Session = Depends(get_db),
):
    quotes = db.query(Quote).all()

    total_value = sum(
        float(q.total_value_usd or 0)
        for q in quotes
    )

    accepted_value = sum(
        float(q.total_value_usd or 0)
        for q in quotes
        if q.status == "Accepted"
    )

    sent = sum(
        1 for q in quotes
        if q.status == "Sent"
    )

    negotiation = sum(
        1 for q in quotes
        if q.status == "Negotiation"
    )

    accepted = sum(
        1 for q in quotes
        if q.status == "Accepted"
    )

    rejected = sum(
        1 for q in quotes
        if q.status == "Rejected"
    )

    converted = sum(
        1 for q in quotes
        if q.status == "Converted to PO"
    )

    return {
        "total_quotes": len(quotes),
        "total_value_usd": total_value,
        "accepted_value_usd": accepted_value,
        "sent": sent,
        "negotiation": negotiation,
        "accepted": accepted,
        "rejected": rejected,
        "converted_to_po": converted,
    }


@router.get(
    "/{quote_id}",
    response_model=QuoteOut,
    dependencies=[Depends(require_permission("Quotes", "can_view"))],
)
def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
):
    quote = db.query(Quote).filter(
        Quote.id == quote_id
    ).first()

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quote not found",
        )

    return quote_response(quote)


@router.post(
    "",
    response_model=QuoteOut,
    dependencies=[Depends(require_permission("Quotes", "can_create"))],
)
def create_quote(
    payload: CreateQuoteRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    existing = db.query(Quote).filter(
        Quote.quote_number == payload.quote_number
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Quote number already exists",
        )

    data = payload.model_dump(exclude_unset=True)

    if not data.get("quote_date"):
        data["quote_date"] = datetime.now(timezone.utc)

    if not data.get("valid_until"):
        data["valid_until"] = (
            data["quote_date"]
            + timedelta(
                days=data.get("validity_days", 30)
            )
        )

    quantity = float(data.get("quantity_kg") or 0)
    unit_price = float(data.get("unit_price_usd") or 0)

    data["total_value_usd"] = (
        quantity * unit_price
    )

    quote = Quote(**data)

    db.add(quote)
    db.flush()

    create_audit(
        db,
        user,
        "CREATE",
        "Quote",
        quote.id,
    )

    db.commit()
    db.refresh(quote)

    return quote_response(quote)


@router.put(
    "/{quote_id}",
    response_model=QuoteOut,
    dependencies=[Depends(require_permission("Quotes", "can_edit"))],
)
def update_quote(
    quote_id: int,
    payload: UpdateQuoteRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    quote = db.query(Quote).filter(
        Quote.id == quote_id
    ).first()

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quote not found",
        )

    data = payload.model_dump(exclude_unset=True)

    if (
        "quote_number" in data
        and data["quote_number"] != quote.quote_number
    ):
        existing = db.query(Quote).filter(
            Quote.quote_number == data["quote_number"],
            Quote.id != quote.id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=409,
                detail="Quote number already exists",
            )

    for key, value in data.items():
        setattr(quote, key, value)

    quantity = float(
        quote.quantity_kg or 0
    )

    unit_price = float(
        quote.unit_price_usd or 0
    )

    quote.total_value_usd = (
        quantity * unit_price
    )

    create_audit(
        db,
        user,
        "UPDATE",
        "Quote",
        quote.id,
    )

    db.commit()
    db.refresh(quote)

    return quote_response(quote)


@router.patch(
    "/{quote_id}/status",
    response_model=QuoteOut,
    dependencies=[Depends(require_permission("Quotes", "can_edit"))],
)
def update_quote_status(
    quote_id: int,
    status: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if status not in STATUS_OPTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(STATUS_OPTIONS)}",
        )

    quote = db.query(Quote).filter(
        Quote.id == quote_id
    ).first()

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quote not found",
        )

    quote.status = status

    create_audit(
        db,
        user,
        "STATUS_CHANGE",
        "Quote",
        quote.id,
    )

    db.commit()
    db.refresh(quote)

    return quote_response(quote)
@router.post(
    "/{quote_id}/convert-to-po",
    response_model=dict,
    dependencies=[Depends(require_permission("Quotes", "can_edit"))],
)
def convert_quote_to_po(
    quote_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    quote = db.query(Quote).filter(
        Quote.id == quote_id
    ).first()

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quote not found",
        )

    if quote.status != "Accepted":
        raise HTTPException(
            status_code=400,
            detail="Only Accepted quotes can be converted to a Purchase Order.",
        )

    # Prevent duplicate conversion
    existing_po = db.query(PurchaseOrder).filter(
        PurchaseOrder.po_number == f"PO-{quote.quote_number}"
    ).first()

    if existing_po:
        raise HTTPException(
            status_code=409,
            detail="This quote has already been converted to a Purchase Order.",
        )

    po = PurchaseOrder(
        po_number=f"PO-{quote.quote_number}",
        customer=quote.customer,
        product=quote.product,
        cas_no=quote.cas_no,
        quantity_kg=quote.quantity_kg,
        value_usd=quote.total_value_usd,
        order_date=datetime.now(timezone.utc),
        expected_delivery=None,
        status="Confirmed",
        production_status="Not Started",
        qc_status="Pending",
        dispatch_status="Pending",
        owner=quote.owner,
        notes=f"Created from Quote {quote.quote_number}",
    )

    db.add(po)

    quote.status = "Converted to PO"

    db.flush()

    create_audit(
        db,
        user,
        "CONVERT_TO_PO",
        "Quote",
        quote.id,
    )

    db.commit()
    db.refresh(po)

    return {
        "message": "Quote converted to Purchase Order successfully.",
        "quote_id": quote.id,
        "quote_number": quote.quote_number,
        "purchase_order_id": po.id,
        "po_number": po.po_number,
    }

@router.delete(
    "/{quote_id}",
    response_model=dict,
    dependencies=[Depends(require_permission("Quotes", "can_delete"))],
)
def delete_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    quote = db.query(Quote).filter(
        Quote.id == quote_id
    ).first()

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quote not found",
        )

    create_audit(
        db,
        user,
        "DELETE",
        "Quote",
        quote.id,
    )

    db.delete(quote)
    db.commit()

    return {
        "message": "Quote deleted successfully"
    }