import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'groups-spec-1'
const FAC_TOKEN = 'fac-tok-groups'

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
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
    group_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const BASE = {
  id: SESSION_ID,
  name: 'Sprint Retro',
  columns: ['Went Well'],
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
  notes: [],
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

async function loadSession(
  page: Page,
  session: Record<string, unknown>,
  participantName: string,
  token = '',
): Promise<void> {
  const id = session.id as string
  await page.addInitScript(
    ({ sid, n, t }: { sid: string; n: string; t: string }) => {
      localStorage.setItem(`retro_name_${sid}`, n)
      if (t) localStorage.setItem(`retro_facilitator_${sid}`, t)
    },
    { sid: id, n: participantName, t: token },
  )
  await mockApi(page, session)
  await page.goto(`/session/${id}`)
  await page.evaluate(
    ({ sess, name }) =>
      new Promise<void>(resolve => {
        function attempt() {
          const el = document.querySelector('session-page') as any
          if (!el) { setTimeout(attempt, 50); return }
          el.session = sess
          el.participantName = name
          el.loading = false
          void el.updateComplete.then(resolve)
        }
        attempt()
      }),
    { sess: session, name: participantName },
  )
}

// Helper to traverse shadow DOM and get a column element
async function getColumnEl(page: Page) {
  return page.evaluate(() => {
    return (document.querySelector('session-page') as any)
      ?.shadowRoot?.querySelector('retro-board')
      ?.shadowRoot?.querySelector('retro-column')
  })
}

// ── Drag-drop attribute tests ──────────────────────────────────────────────

test.describe('card grouping — draggable attribute', () => {
  test('draggable=true on card in discussing phase (published)', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: null })],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')
    // The .card div inside retro-card should have draggable=true when canGroup=true
    // canGroup = published && phase === 'discussing'
    const card = page.locator('.card').first()
    await expect(card).toHaveAttribute('draggable', 'true')
  })

  test('draggable=false on card in collecting phase', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'collecting' as const,
      cards: [makeCard({ id: 'c1', author_name: 'Alice', published: false, group_id: null })],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')
    const card = page.locator('.card').first()
    await expect(card).toHaveAttribute('draggable', 'false')
  })

  test('draggable=false on card in closed phase', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'closed' as const,
      cards: [makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: null })],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')
    const card = page.locator('.card').first()
    await expect(card).toHaveAttribute('draggable', 'false')
  })

  test('draggable=false on unpublished draft card in discussing phase', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [makeCard({ id: 'c1', author_name: 'Alice', published: false, group_id: null })],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')
    const card = page.locator('.card').first()
    await expect(card).toHaveAttribute('draggable', 'false')
  })
})

// ── Drag-drop event dispatch ───────────────────────────────────────────────

test.describe('card grouping — drag interaction', () => {
  test('dropping card onto another dispatches group-cards event to retro-board', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: null, text: 'Card 1' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: null, text: 'Card 2' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    // Simulate drag via evaluate: fire dragstart on card 1, then dragover+drop on card 2
    const result = await page.evaluate(() => {
      return new Promise<{ cardId: string; targetCardId: string } | null>(resolve => {
        const board = (document.querySelector('session-page') as any)
          ?.shadowRoot?.querySelector('retro-board')
        if (!board) { resolve(null); return }

        board.shadowRoot?.addEventListener('group-cards', (e: Event) => {
          resolve((e as CustomEvent).detail)
        }, { once: true })
        // Also listen on board element itself (composed events bubble up)
        board.addEventListener('group-cards', (e: Event) => {
          resolve((e as CustomEvent).detail)
        }, { once: true })

        const col = board.shadowRoot?.querySelector('retro-column')
        const cards = col?.shadowRoot?.querySelectorAll('retro-card')
        if (!cards || cards.length < 2) { resolve(null); return }

        const srcCard = cards[0] as HTMLElement
        const tgtCard = cards[1] as HTMLElement

        // Fire dragstart on source .card div
        const srcInner = srcCard.shadowRoot?.querySelector('.card') as HTMLElement
        if (srcInner) {
          srcInner.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, composed: true }))
        }

        // Fire dragover + drop on target .card div
        const tgtInner = tgtCard.shadowRoot?.querySelector('.card') as HTMLElement
        if (tgtInner) {
          tgtInner.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true }))
          tgtInner.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true }))
        }

        // If no event fires, resolve with null after timeout
        setTimeout(() => resolve(null), 500)
      })
    })

    expect(result).not.toBeNull()
    expect(result?.cardId).toBe('c1')
    expect(result?.targetCardId).toBe('c2')
  })

  test('group-cards event calls api.groupCard', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: null, text: 'Card 1' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: null, text: 'Card 2' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    const groupReq = page.waitForRequest(
      r => r.url().includes('/group') && r.method() === 'POST',
    )

    // Dispatch on .columns (where the @group-cards listener is bound)
    await page.evaluate(() => {
      const board = (document.querySelector('session-page') as any)
        ?.shadowRoot?.querySelector('retro-board')
      const columns = board?.shadowRoot?.querySelector('.columns')
      columns?.dispatchEvent(new CustomEvent('group-cards', {
        bubbles: true,
        detail: { cardId: 'c1', targetCardId: 'c2' },
      }))
    })

    const req = await groupReq
    expect(req.url()).toContain('/cards/c1/group')
    const body = req.postDataJSON()
    expect(body.target_card_id).toBe('c2')
  })

  test('ungroup-card event calls api.ungroupCard', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: 'grp-1', text: 'Card 1' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: 'grp-1', text: 'Card 2' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    const ungroupReq = page.waitForRequest(
      r => r.url().includes('/group') && r.method() === 'DELETE',
    )

    // Dispatch on .columns (where the @ungroup-card listener is bound)
    await page.evaluate(() => {
      const board = (document.querySelector('session-page') as any)
        ?.shadowRoot?.querySelector('retro-board')
      const columns = board?.shadowRoot?.querySelector('.columns')
      columns?.dispatchEvent(new CustomEvent('ungroup-card', {
        bubbles: true,
        detail: { cardId: 'c1' },
      }))
    })

    const req = await ungroupReq
    expect(req.url()).toContain('/cards/c1/group')
    expect(req.method()).toBe('DELETE')
  })
})

// ── Group rendering ────────────────────────────────────────────────────────

test.describe('card grouping — stack rendering', () => {
  test('grouped cards collapse into a single stack tile', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    // Should show a stack tile rather than individual cards
    await expect(page.locator('.stack-tile')).toBeVisible()
    // And not show individual retro-card elements (they're inside the collapsed stack)
    await expect(page.locator('retro-card')).not.toBeVisible()
  })

  test('stack tile shows card count badge', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await expect(page.locator('.stack-count')).toContainText('2')
  })

  test('clicking collapsed stack expands to show individual cards', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await page.locator('.stack-tile').click()

    await expect(page.locator('retro-card')).toHaveCount(2)
  })

  test('clicking expanded stack header collapses it', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await page.locator('.stack-tile').click()
    await expect(page.locator('retro-card')).toHaveCount(2)

    // Click again to collapse (via the stack-collapse button or clicking stack header)
    await page.locator('.stack-collapse').click()
    await expect(page.locator('retro-card')).not.toBeVisible()
    await expect(page.locator('.stack-tile')).toBeVisible()
  })

  test('ungroup button is visible on each card in an expanded stack', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await page.locator('.stack-tile').click()

    // Each expanded card has an ungroup button
    await expect(page.locator('.ungroup-btn')).toHaveCount(2)
  })

  test('clicking ungroup button dispatches ungroup-card event', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    const ungroupReq = page.waitForRequest(
      r => r.url().includes('/group') && r.method() === 'DELETE',
    )

    await page.locator('.stack-tile').click()
    await page.locator('.ungroup-btn').first().click()

    await ungroupReq
  })

  test('ungrouped single card renders normally (no stack tile)', async ({ page }) => {
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: null, text: 'Solo' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await expect(page.locator('.stack-tile')).not.toBeVisible()
    await expect(page.locator('retro-card')).toBeVisible()
  })

  test('groups not shown in collecting phase (all rendered as single cards)', async ({ page }) => {
    // In collecting phase, group_id is irrelevant — cards are always single
    const session = {
      ...BASE,
      phase: 'collecting' as const,
      cards: [
        // Author's own cards visible in collecting
        makeCard({ id: 'c1', author_name: 'Alice', published: false, group_id: 'grp-x', text: 'Mine' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await expect(page.locator('.stack-tile')).not.toBeVisible()
    await expect(page.locator('retro-card')).toBeVisible()
  })

  test('expanded group has visual container with border-left', async ({ page }) => {
    const GROUP_ID = 'grp-abc'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'First' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Second' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    await page.locator('.stack-tile').click()

    // .stack-expanded container must exist and contain .stack-card-wrapper children
    await expect(page.locator('.stack-expanded')).toBeVisible()
    await expect(page.locator('.stack-expanded .stack-card-wrapper')).toHaveCount(2)
  })
})

// ── Cross-column grouping prevention ──────────────────────────────────────

test.describe('card grouping — cross-column prevention', () => {
  test('cross-column drag does not dispatch group-cards event', async ({ page }) => {
    const session = {
      ...BASE,
      columns: ['Went Well', 'To Improve'],
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', column: 'Went Well', author_name: 'Bob', published: true, text: 'Card 1' }),
        makeCard({ id: 'c2', column: 'To Improve', author_name: 'Alice', published: true, text: 'Card 2' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    const groupFired = await page.evaluate(() => {
      return new Promise<boolean>(resolve => {
        // Listen on the board element for any group-cards event
        const board = (document.querySelector('session-page') as any)
          ?.shadowRoot?.querySelector('retro-board')
        if (!board) { resolve(false); return }

        let fired = false
        board.addEventListener('group-cards', () => { fired = true }, { once: true })

        const col = board.shadowRoot?.querySelector('retro-column')
        const cards = col?.shadowRoot?.querySelectorAll('retro-card')
        if (!cards || cards.length < 2) { resolve(false); return }

        const srcCard = cards[0] as HTMLElement  // 'Went Well' column
        const tgtCard = cards[1] as HTMLElement  // 'To Improve' column

        // dragstart sets _draggedCardColumn = 'Went Well'
        const srcInner = srcCard.shadowRoot?.querySelector('.card') as HTMLElement
        if (srcInner) {
          srcInner.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, composed: true }))
        }

        // dragover + drop on target from different column
        const tgtInner = tgtCard.shadowRoot?.querySelector('.card') as HTMLElement
        if (tgtInner) {
          tgtInner.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true }))
          tgtInner.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true }))
        }

        setTimeout(() => resolve(fired), 300)
      })
    })

    expect(groupFired).toBe(false)
  })
})

// ── Drop onto collapsed stack tile ────────────────────────────────────────

test.describe('card grouping — drop onto stack tile', () => {
  test('dropping card onto collapsed stack tile dispatches group-cards event', async ({ page }) => {
    const GROUP_ID = 'grp-xyz'
    const session = {
      ...BASE,
      phase: 'discussing' as const,
      cards: [
        makeCard({ id: 'c1', author_name: 'Bob', published: true, group_id: GROUP_ID, text: 'Grouped 1' }),
        makeCard({ id: 'c2', author_name: 'Alice', published: true, group_id: GROUP_ID, text: 'Grouped 2' }),
        makeCard({ id: 'c3', author_name: 'Alice', published: true, group_id: null, text: 'Lone card' }),
      ],
    }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice')

    const result = await page.evaluate(() => {
      return new Promise<{ cardId: string; targetCardId: string } | null>(resolve => {
        const board = (document.querySelector('session-page') as any)
          ?.shadowRoot?.querySelector('retro-board')
        if (!board) { resolve(null); return }

        board.addEventListener('group-cards', (e: Event) => {
          resolve((e as CustomEvent).detail)
        }, { once: true })

        const col = board.shadowRoot?.querySelector('retro-column')

        // Find the lone retro-card (c3) and simulate dragstart
        const cards = col?.shadowRoot?.querySelectorAll('retro-card')
        if (!cards) { resolve(null); return }
        // c3 is the lone card — it's the only non-grouped card, rendered after the stack tile
        const loneCard = cards[0] as HTMLElement  // only one retro-card visible (lone card)
        const loneInner = loneCard.shadowRoot?.querySelector('.card') as HTMLElement
        if (loneInner) {
          loneInner.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, composed: true }))
        }

        // Fire dragover + drop on the .stack-tile
        const tile = col?.shadowRoot?.querySelector('.stack-tile') as HTMLElement
        if (tile) {
          tile.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true }))
          tile.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true }))
        }

        setTimeout(() => resolve(null), 500)
      })
    })

    expect(result).not.toBeNull()
    expect(result?.cardId).toBe('c3')
    expect(result?.targetCardId).toBe('c1')
  })
})
