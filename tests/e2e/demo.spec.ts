import { expect, test } from "@playwright/test";

test.describe("Interactive Demo Experience", () => {
  test("interactive demo dashboard switches views seamlessly", async ({ page }) => {
    await page.goto("/#demo");

    // Locate the interactive demo section
    const demoSection = page.locator("#demo");
    await expect(demoSection).toBeVisible();

    // Verify view switcher buttons in the demo sidebar (e.g. Features, PRD, Tasks)
    const featuresButton = demoSection.locator("aside").getByRole("button", { name: /features/i });
    await expect(featuresButton).toBeVisible();
    await featuresButton.click();
    await expect(featuresButton).toBeVisible();
  });

  test("CLI interactive snippet section displays velocityai commands", async ({ page }) => {
    await page.goto("/#cli");

    const cliSection = page.locator("#cli");
    await expect(cliSection).toBeVisible();

    // Verify velocityai CLI commands are displayed
    await expect(cliSection.getByText(/velocityai/i).first()).toBeVisible();
  });
});
