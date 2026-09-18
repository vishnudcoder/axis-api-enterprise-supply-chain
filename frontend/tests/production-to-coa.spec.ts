import { test, expect } from "@playwright/test";

test("Automated Production to COA release workflow", async ({ request }) => {
  const unique = Date.now();

  const baseUrl = "http://127.0.0.1:8000";

  // ============================================================
  // 1. LOGIN
  // ============================================================

  const loginResponse = await request.post(
    `${baseUrl}/api/auth/login`,
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

  // ============================================================
  // 2. CREATE PPIC PLAN
  // ============================================================

  const planNumber = `PLAN-COA-${unique}`;
  const batchNumber = `BATCH-COA-${unique}`;
  const poNumber = `PO-COA-${unique}`;

  const createPlanResponse = await request.post(
    `${baseUrl}/api/ppic`,
    {
      headers,
      data: {
        plan_number: planNumber,
        po_id: null,
        po_number: poNumber,
        customer: "Automation Pharma",
        product: "Production COA Integration Test",
        batch_number: batchNumber,
        required_quantity_kg: 250,
        planned_quantity_kg: 250,
        reactor: "R-01",
        planned_start: new Date().toISOString(),
        target_completion: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        material_status: "Available",
        planning_status: "Planned",
        production_status: "Not Started",
        owner: "Automation",
        notes: "Automated Production to COA workflow test",
      },
    },
  );

  expect(createPlanResponse.status()).toBe(200);

  const plan = await createPlanResponse.json();

  expect(plan.id).toBeTruthy();
  expect(plan.plan_number).toBe(planNumber);
  expect(plan.batch_number).toBe(batchNumber);
  expect(plan.po_number).toBe(poNumber);
  expect(plan.product).toBe(
    "Production COA Integration Test",
  );
  expect(Number(plan.planned_quantity_kg)).toBe(250);

  const planId = plan.id;

  // ============================================================
  // 3. CREATE PRODUCTION BATCH LINKED TO PPIC
  // ============================================================

  const createProductionResponse = await request.post(
    `${baseUrl}/api/production`,
    {
      headers,
      data: {
        batch_number: batchNumber,
        plan_id: planId,
        po_number: poNumber,
        customer: "Automation Pharma",
        product: "Production COA Integration Test",
        reactor: "R-01",
        planned_quantity_kg: 250,
        produced_quantity_kg: 0,
        production_status: "Not Started",
        operator: "Automation Operator",
        remarks: "Created for Production to COA integration",
      },
    },
  );

  expect(createProductionResponse.status()).toBe(200);

  const production = await createProductionResponse.json();

  expect(production.id).toBeTruthy();
  expect(production.batch_number).toBe(batchNumber);
  expect(production.plan_id).toBe(planId);
  expect(production.po_number).toBe(poNumber);
  expect(production.customer).toBe("Automation Pharma");
  expect(production.product).toBe(
    "Production COA Integration Test",
  );
  expect(Number(production.planned_quantity_kg)).toBe(250);
  expect(Number(production.produced_quantity_kg)).toBe(0);
  expect(production.production_status).toBe("Not Started");

  const productionId = production.id;

  // ============================================================
  // 4. START PRODUCTION
  // ============================================================

  const runningResponse = await request.patch(
    `${baseUrl}/api/production/${productionId}/status?status=Running`,
    {
      headers,
    },
  );

  expect(runningResponse.ok()).toBeTruthy();

  const runningProduction = await runningResponse.json();

  expect(runningProduction.production_status).toBe("Running");
  expect(runningProduction.start_time).toBeTruthy();
  expect(runningProduction.completion_time).toBeNull();

  // ============================================================
  // 5. UPDATE PRODUCED QUANTITY
  // ============================================================

  const updateProductionResponse = await request.put(
    `${baseUrl}/api/production/${productionId}`,
    {
      headers,
      data: {
        produced_quantity_kg: 250,
        remarks: "Production completed for COA testing",
      },
    },
  );

  expect(updateProductionResponse.ok()).toBeTruthy();

  const updatedProduction =
    await updateProductionResponse.json();

  expect(Number(updatedProduction.produced_quantity_kg)).toBe(250);
  expect(updatedProduction.production_status).toBe("Running");

  // ============================================================
  // 6. COMPLETE PRODUCTION
  // ============================================================

  const completedResponse = await request.patch(
    `${baseUrl}/api/production/${productionId}/status?status=Completed`,
    {
      headers,
    },
  );

  expect(completedResponse.ok()).toBeTruthy();

  const completedProduction =
    await completedResponse.json();

  expect(completedProduction.production_status).toBe(
    "Completed",
  );

  expect(Number(completedProduction.planned_quantity_kg)).toBe(
    250,
  );

  expect(Number(completedProduction.produced_quantity_kg)).toBe(
    250,
  );

  expect(completedProduction.start_time).toBeTruthy();
  expect(completedProduction.completion_time).toBeTruthy();

  // ============================================================
  // 7. CREATE COA FOR COMPLETED PRODUCTION BATCH
  // ============================================================

  const coaNumber = `COA-AUTO-${unique}`;

  const createCOAResponse = await request.post(
    `${baseUrl}/api/coa`,
    {
      headers,
      data: {
        coa_number: coaNumber,
        po_number: poNumber,
        customer: "Automation Pharma",
        product: "Production COA Integration Test",
        cas_no: "AUTO-COA-001",
        batch_number: batchNumber,
        quantity_kg: 250,

        test_status: "Pending",
        coa_status: "Draft",

        qc_approved: false,
        qa_approved: false,

        test_date: null,
        release_date: null,

        tested_by: null,
        approved_by: null,

        document_reference:
          `AUTO-DOC-${unique}`,

        remarks:
          "COA created from completed production batch",
      },
    },
  );

  expect(createCOAResponse.status()).toBe(201);

  const coa = await createCOAResponse.json();

  expect(coa.id).toBeTruthy();
  expect(coa.coa_number).toBe(coaNumber);
  expect(coa.po_number).toBe(poNumber);
  expect(coa.customer).toBe("Automation Pharma");
  expect(coa.product).toBe(
    "Production COA Integration Test",
  );
  expect(coa.batch_number).toBe(batchNumber);
  expect(Number(coa.quantity_kg)).toBe(250);
  expect(coa.test_status).toBe("Pending");
  expect(coa.coa_status).toBe("Draft");
  expect(coa.qc_approved).toBe(false);
  expect(coa.qa_approved).toBe(false);
  expect(coa.release_date).toBeNull();

  const coaId = coa.id;

  // ============================================================
  // 8. COA → TESTING
  // ============================================================

  const testingResponse = await request.patch(
    `${baseUrl}/api/coa/${coaId}/status?status=Testing`,
    {
      headers,
    },
  );

  expect(testingResponse.ok()).toBeTruthy();

  const testingCOA = await testingResponse.json();

  expect(testingCOA.coa_status).toBe("Testing");
  expect(testingCOA.release_date).toBeNull();

  // ============================================================
  // 9. UPDATE TEST RESULT → PASSED
  // ============================================================

  const passedResponse = await request.put(
    `${baseUrl}/api/coa/${coaId}`,
    {
      headers,
      data: {
        test_status: "Passed",
        test_date: new Date().toISOString(),
        tested_by: "Automation QC",
        remarks: "Automated QC test passed",
      },
    },
  );

  expect(passedResponse.ok()).toBeTruthy();

  const passedCOA = await passedResponse.json();

  expect(passedCOA.test_status).toBe("Passed");
  expect(passedCOA.tested_by).toBe("Automation QC");

  // ============================================================
  // 10. QC APPROVED
  // ============================================================

  const qcResponse = await request.patch(
    `${baseUrl}/api/coa/${coaId}/status?status=QC%20Approved`,
    {
      headers,
    },
  );

  expect(qcResponse.ok()).toBeTruthy();

  const qcCOA = await qcResponse.json();

  expect(qcCOA.coa_status).toBe("QC Approved");

  // ============================================================
  // 11. MARK QC APPROVAL FLAG
  // ============================================================

  const qcFlagResponse = await request.put(
    `${baseUrl}/api/coa/${coaId}`,
    {
      headers,
      data: {
        qc_approved: true,
        approved_by: "Automation QC",
      },
    },
  );

  expect(qcFlagResponse.ok()).toBeTruthy();

  const qcApprovedCOA =
    await qcFlagResponse.json();

  expect(qcApprovedCOA.qc_approved).toBe(true);

  // ============================================================
  // 12. QA APPROVED
  // ============================================================

  const qaResponse = await request.patch(
    `${baseUrl}/api/coa/${coaId}/status?status=QA%20Approved`,
    {
      headers,
    },
  );

  expect(qaResponse.ok()).toBeTruthy();

  const qaCOA = await qaResponse.json();

  expect(qaCOA.coa_status).toBe("QA Approved");

  // ============================================================
  // 13. MARK QA APPROVAL FLAG
  // ============================================================

  const qaFlagResponse = await request.put(
    `${baseUrl}/api/coa/${coaId}`,
    {
      headers,
      data: {
        qa_approved: true,
        approved_by: "Automation QA",
      },
    },
  );

  expect(qaFlagResponse.ok()).toBeTruthy();

  const qaApprovedCOA =
    await qaFlagResponse.json();

  expect(qaApprovedCOA.qa_approved).toBe(true);

  // ============================================================
  // 14. RELEASE COA
  // ============================================================

  const releaseResponse = await request.patch(
    `${baseUrl}/api/coa/${coaId}/status?status=Released`,
    {
      headers,
    },
  );

  expect(releaseResponse.ok()).toBeTruthy();

  const releasedCOA = await releaseResponse.json();

  expect(releasedCOA.coa_status).toBe("Released");
  expect(releasedCOA.test_status).toBe("Passed");
  expect(releasedCOA.qc_approved).toBe(true);
  expect(releasedCOA.qa_approved).toBe(true);
  expect(releasedCOA.release_date).toBeTruthy();

  // ============================================================
  // 15. VERIFY COA PERSISTENCE
  // ============================================================

  const verifyCOAResponse = await request.get(
    `${baseUrl}/api/coa/${coaId}`,
    {
      headers,
    },
  );

  expect(verifyCOAResponse.ok()).toBeTruthy();

  const verifiedCOA = await verifyCOAResponse.json();

  expect(verifiedCOA.coa_number).toBe(coaNumber);
  expect(verifiedCOA.batch_number).toBe(batchNumber);
  expect(verifiedCOA.po_number).toBe(poNumber);
  expect(verifiedCOA.coa_status).toBe("Released");
  expect(verifiedCOA.test_status).toBe("Passed");
  expect(verifiedCOA.qc_approved).toBe(true);
  expect(verifiedCOA.qa_approved).toBe(true);
  expect(verifiedCOA.release_date).toBeTruthy();

  // ============================================================
  // 16. VERIFY PRODUCTION STILL COMPLETED
  // ============================================================

  const verifyProductionResponse = await request.get(
    `${baseUrl}/api/production/${productionId}`,
    {
      headers,
    },
  );

  expect(verifyProductionResponse.ok()).toBeTruthy();

  const verifiedProduction =
    await verifyProductionResponse.json();

  expect(verifiedProduction.batch_number).toBe(batchNumber);
  expect(verifiedProduction.plan_id).toBe(planId);
  expect(verifiedProduction.production_status).toBe(
    "Completed",
  );
  expect(Number(verifiedProduction.produced_quantity_kg)).toBe(
    250,
  );

  // ============================================================
  // 17. CLEANUP COA
  // ============================================================

  const deleteCOAResponse = await request.delete(
    `${baseUrl}/api/coa/${coaId}`,
    {
      headers,
    },
  );

  expect(deleteCOAResponse.ok()).toBeTruthy();

  const deletedCOAResponse = await request.get(
    `${baseUrl}/api/coa/${coaId}`,
    {
      headers,
    },
  );

  expect(deletedCOAResponse.status()).toBe(404);

  // ============================================================
  // 18. CLEANUP PRODUCTION
  // ============================================================

  const deleteProductionResponse =
    await request.delete(
      `${baseUrl}/api/production/${productionId}`,
      {
        headers,
      },
    );

  expect(deleteProductionResponse.ok()).toBeTruthy();

  const deletedProductionResponse =
    await request.get(
      `${baseUrl}/api/production/${productionId}`,
      {
        headers,
      },
    );

  expect(deletedProductionResponse.status()).toBe(404);

  // ============================================================
  // 19. CLEANUP PPIC PLAN
  // ============================================================

  const deletePlanResponse = await request.delete(
    `${baseUrl}/api/ppic/${planId}`,
    {
      headers,
    },
  );

  expect(deletePlanResponse.ok()).toBeTruthy();

  const deletedPlanResponse = await request.get(
    `${baseUrl}/api/ppic/${planId}`,
    {
      headers,
    },
  );

  expect(deletedPlanResponse.status()).toBe(404);
});