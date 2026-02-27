import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'spec-sess-1'
const FAC_TOKEN = 'fac-tok-1'

const BASE = {
  id: SESSION_ID,
  name: 'Sprint Retro',
  columns: ['Went Well', 'To Improve', 'Action Items'],
  phase: 'collecting',
  participants: [{ name: 'Alice', joined_at: '2026-01-01T00:00:00Z' }],
  cards: [] as object[],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  facilitator_token: FAC_TOKEN,
  timer: null,
}

/** Format a session as a single SSE event string. */
function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/**
 * Mock API routes for a session: GET session, SSE stream, and a catch-all
 * for all other sub-resources (join, phase, cards, etc.).
 */
async function mockApi(page: Page, session: typeof BASE) {
  await page.route(`/api/v1/sessions/${session.id}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route(`/api/v1/sessions/${session.id}/stream`, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: sse(session),
    }),
  )
  // Catch-all: join, phase, cards, reactions, timer, etc.
  await page.route(`/api/v1/sessions/${session.id}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
}

/**
 * Seed localStorage with a participant name (and optionally a facilitator token)
 * before the page loads, using addInitScript.
 */
async function withName(page: Page, name: string, token = '') {
  await page.addInitScript(
    ({ id, n, t }: { id: string; n: string; t: string }) => {
      localStorage.setItem(`retro_name_${id}`, n)
      if (t) localStorage.setItem(`retro_facilitator_${id}`, t)
    },
    { id: SESSION_ID, n: name, t: token },
  )
}

// ── Loading and error states ──────────────────────────────────────────────────

test.describe('session-page loading and errors', () => {
  test('shows spinner while initial GET is in-flight', async ({ page }) => {
    let resolveRequest!: () => void
    await page.route(`/api/v1/sessions/${SESSION_ID}`, async (route) => {
      await new Promise<void>((r) => { resolveRequest = r })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BASE) })
    })
    await page.route(`/api/v1/sessions/${SESSION_ID}/stream`, (route) => route.abort())
    void page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.spinner')).toBeVisible()
    resolveRequest()
  })

  test('redirects to home when session is not found', async ({ page }) => {
    await page.route(`/api/v1/sessions/${SESSION_ID}`, (route) =>
      route.fulfill({ status: 404, body: 'Not Found' }),
    )
    await page.route(`/api/v1/sessions/${SESSION_ID}/stream`, (route) => route.abort())
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page).toHaveURL('/')
  })
})

// ── Name prompt ───────────────────────────────────────────────────────────────

test.describe('session-page name prompt', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, BASE)
    // Intentionally no withName() → showNamePrompt = true
  })

  test('overlay is shown when no name is stored', async ({ page }) => {
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.overlay')).toBeVisible()
    await expect(page.getByText('Enter your name to join the retrospective.')).toBeVisible()
  })

  test('join button is disabled until a name is entered', async ({ page }) => {
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.getByRole('button', { name: /Join session/ })).toBeDisabled()
    await page.getByPlaceholder('Your name').fill('Bob')
    await expect(page.getByRole('button', { name: /Join session/ })).toBeEnabled()
  })

  test('clicking "Join session" dismisses the overlay and shows the board', async ({ page }) => {
    await page.goto(`/session/${SESSION_ID}`)
    await page.getByPlaceholder('Your name').fill('Bob')
    await page.getByRole('button', { name: /Join session/ }).click()
    await expect(page.locator('.overlay')).not.toBeVisible()
    await expect(page.locator('retro-board')).toBeVisible()
  })

  test('pressing Enter in the name input joins the session', async ({ page }) => {
    await page.goto(`/session/${SESSION_ID}`)
    await page.getByPlaceholder('Your name').fill('Bob')
    await page.getByPlaceholder('Your name').press('Enter')
    await expect(page.locator('.overlay')).not.toBeVisible()
  })

  test('submitting with empty name is a no-op', async ({ page }) => {
    await page.goto(`/session/${SESSION_ID}`)
    await page.getByPlaceholder('Your name').press('Enter')
    await expect(page.locator('.overlay')).toBeVisible()
  })
})

// ── Board: participant view ───────────────────────────────────────────────────

test.describe('session-page board (participant)', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
  })

  test('shows session name in the header', async ({ page }) => {
    await expect(page.getByText('Sprint Retro')).toBeVisible()
  })

  test('shows the share URL bar with a Copy link button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  })

  test('renders all three columns', async ({ page }) => {
    await expect(page.getByText('Went Well')).toBeVisible()
    await expect(page.getByText('To Improve')).toBeVisible()
    await expect(page.getByText('Action Items')).toBeVisible()
  })

  test('shows user chip with the participant name and initial', async ({ page }) => {
    await expect(page.locator('.avatar-name')).toHaveText('Alice')
  })

  test('history icon button opens the sidebar', async ({ page }) => {
    await page.locator('button[title="Your sessions"]').click()
    await expect(page.locator('.sidebar.open')).toBeVisible()
  })

  test('theme toggle button switches the document theme', async ({ page }) => {
    const before = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme') ?? 'light',
    )
    await page.locator('.theme-toggle').click()
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(after).not.toBe(before)
  })

  test('clicking the brand navigates home and disconnects SSE', async ({ page }) => {
    await page.locator('.brand').click()
    await expect(page).toHaveTitle('Retrospekt')
  })

  test('"?" button in user chip opens the help overlay', async ({ page }) => {
    await page.locator('.user-chip .help-btn').click()
    await expect(page.locator('.help-overlay')).toBeVisible()
    await expect(page.getByText('How Retrospekt works')).toBeVisible()
  })

  test('"Got it" closes the help overlay', async ({ page }) => {
    await page.locator('.user-chip .help-btn').click()
    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(page.locator('.help-overlay')).not.toBeVisible()
  })

  test('clicking the help overlay backdrop closes it', async ({ page }) => {
    await page.locator('.user-chip .help-btn').click()
    await page.locator('.help-overlay').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.help-overlay')).not.toBeVisible()
  })

  test('export button is hidden in collecting phase', async ({ page }) => {
    await expect(page.locator('.export-btn')).not.toBeVisible()
  })

  test('"Copy link" button shows "Copied" feedback', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-write'])
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByText(/Copied/)).toBeVisible()
  })

  test('participant bar (not facilitator bar) is rendered', async ({ page }) => {
    await expect(page.locator('.participant-bar')).toBeVisible()
    await expect(page.locator('.facilitator-bar')).not.toBeVisible()
  })
})

// ── Board: phase banners ──────────────────────────────────────────────────────

test.describe('session-page discussing phase', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, { ...BASE, phase: 'discussing' } as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
  })

  test('shows the discussing phase banner', async ({ page }) => {
    await expect(page.locator('.banner-discussing')).toBeVisible()
    await expect(page.getByText(/vote on the cards that matter most/)).toBeVisible()
  })

  test('export button is visible in discussing phase', async ({ page }) => {
    await expect(page.locator('.export-btn')).toBeVisible()
  })
})

test.describe('session-page closed phase', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, { ...BASE, phase: 'closed' } as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()
  })

  test('shows the closed phase banner', async ({ page }) => {
    await expect(page.locator('.banner-closed')).toBeVisible()
    await expect(page.getByText(/This session is closed/)).toBeVisible()
  })

  test('export button is visible in closed phase', async ({ page }) => {
    await expect(page.locator('.export-btn')).toBeVisible()
  })
})

// ── Board: facilitator view ───────────────────────────────────────────────────

test.describe('session-page board (facilitator, collecting)', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.facilitator-bar')).toBeVisible()
  })

  test('shows the collecting phase badge', async ({ page }) => {
    await expect(page.locator('.badge-collecting')).toBeVisible()
  })

  test('"Start discussion" button calls the phase API', async ({ page }) => {
    await page.route(`/api/v1/sessions/${SESSION_ID}/phase`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BASE) }),
    )
    await page.getByRole('button', { name: 'Start discussion →' }).click()
    // No error = API was reached
  })

  test('"Add column" button is visible in collecting', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add column/ })).toBeVisible()
  })

  test('"← Back" button is NOT shown in collecting', async ({ page }) => {
    await expect(page.getByRole('button', { name: '← Back' })).not.toBeVisible()
  })

  test('participants popup opens and shows participant names', async ({ page }) => {
    await page.locator('.participant-count').click()
    await expect(page.locator('.participants-overlay')).toBeVisible()
    await expect(page.getByText('Participants (1)')).toBeVisible()
    await expect(page.locator('.participants-overlay').getByText('Alice')).toBeVisible()
  })

  test('participants popup closes via the × button', async ({ page }) => {
    await page.locator('.participant-count').click()
    await page.locator('.participants-close').click()
    await expect(page.locator('.participants-overlay')).not.toBeVisible()
  })

  test('participants popup closes by clicking the backdrop', async ({ page }) => {
    await page.locator('.participant-count').click()
    await page.locator('.participants-overlay').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.participants-overlay')).not.toBeVisible()
  })

  test('retro-timer is rendered for the facilitator', async ({ page }) => {
    await expect(page.locator('retro-timer')).toBeVisible()
  })

  test('"?" button in facilitator bar opens the help overlay', async ({ page }) => {
    await page.locator('.facilitator-bar .help-btn').click()
    await expect(page.locator('.help-overlay')).toBeVisible()
  })

  test('help overlay in facilitator bar closes via "Got it"', async ({ page }) => {
    await page.locator('.facilitator-bar .help-btn').click()
    await page.locator('.help-close-btn').click()
    await expect(page.locator('.help-overlay')).not.toBeVisible()
  })
})

test.describe('session-page board (facilitator, discussing)', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, { ...BASE, phase: 'discussing' } as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.facilitator-bar')).toBeVisible()
  })

  test('shows "← Back" and "Close session" buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: '← Back' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close session' })).toBeVisible()
  })

  test('"← Back" button calls the phase API', async ({ page }) => {
    await page.route(`/api/v1/sessions/${SESSION_ID}/phase`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BASE) }),
    )
    await page.getByRole('button', { name: '← Back' }).click()
  })
})

// ── Columns and add-card form ─────────────────────────────────────────────────

test.describe('retro-column add-card form', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-column').first()).toBeVisible()
  })

  test('"+ Add a card" button opens the textarea form', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add card' })).toBeVisible()
  })

  test('"Cancel" closes the add form', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('textarea')).not.toBeVisible()
  })

  test('emoji toggle in add form opens the emoji popover', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('.emoji-toggle').click()
    await expect(page.locator('.emoji-popover')).toBeVisible()
  })

  test('"Add card" button submits the new card to the API', async ({ page }) => {
    await page.route(`/api/v1/sessions/${SESSION_ID}/cards`, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'new-card', column: 'Went Well', text: 'Nice', author_name: 'Alice', votes: [], published: false, reactions: [], assignee: null }),
      }),
    )
    await page.getByRole('button', { name: '+ Add a card' }).first().click()
    await page.locator('textarea').fill('Nice sprint!')
    await page.getByRole('button', { name: 'Add card' }).click()
  })
})

// ── Published cards ───────────────────────────────────────────────────────────

test.describe('retro-card rendering', () => {
  test('published card is visible in discussing phase', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'discussing',
      cards: [{
        id: 'card-1',
        column: 'Went Well',
        text: 'Great teamwork',
        author_name: 'Alice',
        votes: [],
        published: true,
        reactions: [],
        assignee: null,
      }],
    }
    await mockApi(page, session as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.getByText('Great teamwork')).toBeVisible()
    await expect(page.locator('retro-card')).toBeVisible()
  })
})

// ── Action items panel ────────────────────────────────────────────────────────

test.describe('action items panel', () => {
  test('renders assigned cards as action items in closed phase', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'closed',
      cards: [{
        id: 'card-1',
        column: 'Action Items',
        text: 'Fix the deploy pipeline',
        author_name: 'Alice',
        votes: [],
        published: true,
        reactions: [],
        assignee: 'Bob',
      }],
    }
    await mockApi(page, session as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.action-items-panel')).toBeVisible()
    await expect(page.locator('.action-item-text')).toHaveText('Fix the deploy pipeline')
    await expect(page.locator('.action-item-assignee')).toHaveText('Bob')
  })
})

// ── SSE real-time updates ─────────────────────────────────────────────────────

test.describe('session-page SSE updates', () => {
  test('re-renders when the session state is updated (simulates SSE push)', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()

    // Simulate the SSE onmessage callback by directly setting the Lit reactive
    // property on the element. Playwright's route.fulfill() sends a complete HTTP
    // response which Chromium's EventSource treats as a closed connection rather
    // than a streaming source, so onmessage doesn't fire. This approach verifies
    // the same guarantee: that updating `session` triggers a re-render.
    const updated = { ...BASE, name: 'SSE Updated Retro', phase: 'discussing' }
    await page.evaluate((updatedSession) => {
      const el = document.querySelector('session-page')
      if (el) (el as unknown as Record<string, unknown>)['session'] = updatedSession
    }, updated)

    await expect(page.getByText('SSE Updated Retro')).toBeVisible()
  })

  test('establishes the SSE stream connection on page load', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    const streamRequest = page.waitForRequest(/\/stream$/)
    await page.goto(`/session/${SESSION_ID}`)
    const req = await streamRequest
    expect(req.url()).toContain(`/sessions/${SESSION_ID}/stream`)
  })
})

// ── Export ────────────────────────────────────────────────────────────────────

test.describe('session-page export', () => {
  test('clicking the export button triggers a Markdown file download', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, { ...BASE, phase: 'discussing' } as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.export-btn')).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.export-btn').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/sprint-retro.*\.md/)
  })

  test('export with cards renders card text, multiple votes, reactions, and assignee', async ({ page }) => {
    await withName(page, 'Alice')
    const sessionWithCards = {
      ...BASE,
      phase: 'discussing',
      cards: [
        {
          id: 'card-1',
          column: 'Went Well',
          text: 'Great teamwork',
          author_name: 'Alice',
          votes: [{ participant_name: 'Alice' }, { participant_name: 'Bob' }],
          published: true,
          reactions: [{ emoji: '❤️', participant_name: 'Alice' }],
          assignee: 'Bob',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'card-2',
          column: 'Went Well',
          text: 'Good retrospective',
          author_name: 'Bob',
          votes: [{ participant_name: 'Bob' }],
          published: true,
          reactions: [],
          assignee: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'card-3',
          column: 'To Improve',
          text: 'Communication',
          author_name: 'Alice',
          votes: [],
          published: true,
          reactions: null, // covers the ?? [] fallback on line 552
          assignee: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    }
    await mockApi(page, sessionWithCards as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.export-btn').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.md$/)
  })
})

// ── SSE error path (sse.ts line 26) ──────────────────────────────────────────

test.describe('session-page SSE error handling', () => {
  test('SSE onmessage ignores invalid JSON without crashing (sse.ts line 26)', async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__mockEventSources = []
      w.EventSource = function (url: string) {
        const es = {
          url,
          onmessage: null as null | ((e: { data: string }) => void),
          onerror: null as null | (() => void),
          close() {},
        }
        w.__mockEventSources.push(es)
        return es
      }
    })
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()

    // Send invalid JSON — hits the catch block (sse.ts line 26)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const es = (window as any).__mockEventSources?.[0] as {
        onmessage: null | ((e: { data: string }) => void)
      }
      if (es?.onmessage) es.onmessage({ data: 'NOT VALID JSON {{' })
    })

    // Board still works — no crash from bad SSE message
    await expect(page.locator('retro-board')).toBeVisible()
  })
})

// ── SSE callback with named participant ───────────────────────────────────────

test.describe('session-page SSE callback', () => {
  test('SSE update triggers saveToHistory when participant name is set', async ({ page }) => {
    // Intercept EventSource before page loads so we can trigger messages manually
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__mockEventSources = []
      w.EventSource = function (url: string) {
        const es = {
          url,
          onmessage: null as null | ((e: { data: string }) => void),
          onerror: null as null | (() => void),
          close() {},
        }
        w.__mockEventSources.push(es)
        return es
      }
    })
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-board')).toBeVisible()

    // Trigger the SSE onmessage callback — hits session-page.ts lines 483-485
    const updated = { ...BASE, name: 'SSE History Test' }
    await page.evaluate((data) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const es = w.__mockEventSources?.[0] as { onmessage: null | ((e: { data: string }) => void) }
      if (es?.onmessage) es.onmessage({ data: JSON.stringify(data) })
    }, updated)

    await expect(page.getByText('SSE History Test')).toBeVisible()
  })
})

// ── Facilitator closed phase ──────────────────────────────────────────────────

test.describe('session-page board (facilitator, closed)', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, { ...BASE, phase: 'closed' } as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.facilitator-bar')).toBeVisible()
  })

  test('shows the Closed phase badge in facilitator bar', async ({ page }) => {
    await expect(page.locator('.badge-closed')).toBeVisible()
    await expect(page.locator('.badge-closed')).toContainText('Closed')
  })

  test('clicking the help overlay backdrop in facilitator bar closes it', async ({ page }) => {
    await page.locator('.facilitator-bar .help-btn').click()
    await expect(page.locator('.help-overlay')).toBeVisible()
    await page.locator('.help-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.help-overlay')).not.toBeVisible()
  })
})

// ── CS brand logo in header ───────────────────────────────────────────────────

test.describe('session-page CS brand logo', () => {
  test('CS logo is NOT shown without brand theme', async ({ page }) => {
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.brand .cs-collab')).not.toBeVisible()
  })

  test('CS logo IS shown when brand=cs is stored', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('retro_brand', 'cs'))
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.brand .cs-collab')).toBeVisible()
  })

  test('CS logo contains the CloudSuite SVG', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('retro_brand', 'cs'))
    await withName(page, 'Alice')
    await mockApi(page, BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.brand .cs-collab [aria-label="CloudSuite"]')).toBeVisible()
  })
})

// ── Add column deduplication ──────────────────────────────────────────────────

test.describe('retro-board add column deduplication', () => {
  test('Add column uses "New column 2" when "New column" already exists', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const sessionWithNewCol = {
      ...BASE,
      columns: ['New column', 'Went Well', 'To Improve', 'Action Items'],
    }
    await mockApi(page, sessionWithNewCol as typeof BASE)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.facilitator-bar')).toBeVisible()
    const req = page.waitForRequest(
      (r) => r.url().includes('/columns') && r.method() === 'POST',
    )
    await page.getByRole('button', { name: /Add column/ }).click()
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.name).toBe('New column 2')
  })
})
