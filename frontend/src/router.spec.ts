import { expect, test } from '@playwright/test'

// The Vite dev server serves index.html for all paths (SPA fallback),
// so router.start() handles routing based on the pathname.

test('renders home-page at /', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Retrospekt 🥓')
  const tagName = await page.locator('#app > :first-child').evaluate((el) => el.tagName.toLowerCase())
  expect(tagName).toBe('home-page')
})

test('renders session-page and sets session-id for /session/:id', async ({ page }) => {
  await page.goto('/session/abc-123')

  await expect(page).toHaveTitle('Retrospekt — Session')
  await expect(page.locator('session-page')).toHaveAttribute('session-id', 'abc-123')
})

test('renders not-found-page for unknown paths', async ({ page }) => {
  await page.goto('/does-not-exist')

  await expect(page).toHaveTitle('Not Found — Retrospekt')
  await expect(page.locator('not-found-page')).toBeAttached()
})

test('navigate() updates location and re-renders', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => (window as Window & { router: { navigate: (p: string) => void } }).router.navigate('/session/xyz'))

  await expect(page).toHaveTitle('Retrospekt — Session')
  const pathname = await page.evaluate(() => window.location.pathname)
  expect(pathname).toBe('/session/xyz')
})
