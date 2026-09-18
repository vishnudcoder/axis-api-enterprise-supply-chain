import { test, expect } from "@playwright/test";

test("Order Management exposes the complete downstream lifecycle", async ({ page, request }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("admin@axis.local");
  await page.getByLabel("Password").fill("Admin@123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: "Order Management" }).click();
  await expect(
    page.getByRole("heading", { name: "Order Management", exact: true }),
  ).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem("axis_token"));
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  const unique = Date.now();

  let poId: number | undefined;
  let planId: number | undefined;
  let batchId: number | undefined;
  let coaId: number | undefined;
  let shipmentId: number | undefined;

  try {
    const poResponse = await request.post(
      "http://127.0.0.1:8000/api/purchase-orders",
      {
        headers,
        data: {
          po_number: `OM-LIFE-${unique}`,
          customer: "Lifecycle Automation Pharma",
          product: "Lifecycle Test Product",
          cas_no: "OM-LIFE-001",
          quantity_kg: 100,
          value_usd: 25000,
          status: "Confirmed",
          production_status: "Not Started",
          qc_status: "Pending",
          dispatch_status: "Pending",
          owner: "Automation",
        },
      },
    );
    expect(poResponse.ok()).toBeTruthy();
    const po = await poResponse.json();
    poId = po.id;

    const planResponse = await request.post(
      "http://127.0.0.1:8000/api/ppic",
      {
        headers,
        data: {
          plan_number: `PPIC-LIFE-${unique}`,
          po_id: po.id,
          po_number: po.po_number,
          customer: po.customer,
          product: po.product,
          batch_number: `BATCH-LIFE-${unique}`,
          required_quantity_kg: 100,
          planned_quantity_kg: 100,
          reactor: "R-AUTO",
          material_status: "Ready",
          planning_status: "Released",
          production_status: "Not Started",
          owner: "Automation",
        },
      },
    );
    expect(planResponse.ok()).toBeTruthy();
    const plan = await planResponse.json();
    planId = plan.id;

    const batchResponse = await request.post(
      "http://127.0.0.1:8000/api/production",
      {
        headers,
        data: {
          batch_number: `BATCH-LIFE-${unique}`,
          plan_id: plan.id,
          po_number: po.po_number,
          customer: po.customer,
          product: po.product,
          reactor: "R-AUTO",
          planned_quantity_kg: 100,
          produced_quantity_kg: 100,
          production_status: "Completed",
          operator: "Automation",
          remarks: "Lifecycle integration test",
        },
      },
    );
    expect(batchResponse.ok()).toBeTruthy();
    const batch = await batchResponse.json();
    batchId = batch.id;

    const coaResponse = await request.post(
      "http://127.0.0.1:8000/api/coa",
      {
        headers,
        data: {
          coa_number: `COA-LIFE-${unique}`,
          po_number: po.po_number,
          customer: po.customer,
          product: po.product,
          cas_no: po.cas_no,
          batch_number: batch.batch_number,
          quantity_kg: 100,
          test_status: "Passed",
          coa_status: "Draft",
          qc_approved: false,
          qa_approved: false,
          tested_by: "Automation",
        },
      },
    );
    expect(coaResponse.ok()).toBeTruthy();
    const coa = await coaResponse.json();
    coaId = coa.id;

    const qcResponse = await request.patch(
      `http://127.0.0.1:8000/api/coa/${coa.id}/status?status=QC%20Approved`,
      { headers },
    );
    const qaResponse = await request.patch(
  `http://127.0.0.1:8000/api/coa/${coa.id}/status?status=${encodeURIComponent(
    "QA Approved"
  )}`,
  {
    headers,
  },
);

expect(
  qaResponse.ok(),
  `QA Approved transition failed: ${await qaResponse.text()}`
).toBeTruthy();

    const releaseResponse = await request.patch(
      `http://127.0.0.1:8000/api/coa/${coa.id}/status?status=Released`,
      { headers },
    );
    expect(releaseResponse.ok()).toBeTruthy();

    const shipmentResponse = await request.post(
      "http://127.0.0.1:8000/api/supply-chain",
      {
        headers,
        data: {
          shipment_number: `SHIP-LIFE-${unique}`,
          po_number: po.po_number,
          customer: po.customer,
          material_name: po.product,
          material_code: po.cas_no,
          quantity: 100,
          unit: "kg",
          source_location: "Plant",
          destination: "Customer",
          transport_mode: "Road",
          priority: "Normal",
          status: "Planned",
          owner: "Automation",
        },
      },
    );
    expect(shipmentResponse.ok()).toBeTruthy();
    const shipment = await shipmentResponse.json();
    shipmentId = shipment.id;

    const lifecycleResponse = await request.get(
      `http://127.0.0.1:8000/api/order-management/${po.id}/lifecycle`,
      { headers },
    );

    expect(lifecycleResponse.ok()).toBeTruthy();
    const lifecycle = await lifecycleResponse.json();

    expect(lifecycle.order.po_number).toBe(po.po_number);
    expect(lifecycle.ppic_plans.length).toBeGreaterThanOrEqual(1);
    expect(lifecycle.production_batches.length).toBeGreaterThanOrEqual(1);
    expect(lifecycle.coas.length).toBeGreaterThanOrEqual(1);
    expect(lifecycle.shipments.length).toBeGreaterThanOrEqual(1);

    await page.getByPlaceholder(
      "Search PO, customer, product, reactor...",
    ).fill(po.po_number);

    await expect(page.getByText(po.po_number, { exact: true })).toBeVisible();
    await page.getByTitle(`View ${po.po_number}`).click();

    await expect(
      page.getByText("Downstream records", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByText(plan.plan_number, { exact: false }),
    ).toBeVisible();

    await expect(
      page.getByText(batch.batch_number, { exact: false }),
    ).toBeVisible();

    await expect(
      page.getByText(coa.coa_number, { exact: false }),
    ).toBeVisible();

    await expect(
      page.getByText(shipment.shipment_number, { exact: false }),
    ).toBeVisible();
  } finally {
    if (shipmentId) {
      await request.delete(
        `http://127.0.0.1:8000/api/supply-chain/${shipmentId}`,
        { headers },
      );
    }
    if (coaId) {
      await request.delete(
        `http://127.0.0.1:8000/api/coa/${coaId}`,
        { headers },
      );
    }
    if (batchId) {
      await request.delete(
        `http://127.0.0.1:8000/api/production/${batchId}`,
        { headers },
      );
    }
    if (planId) {
      await request.delete(
        `http://127.0.0.1:8000/api/ppic/${planId}`,
        { headers },
      );
    }
    if (poId) {
      await request.delete(
        `http://127.0.0.1:8000/api/purchase-orders/${poId}`,
        { headers },
      );
    }
  }
});
