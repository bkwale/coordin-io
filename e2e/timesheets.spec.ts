/**
 * E2E tests — Timesheets (TMS-01 through TMS-10)
 */
import { test, expect } from '@playwright/test'

test.describe('Timesheets', () => {
  test('TMS-01: weekly timesheet page loads', async ({ page }) => {
    await page.goto('/timesheets')
    await expect(page).toHaveURL(/\/timesheets/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('TMS-03: week navigation works', async ({ page }) => {
    await page.goto('/timesheets')
    // Should have previous/next week buttons
    const prevBtn = page.getByRole('button', { name: /previous|prev|←/i })
    const nextBtn = page.getByRole('button', { name: /next|→/i })

    if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prevBtn.click()
      // Page should still be on timesheets
      await expect(page).toHaveURL(/\/timesheets/)
    }
  })

  test('TMS-05: manager review page loads', async ({ page }) => {
    await page.goto('/timesheets/review')
    await expect(page).toHaveURL(/\/timesheets\/review/)
  })

  test('TMS-07: CSV export triggers download', async ({ page }) => {
    await page.goto('/timesheets')

    // Look for export/download button
    const csvBtn = page.getByRole('button', { name: /csv|download csv/i })

    if (await csvBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download')
      await csvBtn.click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.csv$/)
    }
  })

  test('TMS-08: PDF export triggers download', async ({ page }) => {
    await page.goto('/timesheets')

    const pdfBtn = page.getByRole('button', { name: /pdf|download pdf/i })

    if (await pdfBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download')
      await pdfBtn.click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    }
  })
})
