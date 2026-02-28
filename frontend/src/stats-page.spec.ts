/**
 * stats-page component tests — written RED-first per TDD convention.
 *
 * All API calls are mocked via page.route() so tests run without a real server.
 */
import { test, expect } from './playwright-fixtures'

const MOCK_PUBLIC_STATS = {
  total_sessions: 42,
  active_sessions: 15,
  sessions_by_phase: [
    { phase: 'collecting', count: 10 },
    { phase: 'discussing', count: 5 },
    { phase: 'closed', count: 27 },
  ],
  sessions_per_day: [
    { date: '2026-02-25', count: 3 },
    { date: '2026-02-26', count: 7 },
    { date: '2026-02-27', count: 2 },
  ],
  total_cards: 126,
  avg_cards_per_session: 3.0,
  total_votes: 89,
  total_reactions: 45,
}

const MOCK_ADMIN_STATS = {
  reaction_breakdown: [
    { emoji: '❤️', count: 20 },
    { emoji: '😂', count: 15 },
  ],
  cards_per_column: [
    { column: 'Went Well', count: 50 },
    { column: 'To Improve', count: 40 },
  ],
  activity_heatmap: [{ day_of_week: 2, hour_bucket: 14, count: 5 }],
  engagement_funnel: { created: 42, has_cards: 35, has_votes: 20, closed: 27 },
}

async function mockStats(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.route('/api/v1/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PUBLIC_STATS),
    }),
  )
}

async function mockAdminAuth(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  { fail = false } = {},
) {
  await page.route('/api/v1/stats/auth', (route) => {
    if (fail) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid password' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'test-admin-token-xyz' }),
    })
  })
}

async function mockAdminStats(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.route('/api/v1/stats/admin', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_STATS),
    }),
  )
}

test.describe('stats-page static content', () => {
  test('renders page heading', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page).toHaveTitle('Stats — Retrospekt')
    await expect(page.locator('stats-page').getByText('Retrospekt Stats')).toBeVisible()
  })

  test('back link navigates to home', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    const backLink = page.locator('stats-page').getByRole('link', { name: /Back/ })
    await expect(backLink).toBeVisible()
    await backLink.click()
    await expect(page).toHaveTitle('Retrospekt')
  })
})

test.describe('stats-page loading state', () => {
  test('shows loading state initially', async ({ page }) => {
    // Delay the response so we can observe the loading state
    await page.route('/api/v1/stats', async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PUBLIC_STATS),
      })
    })
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText(/loading/i)).toBeVisible()
  })
})

test.describe('stats-page stat cards', () => {
  test.beforeEach(async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
  })

  test('renders total sessions', async ({ page }) => {
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
  })

  test('renders active sessions', async ({ page }) => {
    await expect(page.locator('stats-page').getByText('15')).toBeVisible()
  })

  test('renders total cards', async ({ page }) => {
    await expect(page.locator('stats-page').getByText('126')).toBeVisible()
  })

  test('renders total votes', async ({ page }) => {
    await expect(page.locator('stats-page').getByText('89')).toBeVisible()
  })
})

test.describe('stats-page charts', () => {
  test.beforeEach(async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    // Wait for charts to render after data loads
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
  })

  test('shows donut chart svg element', async ({ page }) => {
    const svg = page.locator('stats-page').locator('#donut-chart')
    await expect(svg).toBeVisible()
  })

  test('shows bar chart svg element', async ({ page }) => {
    const svg = page.locator('stats-page').locator('#bar-chart')
    await expect(svg).toBeVisible()
  })
})

test.describe('stats-page admin unlock', () => {
  test('shows admin unlock section when locked', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Admin/)).toBeVisible()
  })

  test('wrong password shows error message', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page, { fail: true })
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()

    await page.locator('stats-page').getByPlaceholder('Admin password').fill('wrongpass')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Invalid/i)).toBeVisible()
  })

  test('correct token unlocks admin section', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    await mockAdminStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()

    await page.locator('stats-page').getByPlaceholder('Admin password').fill('correctpass')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
  })

  test('admin section shows reaction breakdown emojis', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    await mockAdminStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()

    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Engagement Funnel/i)).toBeVisible()
  })
})
