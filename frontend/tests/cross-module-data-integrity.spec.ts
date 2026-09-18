import { test, expect } from "@playwright/test";

test("Cross-module data integrity across Quote → PO → PPIC → Production → COA → Supply Chain", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8000",
  });

  const unique = Date.now();

  const quoteNumber = `QT-INT-${unique}`;
  const poNumber = `PO-${quoteNumber}`;
  const planNumber = `PPIC-INT-${unique}`;
  const batchNumber = `BATCH-INT-${unique}`;
  const coaNumber = `COA-INT-${unique}`;
  const shipmentNumber = `SHIP-INT-${unique}`;

  let quoteId: number | undefined;
  let poId: number | undefined;
  let planId: number | undefined;
  let batchId: number | undefined;
  let coaId: number | undefined;
  let shipmentId: number | undefined;

  const headers = {
    "Content-Type": "application/json",
  };

  try {
    // =========================================================
    // 1. LOGIN
    // =========================================================

    const loginResponse = await api.post("/api/auth/login", {
      data: {
        email: "admin@axis.local",
        password: "Admin@123",
      },
    });

    expect(
      loginResponse.ok(),
      `Login failed: ${await loginResponse.text()}`
    ).toBeTruthy();

    const loginData = await loginResponse.json();
    const token = loginData.access_token;

    expect(token).toBeTruthy();

    const authHeaders = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    // =========================================================
    // 2. CREATE QUOTE
    // =========================================================

    const quoteResponse = await api.post("/api/quotes", {
      headers: authHeaders,
      data: {
        quote_number: quoteNumber,
        enquiry_id: `ENQ-INT-${unique}`,
        customer: "Integrity Pharma",
        product: "API Integrity Product",
        cas_no: "12345-67-8",
        quantity_kg: 100,
        unit_price_usd: 250,
        total_value_usd: 25000,
        currency: "USD",
        payment_terms: "30 Days",
        delivery_terms: "FOB",
        validity_days: 30,
        status: "Draft",
        quote_date: new Date().toISOString(),
        valid_until: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        owner: "Integration Test",
        notes: "Cross-module integrity test",
      },
    });

    expect(
      quoteResponse.ok(),
      `Quote creation failed: ${await quoteResponse.text()}`
    ).toBeTruthy();

    const quote = await quoteResponse.json();
    quoteId = quote.id;

    expect(quote.quote_number).toBe(quoteNumber);
    expect(quote.customer).toBe("Integrity Pharma");
    expect(quote.product).toBe("API Integrity Product");
    expect(Number(quote.quantity_kg)).toBe(100);
    expect(Number(quote.total_value_usd)).toBe(25000);

    // =========================================================
    // 3. ACCEPT QUOTE
    // =========================================================

    const acceptedResponse = await api.patch(
      `/api/quotes/${quoteId}/status?status=Accepted`,
      {
        headers: authHeaders,
      }
    );

    expect(
      acceptedResponse.ok(),
      `Quote acceptance failed: ${await acceptedResponse.text()}`
    ).toBeTruthy();

    const acceptedQuote = await acceptedResponse.json();

    expect(acceptedQuote.status).toBe("Accepted");

    // =========================================================
    // 4. CONVERT QUOTE → PO
    // =========================================================

    const convertResponse = await api.post(
      `/api/quotes/${quoteId}/convert-to-po`,
      {
        headers: authHeaders,
      }
    );

    expect(
      convertResponse.ok(),
      `Quote → PO conversion failed: ${await convertResponse.text()}`
    ).toBeTruthy();

    const convertedData = await convertResponse.json();

    // The current backend conversion endpoint returns IDs/numbers
    // rather than nested quote and purchase_order objects.
    expect(convertedData.quote_id).toBe(quoteId);
    expect(convertedData.quote_number).toBe(quoteNumber);
    expect(convertedData.purchase_order_id).toBeTruthy();
    expect(convertedData.po_number).toBe(poNumber);

    poId = convertedData.purchase_order_id;

    // Fetch the newly-created PO and verify the converted data.
    const convertedPOResponse = await api.get(
      `/api/purchase-orders/${poId}`,
      {
        headers: authHeaders,
      }
    );

    expect(
      convertedPOResponse.ok(),
      `Converted PO GET failed: ${await convertedPOResponse.text()}`
    ).toBeTruthy();

    const po = await convertedPOResponse.json();

    expect(po.po_number).toBe(poNumber);
    expect(po.customer).toBe("Integrity Pharma");
    expect(po.product).toBe("API Integrity Product");
    expect(po.cas_no).toBe("12345-67-8");
    expect(Number(po.quantity_kg)).toBe(100);
    expect(Number(po.value_usd)).toBe(25000);

    // =========================================================
    // 5. VERIFY PO
    // =========================================================

    const poGetResponse = await api.get(
      `/api/purchase-orders/${poId}`,
      {
        headers: authHeaders,
      }
    );

    expect(
      poGetResponse.ok(),
      `PO GET failed: ${await poGetResponse.text()}`
    ).toBeTruthy();

    const storedPO = await poGetResponse.json();

    expect(storedPO.po_number).toBe(poNumber);
    expect(storedPO.customer).toBe(quote.customer);
    expect(storedPO.product).toBe(quote.product);
    expect(Number(storedPO.quantity_kg)).toBe(
      Number(quote.quantity_kg)
    );
    expect(Number(storedPO.value_usd)).toBe(
      Number(quote.total_value_usd)
    );

    // =========================================================
    // 6. CREATE PPIC PLAN
    // =========================================================

    const ppicResponse = await api.post("/api/ppic", {
      headers: authHeaders,
      data: {
        plan_number: planNumber,
        po_id: poId,
        po_number: poNumber,
        customer: "Integrity Pharma",
        product: "API Integrity Product",
        batch_number: batchNumber,
        required_quantity_kg: 100,
        planned_quantity_kg: 100,
        reactor: "R-INT-01",
        material_status: "Available",
        planning_status: "Confirmed",
        production_status: "Planned",
        owner: "Integration Test",
        notes: "Created for cross-module integrity test",
      },
    });

    expect(
      ppicResponse.ok(),
      `PPIC creation failed: ${await ppicResponse.text()}`
    ).toBeTruthy();

    const plan = await ppicResponse.json();
    planId = plan.id;

    expect(plan.plan_number).toBe(planNumber);
    expect(plan.po_id).toBe(poId);
    expect(plan.po_number).toBe(poNumber);
    expect(plan.customer).toBe(storedPO.customer);
    expect(plan.product).toBe(storedPO.product);
    expect(Number(plan.planned_quantity_kg)).toBe(100);

    // =========================================================
    // 7. CREATE COMPLETED PRODUCTION BATCH
    // =========================================================

    const productionResponse = await api.post("/api/production", {
      headers: authHeaders,
      data: {
        batch_number: batchNumber,
        plan_id: planId,
        po_number: poNumber,
        customer: "Integrity Pharma",
        product: "API Integrity Product",
        reactor: "R-INT-01",
        planned_quantity_kg: 100,
        produced_quantity_kg: 100,
        production_status: "Completed",
        operator: "Integration Test",
        remarks: "Completed integrity test batch",
      },
    });

    expect(
      productionResponse.ok(),
      `Production creation failed: ${await productionResponse.text()}`
    ).toBeTruthy();

    const batch = await productionResponse.json();
    batchId = batch.id;

    expect(batch.batch_number).toBe(batchNumber);
    expect(batch.plan_id).toBe(planId);
    expect(batch.po_number).toBe(poNumber);
    expect(batch.customer).toBe(storedPO.customer);
    expect(batch.product).toBe(storedPO.product);
    expect(batch.production_status).toBe("Completed");
    expect(Number(batch.produced_quantity_kg)).toBe(100);

    // =========================================================
    // 8. CREATE COA
    // =========================================================

    const coaResponse = await api.post("/api/coa", {
      headers: authHeaders,
      data: {
        coa_number: coaNumber,
        batch_number: batchNumber,
        po_number: poNumber,
        customer: "Integrity Pharma",
        product: "API Integrity Product",
        cas_no: "12345-67-8",
        specification: "Integrity Specification",
        test_status: "Passed",
        coa_status: "Draft",
        qc_approved: false,
        qa_approved: false,
        test_date: new Date().toISOString(),
        notes: "Cross-module integrity COA",
      },
    });

    expect(
      coaResponse.ok(),
      `COA creation failed: ${await coaResponse.text()}`
    ).toBeTruthy();

    const coa = await coaResponse.json();
    coaId = coa.id;

    expect(coa.coa_number).toBe(coaNumber);
    expect(coa.batch_number).toBe(batchNumber);
    expect(coa.po_number).toBe(poNumber);
    expect(coa.customer).toBe(storedPO.customer);
    expect(coa.product).toBe(storedPO.product);
    expect(coa.test_status).toBe("Passed");

    // =========================================================
    // 9. QC APPROVAL
    // =========================================================

    const qcResponse = await api.patch(
      `/api/coa/${coaId}/status?status=QC%20Approved`,
      {
        headers: authHeaders,
      }
    );

    expect(
      qcResponse.ok(),
      `QC approval failed: ${await qcResponse.text()}`
    ).toBeTruthy();

    const qcCOA = await qcResponse.json();

    expect(qcCOA.coa_status).toBe("QC Approved");
    expect(qcCOA.qc_approved).toBe(true);

    // =========================================================
    // 10. QA APPROVAL
    // =========================================================

    const qaResponse = await api.patch(
      `/api/coa/${coaId}/status?status=QA%20Approved`,
      {
        headers: authHeaders,
      }
    );

    expect(
      qaResponse.ok(),
      `QA approval failed: ${await qaResponse.text()}`
    ).toBeTruthy();

    const qaCOA = await qaResponse.json();

    expect(qaCOA.coa_status).toBe("QA Approved");
    expect(qaCOA.qc_approved).toBe(true);
    expect(qaCOA.qa_approved).toBe(true);

    // =========================================================
    // 11. RELEASE COA
    // =========================================================

    const releaseResponse = await api.patch(
      `/api/coa/${coaId}/status?status=Released`,
      {
        headers: authHeaders,
      }
    );

    expect(
      releaseResponse.ok(),
      `COA release failed: ${await releaseResponse.text()}`
    ).toBeTruthy();

    const releasedCOA = await releaseResponse.json();

    expect(releasedCOA.coa_status).toBe("Released");
    expect(releasedCOA.qc_approved).toBe(true);
    expect(releasedCOA.qa_approved).toBe(true);
    expect(releasedCOA.release_date).toBeTruthy();

    // =========================================================
    // 12. CREATE SUPPLY CHAIN SHIPMENT
    // =========================================================

    const shipmentResponse = await api.post("/api/supply-chain", {
      headers: authHeaders,
      data: {
        shipment_number: shipmentNumber,
        po_number: poNumber,
        customer: "Integrity Pharma",
        material_name: "API Integrity Product",
        material_code: "API-INT-001",
        quantity: 100,
        unit: "kg",
        source: "AXIS Plant",
        destination: "Integrity Pharma",
        carrier: "Integrity Logistics",
        tracking_number: `TRACK-${unique}`,
        transport_mode: "Road",
        priority: "Normal",
        status: "Planned",
        owner: "Integration Test",
        notes: "Cross-module integrity shipment",
      },
    });

    expect(
      shipmentResponse.ok(),
      `Supply Chain creation failed: ${await shipmentResponse.text()}`
    ).toBeTruthy();

    const shipment = await shipmentResponse.json();
    shipmentId = shipment.id;

    expect(shipment.shipment_number).toBe(shipmentNumber);
    expect(shipment.po_number).toBe(poNumber);
    expect(shipment.customer).toBe(storedPO.customer);
    expect(shipment.material_name).toBe(storedPO.product);
    expect(Number(shipment.quantity)).toBe(100);

    // =========================================================
    // 13. VERIFY COMPLETE ORDER LIFECYCLE
    // =========================================================

    const lifecycleResponse = await api.get(
      `/api/order-management/${poId}/lifecycle`,
      {
        headers: authHeaders,
      }
    );

    expect(
      lifecycleResponse.ok(),
      `Lifecycle request failed: ${await lifecycleResponse.text()}`
    ).toBeTruthy();

    const lifecycle = await lifecycleResponse.json();

    expect(lifecycle.order.po_number).toBe(poNumber);
    expect(lifecycle.order.customer).toBe("Integrity Pharma");
    expect(lifecycle.order.product).toBe("API Integrity Product");

    expect(
      lifecycle.ppic_plans.some(
        (item: any) => item.id === planId
      )
    ).toBeTruthy();

    expect(
      lifecycle.production_batches.some(
        (item: any) => item.id === batchId
      )
    ).toBeTruthy();

    expect(
      lifecycle.coas.some(
        (item: any) => item.id === coaId
      )
    ).toBeTruthy();

    expect(
      lifecycle.shipments.some(
        (item: any) => item.id === shipmentId
      )
    ).toBeTruthy();

    // =========================================================
    // 14. FINAL CROSS-MODULE ASSERTIONS
    // =========================================================

    const lifecyclePlan = lifecycle.ppic_plans.find(
      (item: any) => item.id === planId
    );

    const lifecycleBatch = lifecycle.production_batches.find(
      (item: any) => item.id === batchId
    );

    const lifecycleCOA = lifecycle.coas.find(
      (item: any) => item.id === coaId
    );

    const lifecycleShipment = lifecycle.shipments.find(
      (item: any) => item.id === shipmentId
    );

    expect(lifecyclePlan.po_number).toBe(poNumber);
    expect(lifecycleBatch.po_number).toBe(poNumber);
    expect(lifecycleBatch.plan_id).toBe(planId);

    expect(lifecycleCOA.po_number).toBe(poNumber);
    expect(lifecycleCOA.batch_number).toBe(batchNumber);
    expect(lifecycleCOA.coa_status).toBe("Released");

    expect(lifecycleShipment.po_number).toBe(poNumber);
    expect(lifecycleShipment.shipment_number).toBe(shipmentNumber);
  } finally {
    // =========================================================
    // 15. CLEANUP
    // =========================================================

    if (shipmentId) {
      await api.delete(`/api/supply-chain/${shipmentId}`, {
        headers: {
          ...headers,
          Authorization: headers.Authorization,
        },
      }).catch(() => {});
    }

    if (coaId) {
      await api.delete(`/api/coa/${coaId}`, {
        headers: {
          ...headers,
          Authorization: headers.Authorization,
        },
      }).catch(() => {});
    }

    if (batchId) {
      await api.delete(`/api/production/${batchId}`, {
        headers: {
          ...headers,
          Authorization: headers.Authorization,
        },
      }).catch(() => {});
    }

    if (planId) {
      await api.delete(`/api/ppic/${planId}`, {
        headers: {
          ...headers,
          Authorization: headers.Authorization,
        },
      }).catch(() => {});
    }

    if (poId) {
      await api.delete(`/api/purchase-orders/${poId}`, {
        headers: {
          ...headers,
          Authorization: headers.Authorization,
        },
      }).catch(() => {});
    }

    if (quoteId) {
      await api.delete(`/api/quotes/${quoteId}`, {
        headers: {
          ...headers,
          Authorization: headers.Authorization,
        },
      }).catch(() => {});
    }

    await api.dispose();
  }
});
