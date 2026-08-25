/**
 * E2E tests — Authentication & Onboarding (AUTH-01 through AUTH-09)
 */
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login.page'
import { TEST_USERS } from './fixtures/test-users'

test.describe('Authentication', () => {
  test('AUTH-01: login with valid credentials redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_USERS.owner.email, TEST_USERS.owner.password)
    await expect(page).toHaveURL(/\/(dashboard|my-work)/)
  })

  test('AUTH-02: login with invalid credentials shows error', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(TEST_USERS.owner.email, 'WrongPassword123!')
    await loginPage.expectError()
    await expect(page).toHaveURL(/\/login/)
  })

  test('AUTH-03: forgot password page loads and accepts email', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByRole('button', { name: /reset|send/i }).click()
    // Should show success message (even for non-existent emails for security)
    await expect(page.getByText(/check your email|reset link|sent/i)).toBeVisible()
  })

  test('AUTH-05: signup page loads with required fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('AUTH-09: expired invitation token shows error', async ({ page }) => {
    await page.goto('/activate/invalid-token-that-does-not-exist')
    await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible()
  })
})
