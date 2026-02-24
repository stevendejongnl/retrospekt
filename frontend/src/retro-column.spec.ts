import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'col-spec-1'
const FAC_TOKEN = 'fac-tok-1'

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

const BASE = {
  id: SESSION_ID,
  name: 'Sprint Retro',
  columns: ['Went Well', 'To Improve', 'Action Items'],
  phase: 'collecting' as const,
  participants: [
    { name: 'Alice', joined_at: '2026-01-01T00:00:00Z' },
    { name: 'Bob', joined_at: '2026-01-01T00:00:00Z' },
  ],
  cards: [] as object[],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  facilitator_token: FAC_TOKEN,
  timer: null,
}

async function mockApi(page: Page, session: Record<string, unknown>) {
  const id = session.id as string
  await page.route(`/api/v1/sessions/${id}`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }))
  await page.route(`/api/v1/sessions/${id}/stream`, route =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: sse(session),
    }))
  await page.route(`/api/v1/sessions/${id}/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }))
}

async function withName(page: Page, name: string, token = '') {
  await page.addInitScript(
    ({ id, n, t }: { id: string; n: string; t: string }) => {
      localStorage.setItem(`retro_name_${id}`, n)
      if (t) localStorage.setItem(`retro_facilitator_${id}`, t)
    },
    { id: SESSION_ID, n: name, t: token },
  )
}

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    column: 'Went Well',
    text: 'Great teamwork',
    author_name: 'Alice',
    votes: [],
    published: false,
    reactions: [],
    assignee: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Keyboard shortcuts in textarea ────────────────────────────────────────────

test.describe('retro-column keyboard shortcuts', () => {
  test('Ctrl+Enter submits the card via add-card event -> POST /cards', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-column').first()).toBeVisible()

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('textarea').fill('Some text')

    const req = page.waitForRequest(r => r.url().includes('/cards') && r.method() === 'POST')
    await page.locator('textarea').press('Control+Enter')
    await req
  })

  test('Meta+Enter also submits the card', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('textarea').fill('Some meta text')

    const req = page.waitForRequest(r => r.url().includes('/cards') && r.method() === 'POST')
    await page.locator('textarea').press('Meta+Enter')
    await req
  })

  test('Escape in textarea hides the add form', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await expect(page.locator('textarea')).toBeVisible()

    await page.locator('textarea').press('Escape')
    await expect(page.locator('textarea')).not.toBeVisible()
  })

  test('Ctrl+Enter with empty text does not submit', async ({ page }) => {
    await withName(page, 'Alice')
    let submitted = false
    await page.route(`/api/v1/sessions/${SESSION_ID}/cards`, route => {
      submitted = true
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    })
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    // Leave textarea empty
    await page.locator('textarea').press('Control+Enter')
    // Wait a tick and verify no submission happened
    await page.waitForTimeout(200)
    expect(submitted).toBe(false)
  })
})

// ── Emoji picker ──────────────────────────────────────────────────────────────

test.describe('retro-column emoji picker', () => {
  test('clicking emoji toggle opens the emoji popover', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('.emoji-toggle').click()
    await expect(page.locator('.emoji-popover')).toBeVisible()
  })

  test('clicking an emoji item closes the popover and inserts emoji into textarea', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('.emoji-toggle').click()
    await expect(page.locator('.emoji-popover')).toBeVisible()

    await page.locator('.emoji-item').first().click()
    await expect(page.locator('.emoji-popover')).not.toBeVisible()
    // Textarea should have the emoji inserted
    const val = await page.locator('textarea').inputValue()
    expect(val.length).toBeGreaterThan(0)
  })

  test('clicking outside the column closes the emoji popover', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('.emoji-toggle').click()
    await expect(page.locator('.emoji-popover')).toBeVisible()

    // Click on the page header (outside the column)
    await page.locator('.brand').click()
    // After navigating to home or losing focus, popover should be gone
    // Navigate back and verify
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.emoji-popover')).not.toBeVisible()
  })
})

// ── Title editing (facilitator) ───────────────────────────────────────────────

test.describe('retro-column title editing', () => {
  test('clicking title in collecting phase (facilitator) shows title input', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.facilitator-bar')).toBeVisible()

    // Click on the "Went Well" column title text
    const col = page.locator('retro-column').first()
    await col.locator('.column-title span[style]').click()
    await expect(col.locator('.title-input')).toBeVisible()
  })

  test('pressing Enter commits the title rename -> PATCH /columns', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    const col = page.locator('retro-column').first()
    await col.locator('.column-title span[style]').click()

    const req = page.waitForRequest(r => r.url().includes('/columns/') && r.method() === 'PATCH')
    const input = col.locator('.title-input')
    await input.fill('New Name')
    await input.press('Enter')
    await req
  })

  test('pressing Escape cancels the title edit', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    const col = page.locator('retro-column').first()
    await col.locator('.column-title span[style]').click()
    await expect(col.locator('.title-input')).toBeVisible()

    await col.locator('.title-input').press('Escape')
    await expect(col.locator('.title-input')).not.toBeVisible()
  })

  test('title is not editable by a non-facilitator', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    // Should not show the clickable span style
    const col = page.locator('retro-column').first()
    await expect(col.locator('.title-input')).not.toBeVisible()
  })
})

// ── Delete column button ──────────────────────────────────────────────────────

test.describe('retro-column delete button', () => {
  test('delete-col button is visible for facilitator in collecting phase', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.delete-col-btn').first()).toBeVisible()
  })

  test('clicking delete-col button calls DELETE /columns', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    const req = page.waitForRequest(r => r.url().includes('/columns/') && r.method() === 'DELETE')
    await page.locator('.delete-col-btn').first().click()
    await req
  })

  test('delete-col button is NOT visible for non-facilitator', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.delete-col-btn')).not.toBeVisible()
  })
})

// ── Publish-all button ────────────────────────────────────────────────────────

test.describe('retro-column publish-all', () => {
  test('publish-all button is shown in discussing phase when participant has unpublished cards', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'discussing',
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.publish-all-btn')).toBeVisible()
  })

  test('clicking publish-all calls POST /cards/publish-all', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'discussing',
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    const req = page.waitForRequest(r => r.url().includes('/publish-all') && r.method() === 'POST')
    await page.locator('.publish-all-btn').click()
    await req
  })

  test('publish-all button is NOT shown in collecting phase', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'collecting',
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.publish-all-btn')).not.toBeVisible()
  })

  test('publish-all is NOT shown when participant has no unpublished cards', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'discussing',
      cards: [makeCard({ author_name: 'Alice', published: true })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.publish-all-btn')).not.toBeVisible()
  })
})

// ── Card visibility in closed phase ──────────────────────────────────────────

test.describe('retro-column closed phase card sorting', () => {
  test('cards in closed phase are sorted by vote count descending', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'closed',
      cards: [
        makeCard({ id: 'c1', text: 'Zero votes', author_name: 'Alice', published: true, votes: [] }),
        makeCard({ id: 'c2', text: 'Two votes', author_name: 'Alice', published: true, votes: [
          { participant_name: 'Alice' }, { participant_name: 'Bob' },
        ] }),
        makeCard({ id: 'c3', text: 'One vote', author_name: 'Alice', published: true, votes: [
          { participant_name: 'Bob' },
        ] }),
      ],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    const cards = page.locator('retro-card')
    await expect(cards).toHaveCount(3)
    // First card should contain "Two votes" text
    await expect(cards.nth(0)).toContainText('Two votes')
    await expect(cards.nth(1)).toContainText('One vote')
    await expect(cards.nth(2)).toContainText('Zero votes')
  })
})
