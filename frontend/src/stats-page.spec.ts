/**
 * stats-page component tests — written RED-first per TDD convention.
 *
 * All API calls are mocked via page.route() so tests run without a real server.
 *
 * stats-page now renders public analytics only (no admin auth/unlock flow —
 * that lives in admin-page.spec.ts).
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
  feedback_total: 3,
  reaction_breakdown: [
    { emoji: '❤️', count: 20 },
    { emoji: '😂', count: 15 },
  ],
  cards_per_column: [
    { column: 'Went Well', count: 50 },
    { column: 'To Improve', count: 40 },
  ],
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
  feedback_avg_rating: 4.0,
  feedback_by_rating: [
    { rating: 4, count: 2 },
    { rating: 5, count: 1 },
  ],
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
    // Delay the response long enough to reliably observe loading state
    await page.route('/api/v1/stats', async (route) => {
      await new Promise((r) => setTimeout(r, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PUBLIC_STATS),
      })
    })
    // Don't wait for full load — check for loading indicator as soon as DOM is ready
    await page.goto('/stats', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('stats-page').getByText(/loading/i)).toBeVisible()
  })
})

test.describe('stats-page stat cards', () => {
  test.beforeEach(async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page .stat-value').first()).toBeVisible()
  })

  test('renders total sessions', async ({ page }) => {
    await expect(page.locator('stats-page').getByText('42').first()).toBeVisible()
  })

  test('renders active sessions', async ({ page }) => {
    await expect(page.locator('stats-page').getByText('15', { exact: true })).toBeVisible()
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
    await expect(page.locator('stats-page .stat-value').first()).toBeVisible()
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
})

// ---------------------------------------------------------------------------
// Public analytics sections (no unlock step — everything here is public)
// ---------------------------------------------------------------------------

test.describe('stats-page public analytics', () => {
  test('shows Analytics section without any unlock step', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page .stat-value').first()).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Reaction Breakdown/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Cards per Column/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Engagement Funnel/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText(/Session Lifetime/i)).toBeVisible()
  })

  test('no password field is rendered anywhere', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page .stat-value').first()).toBeVisible()
    await expect(page.locator('stats-page').getByPlaceholder('Admin password')).toHaveCount(0)
  })

  test('shows reaction breakdown chart and raw chips', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').locator('#reaction-chart')).toBeVisible()
    await expect(page.locator('stats-page').getByText('❤️ 20')).toBeVisible()
    await expect(page.locator('stats-page').getByText('😂 15')).toBeVisible()
  })

  test('shows cards per column list', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page .column-item', { hasText: 'Went Well' })).toBeVisible()
    await expect(page.locator('stats-page .column-item', { hasText: 'To Improve' })).toBeVisible()
  })

  test('shows engagement funnel steps', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page .funnel-label', { hasText: 'Created' })).toBeVisible()
    await expect(page.locator('stats-page .funnel-label', { hasText: 'Has cards' })).toBeVisible()
    await expect(page.locator('stats-page .funnel-label', { hasText: 'Has votes' })).toBeVisible()
    await expect(page.locator('stats-page .funnel-label', { hasText: 'Closed' })).toBeVisible()
  })

  test('shows session lifetime distribution chart with 4 bars', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    const svg = page.locator('stats-page').locator('#lifetime-chart')
    await expect(svg).toBeVisible()
    const rects = page.locator('stats-page').locator('#lifetime-chart rect')
    await expect(rects).toHaveCount(4)
  })

  test('shows em dash for null avg time to close', async ({ page }) => {
    const nullStats = {
      ...MOCK_PUBLIC_STATS,
      session_lifetime: {
        ...MOCK_PUBLIC_STATS.session_lifetime,
        avg_time_to_close_hours: null,
      },
    }
    await page.route('/api/v1/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nullStats) }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page .stat-value').first()).toBeVisible()
    // null → rendered as em dash "–" (exact to avoid matching "1–7 days" chart labels)
    await expect(page.locator('stats-page').getByText('–', { exact: true })).toBeVisible()
  })

  test('shows feedback ratings without comment list', async ({ page }) => {
    await mockStats(page)
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText(/User Feedback/i)).toBeVisible()
    await expect(page.locator('stats-page').getByText('4.0')).toBeVisible()
    await expect(page.locator('stats-page #feedback-rating-chart')).toBeVisible()
    await expect(page.locator('stats-page .feedback-entry')).toHaveCount(0)
  })

  test('feedback section shows "No feedback submitted yet" when total is 0', async ({ page }) => {
    const noFeedbackStats = { ...MOCK_PUBLIC_STATS, feedback_total: 0, feedback_avg_rating: null, feedback_by_rating: [] }
    await page.route('/api/v1/stats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noFeedbackStats) }),
    )
    await page.goto('/stats')
    await expect(page.locator('stats-page').getByText(/No feedback submitted yet/i)).toBeVisible()
    await expect(page.locator('stats-page #feedback-rating-chart')).not.toBeVisible()
  })
})
