# AXIS API — Phase 1

Custom source-code implementation. No Lovable dependency.

Phase 1 includes:
- React + TypeScript + Vite
- React Router
- FastAPI
- PostgreSQL
- SQLAlchemy
- JWT authentication
- bcrypt/passlib password hashing
- centralized role/permission configuration
- backend authorization
- responsive desktop/mobile sidebar
- seven roles
- development role-switcher
- protected routes
- admin user-management foundation

## Requirements

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+ OR Docker

## Start PostgreSQL with Docker

From the project root:

```bash
docker compose up -d db
```

## Backend

Windows:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

FastAPI docs:
http://127.0.0.1:8000/docs

## Sample Management

The Sample Management development changes use the existing
`commercial.customer_sample`, `quality.sample`, `quality.test_request`, and
`quality.test_attempt` tables through `/api/sample-management`. The Customer
Requests, Quality Samples, and Tests Pending views remain separate, with
commercial requests traceable through the Quality and test views.

Quality samples link to commercial requests using the existing
`quality.sample.customer_sample_id` foreign key. The registration form sends
the selected commercial `sample_id` as `p_customer_sample_id` (a UUID), not as
a sample number. The backend invokes `quality.create_sample` with the
authenticated AXIS identity and a request ID. The database function generates
the Quality sample number and enforces product/request matching, approved
sample types, and the requirement to select exactly one batch or material lot.
The existing database row-audit trigger records Quality sample writes.

The sample type options are loaded from the active, approved database catalog;
the application does not invent values. At the time these development changes
were checked, that catalog had no active approved entries, so Quality must
approve a sample type before a sample can be registered. The API registry
entry `QUALITY.CREATE_SAMPLE` also remains `DRAFT`; it was not activated.
Customer receipt/tracking details and test review/retest data are not included
because their approved contracts are not available in the current development
scope.

## Frontend

Open a second terminal:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

macOS/Linux:

```bash
cp .env.example .env
npm run dev
```

Open:
http://localhost:5173

## Development accounts

| Role | Email | Password |
|---|---|---|
| Plant Head / Admin | admin@axis.local | Admin@123 |
| Managing Director | md@axis.local | Demo@123 |
| Sales & Marketing | sales@axis.local | Demo@123 |
| QC / QA | qc@axis.local | Demo@123 |
| PPIC Planner | ppic@axis.local | Demo@123 |
| Production / Plant | production@axis.local | Demo@123 |
| Stores & Supply Chain | stores@axis.local | Demo@123 |

These credentials are development-only.

## Phase 1 acceptance test

1. Login with Admin.
2. Confirm all navigation groups appear.
3. Open User Management.
4. Log out.
5. Login as Sales.
6. Confirm plant/material modules are hidden.
7. Directly open `/reactors`; it must show Access Denied.
8. Use the development role selector and switch to another role.
9. Confirm navigation recalculates.
10. Resize browser below 800px and confirm sidebar becomes a drawer.
