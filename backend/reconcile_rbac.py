"""
Idempotent RBAC permission reconciliation for AXIS API.

Run from the backend folder:
    .\venv\Scripts\python.exe reconcile_rbac.py

This updates permission rows only. Users and business data are preserved.
"""

from app.database import SessionLocal
from app.models import Role, Permission

RBAC = {
    "Plant Head / Admin": {
        "Dashboard": "all",
        "MD Commercial View": "all",
        "Leads": "all",
        "COA": "all",
        "Samples": "all",
        "Quotes": "all",
        "Purchase Orders": "all",
        "Order Management": "all",
        "PPIC": "all",
        "Production": "all",
        "Reactors": "all",
        "Equipment & Utilities": "all",
        "Stock Management": "all",
        "Supply Chain": "all",
    },

    "Managing Director": {
        "Dashboard": "view",
        "MD Commercial View": "view",
        "Leads": "view",
        "COA": "view",
        "Samples": "view",
        "Quotes": "view",
        "Purchase Orders": "view",
        "Order Management": "view",
        "PPIC": "view",
        "Reactors": "view",
        "Equipment & Utilities": "view",
        "Stock Management": "view",
        "Supply Chain": "view",
    },

    "Sales & Marketing": {
        "Dashboard": "view",
        "Leads": "all",
        "COA": "view",
        "Samples": "all",
        "Quotes": "all",
        "Purchase Orders": "all",
        "Order Management": "view",
    },

    "QC / QA": {
        "Dashboard": "view",
        "COA": "all",
        "Samples": "all",
        "PPIC": "view",
        "Stock Management": "view",
    },

    "PPIC Planner": {
        "Dashboard": "view",
        "Purchase Orders": "view",
        "Order Management": "view",
        "PPIC": "all",
        "Reactors": "all",
        "Stock Management": "view",
        "Supply Chain": "view",
    },

    "Production / Plant": {
        "Dashboard": "view",
        "PPIC": "view",
        "Production": "all",
        "Reactors": "all",
        "Equipment & Utilities": "all",
    },

    "Stores & Supply Chain": {
        "Dashboard": "view",
        "Purchase Orders": "view",
        "Order Management": "view",
        "Stock Management": "all",
        "Supply Chain": "all",
    },
}


ALL_FLAGS = (
    "can_view",
    "can_create",
    "can_edit",
    "can_delete",
    "can_approve",
)


def make_flags(mode: str) -> dict:
    if mode == "all":
        return {
            "can_view": True,
            "can_create": True,
            "can_edit": True,
            "can_delete": True,
            "can_approve": True,
        }

    if mode == "view":
        return {
            "can_view": True,
            "can_create": False,
            "can_edit": False,
            "can_delete": False,
            "can_approve": False,
        }

    raise ValueError(f"Unsupported RBAC mode: {mode}")


def main():
    db = SessionLocal()

    try:
        roles_checked = 0
        rows_created = 0

        for role_name, page_map in RBAC.items():
            role = db.query(Role).filter(Role.name == role_name).first()

            if role is None:
                raise RuntimeError(
                    f'Role "{role_name}" does not exist. Run seed.py first.'
                )

            roles_checked += 1

            existing = {
                permission.page: permission
                for permission in db.query(Permission)
                .filter(Permission.role_id == role.id)
                .all()
            }

            for page, mode in page_map.items():
                desired = make_flags(mode)
                permission = existing.get(page)

                if permission is None:
                    db.add(
                        Permission(
                            role_id=role.id,
                            page=page,
                            **desired,
                        )
                    )
                    rows_created += 1
                else:
                    for key, value in desired.items():
                        setattr(permission, key, value)

            # Disable stale pages rather than deleting permission rows.
            allowed_pages = set(page_map)

            for page, permission in existing.items():
                if page not in allowed_pages:
                    for key in ALL_FLAGS:
                        setattr(permission, key, False)

        db.commit()

        print()
        print("AXIS API RBAC reconciliation completed successfully.")
        print(f"Roles checked: {roles_checked}")
        print(f"New permission rows: {rows_created}")
        print("Backend RBAC is synchronized with the current Playwright acceptance matrix.")
        print("No users or business records were deleted.")
        print()

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
