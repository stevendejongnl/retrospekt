import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'open-fac-spec-1'
const FAC_TOKEN = 'fac-tok-open-fac'

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
  cards: [],
  reactions_enabled: true,
  open_facilitator: false,
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

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('open facilitator — facilitator bar visibility', () => {
  test('facilitator bar is hidden for participant when open_facilitator=false', async ({ page }) => {
    const session = { ...BASE, open_facilitator: false }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Bob')
    await expect(page.locator('.facilitator-bar')).not.toBeVisible()
  })

  test('facilitator bar is visible for participant when open_facilitator=true', async ({ page }) => {
    const session = { ...BASE, open_facilitator: true }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Bob')
    await expect(page.locator('.facilitator-bar')).toBeVisible()
  })

  test('actual facilitator still sees facilitator bar when open_facilitator=false', async ({ page }) => {
    const session = { ...BASE, open_facilitator: false }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice', FAC_TOKEN)
    await expect(page.locator('.facilitator-bar')).toBeVisible()
  })

  test('phase button is visible to participant when open_facilitator=true', async ({ page }) => {
    const session = { ...BASE, open_facilitator: true }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Bob')
    await expect(page.locator('.phase-btn')).toBeVisible()
  })

  test('settings gear is visible to participant when open_facilitator=true', async ({ page }) => {
    const session = { ...BASE, open_facilitator: true }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Bob')
    await expect(page.locator('.settings-btn')).toBeVisible()
  })
})

test.describe('open facilitator — API calls include participant name', () => {
  test('participant clicking phase button sends X-Participant-Name header', async ({ page }) => {
    const session = { ...BASE, open_facilitator: true }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Bob')

    const phaseReq = page.waitForRequest(
      r => r.url().includes('/phase') && r.method() === 'POST',
    )
    await page.locator('.phase-btn').click()

    const req = await phaseReq
    expect(req.headers()['x-participant-name']).toBe('Bob')
  })
})

test.describe('open facilitator — settings toggle', () => {
  test('open facilitator toggle is visible in settings dialog for facilitator', async ({ page }) => {
    const session = { ...BASE, open_facilitator: false }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice', FAC_TOKEN)
    await page.locator('.settings-btn').click()
    await expect(page.locator('.settings-open-facilitator-input')).toBeVisible()
  })

  test('toggling allow participants and saving calls PATCH with open_facilitator: true', async ({ page }) => {
    const session = { ...BASE, open_facilitator: false }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice', FAC_TOKEN)

    const patchReq = page.waitForRequest(
      r => r.url().endsWith(`/sessions/${SESSION_ID}`) && r.method() === 'PATCH',
    )
    await page.locator('.settings-btn').click()
    await page.locator('.settings-open-facilitator-input').click()
    await page.getByRole('button', { name: 'Save' }).click()

    const req = await patchReq
    const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>
    expect(body.open_facilitator).toBe(true)
  })

  test('disabling the toggle and saving calls PATCH with open_facilitator: false', async ({ page }) => {
    const session = { ...BASE, open_facilitator: true }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Alice', FAC_TOKEN)

    const patchReq = page.waitForRequest(
      r => r.url().endsWith(`/sessions/${SESSION_ID}`) && r.method() === 'PATCH',
    )
    await page.locator('.settings-btn').click()
    // Checkbox should be checked (session has open_facilitator=true) — uncheck it
    await page.locator('.settings-open-facilitator-input').click()
    await page.getByRole('button', { name: 'Save' }).click()

    const req = await patchReq
    const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>
    expect(body.open_facilitator).toBe(false)
  })
})

test.describe('open facilitator — SSE reactivity', () => {
  test('SSE update changing open_facilitator to true shows facilitator bar to participant', async ({ page }) => {
    const session = { ...BASE, open_facilitator: false }
    await loadSession(page, session as unknown as Record<string, unknown>, 'Bob')
    await expect(page.locator('.facilitator-bar')).not.toBeVisible()

    // Simulate SSE push: update session to open_facilitator=true
    const updated = { ...BASE, open_facilitator: true }
    await page.evaluate((updatedSession) => {
      const el = document.querySelector('session-page') as any
      if (el) (el as unknown as Record<string, unknown>)['session'] = updatedSession
    }, updated)

    await expect(page.locator('.facilitator-bar')).toBeVisible()
  })
})
