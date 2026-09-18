import { test, expect } from "@playwright/test";

test("Automated PO to PPIC workflow", async ({ page }) => {
  const poNumber = `AUTO-PPIC-PO-${Date.now()}`;

  // LOGIN
  await page.goto("/");

  await page.getByLabel(/email/i).fill("admin@axis.local");
  await page.getByLabel(/password/i).fill("Admin@123");

  await page
    .getByRole("button", { name: /login|sign in/i })
    .click();

  await expect(
    page.getByText("AXIS Administrator", { exact: false })
  ).toBeVisible();

  // PURCHASE ORDERS
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

  // CREATE PO
  await page
    .getByRole("button", {
      name: /Add Purchase Order/i,
    })
    .click();

  await page
    .getByRole("textbox", {
      name: /^PO Number \*$/i,
    })
    .fill(poNumber);

  await page
    .getByRole("textbox", {
      name: /^Customer \*$/i,
    })
    .fill("Automation Pharma");

  await page
    .getByRole("textbox", {
      name: /^Product \*$/i,
    })
    .fill("Paracetamol API");

  const casField = page.getByRole("textbox", {
    name: /^CAS/i,
  });

  if (await casField.count() > 0) {
    await casField.fill("103-90-2");
  }

  const quantityField = page.getByRole("spinbutton", {
    name: /^Quantity/i,
  });

  if (await quantityField.count() > 0) {
    await quantityField.fill("1000");
  }

  const valueField = page.getByRole("spinbutton", {
    name: /^Value/i,
  });

  if (await valueField.count() > 0) {
    await valueField.fill("25000");
  }

  await page
    .getByRole("button", {
      name: "Create PO",
      exact: true,
    })
    .click();

  // VERIFY PO IN TABLE
  const poRow = page.locator("tr").filter({
    hasText: poNumber,
  });

  await expect(poRow).toBeVisible();

  // OPEN PO
  await poRow
    .getByRole("button", {
      name: /View PO/i,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: poNumber,
      exact: true,
    })
  ).toBeVisible();

  // CREATE PRODUCTION PLAN
  const productionPlanButton = page.getByRole("button", {
    name: /Create Production Plan/i,
  });

  await expect(productionPlanButton).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await productionPlanButton.click();

  // WAIT FOR API/UI UPDATE
  await page.waitForTimeout(1000);

  // OPEN PPIC
  await page
    .getByText("PPIC", {
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "PPIC",
      exact: true,
    })
  ).toBeVisible();

  // ==========================================
  // VERIFY PPIC PLAN
  // ==========================================

  const ppicTable = page.getByRole("table");

  await expect(ppicTable).toBeVisible();

  const ppicRow = ppicTable.locator("tbody tr").filter({
    hasText: poNumber,
  });

  await expect(ppicRow).toHaveCount(1);

  await expect(
    ppicRow
      .getByText(poNumber, {
        exact: true,
      })
  ).toBeVisible();

  await expect(
    ppicRow
      .getByText("Automation Pharma", {
        exact: true,
      })
  ).toBeVisible();

  await expect(
    ppicRow
      .getByText("Paracetamol API", {
        exact: true,
      })
  ).toBeVisible();
});