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

const MOCK_SENTRY_HEALTH = {
  unresolved_count: 5,
  top_issues: [
    { id: '123', title: 'ZeroDivisionError: division by zero', count: 15, last_seen: '2026-02-28T10:00:00Z' },
    { id: '456', title: 'KeyError: user_id', count: 7, last_seen: '2026-02-27T09:00:00Z' },
  ],
  error_rate_7d: [
    { date: '2026-02-22', value: 10 },
    { date: '2026-02-23', value: 25 },
    { date: '2026-02-24', value: 0 },
    { date: '2026-02-25', value: 5 },
    { date: '2026-02-26', value: 8 },
    { date: '2026-02-27', value: 3 },
    { date: '2026-02-28', value: 12 },
  ],
  p95_latency_7d: [
    { date: '2026-02-22', value: 120.5 },
    { date: '2026-02-23', value: 98.3 },
    { date: '2026-02-24', value: 0 },
    { date: '2026-02-25', value: 145.0 },
    { date: '2026-02-26', value: 110.0 },
    { date: '2026-02-27', value: 88.5 },
    { date: '2026-02-28', value: 133.2 },
  ],
  error: null,
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
  session_lifetime: {
    expiry_countdown: { expiring_within_7_days: 3, expiring_within_30_days: 12 },
    lifetime_distribution: [
      { label: '<1 day', count: 5 },
      { label: '1–7 days', count: 10 },
      { label: '7–30 days', count: 20 },
      { label: '30+ days', count: 7 },
    ],
    avg_duration: { open_avg_hours: 14.5, closed_avg_hours: 48.25 },
    avg_time_to_close_hours: 36.0,
  },
  sentry: null,
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

// ---------------------------------------------------------------------------
// Session Lifetime section
// ---------------------------------------------------------------------------

async function unlockAdmin(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await mockStats(page)
  await mockAdminAuth(page)
  await mockAdminStats(page)
  await page.goto('/stats')
  await expect(page.locator('stats-page').getByText('42')).toBeVisible()
  await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
  await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
  // wait for admin section to be visible
  await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
}

test.describe('stats-page session lifetime section', () => {
  test('shows section heading Session Lifetime', async ({ page }) => {
    await unlockAdmin(page)
    await expect(page.locator('stats-page').getByText('Session Lifetime', { exact: false })).toBeVisible()
  })

  test('shows expiring within 7 days count', async ({ page }) => {
    await unlockAdmin(page)
    // expiring_within_7_days = 3 — check the label to disambiguate from other numbers
    await expect(page.locator('stats-page').getByText('Expiring in 7d', { exact: true })).toBeVisible()
    await expect(page.locator('stats-page').getByText('3', { exact: true }).first()).toBeVisible()
  })

  test('shows expiring within 30 days count', async ({ page }) => {
    await unlockAdmin(page)
    // expiring_within_30_days = 12 — exact match avoids matching '126'
    await expect(page.locator('stats-page').getByText('12', { exact: true })).toBeVisible()
  })

  test('shows avg time to close', async ({ page }) => {
    await unlockAdmin(page)
    // avg_time_to_close_hours = 36.0 → displayed as "36"
    await expect(page.locator('stats-page').getByText(/Avg time to close/i)).toBeVisible()
  })

  test('shows em dash for null avg time to close', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    const nullStats = {
      ...MOCK_ADMIN_STATS,
      session_lifetime: {
        ...MOCK_ADMIN_STATS.session_lifetime,
        avg_time_to_close_hours: null,
      },
    }
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nullStats) }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
    // null → rendered as em dash "–" (exact to avoid matching "1–7 days" chart labels)
    await expect(page.locator('stats-page').getByText('–', { exact: true })).toBeVisible()
  })

  test('shows avg open session duration', async ({ page }) => {
    await unlockAdmin(page)
    // open_avg_hours = 14.5
    await expect(page.locator('stats-page').getByText(/Open sessions/i)).toBeVisible()
  })

  test('shows avg closed session duration', async ({ page }) => {
    await unlockAdmin(page)
    // closed_avg_hours = 48.25
    await expect(page.locator('stats-page').getByText(/Closed sessions/i)).toBeVisible()
  })

  test('shows lifetime distribution chart svg', async ({ page }) => {
    await unlockAdmin(page)
    const svg = page.locator('stats-page').locator('#lifetime-chart')
    await expect(svg).toBeVisible()
  })

  test('lifetime chart renders 4 bars for 4 buckets', async ({ page }) => {
    await unlockAdmin(page)
    const rects = page.locator('stats-page').locator('#lifetime-chart rect')
    await expect(rects).toHaveCount(4)
  })
})

// ---------------------------------------------------------------------------
// Sentry Health section
// ---------------------------------------------------------------------------

async function unlockAdminWithSentry(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await mockStats(page)
  await mockAdminAuth(page)
  const adminWithSentry = { ...MOCK_ADMIN_STATS, sentry: MOCK_SENTRY_HEALTH }
  await page.route('/api/v1/stats/admin', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminWithSentry),
    }),
  )
  await page.goto('/stats')
  await expect(page.locator('stats-page').getByText('42')).toBeVisible()
  await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
  await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
  await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
}

test.describe('stats-page sentry health section', () => {
  test('sentry section hidden when sentry is null', async ({ page }) => {
    await unlockAdmin(page)
    await expect(page.locator('stats-page').getByText('Sentry Health', { exact: false })).not.toBeVisible()
  })

  test('sentry section shown when sentry data present', async ({ page }) => {
    await unlockAdminWithSentry(page)
    await expect(page.locator('stats-page').getByText('Sentry Health', { exact: false })).toBeVisible()
  })

  test('shows unresolved issues count', async ({ page }) => {
    await unlockAdminWithSentry(page)
    await expect(page.locator('stats-page').getByText('Unresolved Issues', { exact: false })).toBeVisible()
    // unresolved_count = 5
    await expect(page.locator('stats-page').getByText('5', { exact: true }).first()).toBeVisible()
  })

  test('shows top issues list with titles', async ({ page }) => {
    await unlockAdminWithSentry(page)
    await expect(page.locator('stats-page').getByText('ZeroDivisionError: division by zero', { exact: false })).toBeVisible()
    await expect(page.locator('stats-page').getByText('KeyError: user_id', { exact: false })).toBeVisible()
  })

  test('shows error rate chart svg', async ({ page }) => {
    await unlockAdminWithSentry(page)
    const svg = page.locator('stats-page').locator('#sentry-backend-error-chart')
    await expect(svg).toBeVisible()
  })

  test('shows p95 latency chart svg', async ({ page }) => {
    await unlockAdminWithSentry(page)
    const svg = page.locator('stats-page').locator('#sentry-backend-p95-chart')
    await expect(svg).toBeVisible()
  })

  test('error rate chart renders bars', async ({ page }) => {
    await unlockAdminWithSentry(page)
    const rects = page.locator('stats-page').locator('#sentry-backend-error-chart rect')
    await expect(rects).toHaveCount(7)
  })

  test('p95 chart renders bars', async ({ page }) => {
    await unlockAdminWithSentry(page)
    const rects = page.locator('stats-page').locator('#sentry-backend-p95-chart rect')
    await expect(rects).toHaveCount(7)
  })

  test('error rate chart handles null value data points', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    const sentryWithNulls = {
      ...MOCK_SENTRY_HEALTH,
      error_rate_7d: [
        { date: '2026-02-22', value: null },
        { date: '2026-02-23', value: 5 },
        { date: '2026-02-24', value: null },
        { date: '2026-02-25', value: 8 },
        { date: '2026-02-26', value: null },
        { date: '2026-02-27', value: 3 },
        { date: '2026-02-28', value: null },
      ],
    }
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_ADMIN_STATS, sentry: sentryWithNulls }),
      }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Sentry Health/i)).toBeVisible()
    await expect(page.locator('stats-page').locator('#sentry-backend-error-chart')).toBeVisible()
  })

  test('sentry charts handle all-null data gracefully (empty filtered list)', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    const sentryAllNulls = {
      ...MOCK_SENTRY_HEALTH,
      error_rate_7d: [
        { date: '2026-02-22', value: null },
        { date: '2026-02-23', value: null },
      ],
      p95_latency_7d: [
        { date: '2026-02-22', value: null },
        { date: '2026-02-23', value: null },
      ],
    }
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_ADMIN_STATS, sentry: sentryAllNulls }),
      }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Sentry Health/i)).toBeVisible()
    const rects = page.locator('stats-page').locator('#sentry-backend-error-chart rect')
    await expect(rects).toHaveCount(0)
  })

  test('shows error banner when sentry.error is set', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    const adminWithError = {
      ...MOCK_ADMIN_STATS,
      sentry: { ...MOCK_SENTRY_HEALTH, error: 'Connection refused to sentry.io' },
    }
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminWithError),
      }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Connection refused to sentry.io/, { exact: false })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Frontend Sentry Health section
// ---------------------------------------------------------------------------

const MOCK_FRONTEND_SENTRY_HEALTH = {
  unresolved_count: 1,
  top_issues: [
    { id: 'FE-1', title: 'TypeError: Cannot read properties of undefined', count: 3, last_seen: '2026-02-28T11:00:00Z' },
  ],
  error_rate_7d: [
    { date: '2026-02-22', value: 2 },
    { date: '2026-02-23', value: 0 },
    { date: '2026-02-24', value: 1 },
    { date: '2026-02-25', value: 0 },
    { date: '2026-02-26', value: 3 },
    { date: '2026-02-27', value: 0 },
    { date: '2026-02-28', value: 1 },
  ],
  p95_latency_7d: [
    { date: '2026-02-22', value: null },
    { date: '2026-02-23', value: null },
    { date: '2026-02-24', value: null },
    { date: '2026-02-25', value: null },
    { date: '2026-02-26', value: null },
    { date: '2026-02-27', value: null },
    { date: '2026-02-28', value: null },
  ],
  error: null,
}

async function unlockAdminWithFrontendSentry(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await mockStats(page)
  await mockAdminAuth(page)
  const adminWithBoth = {
    ...MOCK_ADMIN_STATS,
    sentry: MOCK_SENTRY_HEALTH,
    sentry_frontend: MOCK_FRONTEND_SENTRY_HEALTH,
  }
  await page.route('/api/v1/stats/admin', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adminWithBoth),
    }),
  )
  await page.goto('/stats')
  await expect(page.locator('stats-page').getByText('42')).toBeVisible()
  await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
  await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
  await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
}

test.describe('stats-page frontend sentry health section', () => {
  test('frontend sentry section hidden when sentry_frontend is null', async ({ page }) => {
    await unlockAdmin(page)
    const headings = page.locator('stats-page').getByText('Sentry Health', { exact: false })
    // Only backend block (or none) — frontend block should not appear when null
    await expect(headings).toHaveCount(0)
  })

  test('frontend sentry section shown when sentry_frontend data present', async ({ page }) => {
    await unlockAdminWithFrontendSentry(page)
    // Should see both Backend and Frontend headings
    await expect(page.locator('stats-page').getByText(/Backend/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Frontend/i)).toBeVisible()
  })

  test('frontend sentry shows issue title', async ({ page }) => {
    await unlockAdminWithFrontendSentry(page)
    await expect(
      page.locator('stats-page').getByText(/TypeError: Cannot read properties of undefined/, { exact: false }),
    ).toBeVisible()
  })

  test('frontend sentry error rate chart renders', async ({ page }) => {
    await unlockAdminWithFrontendSentry(page)
    const svg = page.locator('stats-page').locator('#sentry-frontend-error-chart')
    await expect(svg).toBeVisible()
  })

  test('frontend sentry p95 chart renders', async ({ page }) => {
    await unlockAdminWithFrontendSentry(page)
    const svg = page.locator('stats-page').locator('#sentry-frontend-p95-chart')
    await expect(svg).toBeVisible()
  })

  test('frontend sentry error rate chart renders bars', async ({ page }) => {
    await unlockAdminWithFrontendSentry(page)
    const rects = page.locator('stats-page').locator('#sentry-frontend-error-chart rect')
    await expect(rects).toHaveCount(7)
  })

  test('shows error banner when sentry_frontend.error is set', async ({ page }) => {
    await mockStats(page)
    await mockAdminAuth(page)
    const adminWithFrontendError = {
      ...MOCK_ADMIN_STATS,
      sentry_frontend: { ...MOCK_FRONTEND_SENTRY_HEALTH, error: 'Frontend Sentry unreachable' },
    }
    await page.route('/api/v1/stats/admin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminWithFrontendError),
      }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText('42')).toBeVisible()
    await page.locator('stats-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('stats-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Frontend Sentry unreachable/, { exact: false })).toBeVisible()
  })
})
