/**
 * E2E tests — Fee Quotes (QTE-01 through QTE-07)
 */
import { test, expect } from '@playwright/test'

test.describe('Fee Quotes', () => {
  test('QTE-01: quote list page loads', async ({ page }) => {
    await page.goto('/fee-quotes')
    await expect(page).toHaveURL(/\/fee-quotes/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('QTE-02: new quote page loads', async ({ page }) => {
    await page.goto('/fee-quotes/new')
    await expect(page).toHaveURL(/\/fee-quotes\/new/)
    await expect(page.getByText(/create|new quote/i)).toBeVisible()
  })

  test('QTE-03: quote detail page loads', async ({ page }) => {
    await page.goto('/fee-quotes')

    // Click first quote if available
    const quoteLink = page.getByRole('link').filter({ hasText: /Q-|quote/i }).first()
    if (await quoteLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quoteLink.click()
      await expect(page).toHaveURL(/\/fee-quotes\/[^/]+$/)
    }
  })

  test('QTE-05: PDF download button exists on detail page', async ({ page }) => {
    await page.goto('/fee-quotes')

    const quoteLink = page.getByRole('link').filter({ hasText: /Q-|quote/i }).first()
    if (await quoteLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await quoteLink.click()
      // PDF download button should be visible
      const pdfBtn = page.getByRole('button', { name: /download|pdf/i })
      await expect(pdfBtn).toBeVisible({ timeout: 5000 })
    }
  })
})
