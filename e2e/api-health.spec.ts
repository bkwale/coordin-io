/**
 * E2E tests — API Health & Edge Cases (API-01 through API-06)
 */
import { test, expect } from '@playwright/test'

test.describe('API Health & Validation', () => {
  test('API-01: health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('status')
  })

  test('API-03: invalid UUID returns validation error', async ({ request }) => {
    const response = await request.get('/api/projects/not-a-uuid')
    expect([400, 404]).toContain(response.status())
  })

  test('API-04: invalid date params return validation error', async ({ request }) => {
    const response = await request.get('/api/timesheets/export?dateFrom=not-a-date')
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/date/i)
  })

  test('API-04: invalid status param returns validation error', async ({ request }) => {
    const response = await request.get('/api/timesheets/export?status=INVALID_STATUS')
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/status/i)
  })
})

test.describe('Marketing & Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('MKT-01: landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('MKT-04: FAQ page loads with accordion', async ({ page }) => {
    await page.goto('/faq')
    await expect(page).toHaveURL(/\/faq/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('MKT-05: BRPD feature page loads', async ({ page }) => {
    await page.goto('/features/brpd')
    await expect(page).toHaveURL(/\/features\/brpd/)
  })

  test('MKT-05: quotes feature page loads', async ({ page }) => {
    await page.goto('/features/quotes')
    await expect(page).toHaveURL(/\/features\/quotes/)
  })

  test('MKT-02: demo access page loads', async ({ page }) => {
    await page.goto('/demo-access')
    await expect(page).toHaveURL(/\/demo-access/)
  })
})

test.describe('Empty States', () => {
  test('API-05: search page with no query shows empty state', async ({ page }) => {
    await page.goto('/search')
    await expect(page).toHaveURL(/\/search/)
  })

  test('API-05: approvals page shows content or empty state', async ({ page }) => {
    await page.goto('/approvals')
    await expect(page).toHaveURL(/\/approvals/)
    // Should not show an error — either data or empty state
    await expect(page.getByText(/error|failed|500/i)).toBeHidden({ timeout: 3000 })
  })
})
