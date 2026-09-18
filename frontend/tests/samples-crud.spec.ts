import { test, expect } from "@playwright/test";

test("Automated Samples CRUD workflow", async ({ page }) => {
  const timestamp = Date.now();

  const sampleNumber = `AUTO-SAMPLE-${timestamp}`;
  const enquiryId = `AUTO-ENQ-${timestamp}`;
  const poNumber = `AUTO-PO-${timestamp}`;
  const batchNumber = `AUTO-BATCH-${timestamp}`;

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

  // OPEN SAMPLES
  await page
    .getByText("Samples", { exact: true })
    .first()
    .click();

  await expect(
    page.getByRole("button", { name: /Add Sample/i })
  ).toBeVisible();

  // OPEN ADD SAMPLE
  await page
    .getByRole("button", { name: /Add Sample/i })
    .click();

  await page.waitForTimeout(300);

  // SAMPLE NUMBER
  const sampleNumberLabel = page.getByText(
    "Sample Number *",
    { exact: true }
  );

  await expect(sampleNumberLabel).toBeVisible();

  await sampleNumberLabel
    .locator("..")
    .locator("input")
    .fill(sampleNumber);

  // ENQUIRY ID
  const enquiryLabel = page.getByText("Enquiry ID", {
    exact: true,
  });

  if (await enquiryLabel.count() > 0) {
    const input = enquiryLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill(enquiryId);
    }
  }

  // PO NUMBER
  const poLabel = page.getByText("PO Number", {
    exact: true,
  });

  if (await poLabel.count() > 0) {
    const input = poLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill(poNumber);
    }
  }

  // CUSTOMER
  const customerLabel = page.getByText("Customer", {
    exact: true,
  });

  if (await customerLabel.count() > 0) {
    const input = customerLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill("Automation Pharma");
    }
  }

  // PRODUCT
  const productLabel = page.getByText("Product *", {
    exact: true,
  });

  await expect(productLabel).toBeVisible();

  await productLabel
    .locator("..")
    .locator("input")
    .fill("Paracetamol API");

  // CAS NUMBER
  const casLabel = page.getByText("CAS No.", {
    exact: true,
  });

  if (await casLabel.count() > 0) {
    const input = casLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill("103-90-2");
    }
  }

  // BATCH NUMBER
  const batchLabel = page.getByText("Batch Number", {
    exact: true,
  });

  if (await batchLabel.count() > 0) {
    const input = batchLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill(batchNumber);
    }
  }

  // SAMPLE QUANTITY
  const quantityLabel = page.getByText(
    /Sample Quantity/i
  );

  if (await quantityLabel.count() > 0) {
    const input = quantityLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill("100");
    }
  }

  // SAMPLE TYPE
  const sampleTypeLabel = page.getByText(
    "Sample Type",
    { exact: true }
  );

  if (await sampleTypeLabel.count() > 0) {
    const parent = sampleTypeLabel.first().locator("..");

    const select = parent.locator("select");

    if (await select.count() > 0) {
      await select.selectOption({
        label: "Development",
      });
    }
  }

  // PURPOSE
  const purposeLabel = page.getByText(
    "Purpose",
    { exact: true }
  );

  if (await purposeLabel.count() > 0) {
    const input = purposeLabel
      .first()
      .locator("..")
      .locator("input, textarea");

    if (await input.count() > 0) {
      await input.first().fill(
        "Automated sample testing"
      );
    }
  }

  // CREATE SAMPLE
  await page
    .getByRole("button", {
      name: /Create Sample/i,
      exact: true,
    })
    .click();

  // VERIFY CREATED SAMPLE
  let sampleRow = page.locator("tr").filter({
    hasText: sampleNumber,
  });

  await expect(sampleRow).toBeVisible();

  await expect(
    sampleRow.getByText(sampleNumber, {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    sampleRow.getByText("Paracetamol API", {
      exact: true,
    })
  ).toBeVisible();

  // VIEW SAMPLE
  await sampleRow
    .getByRole("button", {
      name: /View/i,
    })
    .click();

  // VERIFY VIEW
  await expect(
    page.getByRole("heading", {
      name: sampleNumber,
      exact: true,
    })
  ).toBeVisible();

  // CLOSE VIEW
  const closeButton = page.getByRole("button", {
    name: /Close|Cancel/i,
  });

  if (await closeButton.count() > 0) {
    await closeButton.last().click();
  }

  await expect(
    page.getByRole("heading", {
      name: sampleNumber,
      exact: true,
    })
  ).toHaveCount(0);

  // EDIT SAMPLE
  sampleRow = page.locator("tr").filter({
    hasText: sampleNumber,
  });

  await sampleRow
    .getByRole("button", {
      name: /Edit/i,
    })
    .click();

  // EDIT CUSTOMER
  const editCustomerLabel = page.getByText(
    "Customer",
    { exact: true }
  );

  if (await editCustomerLabel.count() > 0) {
    const input = editCustomerLabel
      .first()
      .locator("..")
      .locator("input");

    if (await input.count() > 0) {
      await input.fill(
        "Automation Pharma Updated"
      );
    }
  }

  // SAVE
  await page
    .getByRole("button", {
      name: /Save Changes|Update Sample/i,
    })
    .click();

  // WAIT FOR UPDATE
  await page.waitForTimeout(1000);

  // RELOAD
  await page.reload();

  await expect(
    page.getByRole("button", {
      name: /Add Sample/i,
    })
  ).toBeVisible();

  // FIND SAMPLE AGAIN
  sampleRow = page.locator("tr").filter({
    hasText: sampleNumber,
  });

  await expect(sampleRow).toBeVisible();

  // DELETE SAMPLE
  const deleteButton = sampleRow.getByRole(
    "button",
    {
      name: /Delete/i,
    }
  );

  await expect(deleteButton).toBeVisible();

  // ACCEPT BROWSER CONFIRMATION
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await deleteButton.click({
    force: true,
  });

  // WAIT FOR DELETE/API UPDATE
  await page.waitForTimeout(1000);

  // VERIFY DELETION
  await expect(
    page.locator("tr").filter({
      hasText: sampleNumber,
    })
  ).toHaveCount(0);
});