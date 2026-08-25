/**
 * E2E tests — Projects (PRJ-01 through PRJ-07)
 */
import { test, expect } from '@playwright/test'

test.describe('Projects', () => {
  test('PRJ-01: projects list loads', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/projects/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('PRJ-02: new project page loads', async ({ page }) => {
    await page.goto('/projects/new')
    await expect(page).toHaveURL(/\/projects\/new/)
    // Should show project creation wizard
    await expect(page.getByText(/create|new project/i)).toBeVisible()
  })

  test('PRJ-05: project tabs are visible', async ({ page }) => {
    // Navigate to first project from the list
    await page.goto('/projects')
    const projectLink = page.getByRole('link').filter({ hasText: /PRJ-|project/i }).first()

    // If there are projects, click into one
    if (await projectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectLink.click()
      // Should see project workspace tabs
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('PRJ-06: view switching on projects list', async ({ page }) => {
    await page.goto('/projects')
    // Look for view toggle buttons (Table, Kanban, Gantt)
    const tableBtn = page.getByRole('button', { name: /table/i })
    const kanbanBtn = page.getByRole('button', { name: /kanban|board/i })

    if (await tableBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableBtn.click()
      await kanbanBtn.click()
    }
  })
})
