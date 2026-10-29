from sqlalchemy import text

ACTION_MAP = {
    "VIEW": "can_view",
    "CREATE": "can_create",
    "UPDATE": "can_edit",
    "DELETE": "can_delete",
    "APPROVE": "can_approve",
}

SCREEN_PAGE_MAP = {
    # Commercial
    "COMMERCIAL_CUSTOMER": "Customers",
    "COMMERCIAL_ENQUIRY": "Leads",
    "COMMERCIAL_QUOTE": "Quotes",
    "COMMERCIAL_SALES_ORDER": "Order Management",
    "COMMERCIAL_PO": "Order Management",
    "COMMERCIAL_ACCEPTANCE": "MD Commercial View",
    "COMMERCIAL_CREDIT": "MD Commercial View",
    "COMMERCIAL_FEASIBILITY": "MD Commercial View",
    "COMMERCIAL_REQUIREMENT": "MD Commercial View",
    "COMMERCIAL_DELIVERY": "Supply Chain",
    "COMMERCIAL_SHIPMENT": "Supply Chain",

    # Quality
    "QUALITY_COA": "COA",
    "QUALITY_SAMPLE": "Samples",

    # Procurement and logistics
    "PROCUREMENT_PURCHASE_ORDER": "Purchase Orders",
    "PROCUREMENT_GOODS_RECEIPT": "Supply Chain",
    "PROCUREMENT_SUPPLIER_SHIPMENT": "Supply Chain",

    # Planning and production
    "PPIC_CAPACITY_PLAN": "PPIC",
    "PPIC_DEMAND_REVIEW": "PPIC",
    "PPIC_MPS": "PPIC",
    "PPIC_PRODUCTION_ORDER": "PPIC",
    "PRODUCTION_BATCH": "Production",

    # Inventory
    "INVENTORY_DISPENSE": "Stock Management",
    "INVENTORY_LOT": "Stock Management",
    "INVENTORY_MOVEMENT": "Stock Management",
    "INVENTORY_REPLENISHMENT": "Stock Management",

    # Assets
    "ASSET_REACTOR": "Reactors",
    "ASSET_EQUIPMENT": "Equipment & Utilities",
}


MD_VIEW_ONLY_PAGES = {
    "Dashboard",
    "MD Commercial View",
}


def get_supabase_frontend_permissions(db, role_code: str) -> list[dict]:
    """
    Translate active database grants into frontend permissions.

    Database grants remain authoritative for operational pages.
    Dashboard and MD Commercial View are view-only frontend entries
    for the MANAGING_DIRECTOR role.
    """
    query = text("""
        SELECT
            s.screen_code,
            rs.access_mode,
            p.action_code AS permission_action_code,
            COALESCE(rp.is_active, FALSE) AS role_permission_active
        FROM security.role AS r
        JOIN security.role_screen AS rs
          ON rs.role_id = r.role_id
         AND rs.is_active = TRUE
        JOIN security.screen AS s
          ON s.screen_id = rs.screen_id
         AND s.is_active = TRUE
        LEFT JOIN security.screen_action AS sa
          ON sa.screen_id = s.screen_id
         AND sa.is_active = TRUE
        LEFT JOIN security.permission AS p
          ON p.permission_id = sa.permission_id
         AND p.is_active = TRUE
        LEFT JOIN security.role_permission AS rp
          ON rp.role_id = r.role_id
         AND rp.permission_id = p.permission_id
         AND rp.is_active = TRUE
        WHERE r.role_code = :role_code
          AND r.is_active = TRUE
        ORDER BY s.screen_code, p.action_code
    """)

    pages: dict[str, dict] = {}
    rows = db.execute(
        query,
        {"role_code": role_code},
    ).mappings().all()

    for row in rows:
        page = SCREEN_PAGE_MAP.get(row["screen_code"])

        if not page or row["access_mode"] != "ALLOW":
            continue

        # Customers is allowed only for Commercial and Managing Director.
        if page == "Customers" and role_code not in {
            "COMMERCIAL",
            "MANAGING_DIRECTOR",
        }:
            continue

        if page not in pages:
            pages[page] = {
                "page": page,
                "can_view": False,
                "can_create": False,
                "can_edit": False,
                "can_delete": False,
                "can_approve": False,
            }

        action = row["permission_action_code"]
        flag = ACTION_MAP.get(action)

        # Only active role-permission grants enable an action.
        if flag and row["role_permission_active"] is True:
            pages[page][flag] = True

    # Add view-only navigation entries for the MD.
    # These entries do NOT grant backend API permissions.
    if role_code == "MANAGING_DIRECTOR":
        for page in MD_VIEW_ONLY_PAGES:
            pages.setdefault(
                page,
                {
                    "page": page,
                    "can_view": True,
                    "can_create": False,
                    "can_edit": False,
                    "can_delete": False,
                    "can_approve": False,
                },
            )

    return list(pages.values())
