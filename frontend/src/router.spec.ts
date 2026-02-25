import type { Page } from '@playwright/test'
import { expect, test } from './playwright-fixtures'

// The Vite dev server serves index.html for all paths (SPA fallback),
// so router.start() handles routing based on the pathname.

async function stubSessionApi(page: Page, sessionId: string) {
  const stub = {
    id: sessionId, name: 'Test', columns: ['Went Well'], phase: 'collecting',
    participants: [], cards: [], created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z', facilitator_token: 'tok', timer: null,
  }
  await page.route(`/api/v1/sessions/${sessionId}/stream`, (route) => route.abort())
  await page.route(`/api/v1/sessions/${sessionId}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub) }),
  )
  await page.route(`/api/v1/sessions/${sessionId}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub) }),
  )
}

test('renders home-page at /', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Retrospekt')
  const tagName = await page.locator('#app > :first-child').evaluate((el) => el.tagName.toLowerCase())
  expect(tagName).toBe('home-page')
})

test('renders session-page and sets session-id for /session/:id', async ({ page }) => {
  await stubSessionApi(page, 'abc-123')
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
  await stubSessionApi(page, 'xyz')
  await page.goto('/')
  await page.evaluate(() => (window as Window & { router: { navigate: (p: string) => void } }).router.navigate('/session/xyz'))

  await expect(page).toHaveTitle('Retrospekt — Session')
  const pathname = await page.evaluate(() => window.location.pathname)
  expect(pathname).toBe('/session/xyz')
})
