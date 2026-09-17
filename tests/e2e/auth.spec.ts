import { expect, test } from "@playwright/test";

test.describe("Authentication Journey", () => {
  test("sign-in page renders brand, providers, and email login form", async ({ page }) => {
    await page.goto("/sign-in");

    // Check page title and heading
    await expect(page).toHaveURL(/.*\/sign-in/);
    await expect(page.getByRole("heading", { name: /sign in and ship exactly/i })).toBeVisible();

    // Check branding element
    await expect(page.getByAltText("VelocityAI").first()).toBeVisible();
    await expect(page.getByText("Welcome back")).toBeVisible();

    // Verify OAuth provider buttons
    const googleBtn = page.getByRole("button", { name: /continue with google/i });
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();

    const githubBtn = page.getByRole("button", { name: /continue with github/i });
    await expect(githubBtn).toBeVisible();
    await expect(githubBtn).toBeEnabled();

    // Wait for form hydration
    const form = page.locator("form[data-hydrated='true']");
    await expect(form).toBeVisible();

    // Verify Email inputs
    const emailInput = page.getByLabel(/^email$/i);
    const passwordInput = page.getByLabel(/^password$/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Email submit button should be disabled when inputs are empty
    const submitBtn = page.getByRole("button", { name: /sign in with email/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Fill inputs and verify submit button enables
    await emailInput.fill("test.engineer@velocityai.in");
    await passwordInput.fill("SafePassword123!");
    await expect(submitBtn).toBeEnabled();

    // Back link to home
    const backLink = page.getByRole("link", { name: /back to velocityai/i }).first();
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test("password visibility toggle works as expected", async ({ page }) => {
    await page.goto("/sign-in");

    // Wait for form hydration
    const form = page.locator("form[data-hydrated='true']");
    await expect(form).toBeVisible();

    const passwordInput = page.getByLabel(/^password$/i);
    await passwordInput.fill("SuperSecret123!");

    // Initially type is password
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Locate the toggle button by role and aria-label
    const toggleButton = page.getByRole("button", { name: /show password/i });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    const hideButton = page.getByRole("button", { name: /hide password/i });
    await expect(hideButton).toBeVisible();
    await hideButton.click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
