/**
 * Navigation page object — sidebar, breadcrumbs, search.
 */
import { type Page, type Locator, expect } from '@playwright/test'

export class NavigationPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly notificationBell: Locator
  readonly searchButton: Locator
  readonly breadcrumbs: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.locator('nav[aria-label="Sidebar"], aside')
    this.notificationBell = page.getByRole('button', { name: /notification/i })
    this.searchButton = page.getByRole('button', { name: /search/i })
    this.breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]')
  }

  async navigateTo(item: string) {
    await this.sidebar.getByRole('link', { name: new RegExp(item, 'i') }).click()
  }

  async expectCurrentPage(title: string) {
    await expect(this.page.getByRole('heading', { level: 1 })).toContainText(title)
  }

  async expectBreadcrumb(text: string) {
    await expect(this.breadcrumbs).toContainText(text)
  }

  async openSearch() {
    await this.page.keyboard.press('Meta+k')
  }
}
