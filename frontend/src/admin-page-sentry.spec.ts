import { test, expect } from './playwright-fixtures'

/**
 * The existing admin-page spec mocks sentry and sentry_frontend as null, so every
 * Sentry path in admin-page.ts — the health blocks, the d3 bar charts, the stored-token
 * boot, the 401 recovery — never executed. Those accounted for most of that file's
 * missing branch coverage.
 */

type Page = Parameters<Parameters<typeof test>[1]>[0]['page']

const SERIES = [
  { date: '2026-03-12', value: 1.5 },
  { date: '2026-03-13', value: null },
  { date: '2026-03-14', value: 3.25 },
]

function health(overrides: Record<string, unknown> = {}) {
  return {
    unresolved_count: 4,
    top_issues: [
      { id: 'i1', title: 'TypeError: undefined is not a function', count: 12, last_seen: '2026-03-18T09:00:00Z' },
      { id: 'i2', title: 'Timeout contacting redis', count: 3, last_seen: '2026-03-17T22:15:00Z' },
    ],
    error_rate_7d: SERIES,
    p95_latency_7d: SERIES,
    error: null,
    ...overrides,
  }
}

function stats(overrides: Record<string, unknown> = {}) {
  return {
    sentry: health(),
    sentry_frontend: health(),
    feedback: {
      total: 2,
      avg_rating: 4.5,
      by_rating: [{ rating: 5, count: 1 }, { rating: 4, count: 1 }],
      recent: [
        { id: '1', rating: 5, comment: 'Great tool!', app_version: '1.25.0', participant_name: 'Alice', status: 'new', fixed_in_version: null, created_at: '2026-03-18T12:00:00Z' },
        { id: '2', rating: 4, comment: 'Solid', app_version: '1.25.0', participant_name: 'Bob', status: 'new', fixed_in_version: null, created_at: '2026-03-18T13:00:00Z' },
      ],
    },
    ...overrides,
  }
}

async function mockStats(page: Page, body: unknown, status = 200) {
  await page.route('/api/v1/stats/admin', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

async function mockAuth(page: Page) {
  await page.route('/api/v1/stats/auth', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-admin-token' }) }),
  )
}

async function unlock(page: Page) {
  await page.goto('/admin')
  const admin = page.locator('admin-page')
  await admin.getByPlaceholder('Admin password').fill('pw')
  await admin.getByRole('button', { name: /Unlock/ }).click()
}

test.describe('admin-page — Sentry health', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.clear())
  })

  test('renders both health cards with their averages and unresolved issues', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Backend health')).toBeVisible()
    await expect(admin.getByText('Frontend health')).toBeVisible()
    await expect(admin.getByText('TypeError: undefined is not a function').first()).toBeVisible()
    await expect(admin.getByText('12×').first()).toBeVisible()
    // 1.5 and 3.25 are the two real points; the null one does not count
    await expect(admin.locator('#sentry-backend .metric-value').first()).toHaveText('2.4%')
    await expect(admin.locator('#sentry-backend .metric-value').nth(1)).toHaveText('2 ms')
  })

  test('the sparkline has a point for every day, with a missing day drawn as zero', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await unlock(page)
    await expect(page.locator('admin-page').getByText('Backend health')).toBeVisible()

    const points = await page.locator('admin-page #sentry-backend .sparkline polyline').getAttribute('points')
    const pairs = (points ?? '').trim().split(' ')
    expect(pairs).toHaveLength(3)
    // the null point sits on the baseline (y = 34)
    expect(pairs[1].endsWith(',34')).toBe(true)
  })

  test('an all-null series draws no sparkline and shows a dash', async ({ page }) => {
    await mockAuth(page)
    await mockStats(
      page,
      stats({ sentry: health({ error_rate_7d: [{ date: '2026-03-12', value: null }], p95_latency_7d: [] }) }),
    )
    await unlock(page)
    await expect(page.locator('admin-page').getByText('Backend health')).toBeVisible()

    await expect(page.locator('admin-page #sentry-backend .sparkline')).toHaveCount(0)
    await expect(page.locator('admin-page #sentry-backend .metric-value').first()).toHaveText('–')
    await expect(page.locator('admin-page #sentry-backend .metric-value').nth(1)).toHaveText('–')
  })

  test('an error on the health payload shows the banner instead of the numbers', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats({ sentry: health({ error: 'Sentry API unreachable' }) }))
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Sentry API unreachable')).toBeVisible()
    await expect(admin.locator('#sentry-backend .metrics')).toHaveCount(0)
    await expect(admin.locator('#sentry-frontend .metrics')).toBeVisible()
  })

  test('no unresolved issues says so, and a missing frontend block is left out', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats({ sentry: health({ top_issues: [] }), sentry_frontend: null }))
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Backend health')).toBeVisible()
    await expect(admin.getByText('Frontend health')).not.toBeVisible()
    await expect(admin.getByText('No unresolved issues.')).toBeVisible()
  })
})

test.describe('admin-page — token handling', () => {
  test('a stored token unlocks straight away without the password form', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await page.addInitScript(() => sessionStorage.setItem('retro_admin_token', 'stored-token'))
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Feedback comments', { exact: true })).toBeVisible()
    await expect(admin.getByPlaceholder('Admin password')).not.toBeVisible()
  })

  test('a stored token rejected with 401 clears it and returns to the unlock form', async ({
    page,
  }) => {
    await mockAuth(page)
    await mockStats(page, { detail: 'Unauthorized' }, 401)
    await page.addInitScript(() => sessionStorage.setItem('retro_admin_token', 'stale-token'))
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    await expect(admin.getByPlaceholder('Admin password')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('retro_admin_token'))).toBeNull()
  })

  test('a non-401 failure falls into the error phase, keeping the token', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, { detail: 'Boom' }, 500)
    await page.addInitScript(() => sessionStorage.setItem('retro_admin_token', 'any-token'))
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    // The error phase renders inside the unlock form. Note the message says "Invalid
    // password" even for a 500, which is misleading but is existing behaviour.
    await expect(admin.getByText('Invalid password. Please try again.')).toBeVisible()
    // Unlike the 401 path, a server error does not discard the stored token.
    expect(await page.evaluate(() => sessionStorage.getItem('retro_admin_token'))).toBe('any-token')
  })

  test('Enter in the password field submits, same as the button', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    await admin.getByPlaceholder('Admin password').fill('pw')
    await admin.getByPlaceholder('Admin password').press('Enter')
    await expect(admin.getByText('Feedback comments', { exact: true })).toBeVisible()
  })

  test('a key other than Enter does not submit', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    await admin.getByPlaceholder('Admin password').fill('pw')
    await admin.getByPlaceholder('Admin password').press('a')
    await expect(admin.getByText('Feedback comments', { exact: true })).not.toBeVisible()
  })
})

test.describe('admin-page — ignoring feedback', () => {
  test('ignoring one entry leaves the others in place', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Great tool!')).toBeVisible()
    await expect(admin.getByText('Solid')).toBeVisible()

    await page.route('/api/v1/feedback/1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: '1', status: 'ignored' }),
      }),
    )

    // Exercises the false side of the id === id ternary: entry 2 must survive untouched.
    await admin
      .locator('feedback-panel .feedback-entry', { hasText: 'Great tool!' })
      .getByRole('button', { name: /Ignore/i })
      .click()

    await expect(admin.getByText('Great tool!')).not.toBeVisible()
    await expect(admin.getByText('Solid')).toBeVisible()
  })
})
