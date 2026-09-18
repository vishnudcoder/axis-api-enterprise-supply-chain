import { test, expect } from "@playwright/test";

test("Admin can login successfully", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel(/email/i).fill("admin@axis.local");

  await page.getByLabel(/password/i).fill("Admin@123");

  await page.getByRole("button", { name: /login|sign in/i }).click();

  await expect(
    page.getByText("AXIS Administrator", { exact: false })
  ).toBeVisible();

  await expect(
    page.getByText("Dashboard", { exact: true }).first()
  ).toBeVisible();
});