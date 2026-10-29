import { test, expect } from "@playwright/test";

test("production frontend login and dashboard diagnostic", async ({ page }) => {
  const apiResponses: { url: string; status: number }[] = [];
  const failedRequests: { url: string; error: string }[] = [];
  const consoleErrors: string[] = [];

  page.on("response", (response) => {
    if (response.url().includes("/api/")) {
      apiResponses.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/")) {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || "unknown",
      });
    }
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(
    "https://axis-api-enterprise-supply-chain.vercel.app",
    {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    }
  );

  await page.getByLabel(/email/i).fill("admin@axis.local");
  await page.getByLabel(/password/i).fill("Admin@123");

  await page.getByRole("button", { name: /sign in|login/i }).click();

  await page.waitForTimeout(15000);

  console.log("CURRENT URL:", page.url());
  console.log("API RESPONSES:", apiResponses);
  console.log("FAILED REQUESTS:", failedRequests);
  console.log("CONSOLE ERRORS:", consoleErrors);

  await expect(page.getByText("Dashboard", { exact: true }).first()).toBeVisible({
    timeout: 10000,
  });
});