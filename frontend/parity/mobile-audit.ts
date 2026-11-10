/**
 * Mobile audit: open every parity screen at phone and tablet sizes and measure what does not fit.
 *
 * Reuses the parity screens (route, viewer, steps) and fixtures, so the data is the same as the design shows.
 * For each screen and size it saves a full-page screenshot and a JSON of measurements:
 *   - horizontal page overflow (the page scrolls sideways)
 *   - visible elements that reach outside the viewport
 *   - tap targets smaller than 32 px
 *   - text smaller than 11 px
 *   - fixed elements that overlap each other
 *
 * Usage (from frontend/):
 *   AUDIT_OUT=<folder> npx tsx parity/mobile-audit.ts
 *   AUDIT_OUT=<folder> npx tsx parity/mobile-audit.ts --widths 390 --only board-discussing-light
 */
import { chromium, type Browser, type Page, type Route } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXTURE_APP_VERSION, FIXTURE_SESSION_ID, createApiResponses, createSessionFixture } from './fixtures'
import { COMPARED_SCREENS, PARITY_SCREENS, type ParityScreen, type Step } from './screens'

const PARITY_DIRECTORY = resolve(fileURLToPath(new URL('.', import.meta.url)))
const FRONTEND_DIRECTORY = resolve(PARITY_DIRECTORY, '..')
const OUT = process.env.AUDIT_OUT ?? join(PARITY_DIRECTORY, 'output', 'mobile')
const PORT = Number(process.env.AUDIT_PORT ?? 5198)
const ADDRESS = `http://127.0.0.1:${PORT}`
const FACILITATOR_TOKEN = 'parity-facilitator-token'
const CHANGELOG_FIXTURE = readFileSync(join(PARITY_DIRECTORY, 'changelog-fixture.json'), 'utf8')
const SETTLE_MS = 700
const CONCURRENCY = 4

const VIEWPORTS: Record<number, number> = { 360: 780, 390: 844, 430: 932, 768: 1024 }

function storageFor(screen: ParityScreen): Record<string, string> {
  const entries: Record<string, string> = { retro_theme: screen.theme }
  if (!screen.askConsent) entries.retro_analytics_consent = 'denied'
  entries[`retro_feedback_v${FIXTURE_APP_VERSION}`] = 'true'
  if (screen.viewer !== 'visitor') entries[`retro_name_${FIXTURE_SESSION_ID}`] = 'Alice'
  if (screen.viewer === 'facilitator') entries[`retro_facilitator_${FIXTURE_SESSION_ID}`] = FACILITATOR_TOKEN
  if (screen.presenting) entries[`retro_present_${FIXTURE_SESSION_ID}`] = 'true'
  const entry = (id: string, name: string, phase: string, created: string, who: string, facilitator: boolean) => ({
    id, name, phase, created_at: created, participantName: who, isFacilitator: facilitator, joinedAt: created, seenChangelogVersion: '999.0.0',
  })
  if (screen.withHistory || screen.askWhatsNew) {
    entries.retro_history = JSON.stringify([
      entry(FIXTURE_SESSION_ID, 'Sprint 42 Retro', 'discussing', '2026-05-05T09:00:00Z', 'Alice', true),
      entry('h2', 'Mad Sad Glad — Q2', 'collecting', '2026-05-02T09:00:00Z', 'Alice', false),
      entry('h3', 'Team offsite', 'closed', '2026-04-18T09:00:00Z', 'Alice', true),
      entry('h4', 'Incident review', 'closed', '2026-04-03T09:00:00Z', 'Bob', false),
    ])
  }
  return entries
}

async function answerApi(page: Page, screen: ParityScreen): Promise<void> {
  const responses = createApiResponses()
  const session = createSessionFixture(screen.board?.phase ?? 'discussing', screen.board?.timer ?? 'none', screen.board?.notes ?? false)
  await page.route('**/*', (route: Route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (url.pathname.endsWith('/generated/changelog.ts')) {
      return route.fulfill({ contentType: 'text/javascript', body: `export const CHANGELOG = ${CHANGELOG_FIXTURE}` })
    }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    const path = url.pathname.slice('/api/v1'.length)
    if (path === `/sessions/${FIXTURE_SESSION_ID}/stream`) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body: `retry: 600000\ndata: ${JSON.stringify(session)}\n\n` })
    }
    if (path.startsWith(`/sessions/${FIXTURE_SESSION_ID}`)) return route.fulfill({ json: session })
    if (path === '/stats') return route.fulfill({ json: responses.publicStats })
    if (path === '/stats/auth') return route.fulfill({ json: responses.authToken })
    if (path === '/stats/admin') return route.fulfill({ json: responses.adminStats })
    if (path === '/gifs/status') return route.fulfill({ json: responses.gifsStatus })
    return route.fulfill({ status: 404, json: { detail: 'not part of the fixtures' } })
  })
}

async function perform(page: Page, step: Step): Promise<void> {
  if ('click' in step) await page.click(step.click, { timeout: 4000 })
  if ('fill' in step) await page.fill(step.fill[0], step.fill[1])
  if ('press' in step) await page.keyboard.press(step.press)
  if ('scroll' in step) await page.locator(step.scroll[0]).evaluate((el, top) => { el.scrollTop = top }, step.scroll[1])
}

/** Runs in the page: walks light and shadow DOM and measures what does not fit. */
const MEASURE = (): unknown => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  type Rect = { x: number; y: number; w: number; h: number }
  const label = (el: Element): string => {
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28)
    return `${el.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ''}`
  }
  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  const visible = (el: Element): boolean => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  // does an ancestor scroll or clip sideways, so reaching outside is intended?
  const clippedByAncestor = (el: Element): boolean => {
    if (getComputedStyle(el).position === 'fixed') return false // a fixed element is not clipped by its ancestors
    let node: Element | null = el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null)
    while (node) {
      const s = getComputedStyle(node)
      if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX) && node.getBoundingClientRect().right <= vw + 1) return true
      node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null)
    }
    return false
  }

  const outside: { el: string; rect: Rect; clipped: boolean }[] = []
  const small: { el: string; rect: Rect }[] = []
  const tinyText: { el: string; size: number }[] = []
  const fixedEls: { el: string; rect: Rect }[] = []
  let interactive = 0
  let elements = 0

  const walk = (root: ParentNode): void => {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      if (el.shadowRoot) walk(el.shadowRoot)
      if (!visible(el)) continue
      elements++
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (s.position === 'fixed' && el.tagName.toLowerCase() !== 'style') {
        // only what is on screen, and not a full-screen scrim
        const onScreen = r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh
        const scrim = r.width >= vw - 1 && r.height >= vh - 1
        if (onScreen && !scrim) fixedEls.push({ el: label(el), rect: rectOf(el) })
      }
      if (r.right > vw + 1 || r.left < -1) {
        if (el.children.length === 0 || ['button', 'a', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase()) || s.position === 'fixed') {
          outside.push({ el: label(el), rect: rectOf(el), clipped: clippedByAncestor(el) })
        }
      }
      const tag = el.tagName.toLowerCase()
      const isControl = ['button', 'a', 'select', 'textarea'].includes(tag) || (tag === 'input' && (el as HTMLInputElement).type !== 'hidden') || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'menuitem' || el.getAttribute('role') === 'radio'
      if (isControl) {
        interactive++
        if (Math.min(r.width, r.height) < 32) small.push({ el: label(el), rect: rectOf(el) })
      }
      const direct = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())
      if (direct) {
        const size = parseFloat(s.fontSize)
        if (size < 11) tinyText.push({ el: label(el), size })
      }
    }
  }
  walk(document)

  const overlaps: { a: string; b: string }[] = []
  for (let i = 0; i < fixedEls.length; i++) {
    for (let j = i + 1; j < fixedEls.length; j++) {
      const a = fixedEls[i].rect
      const b = fixedEls[j].rect
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push({ a: fixedEls[i].el, b: fixedEls[j].el })
    }
  }
  const doc = document.documentElement
  return {
    viewport: { w: vw, h: vh },
    pageScrollWidth: doc.scrollWidth,
    pageOverflowX: Math.max(0, doc.scrollWidth - vw),
    pageHeight: doc.scrollHeight,
    elements,
    interactive,
    outside: outside.filter((o) => !o.clipped),
    outsideClipped: outside.filter((o) => o.clipped).length,
    smallTargets: small,
    tinyText,
    fixed: fixedEls,
    fixedOverlaps: overlaps,
    vh,
  }
}

async function capture(browser: Browser, screen: ParityScreen, width: number, height: number): Promise<void> {
  const context = await browser.newContext({
    viewport: { width, height }, colorScheme: screen.theme, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'UTC',
  })
  const file = `${screen.name}@${width}`
  try {
    await context.addInitScript('window.__name = (fn) => fn') // tsx wraps named functions; the page has no such helper
    await context.addInitScript((entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, storageFor(screen))
    const page = await context.newPage()
    await answerApi(page, screen)
    await page.goto(`${ADDRESS}${screen.route}${screen.brand ? `?theme=${screen.brand}` : ''}`, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(SETTLE_MS)
    const problems: string[] = []
    for (const step of screen.steps ?? []) {
      try {
        await perform(page, step)
      } catch (error) {
        problems.push(`step ${JSON.stringify(step)} failed: ${String(error).split('\n')[0]}`)
      }
      await page.waitForTimeout(SETTLE_MS)
    }
    const measured = await page.evaluate(MEASURE)
    writeFileSync(join(OUT, `${file}.json`), JSON.stringify({ screen: screen.name, width, problems, ...(measured as object) }, null, 1))
    await page.screenshot({ path: join(OUT, `${file}.png`), fullPage: true })
  } catch (error) {
    writeFileSync(join(OUT, `${file}.json`), JSON.stringify({ screen: screen.name, width, error: String(error) }))
  } finally {
    await context.close()
  }
}

async function startServer(): Promise<ChildProcess> {
  const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: FRONTEND_DIRECTORY, stdio: 'ignore', env: { ...process.env, PARITY_APP_VERSION: FIXTURE_APP_VERSION },
  })
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try { await fetch(ADDRESS); return server } catch { await new Promise((done) => setTimeout(done, 500)) }
  }
  server.kill()
  throw new Error(`${ADDRESS} did not respond`)
}

function list(flag: string): string[] {
  const args = process.argv.slice(2)
  const at = args.indexOf(flag)
  if (at < 0) return []
  const out: string[] = []
  for (const a of args.slice(at + 1)) { if (a.startsWith('--')) break; out.push(a) }
  return out
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const only = list('--only')
  const widths = list('--widths').map(Number)
  const everything = process.argv.includes('--both-themes')
  // layout does not change with the theme, so one theme per screen unless it exists in one theme only
  const pool = process.argv.includes('--with-pending') ? PARITY_SCREENS : COMPARED_SCREENS
  const names = new Set(pool.map((s) => s.name))
  const screens = pool.filter((s) => (!only.length || only.includes(s.name)) && (everything || !s.name.endsWith('-dark') || !names.has(s.name.replace(/-dark$/, '-light'))))
  const sizes = Object.entries(VIEWPORTS).filter(([w]) => !widths.length || widths.includes(Number(w))).map(([w, h]) => [Number(w), h] as const)
  const jobs = screens.flatMap((screen) => sizes.map(([w, h]) => () => capture(browser, screen, w, h)))

  const server = await startServer()
  const browser = await chromium.launch()
  try {
    let next = 0
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) { const job = jobs[next++]; await job() }
    }))
  } finally {
    await browser.close()
    server.kill()
  }
  console.log(`audited ${screens.length} screens at ${sizes.map(([w]) => w).join(', ')} px → ${OUT}`)
}

main().catch((error) => { console.error(error); process.exit(1) })
