import { test, expect } from "@playwright/test";

test("Admin can access all main modules", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/email/i).fill("admin@axis.local");
  await page.getByLabel(/password/i).fill("Admin@123");

  await page.getByRole("button", { name: /login|sign in/i }).click();

  await expect(
    page.getByText("AXIS Administrator", { exact: false })
  ).toBeVisible();

  const modules = [
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
  ];

  for (const module of modules) {
    await expect(
      page.getByText(module, { exact: true }).first()
    ).toBeVisible();
  }
});