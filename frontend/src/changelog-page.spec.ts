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

test.describe('changelog-page hash deep-linking', () => {
  // v1.18.0 is ~15 entries down the generated changelog list (see
  // frontend/src/generated/changelog.ts), so it is well outside the initial
  // viewport — this proves scrollIntoView actually ran rather than the
  // element merely happening to already be visible on load.
  test('navigating to /changelog#v1.18.0 scrolls that version card into view', async ({ page }) => {
    await page.goto('/changelog#v1.18.0')
    const target = page.locator('changelog-page #v1\\.18\\.0')
    await expect(target).toBeInViewport()
  })
})
