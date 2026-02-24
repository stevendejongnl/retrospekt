import type { Page } from '@playwright/test'
import { test, expect } from './playwright-fixtures'

async function mockAudioContext(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.__audioCtxCreated = false
    w.AudioContext = function MockAudioContext(this: Record<string, unknown>) {
      w.__audioCtxCreated = true
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
      this.resume = () => Promise.resolve()
      this.createOscillator = () => ({
        frequency: { setValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {},
      })
      this.createGain = () => ({
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
      })
    }
  })
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'timer-spec-1'
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
  timer: null as null | {
    duration_seconds: number
    started_at: string | null
    paused_remaining: number | null
  },
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

// ── Preset buttons ────────────────────────────────────────────────────────────

test.describe('retro-timer preset buttons', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()
  })

  test('5m preset button calls PATCH /timer with 300 seconds', async ({ page }) => {
    const req = page.waitForRequest(r => r.url().includes('/timer') && r.method() === 'PATCH')
    await page.getByRole('button', { name: '5m', exact: true }).click()
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.duration_seconds).toBe(300)
  })

  test('10m preset button calls PATCH /timer with 600 seconds', async ({ page }) => {
    const req = page.waitForRequest(r => r.url().includes('/timer') && r.method() === 'PATCH')
    await page.getByRole('button', { name: '10m', exact: true }).click()
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.duration_seconds).toBe(600)
  })

  test('15m preset button calls PATCH /timer with 900 seconds', async ({ page }) => {
    const req = page.waitForRequest(r => r.url().includes('/timer') && r.method() === 'PATCH')
    await page.getByRole('button', { name: '15m', exact: true }).click()
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.duration_seconds).toBe(900)
  })

  test('30m preset button calls PATCH /timer with 1800 seconds', async ({ page }) => {
    const req = page.waitForRequest(r => r.url().includes('/timer') && r.method() === 'PATCH')
    await page.getByRole('button', { name: '30m', exact: true }).click()
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.duration_seconds).toBe(1800)
  })

  test('active preset button has .active class when duration matches', async ({ page }) => {
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.preset-btn.active')).toBeVisible()
    await expect(page.locator('.preset-btn.active')).toContainText('5m')
  })
})

// ── Custom duration input ─────────────────────────────────────────────────────

test.describe('retro-timer custom input', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
  })

  test('Set button is disabled when input is empty', async ({ page }) => {
    await expect(page.locator('.custom-set-btn')).toBeDisabled()
  })

  test('typing minutes and clicking Set calls PATCH /timer', async ({ page }) => {
    await page.locator('.custom-input').fill('7')
    const req = page.waitForRequest(r => r.url().includes('/timer') && r.method() === 'PATCH')
    await page.locator('.custom-set-btn').click()
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.duration_seconds).toBe(420) // 7 * 60
  })

  test('pressing Enter in custom input also calls PATCH /timer', async ({ page }) => {
    await page.locator('.custom-input').fill('3')
    const req = page.waitForRequest(r => r.url().includes('/timer') && r.method() === 'PATCH')
    await page.locator('.custom-input').press('Enter')
    const request = await req
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    expect(body.duration_seconds).toBe(180)
  })
})

// ── Start / Pause / Resume / Reset buttons ────────────────────────────────────

test.describe('retro-timer start button', () => {
  test('Start button is disabled when no timer is set', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-btn').filter({ hasText: 'Start' })).toBeDisabled()
  })

  test('Start button is enabled when timer is set and not running', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-btn').filter({ hasText: 'Start' })).toBeEnabled()
  })

  test('clicking Start calls POST /timer/start', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/timer/start') && r.method() === 'POST')
    await page.locator('.timer-btn').filter({ hasText: 'Start' }).click()
    await req
  })

  test('Pause button is shown when timer is running (has started_at)', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = {
      ...BASE,
      timer: {
        duration_seconds: 300,
        started_at: new Date(Date.now() - 10000).toISOString(), // started 10s ago
        paused_remaining: null,
      },
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-btn').filter({ hasText: 'Pause' })).toBeVisible()
  })

  test('clicking Pause calls POST /timer/pause', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = {
      ...BASE,
      timer: {
        duration_seconds: 300,
        started_at: new Date(Date.now() - 10000).toISOString(),
        paused_remaining: null,
      },
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/timer/pause') && r.method() === 'POST')
    await page.locator('.timer-btn').filter({ hasText: 'Pause' }).click()
    await req
  })

  test('Resume button is shown when timer has paused_remaining', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = {
      ...BASE,
      timer: { duration_seconds: 300, started_at: null, paused_remaining: 240 },
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-btn').filter({ hasText: 'Resume' })).toBeVisible()
  })

  test('Reset button is disabled when no timer is set', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-btn.secondary').filter({ hasText: 'Reset' })).toBeDisabled()
  })

  test('clicking Reset calls POST /timer/reset', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    const req = page.waitForRequest(r => r.url().includes('/timer/reset') && r.method() === 'POST')
    await page.locator('.timer-btn.secondary').filter({ hasText: 'Reset' }).click()
    await req
  })
})

// ── Timer display ─────────────────────────────────────────────────────────────

test.describe('retro-timer display', () => {
  test('timer-display is shown when timer is set', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-display')).toBeVisible()
    await expect(page.locator('.timer-display')).toContainText('5:00')
  })

  test('timer-display has .green class when remaining > 25%', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-display.green')).toBeVisible()
  })

  test('timer-display has .amber class when remaining is 10-25%', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    // 300s total, 50s remaining = ~16.6% -> amber
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: 50 } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-display.amber')).toBeVisible()
  })

  test('timer-display has .red class when remaining < 10%', async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    // 300s total, 20s remaining = ~6.7% -> red
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: 20 } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-display.red')).toBeVisible()
  })
})

// ── Timer interval callback (lines 218-224) ───────────────────────────────────

test.describe('retro-timer interval callback', () => {
  test('live countdown ticks and updates the display', async ({ page }) => {
    // Use a longer duration to avoid race with page-load time
    const startedAt = new Date(Date.now()).toISOString()
    const session = {
      ...BASE,
      timer: { duration_seconds: 60, started_at: startedAt, paused_remaining: null },
    }
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-display')).toBeVisible()
    // Capture the initial rendered value
    const firstText = await page.locator('.timer-display').textContent()
    // Wait for the setInterval callback to fire and update displaySeconds (lines 222-223)
    await expect(async () => {
      const current = await page.locator('.timer-display').textContent()
      expect(current).not.toBe(firstText)
    }).toPass({ timeout: 3000 })
  })

  test('interval self-clears when timer reaches zero (line 224)', async ({ page }) => {
    // Timer started 4.6s ago, 5s total → ~0.4s remaining; after 1s interval fires → remaining <= 0
    const startedAt = new Date(Date.now() - 4600).toISOString()
    const session = {
      ...BASE,
      timer: { duration_seconds: 5, started_at: startedAt, paused_remaining: null },
    }
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-display')).toBeVisible()
    // Wait for the interval to fire and hit remaining <= 0 → clearTimer (line 224)
    await page.waitForTimeout(1500)
    await expect(page.locator('.timer-display')).toContainText('0:00')
  })

  test('interval self-clears when started_at is cleared while running (lines 218-220)', async ({ page }) => {
    const startedAt = new Date(Date.now()).toISOString()
    const session = {
      ...BASE,
      timer: { duration_seconds: 30, started_at: startedAt, paused_remaining: null },
    }
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()

    // Mutate started_at IN-PLACE so Lit's setter is NOT triggered — the running
    // setInterval sees started_at=null on its next tick and executes clearTimer()
    // (lines 218-220). Reassigning rt.timer would call the Lit setter → syncFromTimer()
    // → clearTimer() synchronously, which would prevent the interval from ever seeing
    // started_at=null. In-place mutation bypasses Lit's change detection entirely.
    await page.evaluate(() => {
      const sp = document.querySelector('session-page')
      const rb = sp?.shadowRoot?.querySelector('retro-board')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rt = rb?.shadowRoot?.querySelector('retro-timer') as any
      if (rt?.timer) rt.timer.started_at = null
    })
    // Wait for the next interval tick — it detects started_at=null and clears itself
    await page.waitForTimeout(1100)
    // No error — the interval self-cleared gracefully
    await expect(page.locator('retro-timer')).toBeVisible()
  })
})

// ── Timer disconnectedCallback (lines 197-205) ─────────────────────────────────

test.describe('retro-timer disconnectedCallback', () => {
  test('navigating away from a running timer clears the interval without error', async ({ page }) => {
    const session = {
      ...BASE,
      timer: {
        duration_seconds: 60,
        started_at: new Date(Date.now() - 5000).toISOString(),
        paused_remaining: null,
      },
    }
    await withName(page, 'Alice', FAC_TOKEN)
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()
    // Navigate home — triggers disconnectedCallback → clearTimer (lines 197-205)
    await page.locator('.brand').click()
    await expect(page).toHaveURL('/')
  })
})

// ── Participant view ──────────────────────────────────────────────────────────

test.describe('retro-timer participant view', () => {
  test('shows timer-pill for participant when timer is set (compact view, no controls)', async ({ page }) => {
    await withName(page, 'Alice') // non-facilitator
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-pill')).toBeVisible()
    // No preset buttons or start/pause/reset in participant view
    await expect(page.locator('.preset-btn')).not.toBeVisible()
    await expect(page.locator('.timer-btn')).not.toBeVisible()
  })

  test('shows nothing for participant when no timer is set', async ({ page }) => {
    await withName(page, 'Alice') // non-facilitator
    await mockApi(page, BASE as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    // No timer-pill when timer is null
    await expect(page.locator('.timer-pill')).not.toBeVisible()
  })
})

// ── Mute toggle – facilitator view ────────────────────────────────────────────

test.describe('retro-timer mute toggle (facilitator)', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice', FAC_TOKEN)
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()
  })

  test('mute button is visible in facilitator timer panel', async ({ page }) => {
    await expect(page.locator('.mute-btn')).toBeVisible()
  })

  test('mute button title is "Mute timer sound" when unmuted', async ({ page }) => {
    await expect(page.locator('.mute-btn')).toHaveAttribute('title', 'Mute timer sound')
  })

  test('clicking mute button adds .muted class and changes title', async ({ page }) => {
    await page.locator('.mute-btn').click()
    await expect(page.locator('.mute-btn')).toHaveClass(/muted/)
    await expect(page.locator('.mute-btn')).toHaveAttribute('title', 'Unmute timer sound')
  })

  test('mute preference is written to localStorage', async ({ page }) => {
    await page.locator('.mute-btn').click()
    const stored = await page.evaluate(() => localStorage.getItem('retro_timer_muted'))
    expect(stored).toBe('true')
  })

  test('clicking mute then unmute restores unmuted state', async ({ page }) => {
    await page.locator('.mute-btn').click()
    await page.locator('.mute-btn').click()
    await expect(page.locator('.mute-btn')).not.toHaveClass(/muted/)
    await expect(page.locator('.mute-btn')).toHaveAttribute('title', 'Mute timer sound')
    const stored = await page.evaluate(() => localStorage.getItem('retro_timer_muted'))
    expect(stored).toBe('false')
  })
})

test('retro-timer mute button shows muted state when retro_timer_muted pre-set in localStorage', async ({ page }) => {
  await withName(page, 'Alice', FAC_TOKEN)
  const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
  await mockApi(page, session as unknown as Record<string, unknown>)
  await page.addInitScript(() => localStorage.setItem('retro_timer_muted', 'true'))
  await page.goto(`/session/${SESSION_ID}`)
  await expect(page.locator('.mute-btn')).toHaveClass(/muted/)
  await expect(page.locator('.mute-btn')).toHaveAttribute('title', 'Unmute timer sound')
})

// ── Mute toggle – participant pill ────────────────────────────────────────────

test.describe('retro-timer mute toggle (participant pill)', () => {
  test.beforeEach(async ({ page }) => {
    await withName(page, 'Alice') // non-facilitator
    const session = { ...BASE, timer: { duration_seconds: 300, started_at: null, paused_remaining: null } }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('.timer-pill')).toBeVisible()
  })

  test('mute button is visible in the participant pill', async ({ page }) => {
    await expect(page.locator('.mute-btn-pill')).toBeVisible()
  })

  test('mute button title is "Mute timer sound" when unmuted', async ({ page }) => {
    await expect(page.locator('.mute-btn-pill')).toHaveAttribute('title', 'Mute timer sound')
  })

  test('clicking mute in pill changes title to "Unmute timer sound"', async ({ page }) => {
    await page.locator('.mute-btn-pill').click()
    await expect(page.locator('.mute-btn-pill')).toHaveAttribute('title', 'Unmute timer sound')
  })
})

// ── Ding sound ────────────────────────────────────────────────────────────────

test.describe('retro-timer ding sound', () => {
  test('AudioContext is not created when page loads with an already-expired timer (wasRunning guard)', async ({ page }) => {
    await mockAudioContext(page)
    await withName(page, 'Alice', FAC_TOKEN)
    const session = {
      ...BASE,
      timer: {
        duration_seconds: 5,
        started_at: new Date(Date.now() - 60_000).toISOString(), // expired 55s ago
        paused_remaining: null,
      },
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()
    await page.waitForTimeout(1500) // let at least one interval tick fire
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await page.evaluate(() => (window as any).__audioCtxCreated as boolean)
    expect(created).toBe(false)
  })

  test('AudioContext is created when a running timer reaches zero', async ({ page }) => {
    await mockAudioContext(page)
    await withName(page, 'Alice', FAC_TOKEN)
    // 30s timer started 28.5s ago → ~1.5s remaining on page load; hits zero within 2s of first tick
    const session = {
      ...BASE,
      timer: {
        duration_seconds: 30,
        started_at: new Date(Date.now() - 28_500).toISOString(),
        paused_remaining: null,
      },
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await page.evaluate(() => (window as any).__audioCtxCreated as boolean)
      expect(created).toBe(true)
    }).toPass({ timeout: 5000 })
  })

  test('AudioContext is not created when timer reaches zero while muted', async ({ page }) => {
    await mockAudioContext(page)
    await withName(page, 'Alice', FAC_TOKEN)
    await page.addInitScript(() => localStorage.setItem('retro_timer_muted', 'true'))
    const session = {
      ...BASE,
      timer: {
        duration_seconds: 30,
        started_at: new Date(Date.now() - 28_500).toISOString(),
        paused_remaining: null,
      },
    }
    await mockApi(page, session as unknown as Record<string, unknown>)
    await page.goto(`/session/${SESSION_ID}`)
    await expect(page.locator('retro-timer')).toBeVisible()
    await page.waitForTimeout(3000) // wait past expiry with margin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await page.evaluate(() => (window as any).__audioCtxCreated as boolean)
    expect(created).toBe(false)
  })
})
