import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'hist-spec-1'
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

function seedHistory(page: Page, entries: object[]) {
  return page.addInitScript((data: object[]) => {
    localStorage.setItem('retro_history', JSON.stringify(data))
  }, entries)
}

// ── History sidebar via home-page ─────────────────────────────────────────────

test.describe('session-history on home-page', () => {
  test('shows "No sessions yet" when history is empty', async ({ page }) => {
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
    await expect(page.getByText('No sessions yet')).toBeVisible()
  })

  test('shows history entries when localStorage has entries', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-1',
        name: 'Old Retro',
        phase: 'closed',
        participantName: 'Alice',
        isFacilitator: false,
        created_at: '2026-01-15T10:00:00Z',
      },
    ])
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
    await expect(page.locator('.item-name').filter({ hasText: 'Old Retro' })).toBeVisible()
  })

  test('shows phase badge for each history entry', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-2',
        name: 'Discussing Session',
        phase: 'discussing',
        participantName: 'Bob',
        isFacilitator: false,
        created_at: '2026-01-15T10:00:00Z',
      },
    ])
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.phase-badge.phase-discussing')).toBeVisible()
  })

  test('shows facilitator badge when isFacilitator is true', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-3',
        name: 'My Session',
        phase: 'collecting',
        participantName: 'Alice',
        isFacilitator: true,
        created_at: '2026-01-15T10:00:00Z',
      },
    ])
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.facilitator-badge')).toBeVisible()
  })

  test('does NOT show facilitator badge when isFacilitator is false', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-4',
        name: 'Not My Session',
        phase: 'collecting',
        participantName: 'Bob',
        isFacilitator: false,
        created_at: '2026-01-15T10:00:00Z',
      },
    ])
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.facilitator-badge')).not.toBeVisible()
  })

  test('clicking × remove button removes the entry from the list', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-5',
        name: 'Removable Session',
        phase: 'closed',
        participantName: 'Alice',
        isFacilitator: false,
        created_at: '2026-01-15T10:00:00Z',
      },
    ])
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.item-name').filter({ hasText: 'Removable Session' })).toBeVisible()

    await page.locator('.remove-btn').click()
    await expect(page.locator('.item-name').filter({ hasText: 'Removable Session' })).not.toBeVisible()
    await expect(page.getByText('No sessions yet')).toBeVisible()
  })

  test('clicking "Clear history" removes all entries', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-6',
        name: 'Session A',
        phase: 'closed',
        participantName: 'Alice',
        isFacilitator: false,
        created_at: '2026-01-15T10:00:00Z',
      },
      {
        id: 'hist-7',
        name: 'Session B',
        phase: 'discussing',
        participantName: 'Bob',
        isFacilitator: false,
        created_at: '2026-01-16T10:00:00Z',
      },
    ])
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.session-item')).toHaveCount(2)

    await page.locator('.clear-btn').click()
    await expect(page.locator('.session-item')).toHaveCount(0)
    await expect(page.getByText('No sessions yet')).toBeVisible()
  })

  test('clicking a session item navigates to the session page', async ({ page }) => {
    await seedHistory(page, [
      {
        id: 'hist-8',
        name: 'Navigate Session',
        phase: 'closed',
        participantName: 'Alice',
        isFacilitator: false,
        created_at: '2026-01-15T10:00:00Z',
      },
    ])
    // Mock the session API so session-page loads without redirecting
    await page.route('/api/v1/sessions/hist-8/stream', route => route.abort())
    await page.route('/api/v1/sessions/hist-8', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: 'hist-8', name: 'Navigate Session', columns: [], phase: 'closed',
        participants: [], cards: [], created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z', facilitator_token: 'tok', timer: null,
      }) }))
    await page.route('/api/v1/sessions/hist-8/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

    await page.goto('/')
    await page.locator('.history-toggle').click()
    await page.locator('.session-item').click()
    // Should navigate to session URL
    await expect(page).toHaveURL(/\/session\/hist-8/)
  })

  test('clicking × close button closes the sidebar', async ({ page }) => {
    await page.goto('/')
    await page.locator('.history-toggle').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()

    await page.locator('.close-btn').click()
    await expect(page.locator('.sidebar.open')).not.toBeVisible()
  })
})

// ── History sidebar via session-page ─────────────────────────────────────────

test.describe('session-history on session-page', () => {
  test('history sidebar opens from session page via history icon button', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()

    await page.locator('button[title="Your sessions"]').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
  })

  test('clicking backdrop closes the sidebar', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)

    await page.locator('button[title="Your sessions"]').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()

    // Click the backdrop to the right of the sidebar (sidebar is 320px wide, so click at x=400)
    await page.locator('.backdrop.visible').click({ position: { x: 400, y: 300 } })
    await expect(page.locator('.sidebar.open')).not.toBeVisible()
  })

  test('shows session entry saved after joining via name prompt', async ({ page }) => {
    await seedHistory(page, [
      {
        id: SESSION_ID,
        name: 'Sprint Retro',
        phase: 'collecting',
        participantName: 'Alice',
        isFacilitator: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ])
    await withName(page, 'Alice')
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()

    await page.locator('button[title="Your sessions"]').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
    await expect(page.locator('.item-name').filter({ hasText: 'Sprint Retro' })).toBeVisible()
  })
})
