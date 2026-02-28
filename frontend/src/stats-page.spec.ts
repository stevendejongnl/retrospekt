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

test.describe('stats-page load error', () => {
  test('shows error message when public stats fails', async ({ page }) => {
    await page.route('/api/v1/stats', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"error"}' }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText(/Failed to load statistics/)).toBeVisible()
  })
})

test.describe('stats-page saved admin token', () => {
  test('pre-seeded sessionStorage token auto-unlocks admin section', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('retro_admin_token', 'pre-seeded-token')
    })
    await mockStats(page)
    await mockAdminStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('Reaction Breakdown', { exact: false })).toBeVisible()
  })

  test('shows loading spinner while fetching admin stats from saved token', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('retro_admin_token', 'token-slow')
    })
    await mockStats(page)

    let resolveAdmin!: () => void
    const adminReady = new Promise<void>((r) => {
      resolveAdmin = r
    })
    await page.route('/api/v1/stats/admin', async (route) => {
      await adminReady
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ADMIN_STATS),
      })
    })

    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    // Admin spinner should be visible since we haven't resolved yet
    await expect(page.locator('stats-page').getByText('Loading…')).toBeVisible()
    resolveAdmin()
    await expect(page.locator('stats-page').getByText('Reaction Breakdown', { exact: false })).toBeVisible()
  })

  test('clears expired token on 401 and shows password form', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('retro_admin_token', 'expired-token')
    })
    await mockStats(page)
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Unauthorized"}' }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    // Token should be cleared, password form should be visible
    await expect(page.locator('stats-page').getByPlaceholder('Admin password')).toBeVisible()
  })

  test('non-401 error from auto-load keeps error state visible', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('retro_admin_token', 'bad-token')
    })
    await mockStats(page)
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Server error"}' }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    // Error state: form shown (password input visible)
    await expect(page.locator('stats-page').getByPlaceholder('Admin password')).toBeVisible()
  })
})

test.describe('stats-page keyboard interaction', () => {
  test('pressing Enter in password field submits the form', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    await mockAdminStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()

    const input = page.locator('stats-page').getByPlaceholder('Admin password')
    await input.fill('mypassword')
    await input.press('Enter')
    await expect(page.locator('stats-page').getByText('Reaction Breakdown', { exact: false })).toBeVisible()
  })
})

test.describe('stats-page charts with empty data', () => {
  test('renders gracefully with empty phase and day data', async ({ page }) => {
    const emptyStats = { ...MOCK_PUBLIC_STATS, sessions_by_phase: [], sessions_per_day: [] }
    await page.route('/api/v1/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyStats) }),
    )
    await page.goto('/stats')
    // SVG elements still exist, just empty
    await expect(page.locator('stats-page').locator('#donut-chart')).toBeVisible()
    await expect(page.locator('stats-page').locator('#bar-chart')).toBeVisible()
  })

  test('renders donut chart with unknown phase using fallback color', async ({ page }) => {
    const unknownPhaseStats = {
      ...MOCK_PUBLIC_STATS,
      sessions_by_phase: [{ phase: 'unknown_phase', count: 5 }],
    }
    await page.route('/api/v1/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(unknownPhaseStats) }),
    )
    await page.goto('/stats')
    // Donut chart should still render with the fallback grey color
    await expect(page.locator('stats-page').locator('#donut-chart')).toBeVisible()
    const path = page.locator('stats-page').locator('#donut-chart path')
    await expect(path).toHaveAttribute('fill', '#9ca3af')
  })

  test('renders admin reaction chart gracefully with empty reaction data', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    const emptyAdmin = { ...MOCK_ADMIN_STATS, reaction_breakdown: [] }
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyAdmin),
      }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()

    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText('Engagement Funnel', { exact: false })).toBeVisible()
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
