import { test, expect } from './playwright-fixtures'

const MOCK_ADMIN_STATS = {
  sentry: null,
  sentry_frontend: null,
  feedback: {
    total: 1,
    avg_rating: 5.0,
    by_rating: [{ rating: 5, count: 1 }],
    recent: [
      { id: '1', rating: 5, comment: 'Great tool!', app_version: '1.25.0', participant_name: 'Alice', status: 'new', fixed_in_version: null, created_at: '2026-03-18T12:00:00Z' },
    ],
  },
}

async function mockAdminAuth(page: Parameters<Parameters<typeof test>[1]>[0]['page'], { fail = false } = {}) {
  await page.route('/api/v1/stats/auth', (route) => {
    if (fail) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid password' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-admin-token' }) })
  })
}

async function mockAdminStats(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.route('/api/v1/stats/admin', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_STATS) }),
  )
}

test.describe('admin-page', () => {
  test('shows unlock form when no token stored', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('admin-page').getByPlaceholder('Admin password')).toBeVisible()
    await expect(page.locator('admin-page').getByText('Feedback Comments')).not.toBeVisible()
  })

  test('unlocking with correct password shows admin content', async ({ page }) => {
    await mockAdminAuth(page)
    await mockAdminStats(page)
    await page.goto('/admin')
    await page.locator('admin-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('admin-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('admin-page').getByText('Feedback Comments')).toBeVisible()
    await expect(page.locator('admin-page').getByText('Great tool!')).toBeVisible()
  })

  test('wrong password shows error', async ({ page }) => {
    await mockAdminAuth(page, { fail: true })
    await page.goto('/admin')
    await page.locator('admin-page').getByPlaceholder('Admin password').fill('wrong')
    await page.locator('admin-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('admin-page').getByText(/Invalid password/i)).toBeVisible()
  })

  test('ignore-feedback event from feedback-panel calls PATCH and updates state', async ({ page }) => {
    await mockAdminAuth(page)
    await mockAdminStats(page)
    await page.goto('/admin')
    await page.locator('admin-page').getByPlaceholder('Admin password').fill('pw')
    await page.locator('admin-page').getByRole('button', { name: /Unlock/ }).click()
    await expect(page.locator('admin-page').getByText('Great tool!')).toBeVisible()

    let patchCalled = false
    await page.route('/api/v1/feedback/1', (route) => {
      patchCalled = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_ADMIN_STATS.feedback.recent[0], status: 'ignored' }),
      })
    })

    await page.locator('admin-page feedback-panel .feedback-entry', { hasText: 'Great tool!' }).getByRole('button', { name: /Ignore/i }).click()
    await expect.poll(() => patchCalled).toBe(true)
    await expect(page.locator('admin-page').getByText('Great tool!')).not.toBeVisible()
  })
})
