import { defineConfig, devices } from '@playwright/test'

/**
 * Coordin.io Playwright E2E configuration.
 *
 * Runs against a local dev server (started automatically) or a deployed URL.
 * Uses Chromium by default; add Firefox/WebKit in CI for cross-browser coverage.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    /* Setup: authenticate test users, save storage state */
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },

    /* Main test suite */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/owner.json',
      },
      dependencies: ['setup'],
    },

    /* Role-specific tests use their own auth state */
    {
      name: 'rbac',
      testMatch: /rbac\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    /* Mobile viewport */
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
    },
  ],

  /* Start local dev server if no E2E_BASE_URL is set */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
