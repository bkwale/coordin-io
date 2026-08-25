/**
 * E2E tests — Leave & Expenses (LEV-01 through EXP-04)
 */
import { test, expect } from '@playwright/test'

test.describe('Leave', () => {
  test('LEV-01: leave page loads', async ({ page }) => {
    await page.goto('/leave')
    await expect(page).toHaveURL(/\/leave/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('LEV-02: leave balance is displayed', async ({ page }) => {
    await page.goto('/leave')
    // Should show remaining days or balance info
    await expect(page.getByText(/balance|remaining|entitlement|days/i)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Expenses', () => {
  test('EXP-01: expenses page loads', async ({ page }) => {
    await page.goto('/expenses')
    await expect(page).toHaveURL(/\/expenses/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
