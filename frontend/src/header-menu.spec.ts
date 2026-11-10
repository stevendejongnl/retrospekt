import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

const SESSION_ID = 'header-menu-1'

const BASE = {
  id: SESSION_ID,
  name: 'Sprint Retro',
  columns: ['Went Well', 'Action Items'],
  phase: 'discussing' as const,
  participants: [
    { name: 'Alice', joined_at: '2026-01-01T00:00:00Z' },
    { name: 'Bob', joined_at: '2026-01-01T00:00:00Z' },
  ],
  cards: [
    {
      id: 'c1', column: 'Action Items', text: 'Set up runbooks', author_name: 'Bob',
      published: true, votes: [], reactions: [], assignee: 'Alice', group_id: null, created_at: '2026-01-01T00:00:00Z',
    },
  ] as object[],
  max_votes_per_participant: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  facilitator_token: 'tok',
  timer: null,
}

async function open(page: Page) {
  await page.addInitScript((id: string) => localStorage.setItem(`retro_name_${id}`, 'Alice'), SESSION_ID)
  await page.route(`/api/v1/sessions/${SESSION_ID}`, route => route.fulfill({ json: BASE }))
  await page.route(`/api/v1/sessions/${SESSION_ID}/stream`, route =>
    route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: `data: ${JSON.stringify(BASE)}\n\n` }))
  await page.route(`/api/v1/sessions/${SESSION_ID}/**`, route => route.fulfill({ json: BASE }))
  await page.goto(`/session/${SESSION_ID}`)
}

test.describe('header: four things', () => {
  test('the header tools are Share, Action items, Notes and the avatar menu', async ({ page }) => {
    await open(page)
    const tools = page.locator('.header-tools')
    await expect(tools.getByRole('button', { name: /Share/ })).toBeVisible()
    await expect(tools.getByRole('button', { name: 'Action items' })).toBeVisible()
    await expect(tools.getByRole('button', { name: 'Board notes' })).toBeVisible()
    await expect(tools.locator('.avatar-menu-btn')).toBeVisible()
    await expect(tools.locator('button')).toHaveCount(4)
  })

  test('votes left are shown once in the header while discussing', async ({ page }) => {
    await open(page)
    await expect(page.locator('.header-votes')).toHaveText('0/5 votes')
    await expect(page.locator('.vote-indicator')).toHaveCount(0)
  })

  test('the action items button carries a count', async ({ page }) => {
    await open(page)
    await expect(page.locator('.actions-badge')).toHaveText('1')
  })

  test('the action items popover lists assigned cards', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Action items' }).click()
    const pop = page.locator('.actions-popover')
    await expect(pop).toContainText('Set up runbooks')
    await expect(pop).toContainText('Assigned to Alice')
    await page.keyboard.press('Escape')
    await expect(pop).toHaveCount(0)
  })

  test('there is no action items panel under the board', async ({ page }) => {
    await open(page)
    await expect(page.locator('retro-board .action-items-panel')).toHaveCount(0)
  })
})

test.describe('avatar menu', () => {
  test('lists sessions, stats, feedback, theme, name and help', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    const menu = page.getByRole('menu')
    for (const label of ['Your sessions', 'Stats', 'Give feedback', 'Theme', 'Change name', 'How it works']) {
      await expect(menu.getByRole('menuitem', { name: label })).toBeVisible()
    }
  })

  test('Escape and an outside click close it', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.locator('.avatar-menu-btn').click()
    await page.locator('main').click({ position: { x: 5, y: 300 } })
    await expect(page.getByRole('menu')).toHaveCount(0)
  })

  test('Change name swaps the name for an input', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    await page.getByRole('menuitem', { name: 'Change name' }).click()
    await expect(page.locator('.avatar-name-input')).toHaveValue('Alice')
  })

  test('Your sessions opens the history panel', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    await page.getByRole('menuitem', { name: 'Your sessions' }).click()
    await expect(page.locator('session-history')).toBeVisible()
  })

  test('Theme expands the light, dark, system choices and halal mode', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    await page.getByRole('menuitem', { name: 'Theme', exact: true }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Dark' })).toBeVisible()
    await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('share popover people', () => {
  test('lists who is here', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: /Share/ }).click()
    const pop = page.locator('.share-popover')
    await expect(pop).toContainText('2 people here')
    await expect(pop.locator('.share-person')).toHaveCount(2)
  })
})

test.describe('header popovers: closing and switching', () => {
  test('clicking Share again closes its popover', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: /Share/ }).click()
    await expect(page.locator('.share-popover')).toBeVisible()
    await page.getByRole('button', { name: /Share/ }).click()
    await expect(page.locator('.share-popover')).toHaveCount(0)
  })

  test('opening the avatar menu closes an open popover', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: /Share/ }).click()
    await page.locator('.avatar-menu-btn').click()
    await expect(page.locator('.share-popover')).toHaveCount(0)
    await expect(page.getByRole('menu')).toBeVisible()
  })

  test('the Action items popover says so when nothing is assigned', async ({ page }) => {
    await page.addInitScript((id: string) => localStorage.setItem(`retro_name_${id}`, 'Alice'), SESSION_ID)
    const empty = { ...BASE, cards: [] }
    await page.route(`/api/v1/sessions/${SESSION_ID}`, route => route.fulfill({ json: empty }))
    await page.route(`/api/v1/sessions/${SESSION_ID}/stream`, route =>
      route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: `data: ${JSON.stringify(empty)}\n\n` }))
    await page.route(`/api/v1/sessions/${SESSION_ID}/**`, route => route.fulfill({ json: empty }))
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.actions-badge')).toHaveCount(0)
    await page.getByRole('button', { name: 'Action items' }).click()
    await expect(page.locator('.actions-popover')).toContainText('Nothing is assigned yet')
  })
})

test.describe('avatar menu: theme choices and rename', () => {
  test('Light, Dark and System each switch the preference, and Halal mode is remembered', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    await page.getByRole('menuitem', { name: 'Theme', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('menuitemradio', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('menuitemradio', { name: 'System' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
    await page.getByLabel('Halal mode').check()
    expect(await page.evaluate(() => localStorage.getItem('retro_halal_mode'))).toBe('true')
  })

  test('renaming to the same name just stops editing', async ({ page }) => {
    await open(page)
    await page.locator('.avatar-menu-btn').click()
    await page.getByRole('menuitem', { name: 'Change name' }).click()
    await page.locator('.avatar-name-input').press('Enter')
    await expect(page.locator('.avatar-name-input')).toHaveCount(0)
    await expect(page.locator('.avatar-name')).toHaveText('Alice')
  })
})
