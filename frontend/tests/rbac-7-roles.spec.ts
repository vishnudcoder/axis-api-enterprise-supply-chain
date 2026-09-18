import { test, expect, request } from "@playwright/test";

const API = "http://127.0.0.1:8000";

type RoleConfig = {
  role: string;
  email: string;
  password: string;
  allowedPages: string[];
  deniedPages: string[];
  backendAllowed: string[];
  backendDenied: string[];
};

const routeMap: Record<string, string> = {
  "MD Commercial View": "/md-commercial",
  Leads: "/leads",
  COA: "/coa",
  Samples: "/samples",
  Quotes: "/quotes",
  "Purchase Orders": "/purchase-orders",
  "Order Management": "/order-management",
  PPIC: "/ppic",
  Production: "/production",
  Reactors: "/reactors",
  "Equipment & Utilities": "/equipment",
  "Stock Management": "/stock",
  "Supply Chain": "/supply-chain",
  "User Management": "/users",
};

const roles: RoleConfig[] = [
  {
    role: "Plant Head / Admin",
    email: "admin@axis.local",
    password: "Admin@123",
    allowedPages: [
      "Dashboard", "MD Commercial View", "Leads", "COA", "Samples", "Quotes",
      "Purchase Orders", "Order Management", "PPIC", "Production", "Reactors",
      "Equipment & Utilities", "Stock Management", "Supply Chain", "User Management",
    ],
    deniedPages: [],
    backendAllowed: [
      "/api/leads", "/api/quotes", "/api/purchase-orders", "/api/ppic",
      "/api/production", "/api/coa", "/api/reactors", "/api/equipment",
      "/api/stock", "/api/supply-chain",
    ],
    backendDenied: [],
  },
  {
    role: "Managing Director",
    email: "md@axis.local",
    password: "Demo@123",
    allowedPages: [
      "Dashboard", "MD Commercial View", "Leads", "COA", "Samples", "Quotes",
      "Purchase Orders", "Order Management", "PPIC", "Reactors",
      "Equipment & Utilities", "Stock Management", "Supply Chain",
    ],
    deniedPages: ["Production", "User Management"],
    backendAllowed: [
      "/api/leads", "/api/quotes", "/api/purchase-orders", "/api/ppic",
      "/api/reactors", "/api/equipment", "/api/stock", "/api/supply-chain",
    ],
    backendDenied: ["/api/production", "/api/admin/users"],
  },
  {
    role: "Sales & Marketing",
    email: "sales@axis.local",
    password: "Demo@123",
    allowedPages: [
      "Dashboard", "Leads", "COA", "Samples", "Quotes", "Purchase Orders",
      "Order Management",
    ],
    deniedPages: [
      "MD Commercial View", "PPIC", "Production", "Reactors",
      "Equipment & Utilities", "Stock Management", "Supply Chain", "User Management",
    ],
    backendAllowed: ["/api/leads", "/api/quotes", "/api/purchase-orders"],
    backendDenied: [
      "/api/ppic", "/api/production", "/api/reactors", "/api/equipment",
      "/api/stock", "/api/supply-chain", "/api/admin/users",
    ],
  },
  {
    role: "QC / QA",
    email: "qc@axis.local",
    password: "Demo@123",
    allowedPages: ["Dashboard", "COA", "Samples", "PPIC", "Stock Management"],
    deniedPages: [
      "MD Commercial View", "Leads", "Quotes", "Purchase Orders", "Order Management",
      "Production", "Reactors", "Equipment & Utilities", "Supply Chain", "User Management",
    ],
    backendAllowed: ["/api/coa", "/api/samples", "/api/ppic", "/api/stock"],
    backendDenied: [
      "/api/leads", "/api/quotes", "/api/purchase-orders", "/api/production",
      "/api/reactors", "/api/equipment", "/api/supply-chain", "/api/admin/users",
    ],
  },
  {
    role: "PPIC Planner",
    email: "ppic@axis.local",
    password: "Demo@123",
    allowedPages: [
      "Dashboard", "Purchase Orders", "Order Management", "PPIC", "Reactors",
      "Stock Management", "Supply Chain",
    ],
    deniedPages: [
      "MD Commercial View", "Leads", "COA", "Samples", "Quotes",
      "Production", "Equipment & Utilities", "User Management",
    ],
    backendAllowed: [
      "/api/purchase-orders", "/api/ppic", "/api/reactors", "/api/stock",
      "/api/supply-chain",
    ],
    backendDenied: [
      "/api/leads", "/api/coa", "/api/quotes", "/api/production",
      "/api/equipment", "/api/admin/users",
    ],
  },
  {
    role: "Production / Plant",
    email: "production@axis.local",
    password: "Demo@123",
    allowedPages: ["Dashboard", "PPIC", "Production", "Reactors", "Equipment & Utilities"],
    deniedPages: [
      "MD Commercial View", "Leads", "COA", "Samples", "Quotes",
      "Purchase Orders", "Order Management", "Stock Management",
      "Supply Chain", "User Management",
    ],
    backendAllowed: ["/api/ppic", "/api/production", "/api/reactors", "/api/equipment"],
    backendDenied: [
      "/api/leads", "/api/coa", "/api/quotes", "/api/purchase-orders",
      "/api/stock", "/api/supply-chain", "/api/admin/users",
    ],
  },
  {
    role: "Stores & Supply Chain",
    email: "stores@axis.local",
    password: "Demo@123",
    allowedPages: ["Dashboard", "Order Management", "Stock Management", "Supply Chain"],
    deniedPages: [
      "MD Commercial View", "Leads", "COA", "Samples", "Quotes",
      "Purchase Orders", "PPIC", "Production", "Reactors",
      "Equipment & Utilities", "User Management",
    ],
    backendAllowed: ["/api/purchase-orders", "/api/stock", "/api/supply-chain"],
    backendDenied: [
      "/api/leads", "/api/coa", "/api/quotes", "/api/ppic", "/api/production",
      "/api/reactors", "/api/equipment", "/api/admin/users",
    ],
  },
];

async function loginApi(
  api: Awaited<ReturnType<typeof request.newContext>>,
  email: string,
  password: string,
) {
  const response = await api.post(`${API}/api/auth/login`, {
    data: { email, password },
  });

  expect(response.ok(), `Login failed for ${email}: ${await response.text()}`).toBeTruthy();

  const body = await response.json();
  expect(body.access_token).toBeTruthy();
  return body.access_token as string;
}

async function validateRole(config: RoleConfig, page: any, api: any) {
  await test.step(`${config.role} - login`, async () => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await page.locator('input[type="email"]').fill(config.email);
    await page.locator('input[type="password"]').fill(config.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(config.role, { exact: true }).first()).toBeVisible();
  });

  await test.step(`${config.role} - visible navigation`, async () => {
    const sidebar = page.locator("aside");
    const sidebarText = await sidebar.innerText();

    for (const pageName of config.allowedPages) {
      expect(sidebarText, `${config.role} should see "${pageName}"`).toContain(pageName);
    }

    for (const pageName of config.deniedPages) {
      expect(sidebarText, `${config.role} should NOT see "${pageName}"`).not.toContain(pageName);
    }
  });

  await test.step(`${config.role} - unauthorized frontend routes`, async () => {
    for (const pageName of config.deniedPages) {
      const route = routeMap[pageName];
      if (!route) continue;

      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
    }
  });

  await test.step(`${config.role} - backend permissions`, async () => {
    const token = await loginApi(api, config.email, config.password);
    const headers = { Authorization: `Bearer ${token}` };

    for (const endpoint of config.backendAllowed) {
      const response = await api.get(`${API}${endpoint}`, { headers });
      expect(
        response.status(),
        `${config.role} should be allowed to GET ${endpoint}; body: ${await response.text()}`,
      ).toBeLessThan(403);
    }

    for (const endpoint of config.backendDenied) {
      const response = await api.get(`${API}${endpoint}`, { headers });
      expect(
        response.status(),
        `${config.role} should be denied from GET ${endpoint}; body: ${await response.text()}`,
      ).toBe(403);
    }
  });
}

// Each role is an independent Playwright test.
// Playwright creates a fresh browser context for every test, so auth state
// from one role can never leak into the next role.
for (const config of roles) {
  test(`${config.role} - RBAC`, async ({ page }) => {
    const api = await request.newContext();
    try {
      await validateRole(config, page, api);
    } finally {
      await api.dispose();
    }
  });
}
