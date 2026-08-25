/**
 * Global setup — authenticates test users and saves storage state.
 *
 * Runs once before the test suite. Each role gets its own auth file
 * so tests can switch between users without re-authenticating.
 */
import { test as setup, expect } from '@playwright/test'
import { TEST_USERS } from './fixtures/test-users'

const ROLES_TO_AUTH = ['owner', 'admin', 'manager', 'member', 'viewer'] as const

for (const role of ROLES_TO_AUTH) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const user = TEST_USERS[role]

    await page.goto('/login')
    await page.getByLabel(/email/i).fill(user.email)
    await page.getByLabel(/password/i).fill(user.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Wait for redirect to dashboard or onboarding
    await expect(page).toHaveURL(/\/(dashboard|onboarding|my-work)/)

    // Save authenticated state
    await page.context().storageState({ path: `e2e/.auth/${role}.json` })
  })
}
