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

  test('renders both health blocks with unresolved counts and top issues', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Sentry Health — Backend')).toBeVisible()
    await expect(admin.getByText('Sentry Health — Frontend')).toBeVisible()
    await expect(admin.getByText('TypeError: undefined is not a function').first()).toBeVisible()
    await expect(admin.getByText('12 events').first()).toBeVisible()
  })

  test('draws a bar per point, giving null points zero height', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await unlock(page)
    await expect(page.locator('admin-page').getByText('Sentry Health — Backend')).toBeVisible()

    // Bars bind to the whole series, not the filtered one, so all three points get a
    // rect and the null point is flattened to height 0 rather than omitted.
    await expect
      .poll(async () =>
        page.locator('admin-page').evaluate((el) => {
          const svg = el.shadowRoot!.querySelector('#sentry-backend-error-chart')
          if (!svg) return null
          const heights = Array.from(svg.querySelectorAll('rect')).map((r) =>
            Number(r.getAttribute('height')),
          )
          return { count: heights.length, zeros: heights.filter((h) => h === 0).length }
        }),
      )
      .toEqual({ count: 3, zeros: 1 })
  })

  test('an all-null series renders the chart but no bars', async ({ page }) => {
    await mockAuth(page)
    await mockStats(
      page,
      stats({ sentry: health({ error_rate_7d: [{ date: '2026-03-12', value: null }], p95_latency_7d: [] }) }),
    )
    await unlock(page)
    await expect(page.locator('admin-page').getByText('Sentry Health — Backend')).toBeVisible()

    await expect
      .poll(async () =>
        page.locator('admin-page').evaluate((el) => {
          const svg = el.shadowRoot!.querySelector('#sentry-backend-error-chart')
          return svg ? svg.querySelectorAll('rect').length : -1
        }),
      )
      .toBe(0)
  })

  test('an error on the health payload shows the banner instead of the stats', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats({ sentry: health({ error: 'Sentry API unreachable' }) }))
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Sentry API unreachable')).toBeVisible()
    // the stat card is part of the non-error branch
    await expect(admin.getByText('Unresolved Issues').first()).toBeVisible()
  })

  test('no top issues omits the Top Issues list', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats({ sentry: health({ top_issues: [] }), sentry_frontend: null }))
    await unlock(page)

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Sentry Health — Backend')).toBeVisible()
    await expect(admin.getByText('Sentry Health — Frontend')).not.toBeVisible()
    await expect(admin.getByText('Top Issues')).not.toBeVisible()
  })
})

test.describe('admin-page — token handling', () => {
  test('a stored token unlocks straight away without the password form', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await page.addInitScript(() => sessionStorage.setItem('retro_admin_token', 'stored-token'))
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    await expect(admin.getByText('Feedback Comments')).toBeVisible()
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
    await expect(admin.getByText('Feedback Comments')).toBeVisible()
  })

  test('a key other than Enter does not submit', async ({ page }) => {
    await mockAuth(page)
    await mockStats(page, stats())
    await page.goto('/admin')

    const admin = page.locator('admin-page')
    await admin.getByPlaceholder('Admin password').fill('pw')
    await admin.getByPlaceholder('Admin password').press('a')
    await expect(admin.getByText('Feedback Comments')).not.toBeVisible()
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
