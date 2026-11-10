/**
 * Render the design's artboards to the reference images for the pixel parity checks.
 *
 * The design is a set of React pages (screens/*.jsx) that live in the design artifact, not in this repository.
 * Pass its project folder with `--designs`. Each artboard is drawn on its own, at its exact size, in a page
 * that can only reach this machine: React and Babel come from a local cache (checked against the integrity
 * hashes the design itself declares), and font requests are answered with the same font files the app uses.
 *
 * Usage:
 *   npx tsx parity/render-references.ts --designs /path/to/design/project [--only home-light board-closed-dark]
 */
import { chromium, type Route } from '@playwright/test'
import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTEXT_OPTIONS, FIXED_TIME, FREEZE_MOTION_STYLE } from './browser-settings'
import { PARITY_SCREENS } from './screens'
import { COLLECT_TEXT_RECTS } from './geometry'

const PARITY_DIRECTORY = resolve(fileURLToPath(new URL('.', import.meta.url)))
const REFERENCE_DIRECTORY = join(PARITY_DIRECTORY, 'references')
const VENDOR_CACHE = join(PARITY_DIRECTORY, '.cache', 'vendor')
const NODE_MODULES = resolve(PARITY_DIRECTORY, '..', 'node_modules')

const FONT_FILES: Array<{ family: string; weight: string; file: string; from: string }> = [
  { family: 'Inter', weight: '100 900', file: 'inter-latin-wght-normal.woff2', from: '@fontsource-variable/inter/files' },
  ...[400, 500, 700, 800].map((w) => ({
    family: 'JetBrains Mono', weight: String(w), file: `jetbrains-mono-latin-${w}-normal.woff2`, from: '@fontsource/jetbrains-mono/files',
  })),
]

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json',
}

async function fetchVendorScript(url: string, integrity: string): Promise<string> {
  mkdirSync(VENDOR_CACHE, { recursive: true })
  const target = join(VENDOR_CACHE, basename(new URL(url).pathname))
  if (!existsSync(target)) writeFileSync(target, Buffer.from(await (await fetch(url)).arrayBuffer()))
  const [algorithm, expected] = integrity.split('-')
  const actual = createHash(algorithm).update(readFileSync(target)).digest('base64')
  if (actual !== expected) {
    rmSync(target)
    throw new Error(`${url} does not match the integrity hash the design declares`)
  }
  return target
}

function buildFontStylesheet(address: string): string {
  return FONT_FILES.map(
    (f) => `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; font-style: normal; src: url('${address}/fonts/${f.file}') format('woff2'); }`,
  ).join('\n')
}

function buildHarness(designHtml: string): string {
  const baseStyle = designHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const scripts = [...designHtml.matchAll(/<script type="text\/babel" src="([^"]+)"><\/script>/g)]
    .map((m) => m[1])
    .filter((src) => !src.endsWith('design-canvas.jsx') && !src.endsWith('handoff.jsx'))
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<style>${baseStyle}</style>
<link rel="stylesheet" href="skin.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
</head><body><div id="root"></div>
<script src="vendor/react.development.js"></script>
<script src="vendor/react-dom.development.js"></script>
<script src="vendor/babel.min.js"></script>
${scripts.map((src) => `<script type="text/babel" src="${src}"></script>`).join('\n')}
<script type="text/babel" src="design-boards.jsx"></script>
<script type="text/babel">
  const q = new URLSearchParams(location.search);
  const Board = window.PARITY_BOARDS[q.get('board')];
  const dark = q.get('dark') === '1';
  const brand = q.get('brand') === '1';
  ReactDOM.createRoot(document.getElementById('root')).render(
    <div className={\`sk sk-ss1 \${brand ? 'sk-cs ' : ''}\${dark ? 'sk-dark' : 'sk-light'}\`}
         style={{ width: +q.get('w'), height: +q.get('h'), position: 'relative', overflow: 'hidden' }}>
      <Board />
    </div>
  );
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__parityReady = true; }));
</script></body></html>`
}

async function assembleSite(site: string, designs: string): Promise<void> {
  const designHtml = readFileSync(join(designs, 'Retrospekt Glass Redesign.html'), 'utf8')
  mkdirSync(join(site, 'screens'), { recursive: true })
  mkdirSync(join(site, 'vendor'), { recursive: true })
  mkdirSync(join(site, 'fonts'), { recursive: true })
  for (const file of readdirSync(join(designs, 'screens'))) copyFileSync(join(designs, 'screens', file), join(site, 'screens', file))
  copyFileSync(join(designs, 'skin.css'), join(site, 'skin.css'))
  copyFileSync(join(PARITY_DIRECTORY, 'design-boards.jsx'), join(site, 'design-boards.jsx'))
  for (const f of FONT_FILES) copyFileSync(join(NODE_MODULES, f.from, f.file), join(site, 'fonts', f.file))
  const vendor: Record<string, string> = {}
  for (const [, url, integrity] of designHtml.matchAll(/<script src="(https:\/\/unpkg\.com\/[^"]+)" integrity="([^"]+)"/g)) {
    vendor[basename(new URL(url).pathname)] = await fetchVendorScript(url, integrity)
  }
  copyFileSync(vendor['react.development.js'], join(site, 'vendor', 'react.development.js'))
  copyFileSync(vendor['react-dom.development.js'], join(site, 'vendor', 'react-dom.development.js'))
  copyFileSync(vendor['babel.min.js'], join(site, 'vendor', 'babel.min.js'))
  writeFileSync(join(site, 'harness.html'), buildHarness(designHtml))
}

function serve(directory: string): Promise<{ address: string; close: () => void }> {
  const server = http.createServer((request, response) => {
    const path = join(directory, decodeURIComponent((request.url ?? '/').split('?')[0]))
    if (!path.startsWith(directory) || !existsSync(path)) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream' })
    createReadStream(path).pipe(response)
  })
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      done({ address: `http://127.0.0.1:${port}`, close: () => server.close() })
    }),
  )
}

function parseArguments(): { designs: string; only: string[] } {
  const args = process.argv.slice(2)
  const designsAt = args.indexOf('--designs')
  const designs = designsAt >= 0 ? args[designsAt + 1] : process.env.RETROSPEKT_DESIGN_DIR
  if (!designs) throw new Error('Pass the design project folder with --designs (or set RETROSPEKT_DESIGN_DIR)')
  const onlyAt = args.indexOf('--only')
  const only = onlyAt >= 0 ? args.slice(onlyAt + 1).filter((a) => !a.startsWith('--')) : []
  return { designs: resolve(designs), only }
}

async function main(): Promise<void> {
  const { designs, only } = parseArguments()
  const site = mkdtempSync(join(tmpdir(), 'retrospekt-design-'))
  await assembleSite(site, designs)
  const { address, close } = await serve(site)
  const fontStylesheet = buildFontStylesheet(address)
  mkdirSync(REFERENCE_DIRECTORY, { recursive: true })

  const browser = await chromium.launch()
  try {
    for (const screen of PARITY_SCREENS.filter((s) => !only.length || only.includes(s.name))) {
      const context = await browser.newContext({ ...CONTEXT_OPTIONS, viewport: { width: screen.size[0], height: screen.size[1] }, colorScheme: screen.theme })
      const page = await context.newPage()
      await page.clock.setFixedTime(FIXED_TIME)
      await page.route('**/*', (route: Route) => {
        const url = route.request().url()
        if (url.startsWith(address)) return route.continue()
        if (url.includes('fonts.googleapis.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: fontStylesheet })
        return route.abort()
      })
      const query = new URLSearchParams({
        board: screen.name, w: String(screen.size[0]), h: String(screen.size[1]),
        dark: screen.theme === 'dark' ? '1' : '0', brand: screen.brand ? '1' : '0',
      })
      await page.goto(`${address}/harness.html?${query}`, { waitUntil: 'load' })
      await page.waitForFunction(() => (window as unknown as { __parityReady?: boolean }).__parityReady === true, undefined, { timeout: 60000 })
      await page.addStyleTag({ content: FREEZE_MOTION_STYLE })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(300)
      if (process.env.PARITY_GEOMETRY) {
        mkdirSync(process.env.PARITY_GEOMETRY, { recursive: true })
        writeFileSync(join(process.env.PARITY_GEOMETRY, `${screen.name}.design.json`), JSON.stringify(await page.evaluate(COLLECT_TEXT_RECTS)))
      }
      await page.screenshot({ path: join(REFERENCE_DIRECTORY, `${screen.name}.png`), clip: { x: 0, y: 0, width: screen.size[0], height: screen.size[1] } })
      console.log('rendered', screen.name)
      await context.close()
    }
  } finally {
    await browser.close()
    close()
    rmSync(site, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
