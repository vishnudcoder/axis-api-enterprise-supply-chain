from app.database import Base, SessionLocal, engine
from app.models import Permission, Role, User
from app.security import hash_password

Base.metadata.create_all(bind=engine)

ROLE_DESCRIPTIONS = {
    "Plant Head / Admin": "Full access across commercial, plant and logistics",
    "Managing Director": "Executive view of commercial pipeline plus plant and logistics oversight",
    "Sales & Marketing": "Leads, samples, quotes and the order book",
    "QC / QA": "COA, samples and batch release visibility",
    "PPIC Planner": "Production planning, orders and material availability",
    "Production / Plant": "Reactors, equipment and running batches",
    "Stores & Supply Chain": "Stock lots, procurement and dispatch",
}

PAGES = [
    "Dashboard",
    "MD Commercial View",
    "Leads",
    "COA",
    "Samples",
    "Quotes",
    "Purchase Orders",
    "Order Management",
    "PPIC",
    "Reactors",
    "Equipment & Utilities",
    "Stock Management",
    "Supply Chain",
]

ROLE_ACCESS = {
    "Plant Head / Admin": {page: ["view", "create", "edit", "delete", "approve"] for page in PAGES},

    "Managing Director": {
        page: ["view"] for page in PAGES
    },

    "Sales & Marketing": {
        "Dashboard": ["view"],
        "Leads": ["view", "create", "edit"],
        "COA": ["view"],
        "Samples": ["view", "create", "edit"],
        "Quotes": ["view", "create", "edit"],
        "Purchase Orders": ["view"],
        "Order Management": ["view"],
    },

    "QC / QA": {
        "Dashboard": ["view"],
        "COA": ["view", "create", "edit", "approve"],
        "Samples": ["view", "create", "edit", "approve"],
        "PPIC": ["view"],
        "Stock Management": ["view"],
    },

    "PPIC Planner": {
        "Dashboard": ["view"],
        "Purchase Orders": ["view"],
        "Order Management": ["view", "create", "edit"],
        "PPIC": ["view", "create", "edit", "approve"],
        "Reactors": ["view"],
        "Stock Management": ["view"],
        "Supply Chain": ["view"],
    },

    "Production / Plant": {
        "Dashboard": ["view"],
        "PPIC": ["view", "edit"],
        "Reactors": ["view", "create", "edit"],
        "Equipment & Utilities": ["view", "create", "edit"],
    },

    "Stores & Supply Chain": {
        "Dashboard": ["view"],
        "Order Management": ["view", "edit"],
        "Stock Management": ["view", "create", "edit"],
        "Supply Chain": ["view", "create", "edit"],
    },
}

DEMO_USERS = [
    ("admin@axis.local", "Admin@123", "AXIS Administrator", "ADM-001", "Administration", "Plant Head / Admin"),
    ("md@axis.local", "Demo@123", "Managing Director", "MD-001", "Management", "Managing Director"),
    ("sales@axis.local", "Demo@123", "Sales User", "SAL-001", "Commercial", "Sales & Marketing"),
    ("qc@axis.local", "Demo@123", "QC User", "QC-001", "Quality", "QC / QA"),
    ("ppic@axis.local", "Demo@123", "PPIC User", "PPC-001", "PPIC", "PPIC Planner"),
    ("production@axis.local", "Demo@123", "Production User", "PRD-001", "Production", "Production / Plant"),
    ("stores@axis.local", "Demo@123", "Stores User", "STO-001", "Stores", "Stores & Supply Chain"),
]

db = SessionLocal()

for role_name, description in ROLE_DESCRIPTIONS.items():
    role = db.query(Role).filter(Role.name == role_name).first()

    if not role:
        role = Role(name=role_name, description=description)
        db.add(role)
        db.flush()

    # Rebuild phase-1 permission matrix safely.
    db.query(Permission).filter(Permission.role_id == role.id).delete()

    for page, actions in ROLE_ACCESS[role_name].items():
        db.add(
            Permission(
                role_id=role.id,
                page=page,
                can_view="view" in actions,
                can_create="create" in actions,
                can_edit="edit" in actions,
                can_delete="delete" in actions,
                can_approve="approve" in actions,
            )
        )

db.commit()

for email, password, full_name, employee_id, department, role_name in DEMO_USERS:
    if not db.query(User).filter(User.email == email).first():
        role = db.query(Role).filter(Role.name == role_name).first()

        db.add(
            User(
                email=email,
                password_hash=hash_password(password),
                full_name=full_name,
                employee_id=employee_id,
                department=department,
                role_id=role.id,
            )
        )

db.commit()
db.close()

print("AXIS API Phase 1 seed completed.")
