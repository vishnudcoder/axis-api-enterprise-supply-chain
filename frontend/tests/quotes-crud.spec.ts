import { test, expect } from "@playwright/test";

test("Automated Quotes CRUD workflow", async ({ page }) => {
  const timestamp = Date.now();

  const quoteNumber = `AUTO-QUOTE-${timestamp}`;
  const enquiryId = `AUTO-ENQ-${timestamp}`;

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
  // OPEN QUOTES
  // ============================================================

  await page.goto("/quotes");

  await expect(
    page.getByRole("heading", {
      name: "Quotes",
      exact: true,
    })
  ).toBeVisible();

  // Actual button in QuotesPage.tsx:
  // "+ Create Quote"
  const createQuoteButton = page.getByRole("button", {
    name: /\+\s*Create Quote/i,
  });

  await expect(createQuoteButton).toBeVisible();

  // ============================================================
  // OPEN CREATE QUOTE FORM
  // ============================================================

  await createQuoteButton.click();

  await expect(
    page.getByRole("heading", {
      name: "Create Quote",
      exact: true,
    })
  ).toBeVisible();

  // ============================================================
  // QUOTE NUMBER
  // ============================================================

  const quoteNumberInput = page
    .getByText("Quote Number *", { exact: true })
    .locator("..")
    .locator("input");

  await expect(quoteNumberInput).toBeVisible();

  await quoteNumberInput.fill(quoteNumber);

  // ============================================================
  // ENQUIRY ID
  // ============================================================

  const enquiryInput = page
    .getByText("Enquiry ID", { exact: true })
    .locator("..")
    .locator("input");

  await enquiryInput.fill(enquiryId);

  // ============================================================
  // CUSTOMER
  // ============================================================

  const customerInput = page
    .getByText("Customer *", { exact: true })
    .locator("..")
    .locator("input");

  await expect(customerInput).toBeVisible();

  await customerInput.fill("Automation Pharma");

  // ============================================================
  // PRODUCT
  // ============================================================

  const productInput = page
    .getByText("Product *", { exact: true })
    .locator("..")
    .locator("input");

  await expect(productInput).toBeVisible();

  await productInput.fill("Paracetamol API");

  // ============================================================
  // CAS NUMBER
  // ============================================================

  const casLabel = page.getByText("CAS No.", {
    exact: true,
  });

  const casInput = casLabel
    .locator("..")
    .locator("input");

  if (await casInput.count() > 0) {
    await casInput.fill("103-90-2");
  }

  // ============================================================
  // QUANTITY
  // ============================================================

  const quantityInput = page
    .getByText("Quantity (kg)", { exact: true })
    .locator("..")
    .locator("input");

  if (await quantityInput.count() > 0) {
    await quantityInput.fill("1000");
  }

  // ============================================================
  // UNIT PRICE
  // ============================================================

  const priceInput = page
    .getByText("Unit Price (USD/kg)", {
      exact: true,
    })
    .locator("..")
    .locator("input");

  if (await priceInput.count() > 0) {
    await priceInput.fill("25");
  }

  // ============================================================
  // CURRENCY
  // ============================================================

  const currencySelect = page
    .getByText("Currency", { exact: true })
    .locator("..")
    .locator("select");

  if (await currencySelect.count() > 0) {
    await currencySelect.selectOption("USD");
  }

  // ============================================================
  // VALIDITY DAYS
  // ============================================================

  const validityInput = page
    .getByText("Validity Days", { exact: true })
    .locator("..")
    .locator("input");

  if (await validityInput.count() > 0) {
    await validityInput.fill("30");
  }

  // ============================================================
  // CREATE QUOTE
  // ============================================================

  // Your page uses browser alert after successful creation.
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "Quote created successfully"
    );

    await dialog.accept();
  });

  await page
    .getByRole("button", {
      name: "Create Quote",
      exact: true,
    })
    .click();

  // ============================================================
  // VERIFY CREATED QUOTE
  // ============================================================

  const quoteRow = page.locator("tr").filter({
    hasText: quoteNumber,
  });

  await expect(quoteRow).toBeVisible();

  await expect(
    quoteRow.getByText(quoteNumber, {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    quoteRow.getByText("Automation Pharma", {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    quoteRow.getByText("Paracetamol API", {
      exact: true,
    })
  ).toBeVisible();

  // ============================================================
  // VIEW QUOTE
  // ============================================================

  await quoteRow
    .getByRole("button", {
      name: "View",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: quoteNumber,
      exact: true,
    })
  ).toBeVisible();

  await expect(
  quoteRow.getByRole("cell", {
    name: "Automation Pharma",
    exact: true,
  })
).toBeVisible();

  await expect(
  quoteRow.locator("td").filter({
    hasText: "Paracetamol API",
  })
).toBeVisible();
  // ============================================================
  // CLOSE VIEW MODAL
  // ============================================================

  await page
    .getByRole("button", {
      name: "Close",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: quoteNumber,
      exact: true,
    })
  ).toHaveCount(0);

  // ============================================================
  // EDIT QUOTE
  // ============================================================

  const rowAfterClose = page.locator("tr").filter({
    hasText: quoteNumber,
  });

  await rowAfterClose
    .getByRole("button", {
      name: "Edit",
      exact: true,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Edit Quote",
      exact: true,
    })
  ).toBeVisible();

  // ============================================================
  // CHANGE CUSTOMER
  // ============================================================

  const editCustomerInput = page
    .getByText("Customer *", { exact: true })
    .locator("..")
    .locator("input");

  await editCustomerInput.fill(
    "Automation Pharma Updated"
  );

  // ============================================================
  // UPDATE QUOTE
  // ============================================================

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      "Quote updated successfully"
    );

    await dialog.accept();
  });

  await page
    .getByRole("button", {
      name: "Update Quote",
      exact: true,
    })
    .click();

  // ============================================================
  // VERIFY UPDATE
  // ============================================================

  const updatedRow = page.locator("tr").filter({
    hasText: quoteNumber,
  });

  await expect(updatedRow).toBeVisible();

  await expect(
    updatedRow.getByText(
      "Automation Pharma Updated",
      {
        exact: true,
      }
    )
  ).toBeVisible();

  // ============================================================
  // CHANGE STATUS → SENT
  // ============================================================

  const statusSelect = updatedRow.locator("select");

  await expect(statusSelect).toHaveCount(1);

  await statusSelect.selectOption("Sent");

  // Wait for React/API update.
  await expect(
    updatedRow.locator("select")
  ).toHaveValue("Sent");

  // ============================================================
  // RELOAD
  // ============================================================

  await page.reload();

  await expect(
    page.getByRole("heading", {
      name: "Quotes",
      exact: true,
    })
  ).toBeVisible();

  // ============================================================
  // VERIFY STATUS AFTER RELOAD
  // ============================================================

  const sentRow = page.locator("tr").filter({
    hasText: quoteNumber,
  });

  await expect(sentRow).toBeVisible();

  await expect(
    sentRow.locator("select")
  ).toHaveValue("Sent");

  // ============================================================
  // DELETE QUOTE
  // ============================================================

  const deleteButton = sentRow.getByRole(
    "button",
    {
      name: "Delete",
      exact: true,
    }
  );

  await expect(deleteButton).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(
      `Delete quote ${quoteNumber}?`
    );

    await dialog.accept();
  });

  await deleteButton.click();

  // ============================================================
  // VERIFY DELETION
  // ============================================================

  await expect(
    page.locator("tr").filter({
      hasText: quoteNumber,
    })
  ).toHaveCount(0);
});