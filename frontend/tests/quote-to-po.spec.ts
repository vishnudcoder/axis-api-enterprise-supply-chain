import { test, expect } from "@playwright/test";

test("Automated Quote to Purchase Order conversion", async ({ request }) => {
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

  // 2. Create a quote
  const quoteNumber = `QT-AUTO-${unique}`;

  const createQuoteResponse = await request.post(
    "http://127.0.0.1:8000/api/quotes",
    {
      headers,
      data: {
        quote_number: quoteNumber,
        enquiry_id: `ENQ-AUTO-${unique}`,
        customer: "Automation Pharma",
        product: "Quote Conversion API Test",
        cas_no: "12345-67-8",
        quantity_kg: 250,
        unit_price_usd: 120,
        total_value_usd: 30000,
        currency: "USD",
        payment_terms: "30% advance",
        delivery_terms: "CIF",
        validity_days: 30,
        status: "Draft",
        owner: "Automation",
        notes: "Automated Quote to PO conversion test",
      },
    },
  );

  expect(createQuoteResponse.status()).toBe(200);

  const createdQuote = await createQuoteResponse.json();

  expect(createdQuote.id).toBeTruthy();
  expect(createdQuote.quote_number).toBe(quoteNumber);
  expect(createdQuote.total_value_usd).toBe(30000);
  expect(createdQuote.status).toBe("Draft");

  const quoteId = createdQuote.id;

  // 3. Move quote to Accepted
  const acceptResponse = await request.patch(
    `http://127.0.0.1:8000/api/quotes/${quoteId}/status?status=Accepted`,
    {
      headers,
    },
  );

  expect(acceptResponse.ok()).toBeTruthy();

  const acceptedQuote = await acceptResponse.json();

  expect(acceptedQuote.id).toBe(quoteId);
  expect(acceptedQuote.status).toBe("Accepted");

  // 4. Convert Accepted Quote to PO
  const convertResponse = await request.post(
    `http://127.0.0.1:8000/api/quotes/${quoteId}/convert-to-po`,
    {
      headers,
    },
  );

  expect(convertResponse.ok()).toBeTruthy();

  const conversion = await convertResponse.json();

  expect(conversion.quote_id).toBe(quoteId);
  expect(conversion.quote_number).toBe(quoteNumber);
  expect(conversion.purchase_order_id).toBeTruthy();
  expect(conversion.po_number).toBe(`PO-${quoteNumber}`);

  const purchaseOrderId = conversion.purchase_order_id;

  // 5. Verify quote is now Converted to PO
  const quoteResponse = await request.get(
    `http://127.0.0.1:8000/api/quotes/${quoteId}`,
    {
      headers,
    },
  );

  expect(quoteResponse.ok()).toBeTruthy();

  const convertedQuote = await quoteResponse.json();

  expect(convertedQuote.status).toBe("Converted to PO");

  // 6. Verify the generated Purchase Order
  const poResponse = await request.get(
    `http://127.0.0.1:8000/api/purchase-orders/${purchaseOrderId}`,
    {
      headers,
    },
  );

  expect(poResponse.ok()).toBeTruthy();

  const purchaseOrder = await poResponse.json();

  expect(purchaseOrder.id).toBe(purchaseOrderId);
  expect(purchaseOrder.po_number).toBe(`PO-${quoteNumber}`);
  expect(purchaseOrder.customer).toBe("Automation Pharma");
  expect(purchaseOrder.product).toBe("Quote Conversion API Test");
  expect(Number(purchaseOrder.quantity_kg)).toBe(250);
  expect(Number(purchaseOrder.value_usd)).toBe(30000);
  expect(purchaseOrder.status).toBe("Confirmed");

  // 7. Verify duplicate conversion is rejected
  const duplicateConversionResponse = await request.post(
    `http://127.0.0.1:8000/api/quotes/${quoteId}/convert-to-po`,
    {
      headers,
    },
  );

  expect(duplicateConversionResponse.status()).toBe(400);

const duplicateBody = await duplicateConversionResponse.json();

expect(duplicateBody.detail).toBe(
  "Only Accepted quotes can be converted to a Purchase Order.",
);

  // 8. Cleanup generated PO
  const deletePOResponse = await request.delete(
    `http://127.0.0.1:8000/api/purchase-orders/${purchaseOrderId}`,
    {
      headers,
    },
  );

  expect(deletePOResponse.ok()).toBeTruthy();

  // 9. Cleanup generated quote
  const deleteQuoteResponse = await request.delete(
    `http://127.0.0.1:8000/api/quotes/${quoteId}`,
    {
      headers,
    },
  );

  expect(deleteQuoteResponse.ok()).toBeTruthy();
});