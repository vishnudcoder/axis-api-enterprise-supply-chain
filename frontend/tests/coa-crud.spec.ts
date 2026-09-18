import { test, expect } from "@playwright/test";

test("Automated COA CRUD workflow", async ({ page, request }) => {
  const timestamp = Date.now();

  const coaNumber = `AUTO-COA-${timestamp}`;
  const poNumber = `AUTO-PO-${timestamp}`;
  const planNumber = `AUTO-PLAN-${timestamp}`;
  const batchNumber = `AUTO-BATCH-${timestamp}`;

  let productionBatchId: number | undefined;
  let planId: number | undefined;
  let coaId: number | undefined;

  // ============================================================
  // LOGIN
  // ============================================================

  await page.goto("/");

  await page.getByLabel(/email/i).fill("admin@axis.local");
  await page.getByLabel(/password/i).fill("Admin@123");

  await page
    .getByRole("button", { name: /login|sign in/i })
    .click();

  await expect(
    page.getByText("AXIS Administrator", { exact: false })
  ).toBeVisible();

  // ============================================================
  // GET AUTH TOKEN
  // ============================================================

  const token = await page.evaluate(() => {
    return (
      localStorage.getItem("axis_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("access_token")
    );
  });

  expect(token).toBeTruthy();

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ============================================================
  // 1. CREATE PPIC PLAN
  // ============================================================

  const planResponse = await request.post(
    "http://127.0.0.1:8000/api/ppic",
    {
      headers: authHeaders,
      data: {
        plan_number: planNumber,
        po_id: null,
        po_number: poNumber,
        customer: "Automation Pharma",
        product: "Paracetamol API",
        batch_number: batchNumber,
        required_quantity_kg: 1000,
        planned_quantity_kg: 1000,
        reactor: "R-101",
        material_status: "Available",
        planning_status: "Confirmed",
        production_status: "Not Started",
        owner: "Automation Test",
        notes: "Automated COA prerequisite test",
      },
    }
  );

  expect(
    planResponse.ok(),
    `PPIC creation failed: ${await planResponse.text()}`
  ).toBeTruthy();

  const planData = await planResponse.json();

  planId = planData.id;

  expect(planId).toBeTruthy();

  // ============================================================
  // 2. CREATE PRODUCTION BATCH
  // ============================================================

  const productionResponse = await request.post(
    "http://127.0.0.1:8000/api/production",
    {
      headers: authHeaders,
      data: {
        batch_number: batchNumber,
        plan_id: planId,
        po_number: poNumber,
        customer: "Automation Pharma",
        product: "Paracetamol API",
        reactor: "R-101",
        planned_quantity_kg: 1000,
        produced_quantity_kg: 0,
        production_status: "Not Started",
        operator: "Automation Test",
        remarks: "Automated COA prerequisite batch",
      },
    }
  );

  expect(
    productionResponse.ok(),
    `Production batch creation failed: ${await productionResponse.text()}`
  ).toBeTruthy();

  const productionData = await productionResponse.json();

  productionBatchId = productionData.id;

  expect(productionBatchId).toBeTruthy();

  // ============================================================
  // 3. START PRODUCTION
  // ============================================================

  const runningResponse = await request.patch(
    `http://127.0.0.1:8000/api/production/${productionBatchId}/status?status=Running`,
    {
      headers: authHeaders,
    }
  );

  expect(
    runningResponse.ok(),
    `Could not start production: ${await runningResponse.text()}`
  ).toBeTruthy();

  // ============================================================
  // 4. COMPLETE PRODUCTION
  // ============================================================

  const completedUpdateResponse = await request.put(
    `http://127.0.0.1:8000/api/production/${productionBatchId}`,
    {
      headers: authHeaders,
      data: {
        produced_quantity_kg: 1000,
      },
    }
  );

  expect(
    completedUpdateResponse.ok(),
    `Could not update produced quantity: ${await completedUpdateResponse.text()}`
  ).toBeTruthy();

  const completedResponse = await request.patch(
    `http://127.0.0.1:8000/api/production/${productionBatchId}/status?status=Completed`,
    {
      headers: authHeaders,
    }
  );

  expect(
    completedResponse.ok(),
    `Could not complete production: ${await completedResponse.text()}`
  ).toBeTruthy();

  // ============================================================
  // 5. OPEN COA
  // ============================================================

  await page
    .getByText("COA", { exact: true })
    .first()
    .click();

  await expect(
    page.getByRole("button", { name: /Add COA/i })
  ).toBeVisible();

  // ============================================================
  // 6. OPEN ADD COA
  // ============================================================

  await page
    .getByRole("button", { name: /Add COA/i })
    .click();

  await page.waitForTimeout(300);

  // ============================================================
  // COA NUMBER
  // ============================================================

  const coaLabel = page.getByText("COA Number *", {
    exact: true,
  });

  await expect(coaLabel).toBeVisible();

  await coaLabel
    .locator("..")
    .locator("input")
    .fill(coaNumber);

  // ============================================================
  // PO NUMBER
  // ============================================================

  const poLabel = page.getByText("PO Number", {
    exact: true,
  });

  if ((await poLabel.count()) > 0) {
    const poInput = poLabel
      .first()
      .locator("..")
      .locator("input");

    if ((await poInput.count()) > 0) {
      await poInput.fill(poNumber);
    }
  }

  // ============================================================
  // CUSTOMER
  // ============================================================

  const customerLabel = page.getByText("Customer", {
    exact: true,
  });

  if ((await customerLabel.count()) > 0) {
    const customerInput = customerLabel
      .first()
      .locator("..")
      .locator("input");

    if ((await customerInput.count()) > 0) {
      await customerInput.fill("Automation Pharma");
    }
  }

  // ============================================================
  // PRODUCT
  // ============================================================

  const productLabel = page.getByText("Product *", {
    exact: true,
  });

  await expect(productLabel).toBeVisible();

  await productLabel
    .locator("..")
    .locator("input")
    .fill("Paracetamol API");

  // ============================================================
  // CAS NUMBER
  // ============================================================

  const casLabel = page.getByText("CAS No.", {
    exact: true,
  });

  if ((await casLabel.count()) > 0) {
    const casInput = casLabel
      .first()
      .locator("..")
      .locator("input");

    if ((await casInput.count()) > 0) {
      await casInput.fill("103-90-2");
    }
  }

  // ============================================================
  // BATCH NUMBER
  // ============================================================

  const batchLabel = page.getByText("Batch Number *", {
    exact: true,
  });

  await expect(batchLabel).toBeVisible();

  await batchLabel
    .locator("..")
    .locator("input")
    .fill(batchNumber);

  // ============================================================
  // QUANTITY
  // ============================================================

  const quantityLabel = page.getByText("Quantity (kg)", {
    exact: true,
  });

  if ((await quantityLabel.count()) > 0) {
    const quantityInput = quantityLabel
      .first()
      .locator("..")
      .locator("input");

    if ((await quantityInput.count()) > 0) {
      await quantityInput.fill("1000");
    }
  }

  // ============================================================
  // CREATE COA
  // ============================================================

  await page
    .getByRole("button", {
      name: /Create COA/i,
      exact: true,
    })
    .click();

  // ============================================================
  // VERIFY CREATED COA
  // ============================================================

  let coaRow = page.locator("tr").filter({
    hasText: coaNumber,
  });

  await expect(coaRow).toBeVisible();

  await expect(
    coaRow.getByText(coaNumber, {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    coaRow.getByText("Paracetamol API", {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    coaRow.getByText(batchNumber, {
      exact: true,
    })
  ).toBeVisible();

  // ============================================================
  // GET COA ID FROM API
  // ============================================================

  const coaListResponse = await request.get(
    `http://127.0.0.1:8000/api/coa?search=${encodeURIComponent(coaNumber)}`,
    {
      headers: authHeaders,
    }
  );

  expect(
    coaListResponse.ok(),
    `Could not find created COA: ${await coaListResponse.text()}`
  ).toBeTruthy();

  const coaListData = await coaListResponse.json();

  const createdCoa =
    coaListData.items?.find(
      (item: any) => item.coa_number === coaNumber
    ) ||
    coaListData.data?.find(
      (item: any) => item.coa_number === coaNumber
    ) ||
    coaListData.find?.(
      (item: any) => item.coa_number === coaNumber
    );

  if (createdCoa) {
    coaId = createdCoa.id;
  }

  // ============================================================
  // VIEW COA
  // ============================================================

  await coaRow
    .getByRole("button", {
      name: /View/i,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: coaNumber,
      exact: true,
    })
  ).toBeVisible();

  // ============================================================
  // CLOSE VIEW
  // ============================================================

  const closeButton = page.getByRole("button", {
    name: /Close|Cancel/i,
  });

  if ((await closeButton.count()) > 0) {
    await closeButton.last().click();
  }

  await expect(
    page.getByRole("heading", {
      name: coaNumber,
      exact: true,
    })
  ).toHaveCount(0);

  // ============================================================
  // EDIT COA
  // ============================================================

  coaRow = page.locator("tr").filter({
    hasText: coaNumber,
  });

  await coaRow
    .getByRole("button", {
      name: /Edit/i,
    })
    .click();

  // ============================================================
  // EDIT PRODUCT
  // ============================================================

  const editProductLabel = page.getByText("Product *", {
    exact: true,
  });

  await expect(editProductLabel).toBeVisible();

  const editProductInput = editProductLabel
    .first()
    .locator("..")
    .locator("input");

  await expect(editProductInput).toHaveCount(1);

  await editProductInput.fill("Paracetamol API Updated");

  // ============================================================
  // SAVE
  // ============================================================

  await page
    .getByRole("button", {
      name: /Save Changes|Update COA/i,
    })
    .click();

  await page.waitForTimeout(1000);

  // ============================================================
  // RELOAD
  // ============================================================

  await page.reload();

  await expect(
    page.getByRole("button", {
      name: /Add COA/i,
    })
  ).toBeVisible();

  // ============================================================
  // VERIFY UPDATED COA
  // ============================================================

  coaRow = page.locator("tr").filter({
    hasText: coaNumber,
  });

  await expect(coaRow).toBeVisible();

  // The COA table does not necessarily display the Customer column.
  // Verify the edited Customer value through the backend instead.
  expect(coaId).toBeTruthy();

  const updatedCoaResponse = await request.get(
    `http://127.0.0.1:8000/api/coa/${coaId}`,
    {
      headers: authHeaders,
    }
  );

  expect(
    updatedCoaResponse.ok(),
    `Could not retrieve updated COA: ${await updatedCoaResponse.text()}`
  ).toBeTruthy();

  const updatedCoa = await updatedCoaResponse.json();

  expect(updatedCoa.coa_number).toBe(coaNumber);
  expect(updatedCoa.product).toBe("Paracetamol API Updated");
  expect(updatedCoa.batch_number).toBe(batchNumber);

  // ============================================================
  // DELETE COA
  // ============================================================

  const deleteButton = coaRow.getByRole("button", {
    name: /Delete/i,
  });

  await expect(deleteButton).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await deleteButton.click({
    force: true,
  });

  // ============================================================
  // HANDLE IN-PAGE CONFIRMATION
  // ============================================================

  const confirmButtons = page.getByRole("button", {
    name: /Delete|Confirm/i,
  });

  if ((await confirmButtons.count()) > 0) {
    const visibleButtons = confirmButtons.filter({
      visible: true,
    });

    if ((await visibleButtons.count()) > 0) {
      await visibleButtons.last().click();
    }
  }

  // ============================================================
  // VERIFY COA DELETED
  // ============================================================

  await expect(
    page.locator("tr").filter({
      hasText: coaNumber,
    })
  ).toHaveCount(0);

  // ============================================================
  // CLEANUP PRODUCTION BATCH
  // ============================================================

  if (productionBatchId) {
    await request.delete(
      `http://127.0.0.1:8000/api/production/${productionBatchId}`,
      {
        headers: authHeaders,
      }
    );
  }

  // ============================================================
  // CLEANUP PPIC PLAN
  // ============================================================

  if (planId) {
    await request.delete(
      `http://127.0.0.1:8000/api/ppic/${planId}`,
      {
        headers: authHeaders,
      }
    );
  }
});