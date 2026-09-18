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
