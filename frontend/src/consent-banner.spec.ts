import { test, expect } from './playwright-fixtures'

async function mount(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('/')
  // Mounted through the dock, because the dock is what removes the card when
  // it is answered — the banner itself only reports "consent-closed".
  await page.setContent(`
    <script type="module">
      import { notifications } from './src/components/notification-dock.ts'
      notifications.consent()
    </script>
  `)
}

test.describe('consent-banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
  })

  test('renders the notice with both choices and a privacy link', async ({ page }) => {
    await mount(page)
    const banner = page.locator('consent-banner')
    await expect(banner.getByText(/privacy-friendly analytics/i)).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Accept' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Decline' })).toBeVisible()
    await expect(banner.getByRole('link', { name: 'Learn more' })).toBeVisible()
  })

  test('Accept stores granted consent and removes the banner', async ({ page }) => {
    await mount(page)
    await page.locator('consent-banner').getByRole('button', { name: 'Accept' }).click()
    await expect(page.locator('consent-banner')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('retro_analytics_consent'))).toBe(
      'granted',
    )
  })

  test('Accept emits consent-granted, which is what starts tracking', async ({ page }) => {
    await mount(page)
    // main.ts only calls tagManager.init() on this event, so it has to escape
    // the shadow root: composed and bubbles both matter here.
    await page.evaluate(() => {
      ;(window as unknown as { __granted?: boolean }).__granted = false
      document.addEventListener(
        'consent-granted',
        () => ((window as unknown as { __granted?: boolean }).__granted = true),
      )
    })
    await page.locator('consent-banner').getByRole('button', { name: 'Accept' }).click()
    expect(await page.evaluate(() => (window as unknown as { __granted?: boolean }).__granted)).toBe(
      true,
    )
  })

  test('Decline stores denied consent and removes the banner without granting', async ({
    page,
  }) => {
    await mount(page)
    await page.evaluate(() => {
      ;(window as unknown as { __granted?: boolean }).__granted = false
      document.addEventListener(
        'consent-granted',
        () => ((window as unknown as { __granted?: boolean }).__granted = true),
      )
    })
    await page.locator('consent-banner').getByRole('button', { name: 'Decline' }).click()
    await expect(page.locator('consent-banner')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('retro_analytics_consent'))).toBe('denied')
    expect(await page.evaluate(() => (window as unknown as { __granted?: boolean }).__granted)).toBe(
      false,
    )
  })

  test('the privacy link routes instead of navigating away', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => {
      ;(window as unknown as { router: { navigate: (p: string) => void }; __navigated?: string }).router =
        {
          navigate: (path: string) =>
            ((window as unknown as { __navigated?: string }).__navigated = path),
        }
    })
    await page.locator('consent-banner').getByRole('link', { name: 'Learn more' }).click()
    expect(await page.evaluate(() => (window as unknown as { __navigated?: string }).__navigated)).toBe(
      '/privacy',
    )
    // preventDefault means the banner is still there; a real navigation would have wiped it
    await expect(page.locator('consent-banner')).toHaveCount(1)
  })
})
