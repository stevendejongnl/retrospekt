/**
 * Screenshot capture script.
 *
 * Run with:  make screenshots
 *   (or)     npx playwright test e2e/screenshots.spec.ts --project=chromium
 *
 * Requirements: services must be running (`make start` or Docker Compose up).
 * Output: docs/assets/screenshots/*.jpg
 */

import * as fs from 'fs'
import * as path from 'path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

// ── Config ────────────────────────────────────────────────────────────────────

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const API = process.env.API_URL ?? 'http://localhost:8001/api/v1'
const OUT = path.resolve(__dirname, '../docs/assets/screenshots')
const QUALITY = 90
const VIEWPORT = { width: 1440, height: 900 }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function shot(page: Page, name: string, full = false): Promise<void> {
  await page.screenshot({
    path: path.join(OUT, name),
    type: 'jpeg',
    quality: QUALITY,
    fullPage: full,
  })
  console.log(`  ✓ ${name}`)
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('retro_theme', t)
  }, theme)
}

async function clearTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('retro_theme')
    localStorage.removeItem('retro_brand')
  })
}

type SessionData = {
  id: string
  facilitator_token: string
}

async function createSession(
  name: string,
  facilitatorName: string,
  columns?: string[],
): Promise<SessionData> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      participant_name: facilitatorName,
      columns: columns ?? ['Went Well', 'To Improve', 'Action Items'],
      reactions_enabled: true,
      open_facilitator: false,
    }),
  })
  return res.json() as Promise<SessionData>
}

async function addCard(
  sessionId: string,
  column: string,
  text: string,
  author: string,
): Promise<{ id: string }> {
  const res = await fetch(`${API}/sessions/${sessionId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column, text, author_name: author }),
  })
  return res.json() as Promise<{ id: string }>
}

async function joinSession(sessionId: string, participantName: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: participantName }),
  })
}

async function setPhase(sessionId: string, token: string, phase: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/phase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Facilitator-Token': token,
    },
    body: JSON.stringify({ phase }),
  })
}

async function publishCard(sessionId: string, cardId: string, authorName: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/cards/${cardId}/publish`, {
    method: 'POST',
    headers: { 'X-Participant-Name': authorName },
  })
}

async function voteCard(sessionId: string, cardId: string, voterName: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/cards/${cardId}/votes`, {
    method: 'POST',
    headers: { 'X-Participant-Name': voterName },
  })
}

async function groupCards(
  sessionId: string,
  cardId: string,
  targetId: string,
  participantName: string,
): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/cards/${cardId}/group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Participant-Name': participantName,
    },
    body: JSON.stringify({ target_card_id: targetId }),
  })
}

async function seedAdminToken(): Promise<string | null> {
  // Redis is only accessible inside the Docker network, so we exec into the
  // running backend container and write an admin token directly (matching the
  // `admin_token:{uuid}` key + 24h TTL used in stats.py).
  try {
    const { execSync } = await import('child_process')
    const token = execSync(
      `docker compose exec -T backend python -c "
import asyncio, uuid, os
import redis.asyncio as r
async def main():
    client = r.from_url(os.environ.get('REDIS_URL', 'redis://redis:6379'))
    tok = str(uuid.uuid4())
    await client.set(f'admin_token:{tok}', '1', ex=86400)
    await client.aclose()
    print(tok, end='')
asyncio.run(main())
"`,
      { encoding: 'utf-8', cwd: path.resolve(__dirname, '..') },
    ).trim()
    return token || null
  } catch {
    console.warn('  ⚠ Could not seed admin token — admin stats screenshot skipped')
    return null
  }
}

async function mountSession(
  context: BrowserContext,
  sessionId: string,
  token: string,
  participantName: string,
): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript(
    ({ sid, tok, name }: { sid: string; tok: string; name: string }) => {
      localStorage.setItem(`retro_facilitator_${sid}`, tok)
      localStorage.setItem(`retro_name_${sid}`, name)
    },
    { sid: sessionId, tok: token, name: participantName },
  )
  return page
}

// ── Test: capture all screens ─────────────────────────────────────────────────

test.use({ viewport: VIEWPORT, deviceScaleFactor: 2 })

test('capture all screens', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true })

  // ── 01. Home — light ────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await setTheme(page, 'light')
    await page.goto(BASE)
    await page.waitForSelector('home-page')
    // Fill in sample text so the form looks populated
    const shadow = page.locator('home-page')
    await shadow.locator('input#session-name').fill('Sprint 42 Retro')
    await shadow.locator('input#your-name').fill('Alice')
    await shot(page, '01-home-light.jpg')
    await ctx.close()
  }

  // ── 01. Home — dark ─────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await setTheme(page, 'dark')
    await page.goto(BASE)
    await page.waitForSelector('home-page')
    const shadow = page.locator('home-page')
    await shadow.locator('input#session-name').fill('Sprint 42 Retro')
    await shadow.locator('input#your-name').fill('Alice')
    await shot(page, '01-home-dark.jpg')
    await ctx.close()
  }

  // ── 10. Home — CS brand theme ────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    // Clear any stored brand/theme first so ?theme=cs triggers the brand init
    await page.addInitScript(() => {
      localStorage.removeItem('retro_theme')
      localStorage.removeItem('retro_brand')
    })
    await page.goto(`${BASE}/?theme=cs`)
    await page.waitForSelector('home-page')
    const shadow = page.locator('home-page')
    await shadow.locator('input#session-name').fill('Sprint 42 Retro')
    await shadow.locator('input#your-name').fill('Alice')
    await shot(page, '10-home-cs-theme.jpg')
    await ctx.close()
  }

  // ── Seed a realistic session for board screenshots ──────────────────────────
  const session = await createSession('Sprint 42 Retro', 'Alice')
  await joinSession(session.id, 'Bob')
  await joinSession(session.id, 'Carol')

  const cards: Record<string, string> = {}

  // Went Well
  cards.w1 = (await addCard(session.id, 'Went Well', 'Shipping went smoothly 🚀', 'Alice')).id
  cards.w2 = (await addCard(session.id, 'Went Well', 'Great team collaboration', 'Bob')).id
  cards.w3 = (await addCard(session.id, 'Went Well', 'Tests caught a regression early', 'Carol')).id

  // To Improve
  cards.i1 = (await addCard(session.id, 'To Improve', 'Stand-ups ran too long', 'Alice')).id
  cards.i2 = (await addCard(session.id, 'To Improve', 'Need better deployment docs', 'Bob')).id

  // Action Items
  cards.a1 = (await addCard(session.id, 'Action Items', 'Set up runbooks for deploy', 'Alice')).id
  cards.a2 = (await addCard(session.id, 'Action Items', 'Timebox standups to 15 min', 'Carol')).id

  // ── 02. Board — collecting phase, light ─────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await setTheme(page, 'light')
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Collecting')
    }, { timeout: 8000 })
    await page.waitForTimeout(800) // let cards render
    await shot(page, '02-board-collecting-light.jpg')
    await ctx.close()
  }

  // ── 02. Board — collecting phase, dark ──────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await setTheme(page, 'dark')
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Collecting')
    }, { timeout: 8000 })
    await page.waitForTimeout(800)
    await shot(page, '02-board-collecting-dark.jpg')
    await ctx.close()
  }

  // ── Advance to discussing + publish all + vote ──────────────────────────────
  await setPhase(session.id, session.facilitator_token, 'discussing')

  // Publish all cards
  for (const [key, id] of Object.entries(cards)) {
    const author = key.startsWith('w') ? (key === 'w2' ? 'Bob' : key === 'w3' ? 'Carol' : 'Alice')
      : key.startsWith('i') ? (key === 'i2' ? 'Bob' : 'Alice')
      : (key === 'a2' ? 'Carol' : 'Alice')
    await publishCard(session.id, id, author)
  }

  // Add votes
  await voteCard(session.id, cards.w1, 'Bob')
  await voteCard(session.id, cards.w1, 'Carol')
  await voteCard(session.id, cards.w2, 'Alice')
  await voteCard(session.id, cards.w2, 'Carol')
  await voteCard(session.id, cards.i1, 'Bob')
  await voteCard(session.id, cards.i1, 'Carol')
  await voteCard(session.id, cards.i2, 'Alice')
  await voteCard(session.id, cards.a1, 'Bob')
  await voteCard(session.id, cards.a2, 'Alice')

  // Group two action items
  await groupCards(session.id, cards.a2, cards.a1, 'Alice')

  // ── 03. Board — discussing phase, light ─────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await setTheme(page, 'light')
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Discussing')
    }, { timeout: 8000 })
    await page.waitForTimeout(800)
    await shot(page, '03-board-discussing-light.jpg')
    await ctx.close()
  }

  // ── 03. Board — discussing phase, dark ──────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await setTheme(page, 'dark')
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Discussing')
    }, { timeout: 8000 })
    await page.waitForTimeout(800)
    await shot(page, '03-board-discussing-dark.jpg')
    await ctx.close()
  }

  // ── 05. Settings dialog ──────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await clearTheme(page)
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Discussing')
    }, { timeout: 8000 })
    await page.waitForTimeout(500)
    // Click the gear icon inside the retro-board shadow DOM
    await page.evaluate(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const btn = board?.shadowRoot?.querySelector('button.settings-btn') as HTMLButtonElement
      btn?.click()
    })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      return !!board?.shadowRoot?.querySelector('.settings-overlay')
    }, { timeout: 5000 })
    await shot(page, '05-settings-dialog.jpg')
    await ctx.close()
  }

  // ── 06. Feedback dialog ──────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await clearTheme(page)
    // Wipe feedback flag so the 💬 button is available
    await page.addInitScript(() => {
      // Remove all retro_feedback_v* keys
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('retro_feedback_v')) localStorage.removeItem(key)
      }
    })
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Discussing')
    }, { timeout: 8000 })
    await page.waitForTimeout(400)
    // Click the feedback button in session-page shadow DOM header
    await page.evaluate(() => {
      const sp = document.querySelector('session-page') as any
      const btn = sp?.shadowRoot?.querySelector('button.feedback-btn') as HTMLButtonElement
      btn?.click()
    })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const fd = sp?.shadowRoot?.querySelector('feedback-dialog') as any
      return fd?.open === true
    }, { timeout: 5000 })
    await shot(page, '06-feedback-dialog.jpg')
    await ctx.close()
  }

  // ── Advance to closed phase ──────────────────────────────────────────────────
  await setPhase(session.id, session.facilitator_token, 'closed')

  // ── 04. Board — closed phase ─────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await mountSession(ctx, session.id, session.facilitator_token, 'Alice')
    await clearTheme(page)
    await page.goto(`${BASE}/session/${session.id}`)
    await page.locator('retro-board').waitFor({ state: 'attached' })
    await page.waitForFunction(() => {
      const sp = document.querySelector('session-page') as any
      const board = sp?.shadowRoot?.querySelector('retro-board') as any
      const badge = board?.shadowRoot?.querySelector('.phase-badge')
      return badge?.textContent?.includes('Closed')
    }, { timeout: 8000 })
    await page.waitForTimeout(800)
    await shot(page, '04-board-closed.jpg', true)
    await ctx.close()
  }

  // ── 07. Stats — public ───────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await clearTheme(page)
    await page.goto(`${BASE}/stats`)
    await page.waitForSelector('stats-page')
    await page.waitForTimeout(1500) // D3 charts animate in
    await shot(page, '07-stats-public.jpg', true)
    await ctx.close()
  }

  // ── 08. Stats — admin unlocked ───────────────────────────────────────────────
  {
    const adminToken = await seedAdminToken()
    if (adminToken) {
      const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
      const page = await ctx.newPage()
      await clearTheme(page)
      // Seed the admin token into localStorage so stats-page auto-unlocks
      await page.addInitScript((tok: string) => {
        localStorage.setItem('retro_admin_token', tok)
      }, adminToken)
      await page.goto(`${BASE}/stats`)
      await page.waitForSelector('stats-page')
      await page.waitForTimeout(2000) // admin section loads + charts
      await shot(page, '08-stats-admin.jpg', true)
      await ctx.close()
    } else {
      console.warn('  ⚠ Skipping 08-stats-admin.jpg (no Redis or admin token)')
    }
  }

  // ── 09. Not found page ───────────────────────────────────────────────────────
  // The router renders not-found-page for any unmatched path.
  // A missing session ID redirects to /?session_not_found — capture that too.
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await clearTheme(page)
    await page.goto(`${BASE}/this-page-does-not-exist`)
    await page.waitForSelector('not-found-page')
    await page.waitForTimeout(400)
    await shot(page, '09-not-found.jpg')
    await ctx.close()
  }
})
