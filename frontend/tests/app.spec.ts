import { test, expect } from "@playwright/test";

test("AXIS application loads successfully", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/AXIS/i);

  await expect(
    page.getByText("AXIS API", { exact: false }).first()
  ).toBeVisible();
});