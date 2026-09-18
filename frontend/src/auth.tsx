import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearSession, loginRequest } from "./api";
import type { Action, User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (page: string, action?: Action) => boolean;
  switchDemoRole: (roleName: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("axis_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("axis_token");

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/api/auth/me")
      .then((response) => {
        setUser(response.data);
        localStorage.setItem("axis_user", JSON.stringify(response.data));
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const nextUser = await loginRequest(email, password);
    setUser(nextUser);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  function normalizePage(value: string | undefined | null) {
    if (!value) return "";

    return String(value)
      .trim()
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function can(page: string, action: Action = "view") {
    if (!user) return false;

    if (user.role.name === "Plant Head / Admin") {
      return true;
    }

    const requestedPage = normalizePage(page);

    // Stores & Supply Chain must not see Purchase Orders
    // in the frontend navigation.
    if (
      user.role.name === "Stores & Supply Chain" &&
      requestedPage === "purchase orders"
    ) {
      return false;
    }

    const permission = user.role.permissions.find(
      (item) => normalizePage(item.page) === requestedPage,
    );

    if (!permission) return false;

    const key = `can_${action}` as keyof typeof permission;
    return Boolean(permission[key]);
  }

  function switchDemoRole(roleName: string) {
    if (import.meta.env.VITE_DEMO_ROLE_SWITCH !== "true") return;
    if (!user) return;

    const permission = user.role.permissions;
    const roles = [...new Set(permission.map((item) => item.page))];

    // The actual production JWT role is never changed here.
    // This function only exists for UI rehearsal and is intentionally
    // limited to changing the displayed permission profile.
    const demoProfiles: Record<string, string[]> = {
      "Plant Head / Admin": [
        "Dashboard",
        "MD Commercial View",
        "Leads",
        "COA",
        "Samples",
        "Quotes",
        "Purchase Orders",
        "Order Management",
        "PPIC",
        "Production",
        "Reactors",
        "Equipment & Utilities",
        "Stock Management",
        "Supply Chain",
      ],

      "Managing Director": roles,

      "Sales & Marketing": [
        "Dashboard",
        "Leads",
        "COA",
        "Samples",
        "Quotes",
        "Purchase Orders",
        "Order Management",
      ],

      "QC / QA": [
        "Dashboard",
        "COA",
        "Samples",
        "PPIC",
        "Stock Management",
      ],

      "PPIC Planner": [
        "Dashboard",
        "Purchase Orders",
        "Order Management",
        "PPIC",
        "Reactors",
        "Stock Management",
        "Supply Chain",
      ],

      "Production / Plant": [
        "Dashboard",
        "PPIC",
        "Production",
        "Reactors",
        "Equipment & Utilities",
      ],

      "Stores & Supply Chain": [
        "Dashboard",
        "Stock Management",
        "Supply Chain",
      ],
    };

    const allowed = new Set(
      (demoProfiles[roleName] || []).map(normalizePage),
    );

    const next = structuredClone(user);

    next.role = {
      ...next.role,
      name: roleName,
      description: roleName,
      permissions: next.role.permissions.map((p) => ({
        ...p,
        can_view: allowed.has(normalizePage(p.page)),
        can_create:
          roleName === "Plant Head / Admin"
            ? true
            : p.can_create && allowed.has(normalizePage(p.page)),
        can_edit:
          roleName === "Plant Head / Admin"
            ? true
            : p.can_edit && allowed.has(normalizePage(p.page)),
        can_delete:
          roleName === "Plant Head / Admin"
            ? true
            : p.can_delete && allowed.has(normalizePage(p.page)),
        can_approve:
          roleName === "Plant Head / Admin"
            ? true
            : p.can_approve && allowed.has(normalizePage(p.page)),
      })),
    };

    setUser(next);
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, can, switchDemoRole }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
