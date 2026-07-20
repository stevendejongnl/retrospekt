import { test, expect } from './playwright-fixtures'

const FEEDBACK_STATS = {
  total: 3,
  avg_rating: 3.33,
  by_rating: [{ rating: 1, count: 1 }, { rating: 4, count: 1 }, { rating: 5, count: 1 }],
  recent: [
    { id: 'new-1', rating: 1, comment: 'still broken', app_version: '1.33.2', participant_name: 'Imre', status: 'new', fixed_in_version: null, created_at: '2026-07-20T06:42:00Z' },
    { id: 'fixed-1', rating: 3, comment: 'wants bundling', app_version: '1.31.0', participant_name: 'Imre', status: 'fixed', fixed_in_version: '1.32.0', created_at: '2026-05-21T07:18:00Z' },
    { id: 'ignored-1', rating: 5, comment: 'no issue', app_version: '1.27.0', participant_name: null, status: 'ignored', fixed_in_version: null, created_at: '2026-03-20T09:37:00Z' },
  ],
}

async function mount(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('/')
  await page.setContent(`
    <feedback-panel></feedback-panel>
    <script type="module">
      import './src/components/feedback-panel.ts'
      document.querySelector('feedback-panel').feedback = ${JSON.stringify(FEEDBACK_STATS)}
      document.querySelector('feedback-panel').adminToken = 'test-token'
    </script>
  `)
}

test.describe('feedback-panel', () => {
  test('New tab shows only status=new entries by default', async ({ page }) => {
    await mount(page)
    await expect(page.locator('feedback-panel').getByText('still broken')).toBeVisible()
    await expect(page.locator('feedback-panel').getByText('wants bundling')).not.toBeVisible()
    await expect(page.locator('feedback-panel').getByText('no issue')).not.toBeVisible()
  })

  test('Resolved tab shows ignored and fixed entries', async ({ page }) => {
    await mount(page)
    await page.locator('feedback-panel').getByRole('button', { name: /Resolved/i }).click()
    await expect(page.locator('feedback-panel').getByText('wants bundling')).toBeVisible()
    await expect(page.locator('feedback-panel').getByText('no issue')).toBeVisible()
  })

  test('fixed entry shows fixed_in_version as a clickable link', async ({ page }) => {
    await mount(page)
    await page.locator('feedback-panel').getByRole('button', { name: /Resolved/i }).click()
    const badge = page.locator('feedback-panel .feedback-fixed-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveAttribute('href', '/changelog#v1.32.0')
  })

  test('New tab entry Ignore button dispatches ignore-feedback event with id', async ({ page }) => {
    await mount(page)
    let eventDetail: unknown = null
    await page.exposeFunction('reportEvent', (detail: unknown) => { eventDetail = detail })
    await page.evaluate(() => {
      document.querySelector('feedback-panel')!.addEventListener('ignore-feedback', (e) => {
        // @ts-expect-error - test harness bridge
        window.reportEvent((e as CustomEvent).detail)
      })
    })
    await page.locator('feedback-panel .feedback-entry', { hasText: 'still broken' }).getByRole('button', { name: /Ignore/i }).click()
    await expect.poll(() => eventDetail).toEqual({ id: 'new-1' })
  })
})
