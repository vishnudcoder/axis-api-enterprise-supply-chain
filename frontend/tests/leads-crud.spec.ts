import { test, expect } from "@playwright/test";

test("Automated Leads CRUD workflow", async ({ page }) => {
  const enquiryId = `AUTO-LEAD-${Date.now()}`;

  // LOGIN
  await page.goto("/");

  await page.getByLabel(/email/i).fill("admin@axis.local");
  await page.getByLabel(/password/i).fill("Admin@123");

  await page
    .getByRole("button", { name: /login|sign in/i })
    .click();

  await expect(
    page.getByText("AXIS Administrator", { exact: false })
  ).toBeVisible();

  // OPEN LEADS
  await page
    .getByText("Leads", { exact: true })
    .first()
    .click();

  await expect(
    page.getByRole("button", { name: /Add Lead/i })
  ).toBeVisible();

  // CREATE LEAD
  await page
    .getByRole("button", { name: /Add Lead/i })
    .click();

  await page
    .getByRole("textbox", {
      name: /^Enquiry ID \*$/i,
    })
    .fill(enquiryId);

  await page
    .getByRole("textbox", {
      name: /^Customer \*$/i,
    })
    .fill("Automation Pharma");

  await page
    .getByRole("textbox", {
      name: /^Product \*$/i,
    })
    .fill("Paracetamol API");

  const casField = page.getByRole("textbox", {
    name: /^CAS/i,
  });

  if ((await casField.count()) > 0) {
    await casField.fill("103-90-2");
  }

  const quantityField = page.getByRole("spinbutton", {
    name: /^Quantity/i,
  });

  if ((await quantityField.count()) > 0) {
    await quantityField.fill("1000");
  }

  const valueField = page.getByRole("spinbutton", {
    name: /^Value/i,
  });

  if ((await valueField.count()) > 0) {
    await valueField.fill("25000");
  }

  await page
    .getByRole("button", {
      name: /Create Lead/i,
      exact: true,
    })
    .click();

  // VERIFY CREATED LEAD
  const leadRow = page.locator("tr").filter({
    hasText: enquiryId,
  });

  await expect(leadRow).toBeVisible();

  await expect(
    leadRow.getByText(enquiryId, {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    leadRow.getByText("Automation Pharma", {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    leadRow.getByText("Paracetamol API", {
      exact: true,
    })
  ).toBeVisible();

  // VIEW LEAD
  await leadRow
    .getByRole("button", {
      name: /View/i,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: enquiryId,
      exact: true,
    })
  ).toBeVisible();

  await expect(
    page.getByText("Automation Pharma", {
      exact: true,
    }).last()
  ).toBeVisible();

  // CLOSE VIEW MODAL
  const closeButton = page.getByRole("button", {
    name: /Close|Cancel/i,
  });

  await closeButton.last().click();

  await expect(
    page.getByRole("heading", {
      name: enquiryId,
      exact: true,
    })
  ).toHaveCount(0);

  // EDIT LEAD
  await leadRow
    .getByRole("button", {
      name: /Edit/i,
    })
    .click();

  const customerField = page.getByRole("textbox", {
    name: /^Customer \*$/i,
  });

  await expect(customerField).toBeVisible();

  await customerField.fill("Automation Pharma Updated");

  await page
    .getByRole("button", {
      name: /Save Changes|Update Lead/i,
    })
    .click();

  // VERIFY UPDATE
  const updatedRow = page.locator("tr").filter({
    hasText: enquiryId,
  });

  await expect(updatedRow).toBeVisible();

  await expect(
    updatedRow.getByText("Automation Pharma Updated", {
      exact: true,
    })
  ).toBeVisible();

  // IMPORTANT:
  // The application automatically opens the updated lead's
  // detail modal after a successful edit.
  const updatedLeadHeading = page.getByRole("heading", {
    name: enquiryId,
    exact: true,
  });

  await expect(updatedLeadHeading).toBeVisible({
    timeout: 10000,
  });

  // Close the automatically opened detail modal.
  // The heading confirms the updated detail modal is open.
  // Do not depend on a specific modal container class because the
  // rendered modal wrapper can differ from the inner modal card.
  await expect(updatedLeadHeading).toBeVisible({
    timeout: 10000,
  });

  // Close the currently visible detail modal using its own Close button.
  const detailCloseButton = page.getByRole("button", {
    name: "Close",
    exact: true,
  }).last();

  await expect(detailCloseButton).toBeVisible({
    timeout: 10000,
  });

  await detailCloseButton.click();


  // Confirm modal/overlay is gone before touching the table.
  await expect(updatedLeadHeading).toHaveCount(0, {
    timeout: 10000,
  });

  // DELETE LEAD
  const deleteButton = updatedRow.locator(
    'button[title="Delete lead"]'
  );

  await expect(deleteButton).toHaveCount(1);
  await expect(deleteButton).toBeEnabled();

  // Register browser confirmation handler BEFORE clicking Delete.
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain(enquiryId);
    await dialog.accept();
  });

  // Wait for the actual backend DELETE request.
  const deleteResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      /\/api\/leads\/\d+$/.test(response.url()),
    { timeout: 10000 }
  );

  await deleteButton.click();

  const deleteResponse = await deleteResponsePromise;

  expect(deleteResponse.ok()).toBeTruthy();

  // VERIFY LEAD REMOVED
  await expect(
    page.locator("tr").filter({
      hasText: enquiryId,
    })
  ).toHaveCount(0, {
    timeout: 10000,
  });
});
