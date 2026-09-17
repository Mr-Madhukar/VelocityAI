import { expect, test } from "@playwright/test";

test.describe("Smoke Suite @smoke", () => {
  test("landing page loads successfully with brand and hero elements", async ({ page }) => {
    await page.goto("/");

    // Verify page title
    await expect(page).toHaveTitle(/VelocityAI/i);

    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Verify header brand element
    const brand = header.getByRole("link", { name: /velocityai/i }).first();
    await expect(brand).toBeVisible();

    // Verify header navigation links
    await expect(header.getByRole("link", { name: /^demo$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^how it works$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^features$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^cli$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^pricing$/i })).toBeVisible();

    // Verify Call-to-Action buttons in header
    await expect(header.getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();

    // Verify footer branding
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/velocityai/i).first()).toBeVisible();
  });

  test("theme toggle button is interactable", async ({ page }) => {
    await page.goto("/");

    // Locate theme toggle button in the header
    const themeBtn = page.getByRole("button", { name: /toggle theme/i });
    await expect(themeBtn).toBeVisible();
    await expect(themeBtn).toBeEnabled();
  });
});
