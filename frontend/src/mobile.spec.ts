import type { Locator, Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'
import { createApiResponses } from '../parity/fixtures'

/**
 * Phone-size guard. The pixel parity run only compares desktop sizes, so these tests are what stops the mobile
 * layout from breaking again: at 360, 390 and 430 px (and 768 px for the columns) nothing may run off the screen,
 * the phase must be visible, and every control must be big enough to touch.
 */

const SESSION_ID = 'mobile-1'
const FAC_TOKEN = 'fac-tok-mobile'
const PHONES = [360, 390, 430] as const
const HEIGHT = 800
const TAP = 40 // header and dock buttons
const HIT = 32 // every other control

const card = (o: Record<string, unknown>) => ({
  id: 'c', column: 'Went Well', text: 'text', author_name: 'Bob', published: true,
  votes: [], reactions: [], assignee: null, group_id: null, created_at: '2026-01-01T00:00:00Z', ...o,
})

const BASE = {
  id: SESSION_ID,
  name: 'Sprint 42 Retro',
  columns: ['Went Well', 'To Improve', 'Action Items'],
  phase: 'discussing' as const,
  participants: [
    { name: 'Alice', joined_at: '2026-01-01T00:00:00Z' },
    { name: 'Bob', joined_at: '2026-01-01T00:00:00Z' },
  ],
  cards: [
    card({ id: 'a', text: 'Shipping went smoothly', votes: [{ participant_name: 'Alice' }], reactions: [{ emoji: '❤️', participant_name: 'Bob' }] }),
    card({ id: 'b', column: 'To Improve', text: 'Stand-ups ran too long', author_name: 'Alice' }),
    card({ id: 'c', column: 'To Improve', text: 'My draft', author_name: 'Alice', published: false }),
    card({ id: 'd', column: 'Action Items', text: 'Set up runbooks', assignee: 'Alice' }),
  ] as object[],
  notes: [] as object[],
  max_votes_per_participant: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  facilitator_token: FAC_TOKEN,
  timer: null as object | null,
}

const RUNNING = { duration_seconds: 600, started_at: new Date().toISOString(), paused_remaining: null }

interface Options {
  session?: Record<string, unknown>
  facilitator?: boolean
  presenting?: boolean
  consent?: boolean
  history?: boolean
}

async function open(page: Page, { session = BASE, facilitator = true, presenting = false, consent = true, history = false }: Options = {}) {
  await page.addInitScript(
    (o: { id: string; token: string; facilitator: boolean; presenting: boolean; consent: boolean; history: boolean }) => {
      localStorage.setItem(`retro_name_${o.id}`, o.facilitator ? 'Alice' : 'Bob')
      if (o.facilitator) localStorage.setItem(`retro_facilitator_${o.id}`, o.token)
      if (o.consent) localStorage.setItem('retro_analytics_consent', 'denied')
      if (o.presenting) localStorage.setItem(`retro_present_${o.id}`, 'true')
      if (o.history) {
        localStorage.setItem('retro_history', JSON.stringify([{
          id: 'other', name: 'Other', phase: 'closed', created_at: '2026-01-01T00:00:00Z', participantName: 'Alice',
          isFacilitator: false, joinedAt: '2026-01-01T00:00:00Z', seenChangelogVersion: '0.0.1',
        }]))
      }
    },
    { id: SESSION_ID, token: FAC_TOKEN, facilitator, presenting, consent, history },
  )
  await page.route(`/api/v1/sessions/${SESSION_ID}`, route => route.fulfill({ json: session }))
  await page.route(`/api/v1/sessions/${SESSION_ID}/stream`, route =>
    route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: `data: ${JSON.stringify(session)}\n\n` }))
  await page.route(`/api/v1/sessions/${SESSION_ID}/**`, route => route.fulfill({ json: session }))
  await page.goto(`/session/${SESSION_ID}`)
  await expect(page.locator('phase-stepper')).toBeAttached()
}

const viewportWidth = (page: Page) => page.evaluate(() => window.innerWidth)

/** Every element of the locator is fully inside the screen (sideways). */
async function expectInside(page: Page, locator: Locator, what: string) {
  const width = await viewportWidth(page)
  const boxes = await Promise.all((await locator.all()).map((l) => l.boundingBox()))
  expect(boxes.length, `${what}: nothing found`).toBeGreaterThan(0)
  for (const box of boxes) {
    expect(box, what).not.toBeNull()
    expect(box!.x, `${what} starts left of the screen`).toBeGreaterThanOrEqual(-0.5)
    expect(box!.x + box!.width, `${what} ends right of the screen (${width}px wide)`).toBeLessThanOrEqual(width + 0.5)
  }
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1

/** The sideways overflow of the page and of every visible element that is not scrolled on purpose. */
async function pageOverflow(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth))
}

for (const width of PHONES) {
  test.describe(`mobile ${width}px`, () => {
    test.use({ viewport: { width, height: HEIGHT }, hasTouch: true, isMobile: true })

    test.describe('header (STE-250)', () => {
      test('the phase stepper is visible and inside the screen', async ({ page }) => {
        await open(page)
        await expect(page.locator('phase-stepper')).toBeVisible()
        await expectInside(page, page.locator('phase-stepper'), 'phase stepper')
      })

      test('the facilitator can still change the phase from the stepper', async ({ page }) => {
        await open(page)
        const request = page.waitForRequest((r) => r.url().endsWith('/phase') && r.method() === 'POST')
        await page.locator('phase-stepper').getByRole('button', { name: /Collecting/ }).click()
        expect((await request).postDataJSON()).toEqual({ phase: 'collecting' })
      })

      test('everyone else only reads the phase', async ({ page }) => {
        await open(page, { facilitator: false })
        await expect(page.locator('phase-stepper')).toBeVisible()
        await expect(page.locator('phase-stepper').getByRole('button')).toHaveCount(0)
      })

      for (const [label, timer] of [['without', null], ['with', RUNNING]] as const) {
        test(`the header controls are all inside the screen ${label} a running timer`, async ({ page }) => {
          await open(page, { session: { ...BASE, timer }, facilitator: false })
          await expectInside(page, page.locator('header').locator('button:visible, .header-countdown'), `header controls (${label} timer)`)
        })
      }

      test('the votes left do not overlap the brand', async ({ page }) => {
        await open(page)
        const votes = await page.locator('.header-votes').boundingBox()
        const brand = await page.locator('.brand').boundingBox()
        expect(votes).not.toBeNull()
        expect(brand).not.toBeNull()
        expect(overlaps(votes!, brand!), 'votes overlap the brand').toBe(false)
      })

      test('the countdown pill does not cover the brand or the tools', async ({ page }) => {
        await open(page, { session: { ...BASE, timer: RUNNING }, facilitator: false })
        const pill = await page.locator('.header-countdown').boundingBox()
        const brand = await page.locator('.brand').boundingBox()
        expect(overlaps(pill!, brand!), 'timer pill overlaps the brand').toBe(false)
        for (const button of await page.locator('.header-tools button:visible').all()) {
          const box = (await button.boundingBox())!
          const insidePill = box.x >= pill!.x && box.y >= pill!.y && box.x + box.width <= pill!.x + pill!.width && box.y + box.height <= pill!.y + pill!.height
          if (insidePill) continue // the pill's own mute button
          expect(overlaps(pill!, box), 'timer pill overlaps a header button').toBe(false)
        }
      })

      test('the header buttons are big enough to touch', async ({ page }) => {
        await open(page)
        for (const button of await page.locator('.header-tools button:visible').all()) {
          const box = (await button.boundingBox())!
          expect(Math.min(box.width, box.height), await button.evaluate((e) => e.className)).toBeGreaterThanOrEqual(TAP - 0.5)
        }
      })
    })

    test.describe('facilitator dock (STE-251)', () => {
      for (const phase of ['collecting', 'discussing', 'closed'] as const) {
        test(`${phase}: every dock button is fully on screen and big enough`, async ({ page }) => {
          await open(page, { session: { ...BASE, phase } })
          const dock = page.locator('.facilitator-dock')
          await expectInside(page, dock, 'dock')
          await expectInside(page, dock.locator('button:visible'), 'dock buttons')
          for (const button of await dock.locator('button:visible').all()) {
            const box = (await button.boundingBox())!
            expect(box.height, `${(await button.textContent())?.trim() || (await button.getAttribute('title'))} is too short`).toBeGreaterThanOrEqual(TAP - 0.5)
          }
        })
      }

      test('the main action is on screen', async ({ page }) => {
        await open(page)
        await expectInside(page, page.getByRole('button', { name: 'Close session' }), 'Close session')
        await open(page, { session: { ...BASE, phase: 'collecting' } })
        await expectInside(page, page.getByRole('button', { name: /Start discussion/ }), 'Start discussion')
      })

      test('the dock never covers the last card when scrolled to the bottom', async ({ page }) => {
        await open(page)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const dock = (await page.locator('.facilitator-dock').boundingBox())!
        const cards = await page.locator('retro-card').all()
        const last = (await cards[cards.length - 1].boundingBox())!
        expect(last.y + last.height, 'last card ends under the dock').toBeLessThanOrEqual(dock.y + 1)
      })
    })

    test.describe('popovers (STE-252)', () => {
      test('the Share popover is inside the screen', async ({ page }) => {
        await open(page)
        await page.getByRole('button', { name: /Share/ }).click()
        await expectInside(page, page.locator('.share-popover'), 'share popover')
        await expectInside(page, page.locator('.share-popover button:visible'), 'share popover buttons')
      })

      test('the Action items popover is inside the screen', async ({ page }) => {
        await open(page)
        await page.getByRole('button', { name: 'Action items' }).click()
        await expectInside(page, page.locator('.actions-popover'), 'actions popover')
      })

      test('the avatar menu is inside the screen', async ({ page }) => {
        await open(page)
        await page.locator('.avatar-menu-btn').click()
        await expectInside(page, page.locator('.user-menu'), 'avatar menu')
      })

      test('a popover opens under the header, not over it', async ({ page }) => {
        await open(page)
        await page.getByRole('button', { name: /Share/ }).click()
        const header = (await page.locator('header').boundingBox())!
        const popover = (await page.locator('.share-popover').boundingBox())!
        expect(popover.y, 'popover covers the header').toBeGreaterThanOrEqual(header.y + header.height - 1)
      })
    })

    test.describe('notification cards (STE-253)', () => {
      test('one card at a time, not half the screen', async ({ page }) => {
        await open(page, { consent: false, history: true })
        await page.locator('.avatar-menu-btn').click()
        await page.locator('.menu-feedback').click()
        await expect(page.locator('consent-banner')).toBeAttached()
        await expect(page.locator('feedback-dialog')).toBeAttached()
        const visible: { tag: string; height: number }[] = []
        for (const tag of ['consent-banner', 'feedback-dialog', 'whats-new-dialog']) {
          const box = await page.locator(tag).boundingBox().catch(() => null)
          if (box && box.height > 0) visible.push({ tag, height: box.height })
        }
        expect(visible.map((v) => v.tag), 'more than one card is visible').toHaveLength(1)
        expect(visible[0].height, 'the card is taller than 40% of the screen').toBeLessThanOrEqual(HEIGHT * 0.4)
      })

      test('closing the visible card shows the next one', async ({ page }) => {
        await open(page, { consent: false })
        await page.locator('.avatar-menu-btn').click()
        await page.locator('.menu-feedback').click()
        await expect(page.locator('consent-banner')).toBeVisible()
        await expect(page.locator('feedback-dialog')).toBeHidden()
        await page.locator('consent-banner').getByRole('button', { name: 'Decline' }).click()
        await expect(page.locator('feedback-dialog')).toBeVisible()
      })

      test('the card is inside the screen and the dock buttons stay reachable', async ({ page }) => {
        await open(page, { consent: false })
        await expectInside(page, page.locator('consent-banner'), 'consent card')
        const card = (await page.locator('consent-banner').boundingBox())!
        for (const button of await page.locator('.facilitator-dock button:visible').all()) {
          expect(overlaps(card, (await button.boundingBox())!), 'the card covers a dock button').toBe(false)
        }
      })
    })

    test.describe('touch targets and text (STE-255)', () => {
      // the invisible hit area around a control: its box, or its centred ::after when that is bigger
      const hitArea = (el: Element) => {
        const rect = el.getBoundingClientRect()
        const after = getComputedStyle(el, '::after')
        const grows = after.content !== 'none' && after.position === 'absolute'
        return {
          width: Math.max(rect.width, grows ? parseFloat(after.width) : 0),
          height: Math.max(rect.height, grows ? parseFloat(after.height) : 0),
        }
      }

      test('every control on the board has a hit area of at least 32px', async ({ page }) => {
        await open(page)
        const small: string[] = []
        for (const control of await page.locator('retro-column button:visible, retro-card button:visible, select:visible').all()) {
          const area = await control.evaluate(hitArea)
          if (Math.min(area.width, area.height) < HIT - 0.5) {
            small.push(`${(await control.evaluate((e) => e.className)) || 'button'} ${Math.round(area.width)}x${Math.round(area.height)}`)
          }
        }
        expect(small, 'controls with a hit area under 32px').toEqual([])
      })

      test('no text on the board is under 11px', async ({ page }) => {
        await open(page)
        const tiny = await page.evaluate(() => {
          const out: string[] = []
          const walk = (root: ParentNode) => {
            for (const el of Array.from(root.querySelectorAll('*'))) {
              if (el.shadowRoot) walk(el.shadowRoot)
              const r = el.getBoundingClientRect()
              if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
              const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())
              if (own && parseFloat(getComputedStyle(el).fontSize) < 11) out.push(`${el.tagName.toLowerCase()}.${el.className} ${getComputedStyle(el).fontSize}`)
            }
          }
          walk(document)
          return out
        })
        expect(tiny, 'text under 11px').toEqual([])
      })
    })

    test.describe('stats and admin (STE-254)', () => {
      test('the stats page does not run past the screen', async ({ page }) => {
        const api = createApiResponses()
        await page.route('/api/v1/stats', route => route.fulfill({ json: api.publicStats }))
        await page.goto('/stats')
        await expect(page.locator('stats-page')).toBeVisible()
        await page.waitForTimeout(400)
        expect(await pageOverflow(page), 'the page scrolls sideways').toBe(0)
        const width = await viewportWidth(page)
        for (const box of await page.locator('stats-page .card, stats-page .stat-card, stats-page section').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) {
          expect(box, 'a stats card ends past the screen').toBeLessThanOrEqual(width + 0.5)
        }
      })

      test('the stats cards sit in a readable grid: two tiles per row at most', async ({ page }) => {
        const api = createApiResponses()
        await page.route('/api/v1/stats', route => route.fulfill({ json: api.publicStats }))
        await page.goto('/stats')
        await page.waitForTimeout(400)
        const tiles = await page.locator('stats-page .stat-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
        const firstRow = tiles.filter((top) => top === tiles[0]).length
        expect(firstRow, 'more than two stat tiles in one row').toBeLessThanOrEqual(2)
      })

      test('the admin health cards show their numbers in full', async ({ page }) => {
        const api = createApiResponses()
        await page.route('/api/v1/stats/auth', route => route.fulfill({ json: api.authToken }))
        await page.route('/api/v1/stats/admin', route => route.fulfill({ json: api.adminStats }))
        await page.goto('/admin')
        await page.locator('admin-page').getByPlaceholder('Admin password').fill('pw')
        await page.locator('admin-page').getByRole('button', { name: /Unlock/ }).click()
        await expect(page.locator('admin-page').getByText('Feedback comments', { exact: true })).toBeVisible()
        await page.waitForTimeout(400)
        expect(await pageOverflow(page), 'the page scrolls sideways').toBe(0)
        const clipped = await page.locator('admin-page *:visible').evaluateAll((els) => {
          const vw = window.innerWidth
          return els.filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() && e.getBoundingClientRect().right > vw + 0.5)
            .map((e) => (e.textContent ?? '').trim().slice(0, 20))
        })
        expect(clipped, 'text runs past the screen').toEqual([])
      })
    })

    test.describe('presenting on a phone', () => {
      test('the stepper is visible and the Exit pill is inside the screen', async ({ page }) => {
        await open(page, { presenting: true })
        await expectInside(page, page.locator('phase-stepper'), 'phase stepper')
        await expectInside(page, page.getByRole('status', { name: 'Presenting' }), 'Exit pill')
      })

      test('the Exit pill does not cover the last card', async ({ page }) => {
        await open(page, { presenting: true })
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const pill = (await page.getByRole('status', { name: 'Presenting' }).boundingBox())!
        const cards = await page.locator('retro-card').all()
        const last = (await cards[cards.length - 1].boundingBox())!
        expect(last.y + last.height, 'last card ends under the pill').toBeLessThanOrEqual(pill.y + 1)
      })
    })

    test.describe('whole pages', () => {
      test('the board never scrolls sideways, in any phase', async ({ page }) => {
        for (const phase of ['collecting', 'discussing', 'closed'] as const) {
          await open(page, { session: { ...BASE, phase, timer: RUNNING } })
          expect(await pageOverflow(page), `${phase}: the page scrolls sideways`).toBe(0)
          await page.unroute(`/api/v1/sessions/${SESSION_ID}`)
        }
      })

      test('the columns are stacked in one column', async ({ page }) => {
        await open(page)
        const xs = await page.locator('retro-column').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
        expect(new Set(xs).size, 'columns are side by side').toBe(1)
      })
    })
  })
}

test.describe('tablet 768px (STE-257)', () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true })

  test('the columns sit two by two', async ({ page }) => {
    await open(page)
    const tops = await page.locator('retro-column').evaluateAll((els) => els.map((e) => ({ x: Math.round(e.getBoundingClientRect().left), y: Math.round(e.getBoundingClientRect().top) })))
    expect(tops).toHaveLength(3)
    expect(Math.abs(tops[0].y - tops[1].y), 'the first two columns are not in the same row').toBeLessThanOrEqual(2)
    expect(tops[1].x, 'the second column is not beside the first').toBeGreaterThan(tops[0].x + 100)
    expect(tops[2].y, 'the third column is not on the next row').toBeGreaterThan(tops[0].y + 50)
  })

  test('the page does not scroll sideways and the header title is not cut mid-word', async ({ page }) => {
    await open(page)
    expect(await pageOverflow(page)).toBe(0)
    const title = page.locator('.session-title')
    await expect(title).toBeVisible()
    const clipped = await title.evaluate((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis')
    expect(clipped, 'the title is cut without an ellipsis').toBe(false)
  })
})

test.describe('desktop 1100px keeps three columns in a row', () => {
  test.use({ viewport: { width: 1100, height: 800 } })

  test('the columns are side by side', async ({ page }) => {
    await open(page)
    const tops = await page.locator('retro-column').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size, 'columns are not all in one row').toBe(1)
  })
})

test.describe('touch: move and group a card without dragging (STE-256)', () => {
  test.use({ viewport: { width: 390, height: HEIGHT }, hasTouch: true, isMobile: true })

  const TWO_IN_COLUMN = {
    ...BASE,
    cards: [
      card({ id: 'a', text: 'First card' }),
      card({ id: 'b', text: 'Second card' }),
      card({ id: 'x', column: 'To Improve', text: 'Elsewhere' }),
    ] as object[],
  }

  test('a card has a Move or group control on a touch screen', async ({ page }) => {
    await open(page, { session: TWO_IN_COLUMN })
    await expect(page.locator('retro-card').first().locator('.move-select')).toBeVisible()
  })

  test('choosing another column moves the card there', async ({ page }) => {
    await open(page, { session: TWO_IN_COLUMN })
    const request = page.waitForRequest((r) => r.url().endsWith('/cards/a/column') && r.method() === 'PATCH')
    await page.locator('retro-card').first().locator('.move-select').selectOption({ label: 'To Improve' })
    expect((await request).postDataJSON()).toEqual({ column: 'To Improve' })
  })

  test('choosing another card in the column groups them', async ({ page }) => {
    await open(page, { session: TWO_IN_COLUMN })
    const request = page.waitForRequest((r) => r.url().endsWith('/cards/a/group') && r.method() === 'POST')
    await page.locator('retro-card').first().locator('.move-select').selectOption({ label: 'Second card' })
    expect((await request).postDataJSON()).toEqual({ target_card_id: 'b' })
  })

  test('the options leave out the column the card is in and the card itself', async ({ page }) => {
    await open(page, { session: TWO_IN_COLUMN })
    const options = await page.locator('retro-card').first().locator('.move-select option').allTextContents()
    expect(options).toContain('To Improve')
    expect(options).toContain('Action Items')
    expect(options).toContain('Second card')
    expect(options).not.toContain('Went Well')
    expect(options).not.toContain('First card')
  })

  test('no control in a closed session, or for a card you may not move', async ({ page }) => {
    await open(page, { session: { ...TWO_IN_COLUMN, phase: 'closed' } })
    await expect(page.locator('.move-select')).toHaveCount(0)
  })

  test('a participant may move their own cards, and group any published card, like dragging', async ({ page }) => {
    const mine = { ...BASE, cards: [card({ id: 'a', text: 'Bobs', author_name: 'Bob' }), card({ id: 'z', text: 'Alices', author_name: 'Alice' })] as object[] }
    await open(page, { session: mine, facilitator: false })
    const byText = (text: string) => page.locator('retro-card').filter({ has: page.locator('.card-text', { hasText: text }) })
    const own = await byText('Bobs').locator('.move-select option').allTextContents()
    expect(own, 'own card can be moved').toContain('To Improve')
    expect(own, 'own card can be grouped').toContain('Alices')
    const other = await byText('Alices').locator('.move-select option').allTextContents()
    expect(other, 'someone else\'s card cannot be moved').not.toContain('To Improve')
    expect(other, 'someone else\'s card can be grouped').toContain('Bobs')
  })
})

test.describe('with a mouse the touch control is not shown (STE-256)', () => {
  test.use({ viewport: { width: 1100, height: 800 } })

  test('there is no Move or group control on desktop', async ({ page }) => {
    await open(page)
    await expect(page.locator('.move-select:visible')).toHaveCount(0)
  })
})
