import { test, expect } from "@playwright/test";

test("Automated PPIC to Production execution workflow", async ({ request }) => {
  const unique = Date.now();

  // 1. Login as Admin
  const loginResponse = await request.post(
    "http://127.0.0.1:8000/api/auth/login",
    {
      data: {
        email: "admin@axis.local",
        password: "Admin@123",
      },
    },
  );

  expect(loginResponse.ok()).toBeTruthy();

  const loginBody = await loginResponse.json();
  expect(loginBody.access_token).toBeTruthy();

  const headers = {
    Authorization: `Bearer ${loginBody.access_token}`,
  };

  // 2. Create PPIC plan
  const planNumber = `PLAN-AUTO-${unique}`;
  const batchNumber = `BATCH-AUTO-${unique}`;

  const createPlanResponse = await request.post(
    "http://127.0.0.1:8000/api/ppic",
    {
      headers,
      data: {
        plan_number: planNumber,
        po_id: null,
        po_number: `PO-AUTO-${unique}`,
        customer: "Automation Pharma",
        product: "PPIC Production Integration Test",
        batch_number: batchNumber,
        required_quantity_kg: 500,
        planned_quantity_kg: 500,
        reactor: "R-01",
        planned_start: new Date().toISOString(),
        target_completion: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        material_status: "Available",
        planning_status: "Planned",
        production_status: "Not Started",
        owner: "Automation",
        notes: "Automated PPIC to Production integration test",
      },
    },
  );

  expect(createPlanResponse.status()).toBe(200);

  const createdPlan = await createPlanResponse.json();

  expect(createdPlan.id).toBeTruthy();
  expect(createdPlan.plan_number).toBe(planNumber);
  expect(createdPlan.po_number).toBe(`PO-AUTO-${unique}`);
  expect(createdPlan.customer).toBe("Automation Pharma");
  expect(createdPlan.product).toBe(
    "PPIC Production Integration Test",
  );
  expect(Number(createdPlan.planned_quantity_kg)).toBe(500);
  expect(createdPlan.production_status).toBe("Not Started");

  const planId = createdPlan.id;

  // 3. Create Production batch linked to PPIC plan
  const createBatchResponse = await request.post(
    "http://127.0.0.1:8000/api/production",
    {
      headers,
      data: {
        batch_number: batchNumber,
        plan_id: planId,
        po_number: `PO-AUTO-${unique}`,
        customer: "Automation Pharma",
        product: "PPIC Production Integration Test",
        reactor: "R-01",
        planned_quantity_kg: 500,
        produced_quantity_kg: 0,
        production_status: "Not Started",
        operator: "Automation Operator",
        remarks: "Created from automated PPIC plan",
      },
    },
  );

  expect(createBatchResponse.status()).toBe(200);

  const createdBatch = await createBatchResponse.json();

  expect(createdBatch.id).toBeTruthy();
  expect(createdBatch.batch_number).toBe(batchNumber);
  expect(createdBatch.plan_id).toBe(planId);
  expect(createdBatch.po_number).toBe(`PO-AUTO-${unique}`);
  expect(createdBatch.customer).toBe("Automation Pharma");
  expect(createdBatch.product).toBe(
    "PPIC Production Integration Test",
  );
  expect(Number(createdBatch.planned_quantity_kg)).toBe(500);
  expect(Number(createdBatch.produced_quantity_kg)).toBe(0);
  expect(createdBatch.production_status).toBe("Not Started");

  const batchId = createdBatch.id;

  // 4. Start production
  const runningResponse = await request.patch(
    `http://127.0.0.1:8000/api/production/${batchId}/status?status=Running`,
    {
      headers,
    },
  );

  expect(runningResponse.ok()).toBeTruthy();

  const runningBatch = await runningResponse.json();

  expect(runningBatch.id).toBe(batchId);
  expect(runningBatch.production_status).toBe("Running");
  expect(runningBatch.start_time).toBeTruthy();
  expect(runningBatch.completion_time).toBeNull();

  // 5. Update produced quantity
  const updateQuantityResponse = await request.put(
    `http://127.0.0.1:8000/api/production/${batchId}`,
    {
      headers,
      data: {
        produced_quantity_kg: 500,
        remarks: "Production quantity completed",
      },
    },
  );

  expect(updateQuantityResponse.ok()).toBeTruthy();

  const updatedBatch = await updateQuantityResponse.json();

  expect(updatedBatch.id).toBe(batchId);
  expect(Number(updatedBatch.produced_quantity_kg)).toBe(500);
  expect(updatedBatch.production_status).toBe("Running");

  // 6. Complete production
  const completedResponse = await request.patch(
    `http://127.0.0.1:8000/api/production/${batchId}/status?status=Completed`,
    {
      headers,
    },
  );

  expect(completedResponse.ok()).toBeTruthy();

  const completedBatch = await completedResponse.json();

  expect(completedBatch.id).toBe(batchId);
  expect(completedBatch.production_status).toBe("Completed");
  expect(Number(completedBatch.planned_quantity_kg)).toBe(500);
  expect(Number(completedBatch.produced_quantity_kg)).toBe(500);
  expect(completedBatch.start_time).toBeTruthy();
  expect(completedBatch.completion_time).toBeTruthy();

  // 7. Verify Production batch persisted
  const batchVerifyResponse = await request.get(
    `http://127.0.0.1:8000/api/production/${batchId}`,
    {
      headers,
    },
  );

  expect(batchVerifyResponse.ok()).toBeTruthy();

  const verifiedBatch = await batchVerifyResponse.json();

  expect(verifiedBatch.plan_id).toBe(planId);
  expect(verifiedBatch.production_status).toBe("Completed");
  expect(Number(verifiedBatch.produced_quantity_kg)).toBe(500);

  // 8. Verify PPIC plan still exists and is linked by batch number
  const planVerifyResponse = await request.get(
    `http://127.0.0.1:8000/api/ppic/${planId}`,
    {
      headers,
    },
  );

  expect(planVerifyResponse.ok()).toBeTruthy();

  const verifiedPlan = await planVerifyResponse.json();

  expect(verifiedPlan.id).toBe(planId);
  expect(verifiedPlan.plan_number).toBe(planNumber);
  expect(verifiedPlan.batch_number).toBe(batchNumber);

  // 9. Cleanup Production batch
  const deleteBatchResponse = await request.delete(
    `http://127.0.0.1:8000/api/production/${batchId}`,
    {
      headers,
    },
  );

  expect(deleteBatchResponse.ok()).toBeTruthy();

  // 10. Verify Production batch deletion
  const deletedBatchResponse = await request.get(
    `http://127.0.0.1:8000/api/production/${batchId}`,
    {
      headers,
    },
  );

  expect(deletedBatchResponse.status()).toBe(404);

  // 11. Cleanup PPIC plan
  const deletePlanResponse = await request.delete(
    `http://127.0.0.1:8000/api/ppic/${planId}`,
    {
      headers,
    },
  );

  expect(deletePlanResponse.ok()).toBeTruthy();

  // 12. Verify PPIC plan deletion
  const deletedPlanResponse = await request.get(
    `http://127.0.0.1:8000/api/ppic/${planId}`,
    {
      headers,
    },
  );

  expect(deletedPlanResponse.status()).toBe(404);
});