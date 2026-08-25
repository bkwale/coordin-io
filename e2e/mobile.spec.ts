/**
 * E2E tests — Mobile Responsive (NAV-08)
 *
 * Uses iPhone 14 viewport via playwright.config.ts project.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/owner.json' })

test.describe('Mobile Responsive', () => {
  test('NAV-08: dashboard loads on mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('NAV-08: sidebar is collapsed on mobile', async ({ page }) => {
    await page.goto('/dashboard')
    // On mobile, sidebar should be hidden or behind hamburger
    const sidebar = page.locator('nav[aria-label="Sidebar"], aside').first()
    // Sidebar should either be hidden or minimal width
    const box = await sidebar.boundingBox()
    if (box) {
      expect(box.width).toBeLessThan(100) // collapsed
    }
  })

  test('NAV-08: projects page works on mobile', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('NAV-08: timesheets page works on mobile', async ({ page }) => {
    await page.goto('/timesheets')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
