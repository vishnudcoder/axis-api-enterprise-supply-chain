export type Action = "view" | "create" | "edit" | "delete" | "approve";

export type Permission = {
  page: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
};

export type Role = {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
};

export type User = {
  id: number;
  email: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  phone: string | null;
  status: string;
  role: Role;
  created_at: string;
  last_login: string | null;
};
