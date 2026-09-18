import { test, expect } from "@playwright/test";

test("Dashboard loads live operational data from backend APIs", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("admin@axis.local");
  await page.getByLabel("Password").fill("Admin@123");

  const leadsResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/leads/summary") &&
      response.request().method() === "GET",
  );

  const poResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/purchase-orders/summary") &&
      response.request().method() === "GET",
  );

  const reactorResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/reactors/summary") &&
      response.request().method() === "GET",
  );

  const stockResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/stock/summary") &&
      response.request().method() === "GET",
  );

  const supplyResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/supply-chain/summary") &&
      response.request().method() === "GET",
  );

  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/$/);

  await Promise.all([
    leadsResponsePromise,
    poResponsePromise,
    reactorResponsePromise,
    stockResponsePromise,
    supplyResponsePromise,
  ]);

  await expect(
    page.getByRole("heading", { name: "Operations Dashboard" }),
  ).toBeVisible();

  await expect(page.getByText("OPEN PIPELINE")).toBeVisible();
  await expect(page.getByText("CONFIRMED POS")).toBeVisible();
  await expect(page.getByText("REACTORS ENGAGED")).toBeVisible();
  await expect(page.getByText("MATERIAL ALERTS", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest POs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plant snapshot" })).toBeVisible();
});
