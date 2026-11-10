/**
 * Compare every screen of the app with its reference image from the design.
 *
 * Starts the development server, opens each screen at the design size with the app's API answered from the
 * fixtures, saves a screenshot and a difference image, and prints how far each screen is from the design.
 * The exit code is 1 when any compared screen is outside the tolerance, so this is the test for pixel parity:
 * a screen is done when it is within the tolerance.
 *
 * Usage (from frontend/):
 *   npm run parity
 *   npm run parity -- --only board-discussing-light home-dark
 */
import { chromium, type Browser, type Page, type Route } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { CONTEXT_OPTIONS, FIXED_TIME, FREEZE_MOTION_STYLE } from './browser-settings'
import { FIXTURE_APP_VERSION, FIXTURE_SESSION_ID, createApiResponses, createSessionFixture } from './fixtures'
import {
  DEFAULT_CHANNEL_TOLERANCE,
  MAXIMUM_DIFFERENCE_SHARE,
  calculateDifferenceShare,
  createDifferenceRaster,
  isWithinTolerance,
  type Raster,
} from './image-comparison'
import { COMPARED_SCREENS, PENDING_SCREENS, type ParityScreen, type Step } from './screens'
import { COLLECT_TEXT_RECTS } from './geometry'

const PARITY_DIRECTORY = resolve(fileURLToPath(new URL('.', import.meta.url)))
const FRONTEND_DIRECTORY = resolve(PARITY_DIRECTORY, '..')
const REFERENCE_DIRECTORY = join(PARITY_DIRECTORY, 'references')
const OUTPUT_DIRECTORY = join(PARITY_DIRECTORY, 'output')

const APP_PORT = Number(process.env.PARITY_APP_PORT ?? 5199)
const APP_ADDRESS = `http://127.0.0.1:${APP_PORT}`
const SERVER_START_TIMEOUT_MS = 90_000
const SETTLE_MS = 1500

const FACILITATOR_TOKEN = 'parity-facilitator-token'
const CHANGELOG_FIXTURE = readFileSync(join(PARITY_DIRECTORY, 'changelog-fixture.json'), 'utf8')

function storageFor(screen: ParityScreen): Record<string, string> {
  const entries: Record<string, string> = { retro_theme: screen.theme }
  if (!screen.askConsent) entries.retro_analytics_consent = 'denied'
  entries[`retro_feedback_v${FIXTURE_APP_VERSION}`] = 'true'
  if (screen.viewer !== 'visitor') entries[`retro_name_${FIXTURE_SESSION_ID}`] = 'Alice'
  if (screen.viewer === 'facilitator') entries[`retro_facilitator_${FIXTURE_SESSION_ID}`] = FACILITATOR_TOKEN
  if (screen.withHistory) {
    const entry = (id: string, name: string, phase: string, created: string, who: string, facilitator: boolean) => ({
      id, name, phase, created_at: created, participantName: who, isFacilitator: facilitator, joinedAt: created, seenChangelogVersion: '999.0.0',
    })
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
    if (url.hostname !== '127.0.0.1') return route.abort() // nothing leaves this machine
    // the app's own release notes are replaced by the ones the design shows, so the screen does not change with every release
    if (url.pathname.endsWith('/generated/changelog.ts')) {
      return route.fulfill({ contentType: 'text/javascript', body: `export const CHANGELOG = ${CHANGELOG_FIXTURE}` })
    }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    const path = url.pathname.slice('/api/v1'.length)
    if (path === `/sessions/${FIXTURE_SESSION_ID}/stream`) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        body: `retry: 600000\ndata: ${JSON.stringify(session)}\n\n`,
      })
    }
    if (path.startsWith(`/sessions/${FIXTURE_SESSION_ID}`)) return route.fulfill({ json: session })
    if (path === '/stats') return route.fulfill({ json: responses.publicStats })
    if (path === '/stats/auth') return route.fulfill({ json: responses.authToken })
    if (path === '/stats/admin') return route.fulfill({ json: responses.adminStats })
    if (path === '/gifs/status') return route.fulfill({ json: responses.gifsStatus })
    return route.fulfill({ status: 404, json: { detail: 'not part of the parity fixtures' } })
  })
}

async function perform(page: Page, step: Step): Promise<void> {
  if ('click' in step) await page.click(step.click)
  if ('fill' in step) await page.fill(step.fill[0], step.fill[1])
  if ('press' in step) await page.keyboard.press(step.press)
  if ('scroll' in step) await page.locator(step.scroll[0]).evaluate((el, top) => { el.scrollTop = top }, step.scroll[1])
}

async function capture(browser: Browser, screen: ParityScreen, target: string): Promise<void> {
  const [width, height] = screen.size
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, viewport: { width, height }, colorScheme: screen.theme })
  try {
    await context.addInitScript((entries: Record<string, string>) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, storageFor(screen))
    const page = await context.newPage()
    await page.clock.setFixedTime(FIXED_TIME)
    await answerApi(page, screen)
    await page.goto(`${APP_ADDRESS}${screen.route}${screen.brand ? `?theme=${screen.brand}` : ''}`, { waitUntil: 'load' })
    await page.addStyleTag({ content: FREEZE_MOTION_STYLE })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(SETTLE_MS)
    for (const step of screen.steps ?? []) {
      await perform(page, step)
      await page.waitForTimeout(SETTLE_MS)
    }
    await page.mouse.move(0, 0)
    if (process.env.PARITY_GEOMETRY) {
      mkdirSync(process.env.PARITY_GEOMETRY, { recursive: true })
      writeFileSync(join(process.env.PARITY_GEOMETRY, `${screen.name}.app.json`), JSON.stringify(await page.evaluate(COLLECT_TEXT_RECTS)))
    }
    await page.screenshot({ path: target, clip: { x: 0, y: 0, width, height } })
  } finally {
    await context.close()
  }
}

const toRaster = (png: PNG): Raster => ({ width: png.width, height: png.height, data: new Uint8Array(png.data) })

function rasterToFile(raster: Raster, path: string): void {
  const png = new PNG({ width: raster.width, height: raster.height })
  png.data = Buffer.from(raster.data)
  writeFileSync(path, PNG.sync.write(png))
}

type Outcome = { share: number } | { problem: string }

function measure(name: string, screenshotPath: string): Outcome {
  const referencePath = join(REFERENCE_DIRECTORY, `${name}.png`)
  if (!existsSync(referencePath)) return { problem: 'no reference image (run npm run parity:references)' }
  const reference = toRaster(PNG.sync.read(readFileSync(referencePath)))
  const screenshot = toRaster(PNG.sync.read(readFileSync(screenshotPath)))
  if (reference.width !== screenshot.width || reference.height !== screenshot.height) {
    return { problem: `size differs: reference ${reference.width}x${reference.height}, screenshot ${screenshot.width}x${screenshot.height}` }
  }
  rasterToFile(createDifferenceRaster(reference, screenshot, DEFAULT_CHANNEL_TOLERANCE), join(OUTPUT_DIRECTORY, `${name}-difference.png`))
  return { share: calculateDifferenceShare(reference, screenshot, DEFAULT_CHANNEL_TOLERANCE) }
}

function reportLine(name: string, outcome: Outcome): string {
  if ('problem' in outcome) return `${name.padEnd(28)} FAIL  ${outcome.problem}`
  const verdict = isWithinTolerance(outcome.share, MAXIMUM_DIFFERENCE_SHARE) ? 'pass' : 'FAIL'
  return `${name.padEnd(28)} ${(outcome.share * 100).toFixed(4).padStart(8)}% of pixels differ   ${verdict}`
}

async function isResponding(address: string): Promise<boolean> {
  try {
    await fetch(address)
    return true
  } catch {
    return false
  }
}

async function startAppServer(): Promise<ChildProcess> {
  const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(APP_PORT), '--strictPort'], {
    cwd: FRONTEND_DIRECTORY,
    stdio: 'ignore',
    env: { ...process.env, PARITY_APP_VERSION: FIXTURE_APP_VERSION },
  })
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isResponding(APP_ADDRESS)) return server
    await new Promise((done) => setTimeout(done, 500))
  }
  server.kill()
  throw new Error(`${APP_ADDRESS} did not respond within ${SERVER_START_TIMEOUT_MS / 1000} seconds`)
}

function parseArguments(): string[] {
  const args = process.argv.slice(2)
  const at = args.indexOf('--only')
  return at >= 0 ? args.slice(at + 1).filter((a) => !a.startsWith('--')) : []
}

async function main(): Promise<number> {
  const only = parseArguments()
  const screens = COMPARED_SCREENS.filter((s) => !only.length || only.includes(s.name))
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true })

  const server = await startAppServer()
  const browser = await chromium.launch()
  const outcomes: Array<[string, Outcome]> = []
  try {
    for (const screen of screens) {
      const screenshotPath = join(OUTPUT_DIRECTORY, `${screen.name}.png`)
      let outcome: Outcome
      try {
        await capture(browser, screen, screenshotPath)
        outcome = measure(screen.name, screenshotPath)
      } catch (error) {
        outcome = { problem: `could not be captured: ${(error as Error).message.split('\n')[0]}` }
      }
      outcomes.push([screen.name, outcome])
      console.log(reportLine(screen.name, outcome))
    }
  } finally {
    await browser.close()
    server.kill()
  }

  const passed = outcomes.filter(([, o]) => 'share' in o && isWithinTolerance(o.share, MAXIMUM_DIFFERENCE_SHARE)).length
  console.log(`\n${passed} of ${outcomes.length} compared screens match the design.`)
  const pending = PENDING_SCREENS.filter((s) => !only.length || only.includes(s.name))
  if (pending.length) {
    console.log(`\n${pending.length} screens cannot be compared yet:`)
    for (const s of pending) console.log(`  ${s.name.padEnd(28)} ${s.pending}`)
  }
  console.log(`\nTolerance: no pixel may differ by more than ${DEFAULT_CHANNEL_TOLERANCE} on any colour channel.`)
  return passed === outcomes.length ? 0 : 1
}

main().then((code) => process.exit(code))
