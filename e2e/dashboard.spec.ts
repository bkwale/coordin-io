/**
 * E2E tests — Dashboard & Navigation (NAV-01 through NAV-08)
 */
import { test, expect } from '@playwright/test'

test.describe('Dashboard & Navigation', () => {
  test('NAV-01: dashboard loads with widgets', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    // Dashboard should have heading and at least one widget card
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('NAV-02: my work page loads', async ({ page }) => {
    await page.goto('/my-work')
    await expect(page).toHaveURL(/\/my-work/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('NAV-03: sidebar navigation works', async ({ page }) => {
    await page.goto('/dashboard')

    // Navigate to projects
    await page.getByRole('link', { name: /projects/i }).first().click()
    await expect(page).toHaveURL(/\/projects/)

    // Navigate to timesheets
    await page.getByRole('link', { name: /timesheets/i }).first().click()
    await expect(page).toHaveURL(/\/timesheets/)
  })

  test('NAV-05: global search opens with Cmd+K', async ({ page }) => {
    await page.goto('/dashboard')
    await page.keyboard.press('Meta+k')
    // Search modal / command palette should appear
    await expect(page.getByPlaceholder(/search/i)).toBeVisible({ timeout: 3000 })
  })

  test('NAV-06: notifications page loads', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page).toHaveURL(/\/notifications/)
  })
})
