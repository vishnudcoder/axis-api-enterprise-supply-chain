import { test, expect } from "@playwright/test";

test("Automated Production CRUD workflow", async ({ page }) => {
  // ============================================================
  // LOGIN
  // ============================================================
  await page.goto("/login");

  await page.getByLabel("Email").fill("admin@axis.local");
  await page.getByLabel("Password").fill("Admin@123");

  await Promise.all([
    page.waitForURL(/\/$/, { timeout: 10000 }),
    page.getByRole("button", { name: "Sign In" }).click(),
  ]);

  await expect(page).toHaveURL(/\/$/);

  // ============================================================
  // OPEN PRODUCTION
  // ============================================================
  await page.goto("/production");

  await expect(page).toHaveURL(/\/production/);
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", {
      name: "Production",
      exact: true,
    })
  ).toBeVisible({ timeout: 10000 });

  const batchNumber = `AUTO-BATCH-${Date.now()}`;

  // ============================================================
  // CREATE BATCH
  // ============================================================
  await page.getByRole("button", {
    name: /\+\s*Create Batch/i,
  }).click();

  await expect(
    page.getByRole("heading", {
      name: "Create Production Batch",
      exact: true,
    })
  ).toBeVisible();

  await page.getByLabel("Batch Number *").fill(batchNumber);
  await page.getByLabel("PO Number").fill("AUTO-PO-PROD");
  await page.getByLabel("Customer").fill("Automation Pharma");
  await page.getByLabel("Product *").fill("Paracetamol API");
  await page.getByLabel("Reactor").fill("R-101");
  await page.getByLabel("Planned Quantity (kg)").fill("100");
  await page.getByLabel("Produced Quantity (kg)").fill("0");
  await page.getByLabel("Operator").fill("Automation Operator");
  await page.getByLabel("Remarks").fill(
    "Automated Playwright production test"
  );

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "Production batch created successfully"
    );
    await dialog.accept();
  });

  await page.getByRole("button", {
    name: "Create Batch",
    exact: true,
  }).click();

  // ============================================================
  // VERIFY CREATE
  // ============================================================
  const batchRow = page.locator("tr").filter({
    hasText: batchNumber,
  });

  await expect(batchRow).toBeVisible({ timeout: 10000 });

  await expect(
    batchRow.getByText(batchNumber, { exact: true })
  ).toBeVisible();

  await expect(
    batchRow.locator("td").filter({
      hasText: "Automation Pharma",
    })
  ).toBeVisible();

  await expect(
    batchRow.locator("td").filter({
      hasText: "Paracetamol API",
    })
  ).toBeVisible();

  await expect(
    batchRow.locator("td").filter({
      hasText: "R-101",
    })
  ).toBeVisible();

 // ============================================================
// VIEW
// ============================================================
await batchRow.getByRole("button", {
  name: "View",
  exact: true,
}).click();

const viewModal = page.locator(".modal-card");

await expect(
  viewModal.getByRole("heading", {
    name: batchNumber,
    exact: true,
  })
).toBeVisible();

await expect(
  viewModal.locator(".detail-grid").getByText("Automation Pharma", {
    exact: true,
  })
).toBeVisible();

await expect(
  viewModal.locator(".detail-grid").getByText("Paracetamol API", {
    exact: true,
  })
).toBeVisible();

await expect(
  viewModal.locator(".detail-grid").getByText("R-101", {
    exact: true,
  })
).toBeVisible();

await page.getByRole("button", {
  name: "Close",
  exact: true,
}).click();

  // ============================================================
  // EDIT
  // ============================================================
  await batchRow.getByRole("button", {
    name: "Edit",
    exact: true,
  }).click();

  await expect(
    page.getByRole("heading", {
      name: "Edit Production Batch",
      exact: true,
    })
  ).toBeVisible();

  await page.getByLabel("Produced Quantity (kg)").fill("95");
  await page.getByLabel("Operator").fill(
    "Updated Automation Operator"
  );

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "Production batch updated successfully"
    );
    await dialog.accept();
  });

  await page.getByRole("button", {
    name: "Update Batch",
    exact: true,
  }).click();

  // ============================================================
  // VERIFY UPDATE
  // ============================================================
  const updatedBatchRow = page.locator("tr").filter({
    hasText: batchNumber,
  });

  await expect(updatedBatchRow).toBeVisible();

  await expect(
    updatedBatchRow.locator("td").filter({
      hasText: "95",
    })
  ).toBeVisible();

  // ============================================================
  // STATUS ? RUNNING
  // ============================================================
  const statusSelect = updatedBatchRow.locator("select");

  await statusSelect.selectOption({
    label: "Running",
  });

  await expect(statusSelect).toHaveValue("Running");

  // ============================================================
  // RELOAD + VERIFY PERSISTENCE
  // ============================================================
  await page.reload();
  await page.waitForLoadState("networkidle");

  const reloadedBatchRow = page.locator("tr").filter({
    hasText: batchNumber,
  });

  await expect(reloadedBatchRow).toBeVisible({
    timeout: 10000,
  });

  await expect(
    reloadedBatchRow.locator("select")
  ).toHaveValue("Running");

  // ============================================================
  // STATUS ? COMPLETED
  // ============================================================
  await reloadedBatchRow.locator("select").selectOption({
    label: "Completed",
  });

  await expect(
    reloadedBatchRow.locator("select")
  ).toHaveValue("Completed");

  // ============================================================
  // DELETE
  // ============================================================
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      `Delete production batch ${batchNumber}?`
    );
    await dialog.accept();
  });

  await reloadedBatchRow.getByRole("button", {
    name: "Delete",
    exact: true,
  }).click();

  // ============================================================
  // VERIFY DELETE
  // ============================================================
  await expect(
    page.locator("tr").filter({
      hasText: batchNumber,
    })
  ).toHaveCount(0);
});
