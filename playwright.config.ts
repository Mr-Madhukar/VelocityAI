import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Configuration for VelocityAI
 * Follows modern 2026 E2E best practices:
 * - Cross-browser testing (Chromium, Firefox, WebKit)
 * - Auto-waiting locators and web-first assertions
 * - Automatic dev/start web server integration
 * - Trace, screenshot, and video capture on retry/failure
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["dot"], ["html"]] : [["list"], ["html"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? "pnpm --filter @shipflow/web start"
      : "pnpm --filter @shipflow/web dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
