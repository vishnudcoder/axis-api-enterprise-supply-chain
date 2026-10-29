import { test, expect } from "@playwright/test";

const baseUrl =
  process.env.E2E_BASE_URL ||
  "http://127.0.0.1:5173";

const roles = [
  {
    name: "Plant Head / Admin",
    email: "admin@axis.local",
    password: "Admin@123",
    shouldRequestLeads: true,
  },
  {
    name: "Managing Director",
    email: "md@axis.local",
    password: "Demo@123",
    shouldRequestLeads: true,
  },
  {
    name: "Sales & Marketing",
    email: "sales@axis.local",
    password: "Demo@123",
    shouldRequestLeads: true,
  },
  {
    name: "QC / QA",
    email: "qc@axis.local",
    password: "Demo@123",
    shouldRequestLeads: false,
  },
  {
    name: "PPIC Planner",
    email: "ppic@axis.local",
    password: "Demo@123",
    shouldRequestLeads: false,
  },
  {
    name: "Production / Plant",
    email: "production@axis.local",
    password: "Demo@123",
    shouldRequestLeads: false,
  },
  {
    name: "Stores & Supply Chain",
    email: "stores@axis.local",
    password: "Demo@123",
    shouldRequestLeads: false,
  },
];

for (const role of roles) {
  test(`dashboard RBAC - ${role.name}`, async ({ page }) => {
    const apiFailures: { url: string; status: number }[] = [];
    const apiRequests: string[] = [];

    page.on("response", (response) => {
      if (response.url().includes("/api/")) {
        apiRequests.push(response.url());

        if (response.status() >= 400) {
          apiFailures.push({
            url: response.url(),
            status: response.status(),
          });
        }
      }
    });

    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Ensure a clean authentication state for every role.
    await page.evaluate(() => {
      localStorage.removeItem("axis_token");
      localStorage.removeItem("axis_user");
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.getByLabel(/email/i).fill(role.email);
    await page.getByLabel(/password/i).fill(role.password);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/auth/login") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: /sign in|login/i }).click(),
    ]);

    await expect(
      page.getByRole("heading", {
        name: "Operations Dashboard",
      }),
    ).toBeVisible({ timeout: 30000 });

    // Allow dashboard requests to settle.
    await page.waitForTimeout(2000);

    await expect(
      page.getByText("Access denied for leads", { exact: true }),
    ).toHaveCount(0);

    await expect(
      page.getByText("Unable to load live dashboard data.", {
        exact: true,
      }),
    ).toHaveCount(0);

    const leadsRequests = apiRequests.filter((url) =>
      url.includes("/api/leads/summary"),
    );

    if (role.shouldRequestLeads) {
      expect(leadsRequests.length).toBeGreaterThan(0);
    } else {
      expect(leadsRequests.length).toBe(0);
    }

    expect(apiFailures).toEqual([]);
  });
}
