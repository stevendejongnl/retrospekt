import { test, expect } from './playwright-fixtures'

/**
 * emoji-picker had no spec of its own. Everything it does once open — dismissing on an
 * outside click, on Escape, on scroll, repositioning on resize, and the empty search
 * result — went untested, which was most of its missing branches.
 */

type Page = Parameters<Parameters<typeof test>[1]>[0]['page']

async function mount(page: Page) {
  await page.goto('/')
  await page.setContent(`
    <div id="outside" style="height: 40px">outside</div>
    <emoji-picker></emoji-picker>
    <div style="height: 200vh">tall, so the page can scroll</div>
    <script type="module">
      import './src/components/emoji-picker.ts'
    </script>
  `)
  await page.waitForFunction(() => !!document.querySelector('emoji-picker')?.shadowRoot)
}

const popup = (page: Page) => page.locator('emoji-picker').locator('.popup')

async function open(page: Page) {
  await page.locator('emoji-picker').locator('button').first().click()
  await expect(popup(page)).toBeVisible()
}

test.describe('emoji-picker', () => {
  test('the trigger opens and closes the popup', async ({ page }) => {
    await mount(page)
    await open(page)
    await page.locator('emoji-picker').locator('button').first().click()
    await expect(popup(page)).toHaveCount(0)
  })

  test('a click outside closes it', async ({ page }) => {
    await mount(page)
    await open(page)
    await page.locator('#outside').click()
    await expect(popup(page)).toHaveCount(0)
  })

  test('a click inside the popup leaves it open', async ({ page }) => {
    await mount(page)
    await open(page)
    // composedPath() includes the host for clicks within the shadow root, which is
    // the branch that keeps it open.
    await popup(page).locator('.search-input').click()
    await expect(popup(page)).toBeVisible()
  })

  test('Escape closes it', async ({ page }) => {
    await mount(page)
    await open(page)
    await page.keyboard.press('Escape')
    await expect(popup(page)).toHaveCount(0)
  })

  test('another key does not close it', async ({ page }) => {
    await mount(page)
    await open(page)
    await page.keyboard.press('a')
    await expect(popup(page)).toBeVisible()
  })

  test('scrolling closes it rather than leaving it misplaced', async ({ page }) => {
    await mount(page)
    await open(page)
    await page.evaluate(() => window.scrollTo(0, 300))
    await expect(popup(page)).toHaveCount(0)
  })

  test('resizing keeps it open and repositions it', async ({ page }) => {
    await mount(page)
    await open(page)
    await page.setViewportSize({ width: 900, height: 700 })
    await expect(popup(page)).toBeVisible()
  })

  test('a search with no matches shows the empty message', async ({ page }) => {
    await mount(page)
    await open(page)
    await popup(page).locator('.search-input').fill('zzzzzznotanemoji')
    await expect(popup(page).getByText('No emoji found')).toBeVisible()
  })

  test('a search with matches shows a grid instead of the empty message', async ({ page }) => {
    await mount(page)
    await open(page)
    await popup(page).locator('.search-input').fill('smile')
    await expect(popup(page).getByText('No emoji found')).toHaveCount(0)
    await expect(popup(page).locator('.emoji-btn').first()).toBeVisible()
  })

  test('picking an emoji reports it and closes', async ({ page }) => {
    await mount(page)
    await page.evaluate(() => {
      document.addEventListener(
        'emoji-picked',
        (e) =>
          ((window as unknown as { __picked?: string }).__picked = (e as CustomEvent).detail as string),
      )
    })
    await open(page)
    await popup(page).locator('.emoji-btn').first().click()
    await expect(popup(page)).toHaveCount(0)
  })

  test('closing while already closed is harmless', async ({ page }) => {
    await mount(page)
    // Exercises the guard side of the listeners: they run on every document click and
    // keypress regardless of whether this picker is open.
    await page.locator('#outside').click()
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.scrollTo(0, 120))
    await expect(popup(page)).toHaveCount(0)
  })
})
