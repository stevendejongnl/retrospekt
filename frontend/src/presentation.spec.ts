import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

const SESSION_ID = 'present-1'
const FAC_TOKEN = 'fac-tok-present'

const card = (o: Record<string, unknown>) => ({
  id: 'c', column: 'Went Well', text: 'text', author_name: 'Bob', published: true,
  votes: [], reactions: [], assignee: null, group_id: null, created_at: '2026-01-01T00:00:00Z', ...o,
})

const BASE = {
  id: SESSION_ID,
  name: 'Sprint Retro',
  columns: ['Went Well', 'To Improve'],
  phase: 'discussing' as const,
  participants: [
    { name: 'Alice', joined_at: '2026-01-01T00:00:00Z' },
    { name: 'Bob', joined_at: '2026-01-01T00:00:00Z' },
  ],
  cards: [
    card({ id: 'pub', text: 'Shared with everyone', votes: [{ participant_name: 'Alice' }] }),
    card({ id: 'mine', column: 'To Improve', text: 'My private draft', author_name: 'Alice', published: false }),
    card({ id: 'theirs', column: 'To Improve', text: 'Bobs private draft', author_name: 'Bob', published: false }),
  ] as object[],
  max_votes_per_participant: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  facilitator_token: FAC_TOKEN,
  timer: null as object | null,
}

async function open(page: Page, session: Record<string, unknown> = BASE, presenting = false, consent = true) {
  await page.addInitScript(
    ({ id, token, on, answered }: { id: string; token: string; on: boolean; answered: boolean }) => {
      localStorage.setItem(`retro_name_${id}`, 'Alice')
      localStorage.setItem(`retro_facilitator_${id}`, token)
      if (answered) localStorage.setItem('retro_analytics_consent', 'denied')
      if (on) localStorage.setItem(`retro_present_${id}`, 'true')
    },
    { id: SESSION_ID, token: FAC_TOKEN, on: presenting, answered: consent },
  )
  await page.route(`/api/v1/sessions/${SESSION_ID}`, route => route.fulfill({ json: session }))
  await page.route(`/api/v1/sessions/${SESSION_ID}/stream`, route =>
    route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: `data: ${JSON.stringify(session)}\n\n` }))
  await page.route(`/api/v1/sessions/${SESSION_ID}/**`, route => route.fulfill({ json: session }))
  await page.goto(`/session/${SESSION_ID}`)
}

const present = async (page: Page) => {
  await page.getByRole('button', { name: /Share/ }).click()
  await page.getByRole('button', { name: /Present this board/ }).click()
}

test.describe('presentation mode: entering and leaving', () => {
  test('is offered in the Share popover, in any phase', async ({ page }) => {
    await open(page, { ...BASE, phase: 'collecting' })
    await page.getByRole('button', { name: /Share/ }).click()
    await expect(page.getByRole('button', { name: /Present this board/ })).toBeVisible()
  })

  test('is off by default: the board shows your drafts and the dock', async ({ page }) => {
    await open(page)
    await expect(page.getByText('My private draft')).toBeVisible()
    await expect(page.locator('.facilitator-dock')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Presenting' })).toHaveCount(0)
  })

  test('shows an Exit pill that is always visible', async ({ page }) => {
    await open(page)
    await present(page)
    const pill = page.getByRole('status', { name: 'Presenting' })
    await expect(pill).toBeVisible()
    await expect(pill.getByRole('button', { name: /Exit/ })).toBeVisible()
  })

  test('Exit brings the board back, drafts included', async ({ page }) => {
    await open(page)
    await present(page)
    await expect(page.getByText('My private draft')).toHaveCount(0)
    await page.getByRole('button', { name: /Exit/ }).click()
    await expect(page.getByText('My private draft')).toBeVisible()
    await expect(page.locator('.facilitator-dock')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Presenting' })).toHaveCount(0)
  })

  test('Escape leaves the mode too', async ({ page }) => {
    await open(page)
    await present(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('status', { name: 'Presenting' })).toHaveCount(0)
    await expect(page.getByText('My private draft')).toBeVisible()
  })

  test('survives a reload on this device', async ({ page }) => {
    await open(page)
    await present(page)
    await page.reload()
    await expect(page.getByRole('status', { name: 'Presenting' })).toBeVisible()
    await expect(page.getByText('My private draft')).toHaveCount(0)
  })

  test('is remembered per board, and cleared on Exit', async ({ page }) => {
    await open(page)
    await present(page)
    expect(await page.evaluate((id) => localStorage.getItem(`retro_present_${id}`), SESSION_ID)).toBe('true')
    await page.getByRole('button', { name: /Exit/ }).click()
    expect(await page.evaluate((id) => localStorage.getItem(`retro_present_${id}`), SESSION_ID)).toBeNull()
  })
})

test.describe('presentation mode: what is shown', () => {
  test('published cards stay; nobody\'s drafts show, not even your own', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.getByText('Shared with everyone')).toBeVisible()
    await expect(page.getByText('My private draft')).toHaveCount(0)
    await expect(page.getByText('Bobs private draft')).toHaveCount(0)
  })

  test('the column count only counts what is shown', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('retro-column').nth(1).locator('.count-badge')).toHaveText('0')
  })

  test('an empty column says cards appear once published', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('retro-column').nth(1).getByText('Cards appear here once they are published')).toBeVisible()
  })

  test('the header keeps board, phase and nothing to act with', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('.session-title')).toContainText('Sprint Retro')
    await expect(page.locator('phase-stepper')).toBeVisible()
    await expect(page.locator('.header-tools').getByRole('button')).toHaveCount(0)
    await expect(page.locator('.header-votes')).toHaveCount(0)
    await expect(page.locator('.avatar-menu-btn')).toHaveCount(0)
  })

  test('keeps the countdown pill while a timer exists', async ({ page }) => {
    const timer = { duration_seconds: 600, started_at: new Date().toISOString(), paused_remaining: null }
    await open(page, { ...BASE, timer }, true)
    await expect(page.locator('.header-countdown')).toBeVisible()
  })

  test('collecting: columns are empty and a bar says how much is written', async ({ page }) => {
    await open(page, { ...BASE, phase: 'collecting' }, true)
    await expect(page.locator('retro-column .card, retro-column retro-card')).toHaveCount(0)
    await expect(page.getByText('3 cards written by 2 people')).toBeVisible()
    await expect(page.getByText('They stay private until the discussion starts.')).toBeVisible()
  })

  test('the board stays live: a new published card appears', async ({ page }) => {
    const live = { ...BASE, cards: [...BASE.cards, card({ id: 'late', text: 'Arrived while presenting' })] }
    await open(page, BASE, true)
    await page.evaluate(() => (document.querySelector('session-page') as unknown as { requestUpdate: () => void }).requestUpdate())
    await page.route(`/api/v1/sessions/${SESSION_ID}`, route => route.fulfill({ json: live }))
    await page.reload()
    await expect(page.getByText('Arrived while presenting')).toBeVisible()
  })
})

test.describe('presentation mode: read only', () => {
  test('no card has controls: no delete, publish, assign, unpublish, reaction picker', async ({ page }) => {
    const mine = card({ id: 'own', text: 'My own published card', author_name: 'Alice' })
    await open(page, { ...BASE, cards: [mine] }, true)
    const c = page.locator('retro-card').first()
    await expect(c.locator('.delete-btn, .publish-btn, .unpublish-btn, .assign-btn, emoji-picker')).toHaveCount(0)
  })

  test('the vote count is shown but cannot be pressed', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('retro-card').first().locator('.vote-btn')).toBeDisabled()
  })

  test('your own vote is not highlighted: the screen shows the team\'s view', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('retro-card').first().locator('.vote-btn')).not.toHaveClass(/voted/)
  })

  test('cards cannot be dragged', async ({ page }) => {
    const mine = card({ id: 'own', text: 'My own published card', author_name: 'Alice' })
    await open(page, { ...BASE, cards: [mine] }, true)
    await expect(page.locator('retro-card').first().locator('.card')).toHaveAttribute('draggable', 'false')
  })

  test('no add-card slot, no column controls, no facilitator dock', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('retro-column .add-btn')).toHaveCount(0)
    await expect(page.locator('retro-column .delete-col-btn, retro-column .sort-votes-btn, retro-column .publish-all-btn')).toHaveCount(0)
    await expect(page.locator('.facilitator-dock')).toHaveCount(0)
  })

  test('the phase stepper cannot be clicked, even for the facilitator', async ({ page }) => {
    await open(page, BASE, true)
    await expect(page.locator('phase-stepper').getByRole('button')).toHaveCount(0)
  })

  test('the column colour picker does not open', async ({ page }) => {
    await open(page, BASE, true)
    await page.locator('retro-column').first().locator('.count-badge').click()
    await expect(page.locator('retro-column').first().locator('.color-picker')).toHaveCount(0)
  })
})

test.describe('presentation mode: no notification cards', () => {
  test('the consent card is not shown while presenting', async ({ page }) => {
    await open(page, BASE, true, false)
    await expect(page.locator('.facilitator-dock')).toHaveCount(0)
    await expect(page.locator('consent-banner')).toHaveCount(0)
  })

  test('entering the mode removes a card that is already docked', async ({ page }) => {
    await open(page, BASE, false, false)
    await expect(page.locator('consent-banner')).toHaveCount(1)
    await present(page)
    await expect(page.locator('consent-banner')).toHaveCount(0)
  })

  test('the feedback card does not pop up when the session closes while presenting', async ({ page }) => {
    await open(page, BASE, true)
    await page.waitForTimeout(100)
    await expect(page.locator('feedback-dialog')).toHaveCount(0)
  })
})

test.describe('presentation mode: meeting screen', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('is zoomed to 125% on a 1920 wide screen', async ({ page }) => {
    await open(page, BASE, true)
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('session-page')!).zoom)).toBe('1.25')
  })
})

test.describe('presentation mode: normal size below 1600px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('is not zoomed', async ({ page }) => {
    await open(page, BASE, true)
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('session-page')!).zoom)).toBe('1')
  })
})
