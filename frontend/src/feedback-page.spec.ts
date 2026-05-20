import { test, expect } from './playwright-fixtures'

test.describe('feedback-page rendering', () => {
  test('renders emoji rating buttons', async ({ page }) => {
    await page.route('/api/v1/feedback', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        id: 'fb-1', rating: 4, comment: '', session_id: null, participant_name: null, app_version: '1.0.0', created_at: '2026-01-01T00:00:00Z',
      }) }))
    await page.goto('/feedback')
    await expect(page.locator('feedback-page .emoji-btn')).toHaveCount(5)
  })

  test('submit button disabled until rating selected', async ({ page }) => {
    await page.goto('/feedback')
    await expect(page.locator('feedback-page .submit-btn')).toBeDisabled()
    await page.locator('feedback-page .emoji-btn').nth(3).click()
    await expect(page.locator('feedback-page .submit-btn')).toBeEnabled()
  })

  test('has a link back to home', async ({ page }) => {
    await page.goto('/feedback')
    await expect(page.locator('feedback-page .back-link')).toBeVisible()
  })
})

test.describe('feedback-page submission', () => {
  test('submitting calls POST /api/v1/feedback', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null
    await page.route('/api/v1/feedback', async route => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'fb-1', rating: 5, comment: '', session_id: null, participant_name: null, app_version: '1.0.0', created_at: '2026-01-01T00:00:00Z' }),
      })
    })
    await page.goto('/feedback')
    await page.locator('feedback-page .emoji-btn').nth(4).click()
    await page.locator('feedback-page .submit-btn').click()
    await expect(async () => {
      expect(capturedBody).not.toBeNull()
      expect(capturedBody!['rating']).toBe(5)
    }).toPass({ timeout: 3000 })
  })

  test('shows thank-you state after successful submit', async ({ page }) => {
    await page.route('/api/v1/feedback', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        id: 'fb-1', rating: 3, comment: '', session_id: null, participant_name: null, app_version: '1.0.0', created_at: '2026-01-01T00:00:00Z',
      }) }))
    await page.goto('/feedback')
    await page.locator('feedback-page .emoji-btn').nth(2).click()
    await page.locator('feedback-page .submit-btn').click()
    await expect(page.locator('feedback-page .thank-you')).toBeVisible()
  })
})
