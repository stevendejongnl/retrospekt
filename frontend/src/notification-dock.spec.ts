import { test, expect } from './playwright-fixtures'

/**
 * The dock replaced three blocking modals, so its own branches — the lazy
 * create, the re-create after removal, the per-kind dedupe, the prop
 * fallbacks and each card's close path — are what the old overlays used to
 * cover through session-page. Covering them here instead.
 */

type Page = Parameters<Parameters<typeof test>[1]>[0]['page']

async function mount(page: Page) {
  await page.goto('/')
  await page.setContent(`
    <button id="behind" onclick="window.__behindClicked = true">behind the dock</button>
    <script type="module">
      import { notifications } from './src/components/notification-dock.ts'
      window.notifications = notifications
    </script>
  `)
  await page.waitForFunction(() => !!(window as Window & { notifications?: unknown }).notifications)
}

type Notifications = {
  consent: () => void
  feedback: (o?: { sessionId?: string; participantName?: string }) => void
  whatsNew: (e: unknown) => void
}
type Win = Window & { notifications: Notifications }

const ENTRY = {
  version: '9.9.9',
  date: '2026-10-05',
  groups: [{ kind: 'Features', items: [{ scope: 'ui', text: 'a thing' }] }],
  highlight: { title: 'A highlighted thing', body: 'It is highlighted.' },
}

const dock = (page: Page) => page.locator('notification-dock')

test.describe('notification-dock', () => {
  test('is created lazily on the first notification', async ({ page }) => {
    await mount(page)
    await expect(dock(page)).toHaveCount(0)
    await page.evaluate(() => (window as unknown as Win).notifications.consent())
    await expect(dock(page)).toHaveCount(1)
  })

  test('re-creates itself after being removed from the document', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => (window as unknown as Win).notifications.consent())
    await expect(dock(page)).toHaveCount(1)
    await page.evaluate(() => document.querySelector('notification-dock')!.remove())
    await expect(dock(page)).toHaveCount(0)
    await page.evaluate(() => (window as unknown as Win).notifications.consent())
    await expect(dock(page)).toHaveCount(1)
  })

  test('stacks all three kinds at once', async ({ page }) => {
    await mount(page)
    await page.evaluate((entry) => {
      const n = (window as unknown as Win).notifications
      n.consent()
      n.feedback({ sessionId: 's1', participantName: 'Alice' })
      n.whatsNew(entry)
    }, ENTRY)
    await expect(dock(page).locator('consent-banner')).toHaveCount(1)
    await expect(dock(page).locator('feedback-dialog')).toHaveCount(1)
    await expect(dock(page).locator('whats-new-dialog')).toHaveCount(1)
  })

  test('never stacks the same kind twice', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => {
      const n = (window as unknown as Win).notifications
      n.feedback({ sessionId: 's1' })
      n.feedback({ sessionId: 's2' })
    })
    await expect(dock(page).locator('feedback-dialog')).toHaveCount(1)
  })

  test('falls back to empty strings when feedback is queued with no options', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => (window as unknown as Win).notifications.feedback())
    await expect(dock(page).locator('feedback-dialog .card')).toBeVisible()
    const props = await page.evaluate(() => {
      const el = document.querySelector('notification-dock')!.shadowRoot!
        .querySelector('feedback-dialog') as unknown as { sessionId: string; participantName: string }
      return { sessionId: el.sessionId, participantName: el.participantName }
    })
    expect(props).toEqual({ sessionId: '', participantName: '' })
  })

  test('dismissing one card leaves the others docked', async ({ page }) => {
    await mount(page)
    await page.evaluate((entry) => {
      const n = (window as unknown as Win).notifications
      n.consent()
      n.whatsNew(entry)
    }, ENTRY)
    await page.locator('whats-new-dialog .got-it-btn').click()
    await expect(dock(page).locator('whats-new-dialog')).toHaveCount(0)
    await expect(dock(page).locator('consent-banner')).toHaveCount(1)
  })

  test('answering the consent banner removes it', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => (window as unknown as Win).notifications.consent())
    await page.locator('consent-banner').getByRole('button', { name: 'Decline' }).click()
    await expect(dock(page).locator('consent-banner')).toHaveCount(0)
  })

  test('the feedback card closes itself on "Not now"', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => (window as unknown as Win).notifications.feedback({}))
    await page.locator('feedback-dialog .skip-btn').click()
    await expect(dock(page).locator('feedback-dialog')).toHaveCount(0)
  })

  test('a control behind the dock still receives its click', async ({ page }) => {
    await mount(page)
    await page.evaluate((entry) => {
      const n = (window as unknown as Win).notifications
      n.consent()
      n.whatsNew(entry)
    }, ENTRY)
    await expect(dock(page).locator('consent-banner')).toHaveCount(1)
    await page.locator('#behind').click()
    expect(await page.evaluate(() => (window as Window & { __behindClicked?: boolean }).__behindClicked)).toBe(true)
  })

  test('submits with no session or participant when queued bare', async ({ page }) => {
    await mount(page)
    let body: Record<string, unknown> = {}
    await page.route('/api/v1/feedback', (route) => {
      body = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'fb-1', rating: 5, comment: '', session_id: null,
          app_version: '1.0.0', created_at: '2026-01-01T00:00:00Z',
        }),
      })
    })
    await page.evaluate(() => (window as unknown as Win).notifications.feedback())
    await page.locator('feedback-dialog .emoji-btn').last().click()
    await page.locator('feedback-dialog .submit-btn').click()
    await expect(page.locator('feedback-dialog .thank-you')).toBeVisible()
    // The empty defaults are sent as absent, not as empty strings.
    expect(body.session_id ?? null).toBeNull()
    expect(body.participant_name ?? null).toBeNull()
  })

  test('the whats-new card links through to the changelog', async ({ page }) => {
    await mount(page)
    await page.evaluate((entry) => (window as unknown as Win).notifications.whatsNew(entry), ENTRY)
    await page.locator('whats-new-dialog .view-changelog').click()
    await expect(page).toHaveURL(/\/changelog$/)
  })

  test('falls back to a generic headline when the entry has no highlight', async ({ page }) => {
    await mount(page)
    await page.evaluate((entry) => {
      (window as unknown as Win).notifications.whatsNew({ ...entry, highlight: undefined })
    }, ENTRY)
    await expect(page.locator('whats-new-dialog .headline')).toHaveText("What's new in v9.9.9")
    await expect(page.locator('whats-new-dialog .highlight-body')).toHaveCount(0)
  })
})
