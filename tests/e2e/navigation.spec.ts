import { expect, test } from "@playwright/test";

test.describe("Public Navigation & Legal Pages", () => {
  test("terms of service page renders legal sections and branding", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByText(/eligibility and accounts/i)).toBeVisible();
  });

  test("privacy policy page renders privacy commitments", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByText(/information we collect/i)).toBeVisible();
  });

  test("CLI docs page renders full terminal command reference", async ({ page }) => {
    await page.goto("/docs/cli");
    await expect(page).toHaveTitle(/CLI docs · VelocityAI/i);
    await expect(page.getByText(/velocityai/i).first()).toBeVisible();
  });

  test("device authorization redirects unauthenticated user to sign-in with callback", async ({ page }) => {
    await page.goto("/device");
    await expect(page).toHaveURL(/.*\/sign-in\?callbackUrl=.*device/);
    await expect(page.getByRole("heading", { name: /sign in and ship exactly/i })).toBeVisible();
  });

  test("account deletion page renders instructions", async ({ page }) => {
    await page.goto("/account-deletion");
    await expect(page.getByRole("heading", { name: /account deletion/i })).toBeVisible();
  });
});
