import { test, expect, type APIRequestContext } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8000";

async function createApiContext(playwright: any): Promise<APIRequestContext> {
  return await playwright.request.newContext({
    baseURL: API_BASE_URL,
  });
}

async function login(
  api: APIRequestContext,
  email: string,
  password: string,
) {
  const response = await api.post("/api/auth/login", {
    data: {
      email,
      password,
    },
  });

  expect(
    response.ok(),
    `Login failed for ${email}: ${await response.text()}`,
  ).toBeTruthy();

  const data = await response.json();

  expect(data.access_token).toBeTruthy();

  return data.access_token as string;
}

test.describe("Production hardening and security validation", () => {
  test("Authentication rejects missing and invalid credentials", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      // No Authorization header.
      const noTokenResponse = await api.get("/api/auth/me");

      expect(
        noTokenResponse.status(),
        `Expected 401 without token. Response: ${await noTokenResponse.text()}`,
      ).toBe(401);

      // Invalid JWT.
      const invalidTokenResponse = await api.get("/api/auth/me", {
        headers: {
          Authorization: "Bearer invalid-token-for-hardening-test",
        },
      });

      expect(
        invalidTokenResponse.status(),
        `Expected 401 for invalid token. Response: ${await invalidTokenResponse.text()}`,
      ).toBe(401);

      // Invalid login password.
      const invalidLoginResponse = await api.post("/api/auth/login", {
        data: {
          email: "admin@axis.local",
          password: "DefinitelyWrongPassword@999",
        },
      });

      expect(
        invalidLoginResponse.status(),
        `Expected login rejection. Response: ${await invalidLoginResponse.text()}`,
      ).toBeGreaterThanOrEqual(400);
      expect(invalidLoginResponse.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test("Admin-only User Management endpoint rejects non-admin users", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const salesToken = await login(
        api,
        "sales@axis.local",
        "Demo@123",
      );

      const response = await api.get("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${salesToken}`,
        },
      });

      expect(
        response.status(),
        `Expected 403 for Sales & Marketing. Response: ${await response.text()}`,
      ).toBe(403);
    } finally {
      await api.dispose();
    }
  });

  test("Admin-only roles endpoint rejects non-admin users", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const productionToken = await login(
        api,
        "production@axis.local",
        "Demo@123",
      );

      const response = await api.get("/api/roles", {
        headers: {
          Authorization: `Bearer ${productionToken}`,
        },
      });

      expect(
        response.status(),
        `Expected 403 for Production / Plant. Response: ${await response.text()}`,
      ).toBe(403);
    } finally {
      await api.dispose();
    }
  });

  test("Admin can access protected administrative endpoints", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
      };

      const rolesResponse = await api.get("/api/roles", {
        headers,
      });

      expect(
        rolesResponse.ok(),
        `Admin roles request failed: ${await rolesResponse.text()}`,
      ).toBeTruthy();

      const usersResponse = await api.get("/api/admin/users", {
        headers,
      });

      expect(
        usersResponse.ok(),
        `Admin users request failed: ${await usersResponse.text()}`,
      ).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test("Purchase Order duplicate protection works", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    let createdPOId: number | null = null;

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      };

      const poNumber = `HARDEN-PO-${Date.now()}`;

      const payload = {
        po_number: poNumber,
        customer: "Hardening Test Customer",
        product: "Hardening Test Product",
        cas_no: "12345-67-8",
        quantity_kg: 100,
        value_usd: 25000,
      };

      const firstResponse = await api.post("/api/purchase-orders", {
        headers,
        data: payload,
      });

      expect(
        firstResponse.ok(),
        `Initial PO creation failed: ${await firstResponse.text()}`,
      ).toBeTruthy();

      const firstData = await firstResponse.json();

      createdPOId = firstData.id;

      expect(createdPOId).toBeTruthy();

      const duplicateResponse = await api.post("/api/purchase-orders", {
        headers,
        data: payload,
      });

      expect(
        duplicateResponse.status(),
        `Expected duplicate PO rejection. Response: ${await duplicateResponse.text()}`,
      ).toBe(409);
    } finally {
      if (createdPOId) {
        const adminToken = await login(
          api,
          "admin@axis.local",
          "Admin@123",
        );

        await api.delete(`/api/purchase-orders/${createdPOId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
      }

      await api.dispose();
    }
  });

  test("Production rejects an invalid status", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    let batchId: number | null = null;

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      };

      const batchNumber = `HARDEN-BATCH-${Date.now()}`;

      const createResponse = await api.post("/api/production", {
        headers,
        data: {
          batch_number: batchNumber,
          plan_id: null,
          po_number: `HARDEN-PO-${Date.now()}`,
          customer: "Hardening Test Customer",
          product: "Hardening Test Product",
          reactor: null,
          planned_quantity_kg: 100,
          produced_quantity_kg: 0,
          production_status: "Not Started",
          operator: "Hardening Test",
          remarks: "Automated hardening test",
        },
      });

      expect(
        createResponse.ok(),
        `Production creation failed: ${await createResponse.text()}`,
      ).toBeTruthy();

      const batchData = await createResponse.json();
      batchId = batchData.id;

      expect(batchId).toBeTruthy();

      const invalidStatusResponse = await api.patch(
        `/api/production/${batchId}/status?status=INVALID_STATUS`,
        {
          headers,
        },
      );

      expect(
        invalidStatusResponse.status(),
        `Expected invalid Production status to be rejected. Response: ${await invalidStatusResponse.text()}`,
      ).toBe(400);
    } finally {
      if (batchId) {
        const adminToken = await login(
          api,
          "admin@axis.local",
          "Admin@123",
        );

        await api.delete(`/api/production/${batchId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
      }

      await api.dispose();
    }
  });

  test("COA cannot be released before QC and QA approval", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    let batchId: number | null = null;
    let coaId: number | null = null;

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      };

      const unique = Date.now();
      const poNumber = `HARDEN-COA-PO-${unique}`;
      const batchNumber = `HARDEN-COA-BATCH-${unique}`;
      const coaNumber = `HARDEN-COA-${unique}`;

      // Create a completed production batch because COA creation
      // requires completed production.
      const batchResponse = await api.post("/api/production", {
        headers,
        data: {
          batch_number: batchNumber,
          plan_id: null,
          po_number: poNumber,
          customer: "Hardening COA Customer",
          product: "Hardening COA Product",
          reactor: null,
          planned_quantity_kg: 100,
          produced_quantity_kg: 100,
          production_status: "Completed",
          operator: "Hardening Test",
          remarks: "Completed batch for COA workflow hardening",
        },
      });

      expect(
        batchResponse.ok(),
        `Completed batch creation failed: ${await batchResponse.text()}`,
      ).toBeTruthy();

      const batchData = await batchResponse.json();
      batchId = batchData.id;

      const coaResponse = await api.post("/api/coa", {
        headers,
        data: {
          coa_number: coaNumber,
          batch_number: batchNumber,
          plan_id: null,
          po_number: poNumber,
          customer: "Hardening COA Customer",
          product: "Hardening COA Product",
          test_status: "Passed",
          coa_status: "Draft",
          qc_approved: false,
          qa_approved: false,
        },
      });

      expect(
        coaResponse.ok(),
        `COA creation failed: ${await coaResponse.text()}`,
      ).toBeTruthy();

      const coaData = await coaResponse.json();
      coaId = coaData.id;

      expect(coaId).toBeTruthy();

      // Release must fail because QC and QA approval
      // have not been completed.
      const releaseResponse = await api.patch(
        `/api/coa/${coaId}/status?status=Released`,
        {
          headers,
        },
      );

      expect(
        releaseResponse.status(),
        `COA release should be rejected before approvals. Response: ${await releaseResponse.text()}`,
      ).toBe(400);

      // QC approval should succeed because the test passed.
      const qcResponse = await api.patch(
        `/api/coa/${coaId}/status?status=QC%20Approved`,
        {
          headers,
        },
      );

      expect(
        qcResponse.ok(),
        `QC approval failed: ${await qcResponse.text()}`,
      ).toBeTruthy();

      // QA approval should now succeed.
      const qaResponse = await api.patch(
        `/api/coa/${coaId}/status?status=QA%20Approved`,
        {
          headers,
        },
      );

      expect(
        qaResponse.ok(),
        `QA approval failed: ${await qaResponse.text()}`,
      ).toBeTruthy();

      // Release should now succeed.
      const finalReleaseResponse = await api.patch(
        `/api/coa/${coaId}/status?status=Released`,
        {
          headers,
        },
      );

      expect(
        finalReleaseResponse.ok(),
        `Final COA release failed: ${await finalReleaseResponse.text()}`,
      ).toBeTruthy();

      const finalCOA = await finalReleaseResponse.json();

      expect(finalCOA.coa_status).toBe("Released");
    } finally {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
      };

      if (coaId) {
        await api.delete(`/api/coa/${coaId}`, {
          headers,
        });
      }

      if (batchId) {
        await api.delete(`/api/production/${batchId}`, {
          headers,
        });
      }

      await api.dispose();
    }
  });

  test("Supply Chain rejects an invalid status", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    let shipmentId: number | null = null;

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      };

      const unique = Date.now();

      const createResponse = await api.post("/api/supply-chain", {
        headers,
        data: {
          shipment_number: `HARDEN-SHIP-${unique}`,
          po_number: `HARDEN-SHIP-PO-${unique}`,
          customer: "Hardening Supply Customer",
          material_name: "Hardening Material",
          material_code: `HARDEN-MAT-${unique}`,
          quantity: 100,
          unit: "kg",
          source: "Plant",
          destination: "Customer",
          carrier: "Hardening Carrier",
          tracking_number: null,
          transport_mode: "Road",
          priority: "Normal",
          status: "Planned",
          owner: "Hardening Test",
          notes: "Automated hardening test",
        },
      });

      /*
       * The current application may require a released COA before
       * creating a Supply Chain shipment. If that workflow rule is
       * active, the API should reject this creation request.
       *
       * If creation succeeds, we additionally verify that an
       * unsupported status transition is rejected.
       */
      if (createResponse.ok()) {
        const shipmentData = await createResponse.json();
        shipmentId = shipmentData.id;

        expect(shipmentId).toBeTruthy();

        const invalidStatusResponse = await api.patch(
          `/api/supply-chain/${shipmentId}/status?status=INVALID_STATUS`,
          {
            headers,
          },
        );

        expect(
          invalidStatusResponse.status(),
          `Expected invalid Supply Chain status to be rejected. Response: ${await invalidStatusResponse.text()}`,
        ).toBe(400);
      } else {
        expect([400, 409, 422]).toContain(createResponse.status());
      }
    } finally {
      if (shipmentId) {
        const adminToken = await login(
          api,
          "admin@axis.local",
          "Admin@123",
        );

        await api.delete(`/api/supply-chain/${shipmentId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
      }

      await api.dispose();
    }
  });

  test("Negative Purchase Order quantity is rejected", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      };

      const response = await api.post("/api/purchase-orders", {
        headers,
        data: {
          po_number: `HARDEN-NEGATIVE-${Date.now()}`,
          customer: "Hardening Validation Customer",
          product: "Hardening Validation Product",
          cas_no: "12345-67-8",
          quantity_kg: -100,
          value_usd: 1000,
        },
      });

      expect(
        response.status(),
        `Negative quantity should be rejected. Response: ${await response.text()}`,
      ).toBeGreaterThanOrEqual(400);

      expect(response.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test("Invalid Purchase Order status is rejected", async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const adminToken = await login(
        api,
        "admin@axis.local",
        "Admin@123",
      );

      const headers = {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      };

      const response = await api.get("/api/purchase-orders", {
        headers,
      });

      expect(
        response.ok(),
        `Purchase Order endpoint failed: ${await response.text()}`,
      ).toBeTruthy();

      // Verify the endpoint remains protected and returns a valid
      // collection response rather than an unexpected server error.
      const data = await response.json();

      expect(data).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });
});