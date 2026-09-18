import { test, expect } from "@playwright/test";

test("Admin can create a Purchase Order", async ({ page }) => {
  await page.goto("/");

  // =========================
  // LOGIN
  // =========================

  await page.getByLabel(/email/i).fill("admin@axis.local");
  await page.getByLabel(/password/i).fill("Admin@123");

  await page
    .getByRole("button", { name: /login|sign in/i })
    .click();

  await expect(
    page.getByText("AXIS Administrator", { exact: false })
  ).toBeVisible();

  // =========================
  // OPEN PURCHASE ORDERS
  // =========================

  await page
    .getByText("Purchase Orders", { exact: true })
    .first()
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Purchase Orders",
      exact: true,
    })
  ).toBeVisible();

  // =========================
  // OPEN CREATE FORM
  // =========================

  await page
    .getByRole("button", {
      name: /Add Purchase Order/i,
    })
    .click();

  // =========================
  // FORM FIELDS
  // =========================

  const poNumber = `AUTO-PO-${Date.now()}`;

  // PO Number
  await page
    .getByRole("textbox", { name: /^PO Number \*$/i })
    .fill(poNumber);

  // Customer
  await page
    .getByRole("textbox", { name: /^Customer \*$/i })
    .fill("Automation Pharma");

  // Product
  await page
    .getByRole("textbox", { name: /^Product \*$/i })
    .fill("Paracetamol API");

  // CAS Number
  const casField = page.getByRole("textbox", {
    name: /^CAS/i,
  });

  if (await casField.count()) {
    await casField.fill("103-90-2");
  }

  // Quantity
  const quantityField = page.getByRole("spinbutton", {
    name: /^Quantity/i,
  });

  if (await quantityField.count()) {
    await quantityField.fill("1000");
  } else {
    await page.getByLabel(/^Quantity/i).fill("1000");
  }

  // Value
  const valueField = page.getByRole("spinbutton", {
    name: /^Value/i,
  });

  if (await valueField.count()) {
    await valueField.fill("25000");
  } else {
    await page.getByLabel(/^Value/i).fill("25000");
  }

  // =========================
  // SUBMIT
  // =========================

  await page
  .getByRole("button", {
    name: "Create PO",
    exact: true,
  })
  .click();

  // =========================
  // VERIFY
  // =========================

  await expect(
    page.getByText(poNumber, { exact: true })
  ).toBeVisible();
});