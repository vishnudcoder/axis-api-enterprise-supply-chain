from app.database import Base, engine, SessionLocal
from app.models import Lead


LEADS = [
    {
        "enquiry_id": "ENQ-26081",
        "customer": "Nordwest Pharma GmbH",
        "product": "Sitagliptin Phosphate",
        "cas_no": "654671-77-9",
        "market": "EU",
        "regulatory_path": "EU GMP",
        "tech_pack": "Complete",
        "quantity_kg": 250,
        "value_usd": 186000,
        "stage": "PO Received",
        "owner": "Aarav Mehta",
        "next_step": "PPIC handover",
        "development": False,
    },
    {
        "enquiry_id": "ENQ-26080",
        "customer": "Zenith Formulations",
        "product": "Sitagliptin Phosphate",
        "cas_no": "654671-77-9",
        "market": "US",
        "regulatory_path": "US DMF",
        "tech_pack": "Complete",
        "quantity_kg": 400,
        "value_usd": 310000,
        "stage": "PO Received",
        "owner": "Aarav Mehta",
        "next_step": "Production planning",
        "development": False,
    },
    {
        "enquiry_id": "ENQ-26079",
        "customer": "Meridian Generics",
        "product": "Apixaban",
        "cas_no": "503612-47-3",
        "market": "US",
        "regulatory_path": "US DMF",
        "tech_pack": "Complete",
        "quantity_kg": 180,
        "value_usd": 210000,
        "stage": "Quote Sent",
        "owner": "Priya Shah",
        "next_step": "Await customer confirmation",
        "development": False,
    },
    {
        "enquiry_id": "ENQ-26078",
        "customer": "Kaizen Seiyaku KK",
        "product": "Vildagliptin",
        "cas_no": "274901-16-5",
        "market": "Japan",
        "regulatory_path": "Japan PMDA",
        "tech_pack": "Complete",
        "quantity_kg": 100,
        "value_usd": 91000,
        "stage": "Quote Sent",
        "owner": "Priya Shah",
        "next_step": "Commercial follow-up",
        "development": False,
    },
    {
        "enquiry_id": "ENQ-26077",
        "customer": "Helix Therapeutics",
        "product": "Empagliflozin",
        "cas_no": "864070-44-0",
        "market": "EU",
        "regulatory_path": "EU GMP",
        "tech_pack": "Complete",
        "quantity_kg": 120,
        "value_usd": 98000,
        "stage": "Sample Sent",
        "owner": "Rahul Kumar",
        "next_step": "Customer sample evaluation",
        "development": False,
    },
    {
        "enquiry_id": "ENQ-26076",
        "customer": "NovaCare Labs",
        "product": "Dapagliflozin",
        "cas_no": "461432-26-8",
        "market": "US",
        "regulatory_path": "US DMF",
        "tech_pack": "Pending",
        "quantity_kg": 90,
        "value_usd": 145000,
        "stage": "COA Shared",
        "owner": "Rahul Kumar",
        "next_step": "Complete technical package",
        "development": False,
    },
    {
        "enquiry_id": "ENQ-26075",
        "customer": "Aster BioPharma",
        "product": "Rivaroxaban",
        "cas_no": "366789-02-8",
        "market": "ROW",
        "regulatory_path": "GMP",
        "tech_pack": "Pending",
        "quantity_kg": 75,
        "value_usd": 78000,
        "stage": "Lead",
        "owner": "Neha Rao",
        "next_step": "Share technical pack",
        "development": True,
    },
    {
        "enquiry_id": "ENQ-26074",
        "customer": "Pacific Remedies",
        "product": "Apixaban",
        "cas_no": "503612-47-3",
        "market": "Japan",
        "regulatory_path": "Japan PMDA",
        "tech_pack": "Pending",
        "quantity_kg": 60,
        "value_usd": 195000,
        "stage": "Lead",
        "owner": "Neha Rao",
        "next_step": "Regulatory pathway discussion",
        "development": True,
    },
]


def main():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        added = 0

        for item in LEADS:
            existing = (
                db.query(Lead)
                .filter(Lead.enquiry_id == item["enquiry_id"])
                .first()
            )

            if existing:
                continue

            db.add(Lead(**item))
            added += 1

        db.commit()

        print(f"Leads seeded successfully. Added: {added}")

    finally:
        db.close()


if __name__ == "__main__":
    main()