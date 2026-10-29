import { expect, test } from "@playwright/test";

test("links customer requests to Quality samples and Tests Pending", async ({ page }) => {
  const customerSampleId = "7f9ea6dc-c0d2-45ac-a2b1-5799dc46a101";
  const qualitySampleId = "8ea7b1ed-d1e3-46bd-b3c2-6800ed57b202";
  const productId = "9fb8c2fe-e2f4-47ce-c4d3-7911fe68c303";
  const batchId = "a0c9d30f-f305-48df-d5e4-8a022f79d404";
  const testRequestId = "b1dae410-0416-49e0-e6f5-9b13308ae505";
  const product = {
    product_id: productId,
    product_code: "API-001",
    product_name: "Example API",
  };
  const customerSample = {
    sample_id: customerSampleId,
    sample_number: "CS-2026-0001",
    sample_status: "REQUESTED",
    product_id: productId,
    ...product,
    requested_at: "2026-10-25T10:00:00Z",
  };
  const qualitySample = {
    quality_sample_id: qualitySampleId,
    sample_number: "QS-2026-000001",
    product_id: productId,
    product_name: product.product_name,
    customer_sample_id: customerSampleId,
    customer_sample_number: customerSample.sample_number,
    sample_type: "CUSTOMER",
    collected_at: "2026-10-25T12:00:00Z",
    batch_id: batchId,
    batch_number: "BATCH-001",
    status: "REGISTERED",
  };
  let qualitySamplePayload: Record<string, unknown> | null = null;

  const user = {
    id: "test-user",
    email: "quality@example.test",
    full_name: "Quality Tester",
    employee_id: null,
    department: null,
    phone: null,
    status: "active",
    created_at: "2026-10-25T00:00:00Z",
    last_login: null,
    role: {
      id: "managing-director",
      name: "Managing Director",
      description: "Sample module test user",
      permissions: [
        {
          page: "Customers",
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_approve: false,
        },
        {
          page: "Samples",
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_approve: false,
        },
      ],
    },
  };

  await page.addInitScript((storedUser) => {
    localStorage.setItem("axis_token", "test-access-token");
    localStorage.setItem("axis_user", JSON.stringify(storedUser));
  }, user);

  await page.route("**/api/auth/supabase-me", (route) =>
    route.fulfill({ json: user }),
  );
  await page.route("**/api/sample-management/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith("/customer-requests/statuses")) {
      return route.fulfill({ json: { items: ["REQUESTED"] } });
    }
    if (path.endsWith("/customer-requests/lookups")) {
      return route.fulfill({
        json: {
          customers: [],
          leads: [],
          products: [product],
        },
      });
    }
    if (path.endsWith("/customer-requests") && method === "GET") {
      return route.fulfill({ json: { items: [customerSample], total: 1 } });
    }
    if (path.endsWith(`/customer-requests/${customerSampleId}`)) {
      return route.fulfill({ json: customerSample });
    }
    if (path.endsWith("/quality-samples/lookups")) {
      return route.fulfill({
        json: {
          products: [product],
          batches: [{ batch_id: batchId, batch_number: "BATCH-001", product_id: productId }],
          material_lots: [],
          customer_samples: [customerSample],
          sample_types: [{ sample_type_code: "CUSTOMER", sample_type_name: "Customer sample" }],
        },
      });
    }
    if (path.endsWith("/quality-samples/statuses")) {
      return route.fulfill({ json: { items: ["REGISTERED"] } });
    }
    if (path.endsWith("/quality-samples") && method === "POST") {
      qualitySamplePayload = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: qualitySample });
    }
    if (path.endsWith("/quality-samples") && method === "GET") {
      return route.fulfill({ json: { items: [qualitySample], total: 1 } });
    }
    if (path.endsWith("/test-requests/statuses")) {
      return route.fulfill({ json: { request_statuses: ["REQUESTED"], result_statuses: [] } });
    }
    if (path.endsWith("/test-requests") && method === "GET") {
      return route.fulfill({
        json: {
          items: [{
            test_request_id: testRequestId,
            quality_sample_id: qualitySampleId,
            sample_number: qualitySample.sample_number,
            customer_sample_id: customerSampleId,
            customer_sample_number: customerSample.sample_number,
            product_code: product.product_code,
            product_name: product.product_name,
            test_panel_code: "IDENTITY",
            requested_at: "2026-10-25T13:00:00Z",
            status: "REQUESTED",
          }],
          total: 1,
        },
      });
    }
    return route.fulfill({ status: 404, json: { detail: `Unexpected API request: ${path}` } });
  });

  await page.goto("/samples");
  await expect(page.getByRole("tab", { name: "Customer Requests" })).toBeVisible();

  const requestRow = page.getByRole("row").filter({ hasText: customerSample.sample_number });
  await requestRow.getByRole("button", { name: "View" }).click();
  await page.getByRole("button", { name: "Register Quality Sample" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Commercial customer request")).toHaveValue(customerSampleId);
  await expect(dialog.getByLabel("Product *")).toHaveValue(productId);
  await expect(dialog.getByLabel("Sample number *")).toHaveCount(0);
  await dialog.getByLabel("Approved sample type *").selectOption("CUSTOMER");
  await dialog.getByLabel("Collected at *").fill("2026-10-25T12:00");
  await dialog.getByLabel("Manufacturing batch *").selectOption(batchId);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("row").filter({ hasText: qualitySample.sample_number })).toBeVisible();
  expect(qualitySamplePayload).toMatchObject({
    p_customer_sample_id: customerSampleId,
    product_id: productId,
    sample_type: "CUSTOMER",
    batch_id: batchId,
    material_lot_id: null,
  });
  expect(qualitySamplePayload?.request_id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(qualitySamplePayload).not.toHaveProperty("sample_number");

  await page.getByRole("tab", { name: "Tests Pending" }).click();
  const testRow = page.getByRole("row").filter({ hasText: testRequestId });
  await expect(testRow).toContainText(customerSample.sample_number);
  await expect(testRow).toContainText(qualitySample.sample_number);
});
