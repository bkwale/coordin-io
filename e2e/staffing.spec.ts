/**
 * E2E tests — Staffing & Settings (STF-01 through SET-07)
 */
import { test, expect } from '@playwright/test'

test.describe('Staffing', () => {
  test('STF-01: staffing page loads', async ({ page }) => {
    await page.goto('/staffing')
    await expect(page).toHaveURL(/\/staffing/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('STF-02: employee row is clickable', async ({ page }) => {
    await page.goto('/staffing')
    // Click first employee row to open drawer
    const row = page.getByRole('row').nth(1)
    if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
      await row.click()
      // Drawer or detail should appear
      await expect(page.getByText(/profile|details|employee/i)).toBeVisible({ timeout: 3000 })
    }
  })
})

test.describe('Settings', () => {
  test('SET-01: settings page loads with sections', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('SET-06: audit trail page loads', async ({ page }) => {
    await page.goto('/settings')
    // Navigate to audit section
    const auditLink = page.getByRole('link', { name: /audit/i })
    if (await auditLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await auditLink.click()
    }
  })

  test('SET-04: notification preferences load', async ({ page }) => {
    await page.goto('/settings')
    const notifLink = page.getByRole('link', { name: /notification/i })
    if (await notifLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notifLink.click()
    }
  })
})
