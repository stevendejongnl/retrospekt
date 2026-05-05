import { test, expect } from './playwright-fixtures'

test.describe('changelog-page', () => {
  test('renders the changelog heading', async ({ page }) => {
    await page.goto('/changelog')
    await expect(page.locator('changelog-page')).toBeVisible()
    const h1 = page.locator('changelog-page').locator('h1')
    await expect(h1).toBeVisible()
    await expect(h1).toContainText('Changelog')
  })

  test('renders at least one version card', async ({ page }) => {
    await page.goto('/changelog')
    await expect(page.locator('changelog-page .version-card').first()).toBeVisible()
  })

  test('first version card has a Latest badge', async ({ page }) => {
    await page.goto('/changelog')
    await expect(page.locator('changelog-page .latest-badge').first()).toBeVisible()
  })

  test('sidebar renders version jump links', async ({ page }) => {
    await page.goto('/changelog')
    const links = page.locator('changelog-page .sidebar-link')
    await expect(links.first()).toBeVisible()
  })

  test('back button navigates away', async ({ page }) => {
    await page.goto('/')
    await page.goto('/changelog')
    await page.locator('changelog-page .back-btn').click()
    // Should navigate back to home
    await expect(page).toHaveURL('/')
  })
})
