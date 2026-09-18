import { test, expect } from "@playwright/test";

test("Dashboard drill-down navigation and refresh work", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("admin@axis.local");
  await page.getByLabel("Password").fill("Admin@123");

  const initialLeadsSummary = page.waitForResponse(
    (response) =>
      response.url().includes("/api/leads/summary") &&
      response.request().method() === "GET",
  );

  await page.getByRole("button", { name: "Sign In" }).click();
  await initialLeadsSummary;

  await expect(
    page.getByRole("heading", { name: "Operations Dashboard" }),
  ).toBeVisible();

  // KPI → Leads
  await page.getByText("OPEN PIPELINE", { exact: true }).click();
  await expect(page).toHaveURL(/\/leads$/);
  await expect(
    page.getByRole("heading", { name: "Leads & Enquiries" }),
  ).toBeVisible();

  await page.goto("/");

  // KPI → Purchase Orders
  await page.getByText("CONFIRMED POS", { exact: true }).click();
  await expect(page).toHaveURL(/\/purchase-orders$/);
  await expect(
    page.getByRole("heading", { name: "Purchase Orders", exact: true }),
  ).toBeVisible();

  await page.goto("/");

  // KPI → Reactors
  await page.getByText("REACTORS ENGAGED", { exact: true }).click();
  await expect(page).toHaveURL(/\/reactors$/);
  await expect(
    page.getByRole("heading", { name: "Reactors" }),
  ).toBeVisible();

  await page.goto("/");

  // KPI → Stock Management
  await page.getByText("MATERIAL ALERTS", { exact: true }).click();
  await expect(page).toHaveURL(/\/stock$/);
  await expect(
    page.getByRole("heading", { name: "Stock Management" }),
  ).toBeVisible();

  await page.goto("/");

  // Latest PO row → Purchase Orders
  const poTable = page.getByRole("heading", { name: "Latest POs" })
    .locator("..")
    .locator("..");
  const firstPoRow = poTable.locator("tbody tr").first();

  if (await firstPoRow.count()) {
    const rowText = await firstPoRow.innerText();
    if (!rowText.includes("No purchase orders") && !rowText.includes("Loading")) {
      await firstPoRow.click();
      await expect(page).toHaveURL(/\/purchase-orders$/);
      await expect(
        page.getByRole("heading", { name: "Purchase Orders", exact: true }),
      ).toBeVisible();
    }
  }

  await page.goto("/");

  // Plant snapshot row → Reactors
  const reactorRows = page.locator(".reactor-list .reactor-row");
  if (await reactorRows.count()) {
    await reactorRows.first().click();
    await expect(page).toHaveURL(/\/reactors$/);
    await expect(
      page.getByRole("heading", { name: "Reactors" }),
    ).toBeVisible();
  }

  await page.goto("/");

  // Refresh → live backend request
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/leads/summary") &&
      response.request().method() === "GET",
  );

  await page.getByRole("button", { name: "Refresh" }).click();
  await refreshResponse;
  await expect(
    page.getByRole("heading", { name: "Operations Dashboard" }),
  ).toBeVisible();
});

