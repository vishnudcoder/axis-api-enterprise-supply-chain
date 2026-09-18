import { test, expect } from "@playwright/test";

test("Order Management live lifecycle workflow", async ({ page, request }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill("admin@axis.local");
  await page.getByLabel("Password").fill("Admin@123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: "Order Management" }).click();
  await expect(page).toHaveURL(/\/order-management$/);
  await expect(
    page.getByRole("heading", { name: "Order Management", exact: true }),
  ).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem("axis_token"));
  expect(token).toBeTruthy();

  const unique = Date.now();
  const poNumber = `OM-AUTO-${unique}`;

  const createResponse = await request.post(
    "http://127.0.0.1:8000/api/purchase-orders",
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        po_number: poNumber,
        customer: "Automation Pharma",
        product: "Order Management Test Product",
        cas_no: "OM-001",
        quantity_kg: 125,
        value_usd: 45000,
        status: "Confirmed",
        production_status: "Not Started",
        qc_status: "Pending",
        dispatch_status: "Pending",
        owner: "Automation",
        notes: "Automated Order Management lifecycle test",
      },
    },
  );

  expect(createResponse.status()).toBe(200);
  const created = await createResponse.json();
  const orderId = created.id;

  try {
    await page.getByPlaceholder(
      "Search PO, customer, product, reactor...",
    ).fill(poNumber);

    await expect(page.getByText(poNumber, { exact: true })).toBeVisible();

    const detailButton = page.getByTitle(`View ${poNumber}`);
    await detailButton.click();

    await expect(page.getByRole("heading", { name: poNumber, exact: true })).toBeVisible();
    await expect(page.getByText("Order lifecycle", { exact: true })).toBeVisible();
    await expect(page.getByText("Next action:", { exact: false })).toBeVisible();

    const transitions = [
      ["Planning", "20%"],
      ["In Production", "45%"],
      ["QC Release", "65%"],
      ["Ready for Dispatch", "80%"],
      ["Dispatched", "95%"],
      ["Completed", "100%"],
    ];

    for (const [nextStatus, progress] of transitions) {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/order-management/${orderId}/status`) &&
          response.request().method() === "PATCH",
      );

      const statusSelect = page.locator(".om-status select");
      await statusSelect.selectOption({ label: nextStatus });

      await responsePromise;
      await expect(page.locator(".om-status select")).toHaveValue(nextStatus);
      await expect(page.getByText(progress, { exact: true })).toBeVisible();
    }

    const summaryResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/order-management/summary") &&
        response.request().method() === "GET",
    );

    await page.getByRole("button", { name: "Close order details" }).click();
    await page.getByRole("button", { name: "Refresh" }).click();
    await summaryResponse;

    await expect(page.getByText(poNumber, { exact: true })).toBeVisible();
  } finally {
    await request.delete(
      `http://127.0.0.1:8000/api/purchase-orders/${orderId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }
});

