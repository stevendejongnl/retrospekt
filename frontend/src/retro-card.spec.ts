import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'card-spec-1'
const FAC_TOKEN = 'fac-tok-1'

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

const BASE = {
  id: SESSION_ID,
  name: 'Sprint Retro',
  columns: ['Went Well', 'To Improve', 'Action Items'],
  phase: 'discussing' as const,
  participants: [
    { name: 'Alice', joined_at: '2026-01-01T00:00:00Z' },
    { name: 'Bob', joined_at: '2026-01-01T00:00:00Z' },
  ],
  cards: [] as object[],
  reactions_enabled: true,
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
    author_name: 'Bob',
    votes: [],
    published: true,
    reactions: [],
    assignee: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Vote button ───────────────────────────────────────────────────────────────

test.describe('retro-card vote button', () => {
  test('vote button is visible for a published card from another participant', async ({ page }) => {
    await withName(page, 'Alice')
    const session = { ...BASE, cards: [makeCard({ author_name: 'Bob', published: true })] }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-card')).toBeVisible()
    await expect(page.locator('.vote-btn')).toBeVisible()
  })

  test('vote button is disabled for own card (canVote=false)', async ({ page }) => {
    await withName(page, 'Alice')
    const session = { ...BASE, cards: [makeCard({ author_name: 'Alice', published: true })] }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.vote-btn')).toBeDisabled()
  })

  test('clicking vote button calls POST /votes', async ({ page }) => {
    await withName(page, 'Alice')
    const session = { ...BASE, cards: [makeCard({ author_name: 'Bob', published: true })] }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/votes') && r.method() === 'POST')
    await page.locator('.vote-btn').click()
    await req
  })

  test('voted state: vote button has .voted class when participant already voted', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Bob', published: true, votes: [{ participant_name: 'Alice' }] })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.vote-btn.voted')).toBeVisible()
  })

  test('clicking voted button calls DELETE /votes (unvote)', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Bob', published: true, votes: [{ participant_name: 'Alice' }] })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/votes') && r.method() === 'DELETE')
    await page.locator('.vote-btn.voted').click()
    await req
  })
})

// ── Publish button ────────────────────────────────────────────────────────────

test.describe('retro-card publish button', () => {
  test('publish button is shown for own unpublished card in discussing phase', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.publish-btn')).toBeVisible()
  })

  test('draft badge is shown when canPublish', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.draft-badge')).toBeVisible()
  })

  test('clicking publish button calls POST /publish', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/publish') && r.method() === 'POST')
    await page.locator('.publish-btn').click()
    await req
  })

  test('publish button is not shown for already-published card', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.publish-btn')).not.toBeVisible()
  })
})

// ── Delete button ─────────────────────────────────────────────────────────────

test.describe('retro-card delete button', () => {
  test('delete button is shown for own card in collecting phase', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'collecting',
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.delete-btn')).toBeVisible()
  })

  test('delete button is NOT shown for another participant card', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'collecting',
      cards: [makeCard({ author_name: 'Bob', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.delete-btn')).not.toBeVisible()
  })

  test('clicking delete button calls DELETE on the card endpoint', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'collecting',
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/cards/') && r.method() === 'DELETE')
    await page.locator('.delete-btn').click()
    await req
  })
})

// ── Reactions row ─────────────────────────────────────────────────────────────

test.describe('retro-card reactions', () => {
  test('reactions row is shown for published card in discussing phase', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Bob', published: true })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.reactions-row')).toBeVisible()
    await expect(page.locator('.reaction-btn')).toHaveCount(6)
  })

  test('clicking a reaction button calls POST /reactions', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Bob', published: true })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/reactions') && r.method() === 'POST')
    await page.locator('.reaction-btn').first().click()
    await req
  })

  test('reacted button has .reacted class', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({
        author_name: 'Bob',
        published: true,
        reactions: [{ emoji: '❤️', participant_name: 'Alice' }],
      })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.reaction-btn.reacted')).toBeVisible()
  })

  test('clicking reacted button calls DELETE /reactions', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({
        author_name: 'Bob',
        published: true,
        reactions: [{ emoji: '❤️', participant_name: 'Alice' }],
      })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/reactions') && r.method() === 'DELETE')
    await page.locator('.reaction-btn.reacted').click()
    await req
  })

  test('reactions are not shown for unpublished card', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.reactions-row')).not.toBeVisible()
  })
})

// ── Assignee ──────────────────────────────────────────────────────────────────

test.describe('retro-card assignee', () => {
  test('assign select is shown when canAssign and card has no assignee', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: null })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.assign-select')).toBeVisible()
  })

  test('selecting an option from assign-select calls PATCH /assignee', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: null })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/assignee') && r.method() === 'PATCH')
    await page.locator('.assign-select').selectOption('Bob')
    await req
  })

  test('assignee chip is shown when card.assignee is set', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: 'Bob' })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.assignee-chip')).toBeVisible()
    await expect(page.locator('.assignee-chip')).toContainText('Bob')
  })

  test('unassign button is shown when assignee is set and canAssign', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: 'Bob' })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.unassign-btn')).toBeVisible()
  })

  test('clicking unassign button calls PATCH /assignee', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: 'Bob' })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/assignee') && r.method() === 'PATCH')
    await page.locator('.unassign-btn').click()
    await req
  })

  test('unassign button is NOT shown when viewing another participant card with assignee', async ({ page }) => {
    // Bob is viewing Alice's card (canAssign=false), but card has assignee set → chip visible, no unassign btn
    await withName(page, 'Bob')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: 'Alice' })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.assignee-chip')).toBeVisible()
    await expect(page.locator('.unassign-btn')).not.toBeVisible()
  })
})

// ── reactions_enabled flag ────────────────────────────────────────────────────

test.describe('retro-card reactions_enabled', () => {
  test('reactions row is hidden when reactions_enabled=false even for published card', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      reactions_enabled: false,
      cards: [makeCard({ author_name: 'Bob', published: true })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-card')).toBeVisible()
    await expect(page.locator('.reactions-row')).not.toBeVisible()
  })

  test('reactions row is shown when reactions_enabled=true', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      reactions_enabled: true,
      cards: [makeCard({ author_name: 'Bob', published: true })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.reactions-row')).toBeVisible()
  })
})

// ── Reactions null field ──────────────────────────────────────────────────────

test.describe('retro-card reactions null handling', () => {
  test('renders reactions row when card.reactions is null (treats as empty)', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Bob', published: true, reactions: null })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    // canReact=true (discussing, published, not own card) — all 6 buttons shown with count=0
    await expect(page.locator('.reaction-btn')).toHaveCount(6)
  })
})

// ── Assign select empty option ────────────────────────────────────────────────

test.describe('retro-card assign select empty option', () => {
  test('selecting empty option in assign-select does not call PATCH /assignee', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      cards: [makeCard({ author_name: 'Alice', published: true, assignee: null })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.assign-select')).toBeVisible()

    // Trigger onAssignChange with empty value — hits the `if (!assignee) return` guard (line 274)
    const patchFired = { value: false }
    await page.route(`/api/v1/sessions/${SESSION_ID}/cards/card-1/assignee`, () => {
      patchFired.value = true
    })
    await page.evaluate(() => {
      // Traverse shadow DOM chain to reach .assign-select inside retro-card
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sp = document.querySelector('session-page') as any
      const rb = sp?.shadowRoot?.querySelector('retro-board') as any
      const col = rb?.shadowRoot?.querySelector('retro-column') as any
      const card = col?.shadowRoot?.querySelector('retro-card') as any
      const select = card?.shadowRoot?.querySelector('.assign-select') as HTMLSelectElement | null
      if (select) {
        select.value = ''
        select.dispatchEvent(new Event('change'))
      }
    })
    // No PATCH request should have been made
    expect(patchFired.value).toBe(false)
  })
})

// ── DELETE returning 204 (api.ts line 79) ────────────────────────────────────

test.describe('retro-card delete 204 response', () => {
  test('DELETE card endpoint returning 204 is handled gracefully', async ({ page }) => {
    await withName(page, 'Alice')
    const session = {
      ...BASE,
      phase: 'collecting',
      cards: [makeCard({ author_name: 'Alice', published: false })],
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    // Override delete to return 204 (no body)
    await page.route(
      `/api/v1/sessions/${SESSION_ID}/cards/card-1`,
      (route) => route.fulfill({ status: 204 }),
    )
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.delete-btn')).toBeVisible()
    // Should not throw — 204 path in api.ts returns undefined
    await page.locator('.delete-btn').click()
  })
})
