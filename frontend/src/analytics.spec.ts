import { test, expect } from './playwright-fixtures'

type Mtm = Record<string, unknown>[]

async function load(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('/')
  await page.setContent(`
    <script type="module">
      import { MatomoTagManager, tagManager } from './src/analytics.ts'
      window.__MatomoTagManager = MatomoTagManager
      window.__tagManager = tagManager
    </script>
  `)
  await page.waitForFunction(() => '__MatomoTagManager' in window)
}

test.describe('MatomoTagManager', () => {
  test('init pushes mtm.Start and injects the container script', async ({ page }) => {
    await load(page)
    // The container URL is never fetched: the script tag is inserted but the
    // request is blocked, so this stays a unit test of the injection itself.
    await page.route('**/container_test.js', (route) => route.abort())

    const result = await page.evaluate(() => {
      // The app itself boots on goto('/') and pushes a page view, so the queue is
      // not empty here. Reset it so index 0 is unambiguously init's own entry.
      ;(window as unknown as { _mtm: Mtm })._mtm = []
      const TM = (window as unknown as { __MatomoTagManager: new (u: string) => { init(): void } })
        .__MatomoTagManager
      new TM('https://example.invalid/container_test.js').init()
      const mtm = (window as unknown as { _mtm: Mtm })._mtm
      const injected = Array.from(document.querySelectorAll('script')).some((s) =>
        s.src.includes('container_test.js'),
      )
      return { first: mtm[0], injected }
    })

    expect(result.first).toHaveProperty('event', 'mtm.Start')
    // Array form: the key is literally "mtm.startTime", and the string form would
    // read the dot as a path separator and look for mtm -> startTime.
    expect(result.first).toHaveProperty(['mtm.startTime'])
    expect(result.injected).toBe(true)
  })

  test('init reuses an existing _mtm queue rather than replacing it', async ({ page }) => {
    await load(page)
    const len = await page.evaluate(() => {
      ;(window as unknown as { _mtm: Mtm })._mtm = [{ event: 'pre-existing' }]
      const TM = (window as unknown as { __MatomoTagManager: new (u: string) => { init(): void } })
        .__MatomoTagManager
      new TM('https://example.invalid/container_test.js').init()
      return (window as unknown as { _mtm: Mtm })._mtm
    })
    expect(len[0]).toEqual({ event: 'pre-existing' })
    expect(len[1]).toHaveProperty('event', 'mtm.Start')
  })

  test('trackPageView pushes the path and title', async ({ page }) => {
    await load(page)
    const last = await page.evaluate(() => {
      const tm = (
        window as unknown as {
          __tagManager: { trackPageView(p: string, t: string): void }
        }
      ).__tagManager
      tm.trackPageView('/session/abc', 'Session abc')
      const mtm = (window as unknown as { _mtm: Mtm })._mtm
      return mtm[mtm.length - 1]
    })
    expect(last).toEqual({
      event: 'retrospektPageView',
      pageUrl: '/session/abc',
      pageTitle: 'Session abc',
    })
  })

  test('trackEvent pushes category and action, leaving optionals undefined', async ({ page }) => {
    await load(page)
    const last = await page.evaluate(() => {
      const tm = (
        window as unknown as {
          __tagManager: { trackEvent(c: string, a: string, n?: string, v?: number): void }
        }
      ).__tagManager
      tm.trackEvent('board', 'card-created')
      const mtm = (window as unknown as { _mtm: Mtm })._mtm
      return mtm[mtm.length - 1]
    })
    expect(last).toMatchObject({
      event: 'retrospektEvent',
      eventCategory: 'board',
      eventAction: 'card-created',
    })
  })

  test('trackEvent carries name and value when given', async ({ page }) => {
    await load(page)
    const last = await page.evaluate(() => {
      const tm = (
        window as unknown as {
          __tagManager: { trackEvent(c: string, a: string, n?: string, v?: number): void }
        }
      ).__tagManager
      tm.trackEvent('timer', 'finished', 'sprint-retro', 300)
      const mtm = (window as unknown as { _mtm: Mtm })._mtm
      return mtm[mtm.length - 1]
    })
    expect(last).toEqual({
      event: 'retrospektEvent',
      eventCategory: 'timer',
      eventAction: 'finished',
      eventName: 'sprint-retro',
      eventValue: 300,
    })
  })

  test('the exported tagManager is a MatomoTagManager', async ({ page }) => {
    await load(page)
    expect(
      await page.evaluate(() => {
        const w = window as unknown as { __tagManager: object; __MatomoTagManager: Function }
        return w.__tagManager instanceof w.__MatomoTagManager
      }),
    ).toBe(true)
  })
})
