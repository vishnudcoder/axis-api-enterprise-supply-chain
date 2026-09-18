import { test, expect } from "@playwright/test";

test("Automated COA to Supply Chain workflow", async ({ request }) => {
  const timestamp = Date.now();

  const poNumber = `AUTO-WF-PO-${timestamp}`;
  const planNumber = `AUTO-WF-PLAN-${timestamp}`;
  const batchNumber = `AUTO-WF-BATCH-${timestamp}`;
  const coaNumber = `AUTO-WF-COA-${timestamp}`;
  const shipmentNumber = `AUTO-WF-SHIP-${timestamp}`;
  const materialCode = `AUTO-WF-MAT-${timestamp}`;

  let planId: number | undefined;
  let batchId: number | undefined;
  let coaId: number | undefined;
  let shipmentId: number | undefined;

  const login = await request.post(
    "http://127.0.0.1:8000/api/auth/login",
    {
      data: {
        email: "admin@axis.local",
        password: "Admin@123",
      },
    }
  );

  expect(
    login.ok(),
    `Login failed: ${await login.text()}`
  ).toBeTruthy();

  const loginData = await login.json();

  const token = loginData.access_token;

  expect(token).toBeTruthy();

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // ============================================================
    // 1. CREATE PPIC PLAN
    // ============================================================

    const planResponse = await request.post(
      "http://127.0.0.1:8000/api/ppic",
      {
        headers,
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
          notes: "Automated COA to Supply Chain workflow",
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

    const batchResponse = await request.post(
      "http://127.0.0.1:8000/api/production",
      {
        headers,
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
          remarks: "Automated workflow batch",
        },
      }
    );

    expect(
      batchResponse.ok(),
      `Production batch creation failed: ${await batchResponse.text()}`
    ).toBeTruthy();

    const batchData = await batchResponse.json();
    batchId = batchData.id;

    expect(batchId).toBeTruthy();

    // ============================================================
    // 3. START PRODUCTION
    // ============================================================

    const runningResponse = await request.patch(
      `http://127.0.0.1:8000/api/production/${batchId}/status?status=${encodeURIComponent("Running")}`,
      {
        headers,
      }
    );

    expect(
      runningResponse.ok(),
      `Could not start production: ${await runningResponse.text()}`
    ).toBeTruthy();

    // ============================================================
    // 4. COMPLETE PRODUCTION
    // ============================================================

    const quantityResponse = await request.put(
      `http://127.0.0.1:8000/api/production/${batchId}`,
      {
        headers,
        data: {
          produced_quantity_kg: 1000,
        },
      }
    );

    expect(
      quantityResponse.ok(),
      `Could not update produced quantity: ${await quantityResponse.text()}`
    ).toBeTruthy();

    const completedResponse = await request.patch(
      `http://127.0.0.1:8000/api/production/${batchId}/status?status=${encodeURIComponent("Completed")}`,
      {
        headers,
      }
    );

    expect(
      completedResponse.ok(),
      `Could not complete production: ${await completedResponse.text()}`
    ).toBeTruthy();

    // ============================================================
    // 5. CREATE COA
    // Production must be completed before COA creation.
    // ============================================================

    const coaResponse = await request.post(
      "http://127.0.0.1:8000/api/coa",
      {
        headers,
        data: {
          coa_number: coaNumber,
          po_number: poNumber,
          customer: "Automation Pharma",
          product: "Paracetamol API",
          cas_no: "103-90-2",
          batch_number: batchNumber,
          quantity_kg: 1000,
          test_status: "In Testing",
          coa_status: "Draft",
          qc_approved: false,
          qa_approved: false,
          tested_by: "Automation QC",
          remarks: "Automated workflow COA",
        },
      }
    );

    expect(
      coaResponse.ok(),
      `COA creation failed: ${await coaResponse.text()}`
    ).toBeTruthy();

    const coaData = await coaResponse.json();
    coaId = coaData.id;

    expect(coaId).toBeTruthy();

    // ============================================================
    // 6. COA TEST PASSED
    // ============================================================

    const passedResponse = await request.put(
      `http://127.0.0.1:8000/api/coa/${coaId}`,
      {
        headers,
        data: {
          test_status: "Passed",
        },
      }
    );

    expect(
      passedResponse.ok(),
      `Could not mark COA Passed: ${await passedResponse.text()}`
    ).toBeTruthy();

    // ============================================================
    // 7. QC APPROVAL
    // IMPORTANT: approval flag is saved BEFORE status transition.
    // ============================================================

    const qcFlagResponse = await request.put(
      `http://127.0.0.1:8000/api/coa/${coaId}`,
      {
        headers,
        data: {
          qc_approved: true,
        },
      }
    );

    expect(
      qcFlagResponse.ok(),
      `Could not save QC approval: ${await qcFlagResponse.text()}`
    ).toBeTruthy();

    const qcStatusResponse = await request.patch(
      `http://127.0.0.1:8000/api/coa/${coaId}/status?status=${encodeURIComponent(
        "QC Approved"
      )}`,
      {
        headers,
      }
    );

    expect(
      qcStatusResponse.ok(),
      `QC Approved transition failed: ${await qcStatusResponse.text()}`
    ).toBeTruthy();

    // ============================================================
    // 8. QA APPROVAL
    // QC must already be approved.
    // ============================================================

    const qaFlagResponse = await request.put(
      `http://127.0.0.1:8000/api/coa/${coaId}`,
      {
        headers,
        data: {
          qa_approved: true,
        },
      }
    );

    expect(
      qaFlagResponse.ok(),
      `Could not save QA approval: ${await qaFlagResponse.text()}`
    ).toBeTruthy();

    const qaResponse = await request.patch(
      `http://127.0.0.1:8000/api/coa/${coaId}/status?status=${encodeURIComponent(
        "QA Approved"
      )}`,
      {
        headers,
      }
    );

    expect(
      qaResponse.ok(),
      `QA Approved transition failed: ${await qaResponse.text()}`
    ).toBeTruthy();

    // ============================================================
    // 9. RELEASE COA
    // Both QC and QA approvals must exist.
    // ============================================================

    const releaseResponse = await request.patch(
      `http://127.0.0.1:8000/api/coa/${coaId}/status?status=${encodeURIComponent(
        "Released"
      )}`,
      {
        headers,
      }
    );

    expect(
      releaseResponse.ok(),
      `COA release failed: ${await releaseResponse.text()}`
    ).toBeTruthy();

    const releasedCoa = await releaseResponse.json();

    expect(releasedCoa.coa_status).toBe("Released");
    expect(releasedCoa.qc_approved).toBeTruthy();
    expect(releasedCoa.qa_approved).toBeTruthy();

    // ============================================================
    // 10. CREATE SHIPMENT
    // Shipment creation requires a Released COA for the PO.
    // ============================================================

    const shipmentResponse = await request.post(
      "http://127.0.0.1:8000/api/supply-chain",
      {
        headers,
        data: {
          shipment_number: shipmentNumber,
          po_number: poNumber,
          customer: "Automation Pharma",
          material_name: "Paracetamol API",
          material_code: materialCode,
          quantity: 1000,
          unit: "kg",
          source_location: "Plant",
          destination: "Customer",
          carrier: "Automation Carrier",
          tracking_number: `AUTO-TRACK-${timestamp}`,
          transport_mode: "Road",
          priority: "Normal",
          status: "Planned",
          owner: "Automation Test",
          notes: "Created only after COA release",
        },
      }
    );

    expect(
      shipmentResponse.ok(),
      `Shipment creation failed: ${await shipmentResponse.text()}`
    ).toBeTruthy();

    const shipmentData = await shipmentResponse.json();
    shipmentId = shipmentData.id;

    expect(shipmentId).toBeTruthy();
    expect(shipmentData.status).toBe("Planned");

    // ============================================================
    // 11. PLANNED -> READY FOR DISPATCH
    // ============================================================

    const readyResponse = await request.patch(
      `http://127.0.0.1:8000/api/supply-chain/${shipmentId}/status?status=${encodeURIComponent(
        "Ready for Dispatch"
      )}`,
      {
        headers,
      }
    );

    expect(
      readyResponse.ok(),
      `Ready for Dispatch transition failed: ${await readyResponse.text()}`
    ).toBeTruthy();

    // ============================================================
    // 12. READY FOR DISPATCH -> DISPATCHED
    // ============================================================

    const dispatchedResponse = await request.patch(
      `http://127.0.0.1:8000/api/supply-chain/${shipmentId}/status?status=${encodeURIComponent(
        "Dispatched"
      )}`,
      {
        headers,
      }
    );

    expect(
      dispatchedResponse.ok(),
      `Dispatch transition failed: ${await dispatchedResponse.text()}`
    ).toBeTruthy();

    const dispatchedData = await dispatchedResponse.json();

    expect(dispatchedData.status).toBe("Dispatched");
    expect(dispatchedData.actual_dispatch).toBeTruthy();

    // ============================================================
    // 13. DISPATCHED -> IN TRANSIT
    // ============================================================

    const transitResponse = await request.patch(
      `http://127.0.0.1:8000/api/supply-chain/${shipmentId}/status?status=${encodeURIComponent(
        "In Transit"
      )}`,
      {
        headers,
      }
    );

    expect(
      transitResponse.ok(),
      `In Transit transition failed: ${await transitResponse.text()}`
    ).toBeTruthy();

    expect((await transitResponse.json()).status).toBe("In Transit");

    // ============================================================
    // 14. IN TRANSIT -> DELIVERED
    // ============================================================

    const deliveredResponse = await request.patch(
      `http://127.0.0.1:8000/api/supply-chain/${shipmentId}/status?status=${encodeURIComponent(
        "Delivered"
      )}`,
      {
        headers,
      }
    );

    expect(
      deliveredResponse.ok(),
      `Delivered transition failed: ${await deliveredResponse.text()}`
    ).toBeTruthy();

    const deliveredData = await deliveredResponse.json();

    expect(deliveredData.status).toBe("Delivered");
    expect(deliveredData.actual_delivery).toBeTruthy();
  } finally {
    // ============================================================
    // CLEANUP - reverse dependency order
    // ============================================================

    if (shipmentId) {
      await request.delete(
        `http://127.0.0.1:8000/api/supply-chain/${shipmentId}`,
        { headers }
      );
    }

    if (coaId) {
      await request.delete(
        `http://127.0.0.1:8000/api/coa/${coaId}`,
        { headers }
      );
    }

    if (batchId) {
      await request.delete(
        `http://127.0.0.1:8000/api/production/${batchId}`,
        { headers }
      );
    }

    if (planId) {
      await request.delete(
        `http://127.0.0.1:8000/api/ppic/${planId}`,
        { headers }
      );
    }
  }
});
