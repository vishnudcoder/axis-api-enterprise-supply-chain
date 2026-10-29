from datetime import datetime

from pydantic import BaseModel


class SupabasePermissionOut(BaseModel):
    page: str
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_approve: bool = False


class SupabaseRoleOut(BaseModel):
    id: str
    name: str
    description: str = ""
    permissions: list[SupabasePermissionOut] = []


class SupabaseUserOut(BaseModel):
    id: str
    email: str
    full_name: str
    employee_id: str | None = None
    department: str | None = None
    phone: str | None = None
    status: str = "active"
    role: SupabaseRoleOut
    created_at: datetime | None = None
    last_login: datetime | None = None


class SupabaseLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: SupabaseUserOut
